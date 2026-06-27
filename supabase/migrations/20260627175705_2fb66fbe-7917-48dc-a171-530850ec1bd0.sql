
ALTER TABLE public.handover_pack
  ADD COLUMN IF NOT EXISTS client_completion_certificate_url text,
  ADD COLUMN IF NOT EXISTS as_built_drawings_url text,
  ADD COLUMN IF NOT EXISTS qc_reports_url text,
  ADD COLUMN IF NOT EXISTS ncr_records_url text,
  ADD COLUMN IF NOT EXISTS dq_resolutions_url text,
  ADD COLUMN IF NOT EXISTS snagging_list_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatch_records_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS measurement_sheets_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_docs_url text,
  ADD COLUMN IF NOT EXISTS keys_manuals_checklist_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS md_approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS md_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS md_approved_by uuid;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.profiles(id);

-- RPC: check if project has all mandatory items auto-confirmable from HStack
CREATE OR REPLACE FUNCTION public.get_handover_readiness(_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qc_ok boolean;
  ncr_ok boolean;
  dq_ok boolean;
  snag_ok boolean;
  dispatch_ok boolean;
  final_qc_ok boolean;
BEGIN
  -- All NCRs closed
  SELECT NOT EXISTS (
    SELECT 1 FROM public.ncr_register
    WHERE project_id = _project_id AND COALESCE(status,'') <> 'closed'
  ) INTO ncr_ok;

  -- All DQs closed
  SELECT NOT EXISTS (
    SELECT 1 FROM public.design_queries
    WHERE project_id = _project_id AND COALESCE(status,'') NOT IN ('closed','resolved')
  ) INTO dq_ok;

  -- All snags closed
  SELECT NOT EXISTS (
    SELECT 1 FROM public.punch_list_items
    WHERE project_id = _project_id AND COALESCE(status,'') <> 'closed'
  ) INTO snag_ok;

  -- All modules dispatched
  SELECT COALESCE(bool_and(COALESCE(status,'') IN ('dispatched','delivered','installed')), false)
    FROM public.modules WHERE project_id = _project_id
    INTO dispatch_ok;
  IF NOT FOUND THEN dispatch_ok := false; END IF;

  -- QC: every module has at least one passed inspection
  SELECT COALESCE(bool_and(EXISTS (
    SELECT 1 FROM public.qc_inspections qi
    WHERE qi.module_id = m.id AND COALESCE(qi.status,'') = 'passed'
  )), false)
  FROM public.modules m WHERE m.project_id = _project_id
  INTO qc_ok;

  -- Final handover inspection passed
  SELECT EXISTS (
    SELECT 1 FROM public.qc_inspections
    WHERE project_id = _project_id
      AND stage_name = 'final_handover_inspection'
      AND COALESCE(status,'') = 'passed'
  ) INTO final_qc_ok;

  RETURN jsonb_build_object(
    'qc_ok', qc_ok,
    'ncr_ok', ncr_ok,
    'dq_ok', dq_ok,
    'snag_ok', snag_ok,
    'dispatch_ok', dispatch_ok,
    'final_qc_ok', final_qc_ok
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_handover_readiness(uuid) TO authenticated;

-- RPC: MD approves handover and closes project
CREATE OR REPLACE FUNCTION public.approve_handover_and_close(_handover_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _project_id uuid;
  _project_name text;
BEGIN
  SELECT (get_user_role(auth.uid()))::text INTO _role;
  IF _role NOT IN ('managing_director','super_admin') THEN
    RAISE EXCEPTION 'Only managing_director can approve handover';
  END IF;

  SELECT hp.project_id, p.name INTO _project_id, _project_name
  FROM public.handover_pack hp
  JOIN public.projects p ON p.id = hp.project_id
  WHERE hp.id = _handover_id;

  IF _project_id IS NULL THEN RAISE EXCEPTION 'Handover pack not found'; END IF;

  UPDATE public.handover_pack
     SET md_approval_status = 'approved',
         md_approved_at = now(),
         md_approved_by = auth.uid()
   WHERE id = _handover_id;

  UPDATE public.projects
     SET status = 'closed',
         closed_at = now(),
         closed_by = auth.uid()
   WHERE id = _project_id;

  -- Notify team members
  INSERT INTO public.notifications (user_id, title, body, type, project_id)
  SELECT DISTINCT ptm.user_id,
         _project_name || ' is now closed.',
         'The project has been successfully closed and handed over.',
         'project_closed',
         _project_id
  FROM public.project_team_members ptm
  WHERE ptm.project_id = _project_id AND ptm.user_id IS NOT NULL;

  -- Notify sales_director
  INSERT INTO public.notifications (user_id, title, body, type, project_id)
  SELECT ur.user_id,
         _project_name || ' closed. Follow up with client for AMC and referrals.',
         'Project closure follow-up required.',
         'amc_followup',
         _project_id
  FROM public.user_roles ur WHERE ur.role::text = 'sales_director';

  -- Notify finance_manager
  INSERT INTO public.notifications (user_id, title, body, type, project_id)
  SELECT ur.user_id,
         _project_name || ' closed. Check final retention release.',
         'Final retention release pending review.',
         'retention_release',
         _project_id
  FROM public.user_roles ur WHERE ur.role::text = 'finance_manager';
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_handover_and_close(uuid) TO authenticated;
