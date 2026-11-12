-- 1. get_site_report: list all open construction tasks regardless of planned start
DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.get_site_report(uuid,date)'::regprocedure);
  d := replace(d, '
        AND t.planned_start_date IS NOT NULL AND t.planned_start_date<=p_date', '');
  d := replace(d, 'ORDER BY t.planned_start_date, t.task_id_in_schedule', 'ORDER BY t.planned_start_date NULLS LAST, t.task_id_in_schedule');
  IF position('planned_start_date<=p_date' in d)>0 THEN RAISE EXCEPTION 'get_site_report patch did not apply'; END IF;
  EXECUTE d;
END $do$;

-- 2. submit_site_report: never overwrite a task with an older report's progress
CREATE OR REPLACE FUNCTION public.submit_site_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.daily_measurements%ROWTYPE; p record; v_tasks int := 0; v_skipped jsonb := '[]'::jsonb; v_wip numeric; v_rated int; v_qty int;
BEGIN
  SELECT * INTO r FROM public.daily_measurements WHERE id=p_report_id AND trade='daily_site_report' FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  PERFORM public._site_report_check_window(r.project_id, r.measurement_date);
  IF r.report_status='submitted' AND r.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the submitter can edit this report'; END IF;
  IF (SELECT count(DISTINCT kind) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false
      AND kind IN ('elevation_front','elevation_rear','elevation_left','elevation_right')) < 4 THEN RAISE EXCEPTION 'All four elevation photos are required'; END IF;
  IF NOT r.site_clean OR r.site_clean_photo_path IS NULL THEN RAISE EXCEPTION 'Site clean tick and photo are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.site_report_task_progress WHERE report_id=r.id AND completion_percentage_after IS NOT NULL)
     AND length(btrim(coalesce(r.notes,''))) < 5 THEN RAISE EXCEPTION 'Enter progress on at least one task, or explain in notes why no work happened'; END IF;

  FOR p IN SELECT sp.task_id, sp.completion_percentage_after pct, t.completion_percentage old_pct, t.task_id_in_schedule code
           FROM public.site_report_task_progress sp JOIN public.project_tasks t ON t.id=sp.task_id
           WHERE sp.report_id=r.id AND sp.completion_percentage_after IS NOT NULL LOOP
    IF EXISTS (SELECT 1 FROM public.site_report_task_progress o JOIN public.daily_measurements d ON d.id=o.report_id
               WHERE o.task_id=p.task_id AND o.completion_percentage_after IS NOT NULL AND d.id<>r.id
                 AND d.report_status='submitted' AND d.is_archived=false AND d.measurement_date>r.measurement_date) THEN
      v_skipped := v_skipped || jsonb_build_object('task_id',p.task_id,'code',p.code);
      CONTINUE;
    END IF;
    UPDATE public.project_tasks SET
      completion_percentage = round(p.pct)::int,
      actual_start_date = coalesce(actual_start_date, r.measurement_date),
      actual_finish_date = CASE WHEN round(p.pct)>=100 THEN coalesce(actual_finish_date, r.measurement_date) ELSE actual_finish_date END,
      updated_at = now()
    WHERE id=p.task_id;
    PERFORM public._site_report_log(r.id,r.project_id,'task_pct:'||p.task_id,p.old_pct::text,round(p.pct)::text);
    v_tasks := v_tasks+1;
  END LOOP;

  SELECT count(*) FILTER (WHERE li.today_qty>0), count(*) FILTER (WHERE li.today_qty>0 AND b.boq_rate>0),
         sum(li.today_qty*b.boq_rate) FILTER (WHERE b.boq_rate>0)
    INTO v_qty, v_rated, v_wip
  FROM public.measurement_line_items li JOIN public.project_boq_items b ON b.id=li.boq_item_id WHERE li.measurement_id=r.id;
  UPDATE public.daily_measurements SET
    total_wip_today = coalesce(v_wip,0),
    wip_needs_review = (v_rated = 0 AND v_qty > 0) OR v_rated < v_qty,
    wip_review_reason = CASE WHEN v_rated < v_qty THEN 'Some quantities have no BOQ rate; WIP not computed for them' ELSE NULL END,
    report_status='submitted', submitted_by=auth.uid(), submitted_at=now(), updated_by=auth.uid(), updated_at=now()
  WHERE id=r.id;
  PERFORM public._site_report_log(r.id,r.project_id,'status',coalesce(r.report_status,'draft'),'submitted');
  RETURN jsonb_build_object('tasks_updated',v_tasks,'tasks_skipped',v_skipped,'quantity_lines',v_qty,
    'photos',(SELECT count(*) FROM public.site_report_photos WHERE report_id=r.id AND is_archived=false));
END $$;