CREATE OR REPLACE FUNCTION public.schedule_recalculate_dates(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_column
DECLARE
  u uuid:=auth.uid(); t public.project_tasks%ROWTYPE;
  v_done uuid[]:=ARRAY[]::uuid[]; v_ids uuid[]; v_path uuid[];
  v_total int; v_next int; v_day1 date; v_start int; v_end int;
  v_code text; v_name text; v_pred text; v_cycle text;
  v_warnings jsonb:='[]'::jsonb; v_result jsonb;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Published schedule dates require a revision and reason' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed FOR UPDATE;
  SELECT count(*) INTO v_total FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed;
  IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed AND coalesce(duration_days,0)<0) THEN
    RAISE EXCEPTION 'Task duration cannot be negative' USING ERRCODE='22023';
  END IF;
  SELECT t.task_id_in_schedule,t.task_name,pred INTO v_code,v_name,v_pred
  FROM public.project_tasks t CROSS JOIN LATERAL unnest(coalesce(t.predecessor_ids,ARRAY[]::text[])) pred
  LEFT JOIN public.project_tasks p ON p.project_id=t.project_id AND NOT p.is_removed
    AND p.task_id_in_schedule=pred
    AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label
  WHERE t.project_id=p_project_id AND NOT t.is_removed AND p.id IS NULL LIMIT 1;
  IF v_code IS NOT NULL THEN
    RAISE EXCEPTION 'Task % (%): predecessor % does not exist in the same project/unit',v_code,v_name,v_pred USING ERRCODE='22023';
  END IF;
  SELECT coalesce(array_agg(id),ARRAY[]::uuid[]) INTO v_done
  FROM public.project_tasks
  WHERE project_id=p_project_id AND NOT is_removed AND coalesce(cardinality(predecessor_ids),0)=0;
  LOOP
    WITH updated AS(
      UPDATE public.project_tasks child SET start_day=x.next_start
      FROM(
        SELECT t.id,max(CASE WHEN coalesce(p.duration_days,0)=0 THEN p.start_day ELSE p.start_day+greatest(coalesce(p.duration_days,0),1)-1 END)+1 AS next_start
        FROM public.project_tasks t
        CROSS JOIN LATERAL unnest(t.predecessor_ids) pred
        JOIN public.project_tasks p ON p.id=ANY(v_done) AND p.project_id=t.project_id AND NOT p.is_removed
          AND p.task_id_in_schedule=pred
          AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label
        WHERE t.project_id=p_project_id AND NOT t.is_removed AND NOT t.id=ANY(v_done)
        GROUP BY t.id HAVING count(*)=cardinality(t.predecessor_ids)
      ) x WHERE child.id=x.id RETURNING child.id
    )
    SELECT array_agg(id) INTO v_ids FROM updated;
    EXIT WHEN v_ids IS NULL;
    v_done:=v_done||v_ids;
  END LOOP;
  IF cardinality(v_done)<>v_total THEN
    WITH RECURSIVE walk(id,path,cycled) AS(
      SELECT t.id,ARRAY[t.id],false FROM public.project_tasks t
      WHERE t.project_id=p_project_id AND NOT t.is_removed AND NOT t.id=ANY(v_done)
      UNION ALL
      SELECT p.id,w.path||p.id,p.id=ANY(w.path)
      FROM walk w JOIN public.project_tasks cur ON cur.id=w.id
      CROSS JOIN LATERAL unnest(cur.predecessor_ids) pred
      JOIN public.project_tasks p ON p.project_id=cur.project_id AND NOT p.is_removed
        AND p.task_id_in_schedule=pred
        AND p.unit_kind IS NOT DISTINCT FROM cur.unit_kind AND p.unit_label IS NOT DISTINCT FROM cur.unit_label
      WHERE NOT w.cycled
    )
    SELECT path INTO v_path FROM walk WHERE cycled LIMIT 1;
    SELECT string_agg(task_id_in_schedule||' ('||task_name||')',' -> ' ORDER BY ord) INTO v_cycle
    FROM unnest(v_path) WITH ORDINALITY x(id,ord) JOIN public.project_tasks t ON t.id=x.id;
    RAISE EXCEPTION 'Schedule dependency cycle: %',v_cycle USING ERRCODE='22023';
  END IF;
  FOR t IN SELECT * FROM public.project_tasks WHERE project_id=p_project_id AND NOT is_removed ORDER BY display_order NULLS LAST,task_id_in_schedule,id LOOP
    v_day1:=NULL;
    IF t.unit_kind IS NOT NULL AND t.unit_label IS NOT NULL THEN
      SELECT day1 INTO v_day1 FROM public.project_schedule_units
      WHERE project_id=p_project_id AND unit_kind=t.unit_kind AND unit_label=t.unit_label;
      IF v_day1 IS NULL THEN
        v_warnings:=v_warnings||jsonb_build_array('No Day 1 for unit '||t.unit_kind||' / '||t.unit_label);
      END IF;
    ELSE
      SELECT min(day1) INTO v_day1 FROM public.project_schedule_units
      WHERE project_id=p_project_id AND unit_kind='module' AND day1 IS NOT NULL;
      v_warnings:=v_warnings||jsonb_build_array('Task '||t.task_id_in_schedule||' has no unit; using earliest module Day 1');
      IF v_day1 IS NULL THEN
        v_warnings:=v_warnings||jsonb_build_array('Task '||t.task_id_in_schedule||' has no unit and the project has no module Day 1');
      END IF;
    END IF;
    v_start:=t.start_day;
    v_end:=CASE WHEN coalesce(t.duration_days,0)=0 THEN v_start ELSE v_start+greatest(coalesce(t.duration_days,0),1)-1 END;
    UPDATE public.project_tasks SET
      planned_start_date=public.schedule_working_date(v_day1,v_start),
      planned_finish_date=public.schedule_working_date(v_day1,v_end)
    WHERE id=t.id;
  END LOOP;
  v_result:=jsonb_build_object('count',v_total,'warnings',v_warnings);
  INSERT INTO public.schedule_audit_log(project_id,entity,action,new_value,actor_id)
  VALUES(p_project_id,'project_schedule','recalculate_dates',v_result,u);
  RETURN v_result;
END $$;