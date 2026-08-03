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

CREATE OR REPLACE FUNCTION public.client_approve_design_stage(_token uuid, _stage_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pid UUID;
  stage RECORD;
  pname TEXT;
  cname TEXT;
  recip RECORD;
BEGIN
  pid := public._cpt_validate(_token);
  IF pid IS NULL THEN RETURN false; END IF;

  SELECT * INTO stage FROM public.design_stages WHERE id = _stage_id AND project_id = pid;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.design_stages
     SET status = 'client_approved',
         approval_date = CURRENT_DATE,
         approval_method = 'client_portal',
         actual_end_date = COALESCE(actual_end_date, CURRENT_DATE),
         updated_at = now()
   WHERE id = _stage_id;

  SELECT name INTO pname FROM public.projects WHERE id = pid;
  SELECT client_name INTO cname FROM public.client_portal_tokens WHERE token = _token LIMIT 1;

  FOR recip IN
    SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('operations_architect','principal_architect')
  LOOP
    INSERT INTO public.notifications(recipient_id, category, title, message, navigate_to, priority)
    VALUES (recip.auth_user_id, 'approval',
            'Client approved design stage',
            COALESCE(cname,'Client') || ' approved "' || stage.stage_name || '" for ' || COALESCE(pname,'project') || '.',
            '/projects/' || pid || '/design',
            'normal');
  END LOOP;

  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.client_request_design_changes(_token uuid, _stage_id uuid, _comment text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pid UUID;
  stage RECORD;
  pname TEXT;
  cname TEXT;
  recip RECORD;
BEGIN
  pid := public._cpt_validate(_token);
  IF pid IS NULL THEN RETURN false; END IF;
  IF _comment IS NULL OR length(trim(_comment)) = 0 THEN RETURN false; END IF;

  SELECT * INTO stage FROM public.design_stages WHERE id = _stage_id AND project_id = pid;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.design_stages
     SET status = 'revision_requested',
         revision_comments = _comment,
         updated_at = now()
   WHERE id = _stage_id;

  SELECT name INTO pname FROM public.projects WHERE id = pid;
  SELECT client_name INTO cname FROM public.client_portal_tokens WHERE token = _token LIMIT 1;

  FOR recip IN
    SELECT auth_user_id FROM public.profiles
    WHERE is_active = true AND role IN ('operations_architect','principal_architect','project_architect')
  LOOP
    INSERT INTO public.notifications(recipient_id, category, title, message, navigate_to, priority)
    VALUES (recip.auth_user_id, 'approval',
            'Client requested design changes',
            COALESCE(cname,'Client') || ' requested changes on "' || stage.stage_name || '" (' || COALESCE(pname,'project') || '): ' || _comment,
            '/projects/' || pid || '/design',
            'high');
  END LOOP;

  RETURN true;
END $function$;

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
           ': ' || r.commitments_made || '. Logged on ' || to_char(r.visit_date,'DD/MM/YYYY') || '.';
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
         to_char(NEW.visit_date,'DD/MM/YYYY') || '. Commitments: ' || NEW.commitments_made;
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

CREATE OR REPLACE FUNCTION public.get_project_by_client_portal_token(_token uuid)
 RETURNS TABLE(project_id uuid, project_name text, project_code text, client_name text, client_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
BEGIN
  SELECT t.*, p.name AS pname, NULL::text AS pcode
    INTO rec
  FROM public.client_portal_tokens t
  JOIN public.projects p ON p.id = t.project_id
  WHERE t.token = _token
    AND t.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.client_portal_tokens
    SET last_accessed_at = now()
    WHERE id = rec.id;

  project_id := rec.project_id;
  project_name := rec.pname;
  project_code := rec.pcode;
  client_name := rec.client_name;
  client_email := rec.client_email;
  RETURN NEXT;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_costing_on_measurement_submit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  msg TEXT;
  recip RECORD;
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
    msg := 'Daily measurement submitted for ' || COALESCE(pname,'project') || '. Review WIP.';
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','production_head','head_operations','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'measurement',
              'Daily measurement submitted',
              msg, msg,
              '/production?project=' || NEW.project_id || '&tab=measurement',
              'normal');
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.qr_notify_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  recip RECORD;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;

  IF NEW.status = 'indent_pending' THEN
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'quotation',
              'Indent awaiting approval',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' indent needs approval vs BOQ rate.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' indent needs approval vs BOQ rate.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END LOOP;

  ELSIF NEW.status = 'indent_approved' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'success', 'quotation',
            'Indent approved — collect vendor quotes',
            'Indent for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || ' is approved. You can now upload vendor quotes.',
            'Indent for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || ' is approved. You can now upload vendor quotes.',
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'indent_rejected' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'warning', 'quotation',
            'Indent rejected',
            'Indent rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.indent_rejection_reason,'(none)'),
            'Indent rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.indent_rejection_reason,'(none)'),
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'under_review' THEN
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'quotation',
              'Quotation awaiting review',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' is ready for review.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' is ready for review.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END LOOP;
    IF NEW.quotes_received_count < NEW.minimum_quotes_required THEN
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('planning_head','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'warning', 'quotation',
                'Quotation below minimum quotes',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '.',
                COALESCE(pname,'Project') || ' — ' || NEW.line_item_description || ' has only ' ||
                  NEW.quotes_received_count || ' quote(s) instead of minimum ' || NEW.minimum_quotes_required ||
                  '. Reason: ' || COALESCE(NEW.remarks,'(none)') || '.',
                '/procurement?tab=quotations&request=' || NEW.id,
                'high');
      END LOOP;
    END IF;

  ELSIF NEW.status = 'approved' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'success', 'quotation',
            'Vendor selection approved',
            'Approved for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Create PO in Tally.',
            'Approved for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Create PO in Tally.',
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'rejected' AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
    VALUES (NEW.created_by, 'warning', 'quotation',
            'Quotation rejected',
            'Rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)'),
            'Rejected for ' || COALESCE(pname,'project') || ' — ' || NEW.line_item_description || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)'),
            '/procurement?tab=quotations&request=' || NEW.id,
            'high');

  ELSIF NEW.status = 'escalated' THEN
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('planning_head','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'quotation',
              'Quotation escalated to Planning Head',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' has completed 2 re-quote rounds without an acceptable vendor. Final decision required.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' has completed 2 re-quote rounds without an acceptable vendor. Final decision required.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'high');
    END LOOP;
    IF NEW.created_by IS NOT NULL THEN
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (NEW.created_by, 'warning', 'quotation',
              'Quotation escalated',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' escalated to Planning Head after 2 re-quote rounds.',
              COALESCE(pname,'Project') || ' — ' || NEW.line_item_description ||
                ' escalated to Planning Head after 2 re-quote rounds.',
              '/procurement?tab=quotations&request=' || NEW.id,
              'normal');
    END IF;
  END IF;

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.site_schedule_dispatch_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record; recip record; pname text; sent int := 0;
  dispatch_date date; days_to_dispatch int; has_uploaded boolean;
BEGIN
  FOR r IN
    SELECT p.id AS project_id, p.name AS project_name,
           (SELECT MIN(planned_end) FROM public.project_stages
              WHERE project_id = p.id AND stage_number = 15) AS planned_dispatch
    FROM public.projects p
    WHERE COALESCE(p.is_archived,false) = false
  LOOP
    dispatch_date := r.planned_dispatch;
    IF dispatch_date IS NULL THEN CONTINUE; END IF;
    days_to_dispatch := dispatch_date - CURRENT_DATE;
    IF days_to_dispatch > 14 OR days_to_dispatch < 0 THEN CONTINUE; END IF;

    SELECT EXISTS (SELECT 1 FROM public.site_schedules
                    WHERE project_id = r.project_id
                      AND status IN ('pending_approval','approved'))
      INTO has_uploaded;
    IF has_uploaded THEN CONTINUE; END IF;

    pname := r.project_name;
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active=true AND role IN ('planning_engineer','planning_head')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'warning', 'site_schedule',
              'Upload Site Schedule',
              'Dispatch is in ' || days_to_dispatch || ' days for ' || COALESCE(pname,'project') || '. Upload Site Schedule now.',
              'Dispatch is in ' || days_to_dispatch || ' days for ' || COALESCE(pname,'project') || '. Upload Site Schedule now.',
              '/projects/' || r.project_id || '?tab=schedule',
              CASE WHEN days_to_dispatch <= 7 THEN 'high' ELSE 'normal' END);
      sent := sent + 1;
    END LOOP;
  END LOOP;
  RETURN sent;
END $function$;

CREATE OR REPLACE FUNCTION public.smr_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pname TEXT;
  recip RECORD;
  recent_count INT;
  msg TEXT;
BEGIN
  SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;

  IF TG_OP = 'INSERT' THEN
    msg := 'Special material request — ' || COALESCE(pname,'project') || ': ' ||
           NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit ||
           '. Reason: ' || NEW.reason ||
           CASE WHEN NEW.urgency = 'urgent' THEN ' [URGENT]' ELSE '' END;
    FOR recip IN SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('production_head','managing_director','head_operations')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id,
              CASE WHEN NEW.urgency='urgent' THEN 'warning' ELSE 'info' END,
              'material', 'Special material request', msg, msg,
              '/production?project=' || NEW.project_id || '&tab=special-materials',
              CASE WHEN NEW.urgency='urgent' THEN 'high' ELSE 'normal' END);
    END LOOP;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      msg := 'Special material approved — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit || '. Please issue.';
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('stores_executive','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'success', 'material',
                'Issue special material', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'high');
      END LOOP;
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'success', 'material',
                'Special material request approved', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;

      SELECT count(*) INTO recent_count
        FROM public.special_material_requests
        WHERE project_id = NEW.project_id
          AND status = 'approved'
          AND approved_at >= now() - INTERVAL '30 days';
      IF recent_count > 3 THEN
        FOR recip IN SELECT auth_user_id FROM public.profiles
          WHERE is_active = true AND role IN ('planning_head','managing_director','head_operations')
        LOOP
          INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
          VALUES (recip.auth_user_id, 'warning', 'material',
                  'Excess special material requests',
                  '⚠️ ' || COALESCE(pname,'Project') || ' has ' || recent_count ||
                  ' special material requests this month. Review BOQ or design for potential gaps.',
                  '⚠️ ' || COALESCE(pname,'Project') || ' has ' || recent_count ||
                  ' special material requests this month. Review BOQ or design for potential gaps.',
                  '/production?project=' || NEW.project_id || '&tab=special-materials', 'high');
        END LOOP;
      END IF;
    ELSIF NEW.status = 'rejected' THEN
      msg := 'Special material request rejected — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || '. Reason: ' || COALESCE(NEW.rejection_reason,'(none)');
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'warning', 'material',
                'Special material request rejected', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    ELSIF NEW.status = 'issued' THEN
      msg := 'Special material issued — ' || COALESCE(pname,'project') || ': ' ||
             NEW.material_name || ' x' || NEW.quantity || ' ' || NEW.unit || '.';
      FOR recip IN SELECT auth_user_id FROM public.profiles
        WHERE is_active = true AND role IN ('costing_engineer','production_head','planning_head','managing_director')
      LOOP
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (recip.auth_user_id, 'info', 'material',
                'Special material issued', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END LOOP;
      IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
        VALUES (NEW.created_by, 'success', 'material',
                'Special material issued', msg, msg,
                '/production?project=' || NEW.project_id || '&tab=special-materials', 'normal');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_site_schedule_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ph_ok boolean; hop_ok boolean; any_reject boolean;
  pname text; recip record;
BEGIN
  IF COALESCE(NEW.type,'project_setup') <> 'site_schedule' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'planning_head'
                    AND status='approved' AND type='site_schedule') INTO ph_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND role = 'head_of_projects'
                    AND status='approved' AND type='site_schedule') INTO hop_ok;
  SELECT EXISTS (SELECT 1 FROM public.project_setup_approvals
                  WHERE project_id = NEW.project_id AND status='rejected'
                    AND type='site_schedule') INTO any_reject;

  IF ph_ok AND hop_ok THEN
    UPDATE public.site_schedules
      SET status='approved', approved_at = COALESCE(approved_at, now())
      WHERE project_id = NEW.project_id;

    SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active=true AND role IN ('site_installation_mgr','site_engineer')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'success', 'site_schedule',
              'Site Schedule approved',
              'Site Schedule approved for ' || COALESCE(pname,'project') || '. View installation milestones in Site Hub.',
              'Site Schedule approved for ' || COALESCE(pname,'project') || '. View installation milestones in Site Hub.',
              '/site-hub?project=' || NEW.project_id || '&tab=schedule',
              'normal');
    END LOOP;
  ELSIF any_reject THEN
    UPDATE public.site_schedules
      SET status='rejected', rejection_reason = COALESCE(NEW.comments, rejection_reason)
      WHERE project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END $function$;