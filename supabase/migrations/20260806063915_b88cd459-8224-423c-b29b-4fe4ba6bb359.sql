CREATE OR REPLACE FUNCTION public.confirm_kickoff_meeting(_kickoff_id uuid, _meeting_date date, _meeting_time time without time zone, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _project_id uuid;
  _project_name text;
  _setup_deadline timestamptz;
  _gfc_approved timestamptz;
  _attendees jsonb;
  _deadline_txt text;
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

  SELECT name, gfc_budget_approved_at INTO _project_name, _gfc_approved
    FROM public.projects WHERE id = _project_id;

  -- Backfill a missing setup deadline: 72h after GFC budget approval,
  -- else 72h after the confirmed meeting slot.
  IF _setup_deadline IS NULL THEN
    _setup_deadline := COALESCE(_gfc_approved, (_meeting_date + _meeting_time)::timestamptz) + interval '72 hours';
    UPDATE public.kickoff_meetings
       SET project_setup_deadline = _setup_deadline
     WHERE id = _kickoff_id;
  END IF;

  _deadline_txt := COALESCE(to_char(_setup_deadline, 'DD/MM/YYYY HH24:MI'), 'TBD');

  INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
  SELECT ur.user_id,
         'GFC Kickoff Meeting — ' || COALESCE(_project_name,'Project'),
         'Scheduled for ' || COALESCE(to_char(_meeting_date,'DD/MM/YYYY'),'TBD') || ' at ' ||
         COALESCE(to_char(_meeting_time,'HH24:MI'),'TBD') ||
         '. Project Setup Template due by ' || _deadline_txt || '.',
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
$function$;

CREATE OR REPLACE FUNCTION public.cv_alert_overdue_commitments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; recip RECORD; pname TEXT; msg TEXT; sent INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.client_visits
    WHERE commitments_status = 'open'
      AND created_at < now() - INTERVAL '48 hours'
      AND (last_alerted_at IS NULL OR last_alerted_at < now() - INTERVAL '20 hours')
  LOOP
    SELECT name INTO pname FROM public.projects WHERE id = r.project_id;
    msg := 'Client commitment open for 48+ hours — ' || COALESCE(pname,'project') ||
           ': ' || COALESCE(r.commitments_made,'(no detail recorded)') || '. Logged on ' ||
           COALESCE(to_char(r.visit_date,'DD/MM/YYYY'),'TBD') || '.';
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('head_of_projects','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'client_visit',
              'Open client commitment 48h+', msg, msg,
              '/site-hub?project=' || r.project_id || '&tab=client-visits', 'high');
      sent := sent + 1;
    END LOOP;
    UPDATE public.client_visits SET last_alerted_at = now() WHERE id = r.id;
  END LOOP;
  RETURN sent;
END $function$;

CREATE OR REPLACE FUNCTION public.cv_notify_logged()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pname TEXT; recip RECORD; msg TEXT;
BEGIN
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
  msg := 'Client visit logged — ' || COALESCE(pname,'project') || ' on ' ||
         COALESCE(to_char(NEW.visit_date,'DD/MM/YYYY'),'TBD') || '. Commitments: ' ||
         COALESCE(NEW.commitments_made,'(none recorded)');
  FOR recip IN SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('head_of_projects','production_head','managing_director')
  LOOP
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (recip.auth_user_id, 'info', 'client_visit',
            'Client visit logged', msg, msg,
            '/site-hub?project=' || NEW.project_id || '&tab=client-visits', 'normal');
  END LOOP;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.fire_billing_milestone_event(_project_id uuid, _event text, _event_label text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname text;
  m RECORD;
  recip RECORD;
  msg text;
  finance_msg text;
  fired int := 0;
BEGIN
  SELECT COALESCE(name, 'Project') INTO pname FROM public.projects WHERE id = _project_id;
  pname := COALESCE(pname, 'Project');

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

    msg := pname || ' — ' || COALESCE(m.description,'Milestone') || ' reached. ₹' ||
           COALESCE(to_char(m.amount_incl_gst, 'FM9,99,99,999'), 'TBD') || '.';
    finance_msg := pname || ' — ' || COALESCE(m.description,'Milestone') ||
           ' reached. Review if invoice action required per contract terms.';

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
END$function$;