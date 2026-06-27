
-- 1) Table
CREATE TABLE IF NOT EXISTS public.kickoff_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_assigned_to_role text NOT NULL DEFAULT 'operations_architect',
  task_assigned_to_id uuid,
  kickoff_deadline timestamptz NOT NULL,
  project_setup_deadline timestamptz,
  meeting_date date,
  meeting_time time,
  meeting_notes text,
  status text NOT NULL DEFAULT 'pending_initiation'
    CHECK (status IN ('pending_initiation','date_confirmed','invite_sent','completed')),
  calendar_invite_sent_at timestamptz,
  reminder_last_sent_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kickoff_meetings TO authenticated;
GRANT ALL ON public.kickoff_meetings TO service_role;

ALTER TABLE public.kickoff_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view kickoff_meetings" ON public.kickoff_meetings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Architects manage kickoff_meetings" ON public.kickoff_meetings
  FOR INSERT TO authenticated WITH CHECK (
    (get_user_role(auth.uid()))::text = ANY (ARRAY['super_admin','managing_director','principal_architect','operations_architect','head_operations'])
  );

CREATE POLICY "Architects update kickoff_meetings" ON public.kickoff_meetings
  FOR UPDATE TO authenticated USING (
    (get_user_role(auth.uid()))::text = ANY (ARRAY['super_admin','managing_director','principal_architect','operations_architect','head_operations'])
  );

CREATE POLICY "Admins delete kickoff_meetings" ON public.kickoff_meetings
  FOR DELETE TO authenticated USING (
    (get_user_role(auth.uid()))::text = ANY (ARRAY['super_admin','managing_director'])
  );

CREATE TRIGGER trg_kickoff_meetings_updated_at
  BEFORE UPDATE ON public.kickoff_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Trigger on design_stages: GFC Budget Submission complete
CREATE OR REPLACE FUNCTION public.trg_design_stage_gfc_budget_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approved_at timestamptz;
  _project_name text;
  _ops_user uuid;
  _kickoff_id uuid;
  _kickoff_deadline timestamptz;
  _setup_deadline timestamptz;
BEGIN
  IF NEW.stage_name = 'GFC Budget Submission'
     AND NEW.status = 'complete'
     AND NEW.deliverable_url IS NOT NULL
     AND (COALESCE(OLD.status,'') <> 'complete' OR OLD.deliverable_url IS NULL)
  THEN
    _approved_at := now();
    _kickoff_deadline := _approved_at + interval '24 hours';
    _setup_deadline := _approved_at + interval '72 hours';

    UPDATE public.projects
       SET gfc_budget_approved_at = _approved_at
     WHERE id = NEW.project_id
     RETURNING name INTO _project_name;

    -- Skip if a kickoff meeting already exists for this project
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
      NEW.project_id, _ops_user, _kickoff_deadline, _setup_deadline, 'pending_initiation'
    ) RETURNING id INTO _kickoff_id;

    -- Notify operations_architect(s)
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           'Initiate GFC Kickoff Meeting — ' || COALESCE(_project_name,'Project'),
           'GFC complete for ' || COALESCE(_project_name,'project') || '. Initiate kickoff meeting within 24 hours.',
           'GFC complete for ' || COALESCE(_project_name,'project') || '. Initiate kickoff meeting within 24 hours.',
           'kickoff_meeting_initiate', 'action', 'kickoff_meetings', _kickoff_id, 'high'
    FROM public.user_roles ur WHERE ur.role::text = 'operations_architect';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_design_stage_gfc_budget_complete ON public.design_stages;
CREATE TRIGGER trg_design_stage_gfc_budget_complete
AFTER UPDATE ON public.design_stages
FOR EACH ROW EXECUTE FUNCTION public.trg_design_stage_gfc_budget_complete();

-- 3) RPC to confirm meeting date/time and notify attendees
CREATE OR REPLACE FUNCTION public.confirm_kickoff_meeting(
  _kickoff_id uuid,
  _meeting_date date,
  _meeting_time time,
  _notes text DEFAULT NULL
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
  IF _role NOT IN ('operations_architect','principal_architect','managing_director','super_admin') THEN
    RAISE EXCEPTION 'Only the operations architect can confirm the kickoff meeting';
  END IF;

  UPDATE public.kickoff_meetings
     SET meeting_date = _meeting_date,
         meeting_time = _meeting_time,
         meeting_notes = COALESCE(_notes, meeting_notes),
         status = 'date_confirmed',
         calendar_invite_sent_at = now()
   WHERE id = _kickoff_id
   RETURNING project_id, project_setup_deadline INTO _project_id, _setup_deadline;

  IF _project_id IS NULL THEN RAISE EXCEPTION 'Kickoff meeting not found'; END IF;

  SELECT name INTO _project_name FROM public.projects WHERE id = _project_id;

  -- Notify all 7 attendees
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
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role::text IN (
    'operations_architect','planning_engineer','head_of_projects',
    'planning_head','production_head','managing_director','principal_architect'
  );

  RETURN jsonb_build_object(
    'project_id', _project_id,
    'project_name', _project_name,
    'meeting_date', _meeting_date,
    'meeting_time', _meeting_time,
    'project_setup_deadline', _setup_deadline,
    'attendees', _attendees
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_kickoff_meeting(uuid, date, time, text) TO authenticated;

-- 4) Daily reminder + escalation
CREATE OR REPLACE FUNCTION public.kickoff_meeting_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _k record;
BEGIN
  FOR _k IN
    SELECT km.id, km.project_id, km.kickoff_deadline, km.escalated_at, p.name AS project_name
    FROM public.kickoff_meetings km
    JOIN public.projects p ON p.id = km.project_id
    WHERE km.status = 'pending_initiation'
      AND km.kickoff_deadline < now()
  LOOP
    -- Daily reminder to operations_architect
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           'Reminder: GFC Kickoff Meeting overdue — ' || _k.project_name,
           'Please confirm a meeting date for ' || _k.project_name || '.',
           'Kickoff meeting initiation is overdue.',
           'kickoff_meeting_reminder', 'action', 'kickoff_meetings', _k.id, 'high'
    FROM public.user_roles ur WHERE ur.role::text = 'operations_architect';

    -- Escalate to principal_architect (once)
    IF _k.escalated_at IS NULL THEN
      INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
      SELECT ur.user_id,
             'Escalation: Kickoff meeting overdue — ' || _k.project_name,
             'Operations architect has not confirmed a kickoff date within 24 hours.',
             'Operations architect has not confirmed a kickoff date within 24 hours.',
             'kickoff_meeting_escalation', 'action', 'kickoff_meetings', _k.id, 'critical'
      FROM public.user_roles ur WHERE ur.role::text = 'principal_architect';

      UPDATE public.kickoff_meetings SET escalated_at = now() WHERE id = _k.id;
    END IF;

    UPDATE public.kickoff_meetings SET reminder_last_sent_at = now() WHERE id = _k.id;
  END LOOP;
END;
$$;
