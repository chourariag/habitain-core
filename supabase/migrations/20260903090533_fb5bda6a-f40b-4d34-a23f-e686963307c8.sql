-- 1. Client portal timeline -> live design schedule
DROP FUNCTION IF EXISTS public.get_design_stages_by_portal_token(uuid);

CREATE FUNCTION public.get_design_stages_by_portal_token(_token uuid)
RETURNS TABLE(
  id uuid,
  stage_code text,
  stage_name text,
  stage_order integer,
  stage_group text,
  status text,
  planned_start_date date,
  planned_end_date date,
  actual_date date,
  deliverable_url text,
  deliverable_required boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pid UUID;
BEGIN
  BEGIN
    SELECT project_id INTO pid FROM public.client_portal_tokens
    WHERE token = _token::uuid AND is_active = true
      AND (expires_at IS NULL OR expires_at > now()) LIMIT 1;
  EXCEPTION WHEN OTHERS THEN pid := NULL; END;

  IF pid IS NULL THEN
    SELECT p.id INTO pid FROM public.projects p
    WHERE p.client_portal_token = _token
      AND p.client_portal_enabled = true
      AND (p.client_portal_expires_at IS NULL OR p.client_portal_expires_at > now())
    LIMIT 1;
  END IF;

  IF pid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT pds.id,
         d.stage_code,
         d.stage_name,
         d.stage_order,
         d.stage_group,
         pds.status,
         pds.planned_start_date,
         COALESCE(pds.planned_end_date, pds.planned_date),
         pds.actual_date,
         pds.deliverable_url,
         d.deliverable_required
  FROM public.project_design_stages pds
  JOIN public.design_stage_definitions d ON d.id = pds.stage_definition_id
  WHERE pds.project_id = pid
    AND d.is_combined_child IS NOT TRUE
  ORDER BY d.stage_order;
END
$function$;

-- 2. Retire the old client-portal write RPCs (they wrote into the dead table)
DROP FUNCTION IF EXISTS public.client_approve_design_stage(uuid, uuid);
DROP FUNCTION IF EXISTS public.client_request_design_changes(uuid, uuid, text);

-- 3. Port the GFC Budget -> kickoff meeting automation onto the live table
CREATE OR REPLACE FUNCTION public.trg_pds_gfc_budget_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _code text;
  _approved_at timestamptz;
  _project_name text;
  _ops_user uuid;
  _kickoff_id uuid;
BEGIN
  IF COALESCE(current_setting('hstack.backfill', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.completion_type, 'live') <> 'live' THEN
    RETURN NEW;
  END IF;

  SELECT d.stage_code INTO _code
  FROM public.design_stage_definitions d
  WHERE d.id = NEW.stage_definition_id;

  IF _code = 'E-8'
     AND NEW.status = 'Completed'
     AND COALESCE(OLD.status, '') <> 'Completed'
  THEN
    _approved_at := now();

    UPDATE public.projects
       SET gfc_budget_approved_at = _approved_at
     WHERE id = NEW.project_id
     RETURNING name INTO _project_name;

    IF EXISTS (SELECT 1 FROM public.kickoff_meetings WHERE project_id = NEW.project_id) THEN
      RETURN NEW;
    END IF;

    SELECT ur.user_id INTO _ops_user
    FROM public.user_roles ur
    WHERE ur.role::text = 'operations_architect'
    LIMIT 1;

    INSERT INTO public.kickoff_meetings(
      project_id, task_assigned_to_id, kickoff_deadline, project_setup_deadline, status
    ) VALUES (
      NEW.project_id, _ops_user, _approved_at + interval '24 hours',
      _approved_at + interval '72 hours', 'pending_initiation'
    ) RETURNING id INTO _kickoff_id;

    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           'Initiate GFC Kickoff Meeting — ' || COALESCE(_project_name, 'Project'),
           'GFC complete for ' || COALESCE(_project_name, 'project') || '. Initiate kickoff meeting within 24 hours.',
           'GFC complete for ' || COALESCE(_project_name, 'project') || '. Initiate kickoff meeting within 24 hours.',
           'kickoff_meeting_initiate', 'action', 'kickoff_meetings', _kickoff_id, 'high'
    FROM public.user_roles ur WHERE ur.role::text = 'operations_architect';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_pds_gfc_budget_complete ON public.project_design_stages;
CREATE TRIGGER trg_pds_gfc_budget_complete
AFTER INSERT OR UPDATE ON public.project_design_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_pds_gfc_budget_complete();

-- 4. Remove old-system triggers and functions
DROP TRIGGER IF EXISTS trg_design_stage_gfc_budget_complete ON public.design_stages;
DROP TRIGGER IF EXISTS trg_design_stage_transition_guard ON public.design_stages;
DROP FUNCTION IF EXISTS public.trg_design_stage_gfc_budget_complete();
DROP FUNCTION IF EXISTS public.design_stage_transition_guard();
DROP FUNCTION IF EXISTS public.initialize_design_stages_v13(uuid, date);
DROP FUNCTION IF EXISTS public.recalculate_design_stage_dates(uuid);

-- 5. Make the old table dormant: no policies, no grants for app roles
DROP POLICY IF EXISTS "Architects can delete design stages" ON public.design_stages;
DROP POLICY IF EXISTS "Architects can insert design_stages" ON public.design_stages;
DROP POLICY IF EXISTS "Architects can update design_stages" ON public.design_stages;
DROP POLICY IF EXISTS "Authenticated can view design_stages" ON public.design_stages;
ALTER TABLE public.design_stages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.design_stages FROM anon;
REVOKE ALL ON public.design_stages FROM authenticated;
REVOKE ALL ON public.design_stages FROM service_role;

COMMENT ON TABLE public.design_stages IS 'RETIRED 2026-09-03. Superseded by project_design_stages + design_stage_definitions. Dormant archive: no policies, no grants, no code paths. Do not read or write.';