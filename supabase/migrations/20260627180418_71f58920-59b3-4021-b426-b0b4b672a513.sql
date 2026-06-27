
-- 1) Trigger on projects: when status transitions to 'closed', create AMC follow-up task & notify
CREATE OR REPLACE FUNCTION public.trg_project_closure_amc_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _client_name text;
  _task_id uuid;
BEGIN
  IF NEW.status = 'closed' AND COALESCE(OLD.status,'') <> 'closed' THEN
    _client_name := COALESCE(NEW.client_name, 'Client');

    -- Create follow-up task
    INSERT INTO public.project_tasks(
      project_id, task_id_in_schedule, task_name, phase, status,
      planned_start_date, planned_finish_date, responsible_role,
      remarks, completion_percentage
    ) VALUES (
      NEW.id,
      'AMC-FU-' || substr(NEW.id::text,1,8),
      'Follow up with ' || _client_name || ' for AMC and referrals',
      'Post-Production',
      'Pending',
      CURRENT_DATE,
      CURRENT_DATE + 7,
      'sales_director',
      NEW.name || ' has been closed. Contact the client to discuss Annual Maintenance Contract and request referrals.',
      0
    )
    RETURNING id INTO _task_id;

    -- Notify sales_director(s)
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           NEW.name || ' closed — AMC follow-up required',
           'Action: Follow up with ' || _client_name || ' for AMC within 7 days.',
           'Action: Follow up with ' || _client_name || ' for AMC within 7 days.',
           'amc_followup_task', 'action', 'project_tasks', _task_id, 'high'
    FROM public.user_roles ur
    WHERE ur.role::text = 'sales_director';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_closure_amc_followup ON public.projects;
CREATE TRIGGER trg_project_closure_amc_followup
AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.trg_project_closure_amc_followup();

-- 2) Trigger on amc_contracts insert: create first R&M maintenance ticket + notify production_head
CREATE OR REPLACE FUNCTION public.trg_amc_contract_first_maintenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ticket_id uuid;
  _site_user uuid;
BEGIN
  -- Find a site_installation_mgr or site_engineer on the project team (preferred), else any with that role
  SELECT ptm.user_id INTO _site_user
  FROM public.project_team_members ptm
  JOIN public.user_roles ur ON ur.user_id = ptm.user_id
  WHERE ptm.project_id = NEW.project_id
    AND ur.role::text IN ('site_installation_mgr','site_engineer')
  LIMIT 1;

  IF _site_user IS NULL THEN
    SELECT ur.user_id INTO _site_user
    FROM public.user_roles ur
    WHERE ur.role::text IN ('site_installation_mgr','site_engineer')
    LIMIT 1;
  END IF;

  INSERT INTO public.rm_tickets(
    project_id, client_name, issue_description, priority, status, raised_by, visit_scheduled_date
  ) VALUES (
    NEW.project_id,
    NEW.client_name,
    'First scheduled AMC maintenance visit (auto-created from AMC contract ' || NEW.id::text || ')',
    'standard',
    'open',
    COALESCE(NEW.created_by, auth.uid()),
    CURRENT_DATE + 30
  ) RETURNING id INTO _ticket_id;

  -- Notify site installation manager / engineer
  IF _site_user IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    VALUES (_site_user,
            'AMC maintenance ticket assigned',
            'First scheduled maintenance for ' || NEW.client_name || ' has been created.',
            'First scheduled maintenance for ' || NEW.client_name || ' has been created.',
            'amc_maintenance', 'action', 'rm_tickets', _ticket_id, 'normal');
  END IF;

  -- Notify production_head (awareness)
  INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
  SELECT ur.user_id,
         'New AMC contract: ' || NEW.client_name,
         'AMC contract created and first maintenance ticket scheduled.',
         'AMC contract created and first maintenance ticket scheduled.',
         'amc_contract_created', 'info', 'amc_contracts', NEW.id, 'normal'
  FROM public.user_roles ur WHERE ur.role::text = 'production_head';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amc_contract_first_maintenance ON public.amc_contracts;
CREATE TRIGGER trg_amc_contract_first_maintenance
AFTER INSERT ON public.amc_contracts
FOR EACH ROW EXECUTE FUNCTION public.trg_amc_contract_first_maintenance();

-- 3) Daily reminder function for AMC follow-up tasks
CREATE OR REPLACE FUNCTION public.amc_followup_daily_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _t record;
  _age_days int;
BEGIN
  FOR _t IN
    SELECT pt.id, pt.project_id, pt.task_name, pt.created_at,
           p.name AS project_name, p.client_name
    FROM public.project_tasks pt
    JOIN public.projects p ON p.id = pt.project_id
    WHERE pt.task_id_in_schedule LIKE 'AMC-FU-%'
      AND pt.status NOT IN ('Completed','Done','Closed')
      AND pt.created_at < now() - interval '7 days'
  LOOP
    _age_days := EXTRACT(DAY FROM (now() - _t.created_at))::int;

    -- Daily reminder to sales_director (after 7 days)
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    SELECT ur.user_id,
           'Reminder: AMC follow-up pending (' || _age_days || ' days)',
           'Please follow up with ' || COALESCE(_t.client_name,'client') || ' for ' || _t.project_name || '.',
           'Please follow up with ' || COALESCE(_t.client_name,'client') || ' for ' || _t.project_name || '.',
           'amc_followup_reminder', 'action', 'project_tasks', _t.id, 'high'
    FROM public.user_roles ur WHERE ur.role::text = 'sales_director';

    -- After 14 days, notify MD
    IF _age_days >= 14 THEN
      INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
      SELECT ur.user_id,
             'AMC follow-up overdue: ' || _t.project_name,
             'Sales has not completed AMC follow-up for ' || COALESCE(_t.client_name,'client') || ' (' || _age_days || ' days).',
             'Sales has not completed AMC follow-up for ' || COALESCE(_t.client_name,'client') || ' (' || _age_days || ' days).',
             'amc_followup_escalation', 'action', 'project_tasks', _t.id, 'critical'
      FROM public.user_roles ur WHERE ur.role::text = 'managing_director';
    END IF;
  END LOOP;
END;
$$;
