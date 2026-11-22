DO $patch$
DECLARE d text; a text;
BEGIN
 d:=pg_get_functiondef('public.get_cost_report(uuid,date,date)'::regprocedure);
 a:='DECLARE result jsonb; bill jsonb; factory jsonb; person_cost boolean;';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Cost declaration anchor missing'; END IF;
 d:=replace(d,a,a||' prior_value numeric:=0; period_value numeric; first_report date;');
 a:='bill:=public.get_running_bill(p_project_id,p_to);';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Cost bill anchor missing'; END IF;
 d:=replace(d,a,a||$body$
 SELECT min(report_date) INTO first_report FROM (
  SELECT measurement_date report_date FROM public.daily_measurements WHERE project_id=p_project_id AND trade='daily_site_report' AND report_status='submitted' AND NOT coalesce(is_archived,false)
  UNION ALL
  SELECT fr.report_date FROM public.factory_daily_reports fr WHERE fr.status='submitted' AND NOT fr.is_archived AND (
   EXISTS(SELECT 1 FROM public.factory_report_blocks fb JOIN public.modules m ON m.id=fb.module_id WHERE fb.report_id=fr.id AND NOT fb.is_archived AND m.project_id=p_project_id)
   OR EXISTS(SELECT 1 FROM public.factory_report_quantities fq JOIN public.modules m ON m.id=fq.module_id WHERE fq.report_id=fr.id AND NOT fq.is_archived AND m.project_id=p_project_id)
  )
 ) dates;
 IF first_report IS NOT NULL AND p_from>first_report THEN
  prior_value:=coalesce((public.get_running_bill(p_project_id,p_from-1)->'totals'->>'value_earned')::numeric,0);
 END IF;
 period_value:=coalesce((bill->'totals'->>'value_earned')::numeric,0)-prior_value;
$body$);
 a:='''value_earned'',(bill->''totals''->>''value_earned'')::numeric,''excess_value''';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Cost value anchor missing'; END IF;
 d:=replace(d,a,'''value_earned'',(bill->''totals''->>''value_earned'')::numeric,''value_earned_period'',period_value,''value_earned_cumulative'',(bill->''totals''->>''value_earned'')::numeric,''excess_value''');
 a:='''value_minus_cost'',(bill->''totals''->>''value_earned'')::numeric-total';
 IF position(a IN d)=0 THEN RAISE EXCEPTION 'Cost margin anchor missing'; END IF;
 d:=replace(d,a,'''value_minus_cost'',period_value-total');
 EXECUTE d;
END $patch$;
REVOKE ALL ON FUNCTION public.get_cost_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_cost_report(uuid,date,date) TO authenticated;
COMMENT ON FUNCTION public.get_cost_report(uuid,date,date) IS 'Read-only indicative same-period costs and cap-aware earned value. value_earned is retained as a cumulative compatibility alias; new consumers use value_earned_period/value_earned_cumulative. Frozen material and per-person cost privacy unchanged.';