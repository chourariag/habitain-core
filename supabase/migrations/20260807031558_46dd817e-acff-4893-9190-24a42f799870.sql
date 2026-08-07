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
  SELECT p.auth_user_id INTO _site_user
  FROM public.project_team_members ptm
  JOIN public.profiles p ON p.id = ptm.profile_id
  JOIN public.user_roles ur ON ur.user_id = p.auth_user_id
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

  IF _site_user IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, title, body, content, type, category, related_table, related_id, priority)
    VALUES (_site_user,
            'AMC maintenance ticket assigned',
            'First scheduled maintenance for ' || NEW.client_name || ' has been created.',
            'First scheduled maintenance for ' || NEW.client_name || ' has been created.',
            'amc_maintenance', 'action', 'rm_tickets', _ticket_id, 'normal');
  END IF;

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