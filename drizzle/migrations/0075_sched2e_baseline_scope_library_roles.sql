-- SCHED-2e: baseline covers only unit tasks; responsible roles on library tasks.
ALTER TABLE public.schedule_library_tasks ADD COLUMN IF NOT EXISTS responsible_role text;
COMMENT ON COLUMN public.schedule_library_tasks.responsible_role IS 'Existing app role name copied into project_tasks.responsible_role when the task is added to a project';
UPDATE public.schedule_library_tasks lt SET responsible_role = CASE WHEN a.code BETWEEN '01' AND '12' THEN 'factory_floor_supervisor' WHEN a.code='13' THEN 'site_installation_mgr' END
FROM public.schedule_library_activities a WHERE a.id=lt.activity_id AND lt.responsible_role IS NULL AND a.code BETWEEN '01' AND '13';

CREATE OR REPLACE FUNCTION public.schedule_add_library_tasks(p_project_id uuid, p_unit_kind text, p_unit_label text, p_library_task_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      unit_kind,unit_label,work_category,display_order,is_qc_gate,is_payment_milestone,task_type,responsible_role
    ) VALUES(
      p_project_id,v_code,l.name,l.activity_phase,l.default_days,v_start,l.id,p_unit_kind,p_unit_label,
      CASE WHEN l.activity_phase='site' THEN 'construction' ELSE 'process' END,
      l.display_order,l.is_qc_gate,l.is_payment_milestone,
      (CASE WHEN l.is_qc_gate THEN 'qc_gate' WHEN l.is_payment_milestone THEN 'payment' ELSE 'task' END)::public.task_template_type,
      l.responsible_role
    ) RETURNING * INTO t;
    v_added:=v_added+1;
    INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
    VALUES(p_project_id,t.id,'project_task','add_library',to_jsonb(t),u);
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $function$;

CREATE OR REPLACE FUNCTION public.publish_schedule_baseline(p_project_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE u uuid:=auth.uid(); v int; snap jsonb; r text:=nullif(btrim(p_reason),''); prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  PERFORM id FROM public.project_tasks WHERE project_id=p_project_id FOR UPDATE;
  SELECT coalesce(max(version),0)+1 INTO v FROM public.schedule_baselines WHERE project_id=p_project_id;
  IF v>1 AND r IS NULL THEN RAISE EXCEPTION 'A reason is required to publish revision %',v USING ERRCODE='22023'; END IF;
  SELECT jsonb_agg(jsonb_build_object('id',t.id,'task_id_in_schedule',t.task_id_in_schedule,'task_name',t.task_name,'duration_days',t.duration_days,'planned_start_date',t.planned_start_date,'planned_finish_date',t.planned_finish_date,'predecessor_ids',t.predecessor_ids,'display_order',t.display_order,'phase',t.phase,'stage_name',t.stage_name,'parent_task_id',t.parent_task_id,'parent_stage_number',t.parent_stage_number,'responsible_role',t.responsible_role,'library_task_id',t.library_task_id,'start_day',t.start_day,'unit_kind',t.unit_kind,'unit_label',t.unit_label,'is_removed',t.is_removed,'removed_at',t.removed_at,'removed_by',t.removed_by,'removed_reason',t.removed_reason,'baseline_version',v) ORDER BY t.display_order NULLS LAST,t.task_id_in_schedule,t.id)
  INTO snap FROM public.project_tasks t
  WHERE t.project_id=p_project_id AND t.unit_label IS NOT NULL AND NOT t.is_removed;
  IF snap IS NULL THEN RAISE EXCEPTION 'No scheduled tasks to publish' USING ERRCODE='22023'; END IF;
  INSERT INTO public.schedule_baselines(project_id,version,kind,reason,published_by,snapshot)
  VALUES(p_project_id,v,CASE WHEN v=1 THEN 'baseline' ELSE 'revision' END,r,u,snap);
  PERFORM set_config('hstack.schedule_revise','on',true);
  UPDATE public.project_tasks SET baseline_version=v
  WHERE project_id=p_project_id AND unit_label IS NOT NULL AND NOT is_removed;
  PERFORM set_config('hstack.schedule_revise',prior,true);
  INSERT INTO public.schedule_audit_log(project_id,entity,action,reason,new_value,actor_id)
  VALUES(p_project_id,'schedule_baseline','publish',r,jsonb_build_object('version',v,'task_count',jsonb_array_length(snap)),u);
  RETURN v;
END $function$;

-- Backfill library-derived project tasks that have no responsible role yet (pre-baseline projects only; guard enforces it).
UPDATE public.project_tasks t SET responsible_role=lt.responsible_role
FROM public.schedule_library_tasks lt
WHERE t.library_task_id=lt.id AND t.responsible_role IS NULL AND lt.responsible_role IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.schedule_baselines b WHERE b.project_id=t.project_id);