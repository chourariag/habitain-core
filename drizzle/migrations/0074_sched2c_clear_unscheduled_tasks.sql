CREATE OR REPLACE FUNCTION public.schedule_clear_unscheduled_tasks(p_project_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  u uuid := auth.uid();
  r text := nullif(btrim(p_reason), '');
  candidates integer := 0;
  deleted integer := 0;
  ids uuid[];
BEGIN
  IF u IS NULL OR p_project_id IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u, p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE = '42501';
  END IF;
  IF r IS NULL THEN
    RAISE EXCEPTION 'A reason is required to clear unscheduled legacy tasks' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:' || p_project_id::text));
  IF EXISTS (SELECT 1 FROM schedule_baselines WHERE project_id = p_project_id) THEN
    RAISE EXCEPTION 'This project has a published baseline; unscheduled tasks can only be cleared before the first baseline' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO candidates FROM project_tasks t
   WHERE t.project_id = p_project_id AND t.unit_label IS NULL
     AND t.planned_start_date IS NULL AND t.planned_finish_date IS NULL;

  SELECT coalesce(array_agg(t.id), '{}') INTO ids FROM project_tasks t
   WHERE t.project_id = p_project_id
     AND t.unit_label IS NULL
     AND t.planned_start_date IS NULL AND t.planned_finish_date IS NULL
     AND coalesce(t.completion_percentage, 0) = 0
     AND t.actual_start_date IS NULL AND t.actual_finish_date IS NULL
     AND coalesce(t.is_qc_gate, false) = false
     AND coalesce(t.is_payment_milestone, false) = false
     AND coalesce(t.task_type::text, 'task') NOT IN ('qc_gate', 'payment')
     AND NOT EXISTS (SELECT 1 FROM project_tasks c WHERE c.parent_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM project_subtasks x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM schedule_task_comments x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM project_boq_items x WHERE x.schedule_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM project_material_plan_items x WHERE x.schedule_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM task_benchmarks x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM red_flag_alerts x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM material_alerts x WHERE x.related_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM panel_handovers x WHERE x.related_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM project_archives x WHERE x.karthik_upload_task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM site_report_task_progress x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM site_report_labour x WHERE x.task_id = t.id)
     AND NOT EXISTS (SELECT 1 FROM site_report_task_workers x WHERE x.task_id = t.id);

  DELETE FROM project_tasks WHERE id = ANY(ids) AND project_id = p_project_id AND unit_label IS NULL;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  INSERT INTO schedule_audit_log(project_id, task_id, entity, action, reason, old_value, new_value, actor_id)
  VALUES (p_project_id, NULL, 'project_task', 'clear_unscheduled', r,
          jsonb_build_object('candidates', candidates, 'task_ids', to_jsonb(ids)),
          jsonb_build_object('deleted', deleted, 'skipped_with_progress', candidates - deleted), u);

  RETURN jsonb_build_object('deleted', deleted, 'skipped_with_progress', candidates - deleted);
END $function$;

REVOKE ALL ON FUNCTION public.schedule_clear_unscheduled_tasks(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_clear_unscheduled_tasks(uuid, text) TO authenticated, service_role;