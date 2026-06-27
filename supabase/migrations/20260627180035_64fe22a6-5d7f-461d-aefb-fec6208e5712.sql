
-- 1) Add new columns (keep existing trigger_event text label as-is)
ALTER TABLE public.project_billing_milestones
  ADD COLUMN IF NOT EXISTS auto_trigger_event text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS triggered_at timestamptz,
  ADD COLUMN IF NOT EXISTS triggered_by_event text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pbm_auto_trigger_event_check'
  ) THEN
    ALTER TABLE public.project_billing_milestones
      ADD CONSTRAINT pbm_auto_trigger_event_check
      CHECK (auto_trigger_event IN (
        'gfc_h1_approved','gfc_h2_approved','gfc_h3_approved',
        'gfc_budget_approved','project_setup_approved',
        'site_readiness_confirmed','dispatch_confirmed',
        'installation_complete','mep_complete','snagging_complete',
        'handover_approved','manual'
      ));
  END IF;
END$$;

-- 2) Core RPC: fires all pending milestones for an event
CREATE OR REPLACE FUNCTION public.fire_billing_milestone_event(_project_id uuid, _event text, _event_label text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pname text;
  m RECORD;
  recip RECORD;
  msg text;
  finance_msg text;
  fired int := 0;
BEGIN
  SELECT COALESCE(project_name, name, 'Project') INTO pname FROM public.projects WHERE id = _project_id;

  FOR m IN
    SELECT * FROM public.project_billing_milestones
     WHERE project_id = _project_id
       AND auto_trigger_event = _event
       AND status = 'pending'
  LOOP
    UPDATE public.project_billing_milestones
       SET status = 'triggered',
           triggered_at = now(),
           triggered_by_event = COALESCE(_event_label, _event),
           updated_at = now()
     WHERE id = m.id;

    msg := pname || ' — ' || m.description || ' reached. ₹' ||
           to_char(m.amount_incl_gst, 'FM9,99,99,999') || '.';
    finance_msg := pname || ' — ' || m.description ||
           ' reached. Review if invoice action required per contract terms.';

    -- planning_head, sales_director, managing_director (same message)
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true
        AND role IN ('planning_head','sales_director','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'billing',
              'Billing milestone reached', msg, msg,
              '/projects/' || _project_id || '?tab=billing', 'normal');
    END LOOP;

    -- finance_manager (awareness wording)
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role = 'finance_manager'
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'billing',
              'Billing milestone reached', finance_msg, finance_msg,
              '/projects/' || _project_id || '?tab=billing', 'normal');
    END LOOP;

    fired := fired + 1;
  END LOOP;

  RETURN fired;
END$$;

GRANT EXECUTE ON FUNCTION public.fire_billing_milestone_event(uuid, text, text) TO authenticated;

-- 3) Trigger: GFC records issued (H1/H2/H3)
CREATE OR REPLACE FUNCTION public.trg_gfc_fire_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE evt text; lbl text;
BEGIN
  IF NEW.gfc_stage = 'advance_h1' THEN evt := 'gfc_h1_approved'; lbl := 'GFC H1 approved';
  ELSIF NEW.gfc_stage = 'final_h2' THEN evt := 'gfc_h2_approved'; lbl := 'GFC H2 approved';
  ELSIF NEW.gfc_stage = 'interior_h3' THEN evt := 'gfc_h3_approved'; lbl := 'GFC H3 approved';
  ELSE RETURN NEW;
  END IF;
  PERFORM public.fire_billing_milestone_event(NEW.project_id, evt, lbl);
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_gfc_records_fire_billing ON public.gfc_records;
CREATE TRIGGER trg_gfc_records_fire_billing
  AFTER INSERT ON public.gfc_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_gfc_fire_billing();

-- 4) Trigger: project_setup_approved on projects
CREATE OR REPLACE FUNCTION public.trg_project_setup_fire_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.project_setup_approved, false) = false
     AND COALESCE(NEW.project_setup_approved, false) = true THEN
    PERFORM public.fire_billing_milestone_event(NEW.id, 'project_setup_approved', 'Project Setup approved');
  END IF;
  IF COALESCE(OLD.status,'') <> 'closed' AND NEW.status = 'closed' THEN
    PERFORM public.fire_billing_milestone_event(NEW.id, 'handover_approved', 'Handover approved');
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_projects_fire_billing ON public.projects;
CREATE TRIGGER trg_projects_fire_billing
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_project_setup_fire_billing();
