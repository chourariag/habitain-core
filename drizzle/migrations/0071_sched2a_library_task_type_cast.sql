CREATE OR REPLACE FUNCTION public.schedule_add_library_tasks(p_project_id uuid,p_unit_kind text,p_unit_label text,p_library_task_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u uuid:=auth.uid(); l record; t public.project_tasks%ROWTYPE;
  v_code text; v_start int; v_added int:=0; v_skipped int:=0;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  IF p_unit_kind NOT IN ('module','panel_set','site') OR nullif(btrim(p_unit_label),'') IS NULL THEN
    RAISE EXCEPTION 'A valid unit kind and label are required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Library tasks can be added only before a baseline; use schedule_add_task with a reason' USING ERRCODE='42501';
  END IF;
  FOR l IN
    SELECT lt.*,a.phase AS activity_phase FROM public.schedule_library_tasks lt
    JOIN public.schedule_library_activities a ON a.id=lt.activity_id AND a.active
    WHERE lt.id=ANY(coalesce(p_library_task_ids,ARRAY[]::uuid[])) AND lt.active
    ORDER BY lt.display_order,lt.code
  LOOP
    IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND library_task_id=l.id AND unit_kind=p_unit_kind AND unit_label=p_unit_label) THEN
      v_skipped:=v_skipped+1; CONTINUE;
    END IF;
    v_code:=l.code||CASE WHEN p_unit_kind='module' THEN '-'||p_unit_label ELSE '' END;
    IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=v_code) THEN
      RAISE EXCEPTION 'Task code % already exists in this project',v_code USING ERRCODE='22023';
    END IF;
    IF l.std_start_day IS NOT NULL THEN
      v_start:=l.std_start_day;
    ELSE
      SELECT coalesce(max(CASE WHEN start_day IS NOT NULL THEN
        CASE WHEN coalesce(duration_days,0)=0 THEN start_day ELSE start_day+greatest(coalesce(duration_days,0),1)-1 END END),0)+1
      INTO v_start FROM public.project_tasks
      WHERE project_id=p_project_id AND NOT is_removed AND unit_kind=p_unit_kind AND unit_label=p_unit_label;
    END IF;
    INSERT INTO public.project_tasks(
      project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,library_task_id,
      unit_kind,unit_label,work_category,display_order,is_qc_gate,is_payment_milestone,task_type
    ) VALUES(
      p_project_id,v_code,l.name,l.activity_phase,l.default_days,v_start,l.id,p_unit_kind,p_unit_label,
      CASE WHEN l.activity_phase='site' THEN 'construction' ELSE 'process' END,
      l.display_order,l.is_qc_gate,l.is_payment_milestone,
      (CASE WHEN l.is_qc_gate THEN 'qc_gate' WHEN l.is_payment_milestone THEN 'payment' ELSE 'task' END)::public.task_template_type
    ) RETURNING * INTO t;
    v_added:=v_added+1;
    INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
    VALUES(p_project_id,t.id,'project_task','add_library',to_jsonb(t),u);
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $$;