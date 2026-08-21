
ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS pipeline_lead_id uuid REFERENCES public.sales_pipeline_leads(id);

ALTER TABLE public.sales_pipeline_leads
  ADD COLUMN IF NOT EXISTS ready_to_win boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ready_to_win_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_to_win_deal_id uuid REFERENCES public.sales_deals(id);

CREATE TABLE IF NOT EXISTS public.sales_win_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid REFERENCES public.sales_deals(id),
  lead_id uuid REFERENCES public.sales_pipeline_leads(id),
  project_id uuid REFERENCES public.projects(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sales_win_sync_log TO authenticated;
GRANT ALL ON public.sales_win_sync_log TO service_role;
ALTER TABLE public.sales_win_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read win sync log" ON public.sales_win_sync_log;
CREATE POLICY "Staff can read win sync log" ON public.sales_win_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_win_sync_approver(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'sales_director')
      OR public.has_role(_uid, 'managing_director')
      OR public.has_role(_uid, 'super_admin');
$$;

-- Main confirmation-driven sync. Never auto-creates a project, never forces Won.
CREATE OR REPLACE FUNCTION public.sync_deal_win(
  p_deal_id uuid,
  p_lead_id uuid DEFAULT NULL,          -- confirmed existing pipeline lead
  p_create_lead boolean DEFAULT false,  -- confirmed "not the same person"
  p_project_id uuid DEFAULT NULL,       -- confirmed existing project
  p_division_choice text DEFAULT NULL   -- required when deal.division = 'both'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deal public.sales_deals%ROWTYPE;
  v_lead_id uuid;
  v_division text;
  v_proj_type text;
  v_proj public.projects%ROWTYPE;
  v_segment text;
  v_source text;
  v_rep uuid;
  v_suraj uuid;
BEGIN
  IF NOT public.is_win_sync_approver(v_uid) THEN
    RAISE EXCEPTION 'Only Sales Director, Managing Director or Super Admin can confirm a win sync';
  END IF;

  SELECT * INTO v_deal FROM public.sales_deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;

  v_division := lower(coalesce(nullif(btrim(coalesce(p_division_choice, '')), ''), v_deal.division));
  IF v_division = 'both' THEN
    RAISE EXCEPTION 'Pick Habitainer or ADS for this win before confirming';
  END IF;
  IF v_division NOT IN ('habitainer','ads') THEN
    RAISE EXCEPTION 'Unsupported division: %', v_division;
  END IF;
  v_proj_type := v_division;

  -- 1. Resolve the pipeline lead
  v_lead_id := v_deal.pipeline_lead_id;
  IF v_lead_id IS NULL THEN v_lead_id := p_lead_id; END IF;

  IF v_lead_id IS NULL THEN
    IF NOT p_create_lead THEN
      RAISE EXCEPTION 'Confirm an existing pipeline lead or confirm creation of a new one';
    END IF;
    v_segment := CASE v_deal.client_type
      WHEN 'b2c_home' THEN 'Home'
      WHEN 'b2b_corporate' THEN 'Office'
      WHEN 'resort_hospitality' THEN 'Hospitality'
      ELSE NULL END;
    v_source := CASE
      WHEN v_deal.lead_source IN ('Direct Call','Referral','Other') THEN v_deal.lead_source
      WHEN v_deal.lead_source = 'WhatsApp Marketing' THEN 'WhatsApp'
      WHEN v_deal.lead_source IN ('Instagram','YouTube','Google') THEN 'Ads'
      WHEN v_deal.lead_source IS NULL THEN NULL
      ELSE 'Other' END;
    SELECT id INTO v_rep FROM public.profiles WHERE id = v_deal.assigned_to;

    INSERT INTO public.sales_pipeline_leads
      (client_name, contact, segment, value, sales_rep, source, stage, temperature,
       created_date, last_activity_date, notes, created_by, updated_by)
    VALUES
      (v_deal.client_name, v_deal.contact_number, v_segment,
       coalesce(v_deal.final_agreed_price, v_deal.contract_value, 0), v_rep, v_source,
       'Proposal Sent',
       CASE WHEN lower(coalesce(v_deal.temperature,'warm')) = 'hot' THEN 'Hot' ELSE 'Warm' END,
       current_date, current_date,
       'Created automatically from CRM deal ' || p_deal_id::text || ' on win confirmation.',
       v_uid, v_uid)
    RETURNING id INTO v_lead_id;

    INSERT INTO public.sales_win_sync_log (deal_id, lead_id, action, details, performed_by)
    VALUES (p_deal_id, v_lead_id, 'lead_created',
            jsonb_build_object('client_name', v_deal.client_name, 'division', v_division), v_uid);
  ELSIF v_deal.pipeline_lead_id IS DISTINCT FROM v_lead_id THEN
    INSERT INTO public.sales_win_sync_log (deal_id, lead_id, action, details, performed_by)
    VALUES (p_deal_id, v_lead_id, 'lead_linked',
            jsonb_build_object('confirmed_by_user', true, 'division', v_division), v_uid);
  END IF;

  UPDATE public.sales_deals SET pipeline_lead_id = v_lead_id WHERE id = p_deal_id;

  -- 2. Resolve the project (never created here)
  IF p_project_id IS NOT NULL THEN
    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
    IF lower(coalesce(v_proj.project_type, v_proj.division, '')) <> v_proj_type THEN
      RAISE EXCEPTION 'Project type does not match the % win', v_proj_type;
    END IF;

    UPDATE public.sales_pipeline_leads
      SET project_id = p_project_id, stage = 'Won', last_activity_date = current_date,
          ready_to_win = false, ready_to_win_at = NULL, ready_to_win_deal_id = NULL,
          updated_by = v_uid
      WHERE id = v_lead_id;

    INSERT INTO public.sales_win_sync_log (deal_id, lead_id, project_id, action, details, performed_by)
    VALUES (p_deal_id, v_lead_id, p_project_id, 'project_linked_won',
            jsonb_build_object('division', v_division), v_uid);

    RETURN jsonb_build_object('lead_id', v_lead_id, 'project_id', p_project_id, 'lead_stage', 'Won', 'pending', false);
  END IF;

  -- 3. No project: hold at last real stage, flag, notify planning_head
  UPDATE public.sales_pipeline_leads
    SET ready_to_win = true, ready_to_win_at = now(), ready_to_win_deal_id = p_deal_id,
        last_activity_date = current_date, updated_by = v_uid
    WHERE id = v_lead_id;

  INSERT INTO public.sales_win_sync_log (deal_id, lead_id, action, details, performed_by)
  VALUES (p_deal_id, v_lead_id, 'flagged_ready_to_win',
          jsonb_build_object('division', v_division, 'client_name', v_deal.client_name), v_uid);

  FOR v_suraj IN
    SELECT auth_user_id FROM public.profiles
     WHERE role = 'planning_head' AND is_active AND auth_user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications
      (recipient_id, title, body, content, category, type, priority, navigate_to, related_table, related_id)
    VALUES
      (v_suraj,
       'Ready to Win — awaiting project creation',
       v_deal.client_name || ' has been won in the CRM (' || v_proj_type ||
         '). Raise the project through the normal flow, then link it to this pipeline lead.',
       v_deal.client_name || ' has been won in the CRM (' || v_proj_type || ').',
       'project_setup_approval', 'project_setup_approval', 'high', '/sales', 'sales_pipeline_leads', v_lead_id);

    INSERT INTO public.sales_win_sync_log (deal_id, lead_id, action, details, performed_by)
    VALUES (p_deal_id, v_lead_id, 'notified_planning_head',
            jsonb_build_object('recipient', v_suraj), v_uid);
  END LOOP;

  RETURN jsonb_build_object('lead_id', v_lead_id, 'project_id', NULL, 'pending', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_deal_win(uuid, uuid, boolean, uuid, text) TO authenticated;

-- Completes a pending win automatically once the project is linked later.
CREATE OR REPLACE FUNCTION public.complete_pending_win_on_project_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND OLD.project_id IS NULL AND NEW.ready_to_win THEN
    NEW.stage := 'Won';
    NEW.ready_to_win := false;
    NEW.ready_to_win_at := NULL;
    NEW.last_activity_date := current_date;

    INSERT INTO public.sales_win_sync_log (deal_id, lead_id, project_id, action, details, performed_by)
    VALUES (OLD.ready_to_win_deal_id, NEW.id, NEW.project_id, 'pending_win_completed',
            jsonb_build_object('auto', true), auth.uid());

    NEW.ready_to_win_deal_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_pending_win ON public.sales_pipeline_leads;
CREATE TRIGGER trg_complete_pending_win
  BEFORE UPDATE ON public.sales_pipeline_leads
  FOR EACH ROW EXECUTE FUNCTION public.complete_pending_win_on_project_link();
