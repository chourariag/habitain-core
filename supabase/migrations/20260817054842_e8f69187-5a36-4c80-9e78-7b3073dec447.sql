ALTER TABLE public.kickoff_meetings
  ADD COLUMN IF NOT EXISTS cancellation_remarks text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.kickoff_meetings'::regclass
             AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.kickoff_meetings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.kickoff_meetings
  ADD CONSTRAINT kickoff_meetings_status_check
  CHECK (status IN ('pending_initiation','date_confirmed','invite_sent','completed','cancelled'));

CREATE OR REPLACE FUNCTION public.cancel_kickoff_meeting(_kickoff_id uuid, _remarks text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _role text;
  _project_id uuid;
  _project_name text;
BEGIN
  SELECT (get_user_role(auth.uid()))::text INTO _role;
  IF _role NOT IN ('operations_architect','principal_architect','head_operations','managing_director','super_admin') THEN
    RAISE EXCEPTION 'Only the operations architect, head of operations, principal architect or MD can cancel the kickoff meeting';
  END IF;

  IF _remarks IS NULL OR btrim(_remarks) = '' THEN
    RAISE EXCEPTION 'Cancellation remarks are required';
  END IF;

  UPDATE public.kickoff_meetings
     SET status = 'cancelled',
         cancellation_remarks = _remarks,
         cancelled_at = now(),
         cancelled_by = auth.uid()
   WHERE id = _kickoff_id
   RETURNING project_id INTO _project_id;

  IF _project_id IS NULL THEN RAISE EXCEPTION 'Kickoff meeting not found'; END IF;

  SELECT name INTO _project_name FROM public.projects WHERE id = _project_id;

  INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
  SELECT ur.user_id,
         'GFC Kickoff Meeting Cancelled — ' || COALESCE(_project_name,'Project'),
         'The GFC kickoff meeting has been cancelled. Remarks: ' || _remarks,
         'The GFC kickoff meeting has been cancelled. Remarks: ' || _remarks,
         'kickoff_meeting_cancelled', 'action', 'kickoff_meetings', _kickoff_id, 'high'
  FROM public.user_roles ur
  WHERE ur.role::text IN (
    'operations_architect','planning_engineer','head_of_projects',
    'planning_head','production_head','managing_director','principal_architect'
  );

  RETURN jsonb_build_object('project_id', _project_id, 'project_name', _project_name);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_kickoff_meeting(uuid, text) TO authenticated;