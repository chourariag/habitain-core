CREATE TABLE public.reminder_rules(key text PRIMARY KEY,description text NOT NULL,due_time_ist time NOT NULL,working_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6}',delivery_mode text NOT NULL DEFAULT 'shadow' CHECK(delivery_mode IN ('shadow','live')),active boolean NOT NULL DEFAULT true,created_by uuid,updated_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.reminder_rules TO authenticated; GRANT ALL ON public.reminder_rules TO service_role;
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_rules_read ON public.reminder_rules FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director') OR public.has_role(auth.uid(),'head_of_projects') OR public.has_role(auth.uid(),'planning_head'));
CREATE TABLE public.escalation_levels(rule_key text REFERENCES public.reminder_rules(key),level int NOT NULL CHECK(level>0),after_hours int NOT NULL CHECK(after_hours>=0),notify_role text NOT NULL,PRIMARY KEY(rule_key,level),created_by uuid,updated_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.escalation_levels TO authenticated; GRANT ALL ON public.escalation_levels TO service_role;
ALTER TABLE public.escalation_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY escalation_levels_read ON public.escalation_levels FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director') OR public.has_role(auth.uid(),'head_of_projects') OR public.has_role(auth.uid(),'planning_head'));
CREATE TABLE public.reminder_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),rule_key text NOT NULL REFERENCES public.reminder_rules(key),subject_ref text NOT NULL,subject_date date NOT NULL,project_id uuid REFERENCES public.projects(id),raised_at timestamptz NOT NULL DEFAULT now(),level int NOT NULL,notified_user uuid,notified_role text NOT NULL,delivery text NOT NULL CHECK(delivery IN ('shadow','sent')),acknowledged_at timestamptz,resolved_at timestamptz,resolved_by text,recipient_ids uuid[] NOT NULL DEFAULT '{}',acknowledgements jsonb NOT NULL DEFAULT '{}',created_by uuid,updated_by uuid,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(rule_key,subject_ref,level));
GRANT SELECT ON public.reminder_events TO authenticated; GRANT ALL ON public.reminder_events TO service_role;
ALTER TABLE public.reminder_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_events_read ON public.reminder_events FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director') OR public.has_role(auth.uid(),'head_of_projects') OR public.has_role(auth.uid(),'planning_head') OR notified_user=auth.uid() OR auth.uid()=ANY(recipient_ids));
CREATE TABLE public.reminder_change_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor uuid NOT NULL,changed_at timestamptz NOT NULL DEFAULT now(),subject_ref text NOT NULL,old_value jsonb,new_value jsonb);
GRANT SELECT ON public.reminder_change_log TO authenticated; GRANT ALL ON public.reminder_change_log TO service_role;
ALTER TABLE public.reminder_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_change_log_read ON public.reminder_change_log FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director'));
CREATE FUNCTION public.reminder_expected_day(p_project uuid,p_date date) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=p_project AND NOT coalesce(p.is_archived,false) AND p.status IS NOT NULL AND lower(p.status) NOT IN ('completed','closed','cancelled','canceled','archived','on_hold','inactive') AND (EXISTS(SELECT 1 FROM public.project_tasks t WHERE t.project_id=p.id AND t.work_category='construction' AND ((t.completion_percentage>0 AND t.completion_percentage<100) OR (t.planned_start_date<=p_date AND t.planned_finish_date>=p_date))) OR EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=p.id AND a.work_date=p_date)));
$$;
CREATE FUNCTION public.reminder_subjects(p_now timestamptz DEFAULT now()) RETURNS TABLE(rule_key text,subject_ref text,subject_date date,project_id uuid,due_at timestamptz,owner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH dates AS(SELECT p.id,d::date AS report_day FROM public.projects p CROSS JOIN LATERAL generate_series(least((SELECT min(t.planned_start_date) FROM public.project_tasks t WHERE t.project_id=p.id AND t.work_category='construction'),(SELECT min(a.work_date) FROM public.labour_attendance a WHERE a.project_id=p.id),(p_now AT TIME ZONE 'Asia/Kolkata')::date),(p_now AT TIME ZONE 'Asia/Kolkata')::date,interval '1 day') d WHERE public.reminder_expected_day(p.id,d::date))
SELECT r.key,d.id::text||':'||d.report_day::text,d.report_day,d.id,(d.report_day+r.due_time_ist) AT TIME ZONE 'Asia/Kolkata',NULL::uuid FROM dates d JOIN public.reminder_rules r ON r.key IN ('daily_site_report','labour_attendance') AND r.active WHERE extract(isodow FROM d.report_day)::int=ANY(r.working_days) AND p_now>=(d.report_day+r.due_time_ist) AT TIME ZONE 'Asia/Kolkata' AND ((r.key='daily_site_report' AND NOT EXISTS(SELECT 1 FROM public.daily_measurements m WHERE m.project_id=d.id AND m.measurement_date=d.report_day AND m.trade='daily_site_report' AND m.report_status='submitted' AND NOT m.is_archived)) OR (r.key='labour_attendance' AND NOT EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=d.id AND a.work_date=d.report_day)))
UNION ALL SELECT r.key,e.id::text,e.entry_date,e.project_id,e.created_at+interval '48 hours',e.submitted_by FROM public.expense_entries e JOIN public.reminder_rules r ON r.key='expense_receipt' AND r.active WHERE nullif(btrim(e.receipt_path),'') IS NULL AND nullif(btrim(e.receipt_url),'') IS NULL AND e.status<>'rejected' AND e.created_at+interval '48 hours'<=p_now AND extract(isodow FROM p_now AT TIME ZONE 'Asia/Kolkata')::int=ANY(r.working_days);
$$;
CREATE FUNCTION public.run_reminders(p_dry boolean DEFAULT true) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s record;l record;ids uuid[];output jsonb:='[]';item jsonb;inserted_id uuid;new_ids uuid[]:='{}';recipient uuid;summary text;count_new int;
BEGIN
IF auth.uid() IS NOT NULL AND NOT(public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director') OR public.has_role(auth.uid(),'head_of_projects') OR public.has_role(auth.uid(),'planning_head')) THEN RAISE EXCEPTION 'Not allowed'; END IF;
IF auth.uid() IS NOT NULL AND NOT p_dry THEN RAISE EXCEPTION 'Use the scheduled runner; Run now is dry-run only'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key='reminders' AND enabled) THEN RETURN '[]'::jsonb; END IF;
IF NOT p_dry THEN
PERFORM pg_advisory_xact_lock(hashtext('hstack-reminders'));
UPDATE public.reminder_events e SET resolved_at=now(),resolved_by='underlying_data',updated_at=now(),updated_by=auth.uid() WHERE resolved_at IS NULL AND ((e.rule_key='daily_site_report' AND EXISTS(SELECT 1 FROM public.daily_measurements m WHERE m.project_id=e.project_id AND m.measurement_date=e.subject_date AND m.trade='daily_site_report' AND m.report_status='submitted' AND NOT m.is_archived)) OR (e.rule_key='labour_attendance' AND EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=e.project_id AND a.work_date=e.subject_date)) OR (e.rule_key='expense_receipt' AND EXISTS(SELECT 1 FROM public.expense_entries x WHERE x.id::text=e.subject_ref AND (nullif(btrim(x.receipt_path),'') IS NOT NULL OR nullif(btrim(x.receipt_url),'') IS NOT NULL))));
END IF;
FOR s IN SELECT * FROM public.reminder_subjects(now()) LOOP
FOR l IN SELECT el.*,r.delivery_mode FROM public.escalation_levels el JOIN public.reminder_rules r ON r.key=el.rule_key WHERE el.rule_key=s.rule_key AND now()>=s.due_at+make_interval(hours=>el.after_hours) ORDER BY el.level LOOP
IF EXISTS(SELECT 1 FROM public.reminder_events e WHERE e.rule_key=s.rule_key AND e.subject_ref=s.subject_ref AND e.level=l.level) THEN CONTINUE; END IF;
ids:='{}';
IF l.notify_role='owner' AND s.owner_id IS NOT NULL THEN
SELECT coalesce(array_agg(p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.profiles p WHERE p.auth_user_id=s.owner_id AND coalesce(p.is_active,true) AND NOT coalesce(p.is_archived,false);
ELSIF s.project_id IS NOT NULL THEN
SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.project_team_members tm JOIN public.profiles p ON p.id=tm.profile_id WHERE tm.project_id=s.project_id AND tm.is_active AND coalesce(p.is_active,true) AND NOT coalesce(p.is_archived,false) AND ((l.notify_role='owner' AND tm.role IN ('site_engineer','site_installation_mgr')) OR (l.notify_role<>'owner' AND tm.role=l.notify_role));
ELSE
SELECT coalesce(array_agg(DISTINCT p.auth_user_id ORDER BY p.auth_user_id),'{}') INTO ids FROM public.user_roles ur JOIN public.profiles p ON p.auth_user_id=ur.user_id WHERE ur.role::text=l.notify_role AND coalesce(p.is_active,true) AND NOT coalesce(p.is_archived,false);
END IF;
item:=jsonb_build_object('rule_key',s.rule_key,'subject_ref',s.subject_ref,'subject_date',s.subject_date,'project_id',s.project_id,'due_at',s.due_at,'level',l.level,'notified_user',ids[1],'recipient_ids',ids,'notified_role',l.notify_role||CASE WHEN cardinality(ids)=0 THEN ' (unassigned)' ELSE '' END,'delivery',CASE WHEN l.delivery_mode='live' AND cardinality(ids)>0 THEN 'sent' ELSE 'shadow' END);
output:=output||jsonb_build_array(item);
IF NOT p_dry THEN
INSERT INTO public.reminder_events(rule_key,subject_ref,subject_date,project_id,level,notified_user,recipient_ids,notified_role,delivery,created_by,updated_by) VALUES(s.rule_key,s.subject_ref,s.subject_date,s.project_id,l.level,ids[1],ids,item->>'notified_role',item->>'delivery',auth.uid(),auth.uid()) ON CONFLICT DO NOTHING RETURNING id INTO inserted_id;
IF inserted_id IS NOT NULL AND item->>'delivery'='sent' THEN new_ids:=array_append(new_ids,inserted_id); END IF;
END IF;
END LOOP;END LOOP;
IF NOT p_dry THEN
FOR recipient IN SELECT DISTINCT unnest(e.recipient_ids) FROM public.reminder_events e WHERE e.id=ANY(new_ids) LOOP
SELECT count(*),string_agg(r.description||CASE WHEN p.name IS NULL THEN '' ELSE ' — '||p.name END||' ('||to_char(e.subject_date,'DD/MM/YYYY')||', level '||e.level||')','; ' ORDER BY e.raised_at,e.id) INTO count_new,summary FROM public.reminder_events e JOIN public.reminder_rules r ON r.key=e.rule_key LEFT JOIN public.projects p ON p.id=e.project_id WHERE e.id=ANY(new_ids) AND recipient=ANY(e.recipient_ids);
INSERT INTO public.notifications(recipient_id,type,content,title,body,category,navigate_to) VALUES(recipient,'reminder',count_new||' reminders: '||summary,count_new||' reminders',count_new||' reminders: '||summary,'reminder','/alerts');
END LOOP;END IF;
RETURN output;
END;$$;
CREATE FUNCTION public.update_reminder_rule(p_key text,p_due time,p_days int[],p_mode text,p_active boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row jsonb;new_row jsonb;
BEGIN
IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only Super Admin can edit reminder rules'; END IF;
IF cardinality(p_days)<1 OR NOT p_days<@ARRAY[1,2,3,4,5,6,7] THEN RAISE EXCEPTION 'Choose valid working days'; END IF;
SELECT to_jsonb(r) INTO old_row FROM public.reminder_rules r WHERE key=p_key FOR UPDATE;
IF old_row IS NULL THEN RAISE EXCEPTION 'Unknown reminder rule'; END IF;
UPDATE public.reminder_rules SET due_time_ist=p_due,working_days=p_days,delivery_mode=p_mode,active=p_active,updated_at=now(),updated_by=auth.uid() WHERE key=p_key RETURNING to_jsonb(reminder_rules) INTO new_row;
INSERT INTO public.reminder_change_log(actor,subject_ref,old_value,new_value) VALUES(auth.uid(),p_key,old_row,new_row);
END;$$;
CREATE FUNCTION public.update_escalation_level(p_key text,p_level int,p_hours int,p_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row jsonb;new_row jsonb;
BEGIN
IF NOT public.has_role(auth.uid(),'super_admin') THEN RAISE EXCEPTION 'Only Super Admin can edit escalation levels'; END IF;
IF p_role<>'owner' AND NOT EXISTS(SELECT 1 FROM pg_enum WHERE enumtypid='public.app_role'::regtype AND enumlabel=p_role) THEN RAISE EXCEPTION 'Unknown role'; END IF;
SELECT to_jsonb(e) INTO old_row FROM public.escalation_levels e WHERE rule_key=p_key AND level=p_level FOR UPDATE;
UPDATE public.escalation_levels SET after_hours=p_hours,notify_role=p_role,updated_at=now(),updated_by=auth.uid() WHERE rule_key=p_key AND level=p_level RETURNING to_jsonb(escalation_levels) INTO new_row;
IF new_row IS NULL THEN RAISE EXCEPTION 'Unknown escalation level'; END IF;
INSERT INTO public.reminder_change_log(actor,subject_ref,old_value,new_value) VALUES(auth.uid(),p_key||':'||p_level,old_row,new_row);
END;$$;
CREATE FUNCTION public.acknowledge_reminder(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row jsonb;new_row jsonb;
BEGIN
SELECT to_jsonb(e) INTO old_row FROM public.reminder_events e WHERE id=p_id AND auth.uid()=ANY(recipient_ids) FOR UPDATE;
IF old_row IS NULL THEN RAISE EXCEPTION 'Only the addressed person can acknowledge this reminder'; END IF;
UPDATE public.reminder_events SET acknowledged_at=coalesce(acknowledged_at,now()),acknowledgements=acknowledgements||jsonb_build_object(auth.uid()::text,now()),updated_at=now(),updated_by=auth.uid() WHERE id=p_id RETURNING to_jsonb(reminder_events) INTO new_row;
INSERT INTO public.reminder_change_log(actor,subject_ref,old_value,new_value) VALUES(auth.uid(),p_id::text,old_row,new_row);
END;$$;
CREATE FUNCTION public.list_open_reminders() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('project_name',p.name,'description',r.description,'recipient_names',coalesce((SELECT string_agg(coalesce(pr.display_name,pr.auth_user_id::text),', ' ORDER BY pr.display_name) FROM public.profiles pr WHERE pr.auth_user_id=ANY(e.recipient_ids)),'Unassigned')) ORDER BY e.raised_at DESC),'[]') FROM public.reminder_events e JOIN public.reminder_rules r ON r.key=e.rule_key LEFT JOIN public.projects p ON p.id=e.project_id WHERE e.resolved_at IS NULL AND auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'managing_director') OR public.has_role(auth.uid(),'head_of_projects') OR public.has_role(auth.uid(),'planning_head') OR auth.uid()=ANY(e.recipient_ids));
$$;
REVOKE ALL ON FUNCTION public.reminder_expected_day(uuid,date),public.reminder_subjects(timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.run_reminders(boolean),public.update_reminder_rule(text,time,int[],text,boolean),public.update_escalation_level(text,int,int,text),public.acknowledge_reminder(uuid),public.list_open_reminders() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.run_reminders(boolean),public.update_reminder_rule(text,time,int[],text,boolean),public.update_escalation_level(text,int,int,text),public.acknowledge_reminder(uuid),public.list_open_reminders() TO authenticated,service_role;