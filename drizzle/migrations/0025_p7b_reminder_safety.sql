ALTER TABLE public.reminder_rules ADD COLUMN effective_from date NOT NULL DEFAULT '2026-11-16';
CREATE OR REPLACE FUNCTION public.reminder_subjects(p_now timestamptz DEFAULT now()) RETURNS TABLE(rule_key text,subject_ref text,subject_date date,project_id uuid,due_at timestamptz,owner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH clock AS (SELECT (p_now AT TIME ZONE 'Asia/Kolkata')::date AS today),
first_activity AS (
 SELECT p.id,least((SELECT min(coalesce(t.planned_start_date,(t.created_at AT TIME ZONE 'Asia/Kolkata')::date)) FROM public.project_tasks t WHERE t.project_id=p.id AND t.work_category='construction'),(SELECT min(a.work_date) FROM public.labour_attendance a WHERE a.project_id=p.id)) AS first_day FROM public.projects p
),
dates AS (
 SELECT f.id,c.today-offset_days AS report_day FROM first_activity f CROSS JOIN clock c CROSS JOIN (VALUES (0),(1),(2)) AS offsets(offset_days)
 WHERE c.today-offset_days>=f.first_day AND public.reminder_expected_day(f.id,c.today-offset_days)
)
SELECT r.key,d.id::text||':'||d.report_day::text,d.report_day,d.id,(d.report_day+r.due_time_ist) AT TIME ZONE 'Asia/Kolkata',NULL::uuid
FROM dates d JOIN public.reminder_rules r ON r.key IN ('daily_site_report','labour_attendance') AND r.active
WHERE d.report_day>=r.effective_from AND extract(isodow FROM d.report_day)::int=ANY(r.working_days)
AND p_now>=(d.report_day+r.due_time_ist) AT TIME ZONE 'Asia/Kolkata'
AND ((r.key='daily_site_report' AND NOT EXISTS(SELECT 1 FROM public.daily_measurements m WHERE m.project_id=d.id AND m.measurement_date=d.report_day AND m.trade='daily_site_report' AND m.report_status='submitted' AND NOT m.is_archived))
OR (r.key='labour_attendance' AND NOT EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=d.id AND a.work_date=d.report_day)))
UNION ALL
SELECT r.key,e.id::text,e.entry_date,e.project_id,e.created_at+interval '48 hours',e.submitted_by
FROM public.expense_entries e JOIN public.reminder_rules r ON r.key='expense_receipt' AND r.active
WHERE nullif(btrim(e.receipt_path),'') IS NULL AND nullif(btrim(e.receipt_url),'') IS NULL
AND e.status IN ('draft','pending_hr','flagged')
AND e.entry_date>=r.effective_from AND e.created_at>=r.effective_from::timestamp AT TIME ZONE 'Asia/Kolkata'
AND e.created_at+interval '48 hours'<=p_now
AND extract(isodow FROM p_now AT TIME ZONE 'Asia/Kolkata')::int=ANY(r.working_days);
$$;
DO $migration$
DECLARE body text;
BEGIN
SELECT prosrc INTO body FROM pg_proc WHERE oid='public.run_reminders(boolean)'::regprocedure;
body:=replace(body,'DECLARE s record;','DECLARE v_now timestamptz:=now();s record;');
body:=replace(body,'BEGIN\nIF auth.uid()', 'BEGIN\nIF auth.uid()');
body:=replace(body,'IF NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key=''reminders'' AND enabled)', 'IF NOT p_dry AND NOT EXISTS(SELECT 1 FROM public.feature_flags WHERE key=''reminders'' AND enabled)');
body:=replace(body,'IF NOT p_dry THEN'||chr(10)||'PERFORM pg_advisory_xact_lock',
'IF p_dry AND p_asof IS NOT NULL AND public.has_role(auth.uid(),''super_admin'') THEN v_now:=p_asof; END IF;'||chr(10)||'IF NOT p_dry THEN'||chr(10)||'PERFORM pg_advisory_xact_lock');
body:=replace(body,'FOR s IN SELECT * FROM public.reminder_subjects(now())','FOR s IN SELECT * FROM public.reminder_subjects(v_now)');
body:=replace(body,'AND now()>=s.due_at','AND v_now>=s.due_at');
body:=replace(body,'UPDATE public.reminder_events e SET resolved_at=now(),resolved_by=''underlying_data''',
'UPDATE public.reminder_events SET resolved_at=now(),resolved_by=''window_closed'',updated_at=now(),updated_by=auth.uid() WHERE resolved_at IS NULL AND rule_key IN (''daily_site_report'',''labour_attendance'') AND subject_date<(now() AT TIME ZONE ''Asia/Kolkata'')::date-3;'||chr(10)||'UPDATE public.reminder_events e SET resolved_at=now(),resolved_by=''underlying_data''');
EXECUTE format('CREATE FUNCTION public.run_reminders(p_dry boolean,p_asof timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS %L',body);
END;
$migration$;
CREATE OR REPLACE FUNCTION public.run_reminders(p_dry boolean DEFAULT true) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.run_reminders(p_dry,NULL::timestamptz); $$;
DO $migration$
DECLARE body text;
BEGIN
SELECT prosrc INTO body FROM pg_proc WHERE oid='public.update_reminder_rule(text,time,integer[],text,boolean)'::regprocedure;
body:=replace(body,'UPDATE public.reminder_rules SET due_time_ist=p_due','UPDATE public.reminder_rules SET effective_from=p_effective_from,due_time_ist=p_due');
EXECUTE format('CREATE FUNCTION public.update_reminder_rule(p_key text,p_due time,p_days int[],p_mode text,p_active boolean,p_effective_from date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS %L',body);
END;
$migration$;
CREATE OR REPLACE FUNCTION public.update_reminder_rule(p_key text,p_due time,p_days int[],p_mode text,p_active boolean) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT public.update_reminder_rule(p_key,p_due,p_days,p_mode,p_active,(SELECT effective_from FROM public.reminder_rules WHERE key=p_key)); $$;
REVOKE ALL ON FUNCTION public.run_reminders(boolean,timestamptz),public.update_reminder_rule(text,time,int[],text,boolean,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.run_reminders(boolean,timestamptz),public.update_reminder_rule(text,time,int[],text,boolean,date) TO authenticated,service_role;