ALTER TABLE public.kickoff_meetings ADD COLUMN IF NOT EXISTS meeting_link text;

CREATE OR REPLACE FUNCTION public.confirm_kickoff_meeting(
  _kickoff_id uuid,
  _meeting_date date,
  _meeting_time time,
  _notes text DEFAULT NULL,
  _meeting_link text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _project_id uuid;
  _project_name text;
  _setup_deadline timestamptz;
  _attendees jsonb;
BEGIN
  SELECT (get_user_role(auth.uid()))::text INTO _role;
  IF _role NOT IN ('operations_architect','principal_architect','head_operations','managing_director','super_admin') THEN
    RAISE EXCEPTION 'Only the operations architect, head of operations, principal architect or MD can confirm the kickoff meeting';
  END IF;

  UPDATE public.kickoff_meetings
     SET meeting_date = _meeting_date,
         meeting_time = _meeting_time,
         meeting_notes = COALESCE(_notes, meeting_notes),
         meeting_link = COALESCE(_meeting_link, meeting_link),
         status = 'date_confirmed',
         calendar_invite_sent_at = now()
   WHERE id = _kickoff_id
   RETURNING project_id, project_setup_deadline INTO _project_id, _setup_deadline;

  IF _project_id IS NULL THEN RAISE EXCEPTION 'Kickoff meeting not found'; END IF;

  SELECT name INTO _project_name FROM public.projects WHERE id = _project_id;

  INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
  SELECT ur.user_id,
         'GFC Kickoff Meeting — ' || COALESCE(_project_name,'Project'),
         'Scheduled for ' || to_char(_meeting_date,'DD/MM/YYYY') || ' at ' || to_char(_meeting_time,'HH24:MI') ||
         '. Project Setup Template due by ' || to_char(_setup_deadline,'DD/MM/YYYY HH24:MI') || '.',
         'GFC Kickoff Meeting scheduled. Review the GFC Budget and come prepared to confirm factory schedule and material plan dates.',
         'kickoff_meeting_invite', 'action', 'kickoff_meetings', _kickoff_id, 'high'
  FROM public.user_roles ur
  WHERE ur.role::text IN (
    'operations_architect','planning_engineer','head_of_projects',
    'planning_head','production_head','managing_director','principal_architect'
  );

  SELECT jsonb_agg(DISTINCT jsonb_build_object('user_id', ur.user_id, 'role', ur.role::text, 'email', p.email, 'name', p.display_name))
    INTO _attendees
  FROM public.user_roles ur
  JOIN public.profiles p ON p.auth_user_id = ur.user_id
  WHERE p.is_active IS DISTINCT FROM false
    AND ur.role::text IN (
    'operations_architect','planning_engineer','head_of_projects',
    'planning_head','production_head','managing_director','principal_architect'
  );

  RETURN jsonb_build_object(
    'project_id', _project_id,
    'project_name', _project_name,
    'project_setup_deadline', _setup_deadline,
    'meeting_link', _meeting_link,
    'attendees', COALESCE(_attendees, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_kickoff_meeting(uuid, date, time, text, text) TO authenticated;
DROP FUNCTION IF EXISTS public.confirm_kickoff_meeting(uuid, date, time, text);