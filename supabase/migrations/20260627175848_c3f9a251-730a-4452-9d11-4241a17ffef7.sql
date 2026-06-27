
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
  INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
  SELECT DISTINCT ptm.user_id,
         _project_name || ' is now closed.',
         'The project has been successfully closed and handed over.',
         'The project has been successfully closed and handed over.',
         'project_closed', 'info', 'projects', _project_id
  FROM public.project_team_members ptm
  WHERE ptm.project_id = _project_id AND ptm.user_id IS NOT NULL;

  -- Notify sales_director
  INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
  SELECT ur.user_id,
         _project_name || ' closed. Follow up with client for AMC and referrals.',
         'Project closure follow-up required.',
         'Project closure follow-up required.',
         'amc_followup', 'action', 'projects', _project_id
  FROM public.user_roles ur WHERE ur.role::text = 'sales_director';

  -- Notify finance_manager
  INSERT INTO public.notifications (recipient_id, title, body, content, type, category, related_table, related_id)
  SELECT ur.user_id,
         _project_name || ' closed. Check final retention release.',
         'Final retention release pending review.',
         'Final retention release pending review.',
         'retention_release', 'action', 'projects', _project_id
  FROM public.user_roles ur WHERE ur.role::text = 'finance_manager';
END;
$$;
