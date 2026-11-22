BEGIN;
CREATE TEMP TABLE cost_period_evidence(label text,data jsonb);
DO $test$
DECLARE p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; end_bill jsonb; prior_bill jsonb; mid_report jsonb; full_report jsonb; first_day date;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','99b67080-a6eb-4feb-bd8e-92a287b430aa',true);
 SELECT min(d) INTO first_day FROM (
  SELECT measurement_date d FROM public.daily_measurements WHERE project_id=p AND trade='daily_site_report' AND report_status='submitted' AND NOT coalesce(is_archived,false)
  UNION ALL SELECT fr.report_date FROM public.factory_daily_reports fr JOIN public.factory_report_blocks fb ON fb.report_id=fr.id JOIN public.modules m ON m.id=fb.module_id WHERE m.project_id=p AND fr.status='submitted' AND NOT fr.is_archived AND NOT fb.is_archived
 ) dates;
 IF first_day IS NULL THEN RAISE EXCEPTION 'No first submitted report'; END IF;
 SET LOCAL ROLE authenticated;
 end_bill:=public.get_running_bill(p,'2026-11-22');
 prior_bill:=public.get_running_bill(p,'2026-11-20');
 mid_report:=public.get_cost_report(p,'2026-11-21','2026-11-22');
 full_report:=public.get_cost_report(p,first_day,'2026-11-22');
 IF (end_bill->'totals'->>'value_earned')::numeric<>151000 THEN RAISE EXCEPTION 'Cumulative regression'; END IF;
 IF (prior_bill->'totals'->>'value_earned')::numeric<>78000 THEN RAISE EXCEPTION 'Prior earned regression'; END IF;
 IF (mid_report->'totals'->>'value_earned_period')::numeric<>73000 OR (mid_report->'totals'->>'value_earned_period')::numeric<>(end_bill->'totals'->>'value_earned')::numeric-(prior_bill->'totals'->>'value_earned')::numeric THEN RAISE EXCEPTION 'Period subtraction'; END IF;
 IF (mid_report->'totals'->>'value_minus_cost')::numeric<>69807.66 OR (mid_report->'totals'->>'value_minus_cost')::numeric<>73000-(mid_report->'totals'->>'total')::numeric THEN RAISE EXCEPTION 'Same period margin'; END IF;
 IF (full_report->'totals'->>'value_earned_period')::numeric<>151000 OR (full_report->'totals'->>'value_earned_cumulative')::numeric<>151000 THEN RAISE EXCEPTION 'First report range'; END IF;
 IF (mid_report->'totals'->>'excess_value')::numeric<>19500 OR (prior_bill->'totals'->>'excess_value')::numeric<>19500 THEN RAISE EXCEPTION 'Cap/excess regression'; END IF;
 IF (full_report->'totals'->>'own_labour')::numeric<>6365.46 OR (mid_report->'totals'->>'total')::numeric<>3192.34 THEN RAISE EXCEPTION 'Cost changed'; END IF;
 RESET ROLE;
 INSERT INTO cost_period_evidence VALUES('Mid-project',jsonb_build_object('from','21/11/2026','to','22/11/2026','earned_end',151000,'earned_before',78000,'period',73000,'cost',3192.34,'value_minus_cost',69807.66,'excess',19500)),('First report',jsonb_build_object('first_report',first_day,'period',full_report->'totals'->'value_earned_period','cumulative',full_report->'totals'->'value_earned_cumulative'));
END $test$;
SELECT jsonb_agg(to_jsonb(e)) evidence FROM cost_period_evidence e;
ROLLBACK;