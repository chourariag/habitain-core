-- SCHED-2f: revisions, added tasks and removals recalculate planned dates on the server,
-- reusing schedule_working_date and project_schedule_units.day1 (same maths as schedule_recalculate_dates).

CREATE OR REPLACE FUNCTION public._schedule_end_day(p_start int, p_dur int)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_start IS NULL THEN NULL WHEN coalesce(p_dur,0)=0 THEN p_start ELSE p_start+greatest(p_dur,1)-1 END
$$;

CREATE OR REPLACE FUNCTION public._schedule_unit_day1(p_project_id uuid, p_kind text, p_label text)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_kind IS NOT NULL AND p_label IS NOT NULL THEN
    (SELECT day1 FROM public.project_schedule_units WHERE project_id=p_project_id AND unit_kind=p_kind AND unit_label=p_label)
  ELSE
    (SELECT min(day1) FROM public.project_schedule_units WHERE project_id=p_project_id AND unit_kind='module' AND day1 IS NOT NULL)
  END
$$;

CREATE OR REPLACE FUNCTION public._schedule_cascade_successors(p_project_id uuid, p_seed_ids uuid[], p_root_id uuid, p_reason text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE
  v_aff uuid[]; v_done uuid[]:=ARRAY[]::uuid[]; v_progress boolean; t public.project_tasks%ROWTYPE;
  v_ns int; v_day1 date; v_s date; v_f date; v_path uuid[]; v_cycle text;
  v_moved jsonb:='[]'::jsonb; v_not jsonb:='[]'::jsonb; v_reason text;
  prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
BEGIN
  IF coalesce(cardinality(p_seed_ids),0)=0 THEN RETURN jsonb_build_object('moved',v_moved,'not_moved',v_not); END IF;
  CREATE TEMP TABLE IF NOT EXISTS _sched_walk(id uuid, path uuid[], cycled boolean) ON COMMIT DROP;
  TRUNCATE _sched_walk;
  INSERT INTO _sched_walk
  WITH RECURSIVE walk(id,path,cycled) AS(
    SELECT s,ARRAY[s],(s=p_root_id) FROM unnest(p_seed_ids) s
    UNION ALL
    SELECT c.id,w.path||c.id,(c.id=ANY(w.path) OR c.id=p_root_id)
    FROM walk w JOIN public.project_tasks cur ON cur.id=w.id
    JOIN public.project_tasks c ON c.project_id=cur.project_id AND NOT c.is_removed
      AND cur.task_id_in_schedule=ANY(c.predecessor_ids)
      AND c.unit_kind IS NOT DISTINCT FROM cur.unit_kind AND c.unit_label IS NOT DISTINCT FROM cur.unit_label
    WHERE NOT w.cycled AND NOT cur.is_removed AND cardinality(w.path)<500
  ) SELECT id,path,cycled FROM walk;
  SELECT path INTO v_path FROM _sched_walk WHERE cycled LIMIT 1;
  IF v_path IS NOT NULL THEN
    IF p_root_id IS NOT NULL THEN v_path:=ARRAY[p_root_id]||v_path; END IF;
    SELECT string_agg(pt.task_id_in_schedule||' ('||pt.task_name||')',' -> ' ORDER BY x.ord) INTO v_cycle
    FROM unnest(v_path) WITH ORDINALITY x(id,ord) JOIN public.project_tasks pt ON pt.id=x.id;
    RAISE EXCEPTION 'Schedule dependency cycle: %',v_cycle USING ERRCODE='22023';
  END IF;
  SELECT array_agg(DISTINCT id) INTO v_aff FROM _sched_walk;
  PERFORM 1 FROM public.project_tasks WHERE id=ANY(v_aff) FOR UPDATE;
  PERFORM set_config('hstack.schedule_revise','on',true);
  LOOP
    v_progress:=false;
    FOR t IN SELECT * FROM public.project_tasks a WHERE a.id=ANY(v_aff) AND NOT a.id=ANY(v_done)
      AND NOT EXISTS(SELECT 1 FROM public.project_tasks p WHERE p.id=ANY(v_aff) AND NOT p.id=ANY(v_done) AND p.id<>a.id
        AND NOT p.is_removed AND p.task_id_in_schedule=ANY(a.predecessor_ids)
        AND p.unit_kind IS NOT DISTINCT FROM a.unit_kind AND p.unit_label IS NOT DISTINCT FROM a.unit_label)
      ORDER BY a.display_order NULLS LAST,a.task_id_in_schedule,a.id
    LOOP
      v_done:=v_done||t.id; v_progress:=true;
      v_reason:=CASE
        WHEN t.is_removed THEN 'Removed from the schedule'
        WHEN t.actual_start_date IS NOT NULL THEN 'Already started on '||to_char(t.actual_start_date,'DD/MM/YYYY')
        WHEN coalesce(t.completion_percentage,0)>0 THEN 'Progress already recorded ('||t.completion_percentage||'%)'
        ELSE NULL END;
      IF v_reason IS NOT NULL THEN
        v_not:=v_not||jsonb_build_array(jsonb_build_object('task_id',t.id,'code',t.task_id_in_schedule,'name',t.task_name,'reason',v_reason));
        CONTINUE;
      END IF;
      SELECT max(public._schedule_end_day(p.start_day,p.duration_days))+1 INTO v_ns
      FROM public.project_tasks p WHERE p.project_id=t.project_id AND NOT p.is_removed AND p.task_id_in_schedule=ANY(t.predecessor_ids)
        AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label;
      IF v_ns IS NULL THEN v_ns:=t.start_day; END IF;
      IF v_ns IS NULL THEN CONTINUE; END IF;
      v_day1:=public._schedule_unit_day1(t.project_id,t.unit_kind,t.unit_label);
      v_s:=public.schedule_working_date(v_day1,v_ns);
      v_f:=public.schedule_working_date(v_day1,public._schedule_end_day(v_ns,t.duration_days));
      IF v_ns IS DISTINCT FROM t.start_day OR v_s IS DISTINCT FROM t.planned_start_date OR v_f IS DISTINCT FROM t.planned_finish_date THEN
        UPDATE public.project_tasks SET start_day=v_ns,planned_start_date=v_s,planned_finish_date=v_f,updated_at=now() WHERE id=t.id;
        INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,reason,old_value,new_value,actor_id)
        VALUES(p_project_id,t.id,'project_task','cascade',p_reason,
          jsonb_build_object('start_day',t.start_day,'planned_start_date',t.planned_start_date,'planned_finish_date',t.planned_finish_date),
          jsonb_build_object('start_day',v_ns,'planned_start_date',v_s,'planned_finish_date',v_f),p_actor);
        v_moved:=v_moved||jsonb_build_array(jsonb_build_object('task_id',t.id,'code',t.task_id_in_schedule,'name',t.task_name,
          'old_start_day',t.start_day,'new_start_day',v_ns,'old_start',t.planned_start_date,'old_finish',t.planned_finish_date,'new_start',v_s,'new_finish',v_f));
      END IF;
    END LOOP;
    EXIT WHEN NOT v_progress;
  END LOOP;
  PERFORM set_config('hstack.schedule_revise',prior,true);
  IF cardinality(v_done)<>cardinality(v_aff) THEN RAISE EXCEPTION 'Schedule dependency cycle among successor tasks' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('moved',v_moved,'not_moved',v_not);
END $$;

CREATE OR REPLACE FUNCTION public._schedule_recalc_one(p_task_id uuid, p_derive_start boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE t public.project_tasks%ROWTYPE; v_pred text; v_ns int; v_day1 date; prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
BEGIN
  SELECT * INTO t FROM public.project_tasks WHERE id=p_task_id FOR UPDATE;
  IF t.task_id_in_schedule=ANY(coalesce(t.predecessor_ids,ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'Schedule dependency cycle: % (%) cannot follow itself',t.task_id_in_schedule,t.task_name USING ERRCODE='22023';
  END IF;
  SELECT pred INTO v_pred FROM unnest(coalesce(t.predecessor_ids,ARRAY[]::text[])) pred
  WHERE NOT EXISTS(SELECT 1 FROM public.project_tasks p WHERE p.project_id=t.project_id AND NOT p.is_removed AND p.task_id_in_schedule=pred
    AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label) LIMIT 1;
  IF v_pred IS NOT NULL THEN
    RAISE EXCEPTION 'Task % (%): predecessor % does not exist in the same project/unit',t.task_id_in_schedule,t.task_name,v_pred USING ERRCODE='22023';
  END IF;
  v_ns:=t.start_day;
  IF p_derive_start AND coalesce(cardinality(t.predecessor_ids),0)>0 THEN
    SELECT max(public._schedule_end_day(p.start_day,p.duration_days))+1 INTO v_ns FROM public.project_tasks p
    WHERE p.project_id=t.project_id AND NOT p.is_removed AND p.task_id_in_schedule=ANY(t.predecessor_ids)
      AND p.unit_kind IS NOT DISTINCT FROM t.unit_kind AND p.unit_label IS NOT DISTINCT FROM t.unit_label;
    v_ns:=coalesce(v_ns,t.start_day);
  END IF;
  IF v_ns IS NULL THEN RETURN; END IF;
  v_day1:=public._schedule_unit_day1(t.project_id,t.unit_kind,t.unit_label);
  PERFORM set_config('hstack.schedule_revise','on',true);
  UPDATE public.project_tasks SET start_day=v_ns,
    planned_start_date=CASE WHEN v_day1 IS NULL THEN planned_start_date ELSE public.schedule_working_date(v_day1,v_ns) END,
    planned_finish_date=CASE WHEN v_day1 IS NULL THEN planned_finish_date ELSE public.schedule_working_date(v_day1,public._schedule_end_day(v_ns,t.duration_days)) END
  WHERE id=t.id;
  PERFORM set_config('hstack.schedule_revise',prior,true);
END $$;

REVOKE ALL ON FUNCTION public._schedule_cascade_successors(uuid,uuid[],uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._schedule_recalc_one(uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._schedule_unit_day1(uuid,text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.schedule_revise_task(p_task_id uuid, p_patch jsonb, p_reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE; v_bad text;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_keys text[] := ARRAY['task_name','duration_days','planned_start_date','planned_finish_date','predecessor_ids','display_order','phase','stage_name','parent_task_id','parent_stage_number','responsible_role','library_task_id','start_day','unit_kind','unit_label'];
  v_audit_keys text[]; v_dates boolean := coalesce(p_patch ?| ARRAY['start_day','duration_days','predecessor_ids'], false);
  v_seeds uuid[]; v_cascade jsonb := jsonb_build_object('moved','[]'::jsonb,'not_moved','[]'::jsonb); v_legacy jsonb;
BEGIN
  SELECT * INTO t FROM public.project_tasks WHERE id = p_task_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF v_uid IS NULL OR NOT public.can_edit_schedule(v_uid) OR NOT public.user_can_access_project(v_uid, t.project_id) THEN
    RAISE EXCEPTION 'Only the planning office can revise the schedule' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schedule_baselines WHERE project_id = t.project_id) THEN
    RAISE EXCEPTION 'Publish a baseline before revising tasks' USING ERRCODE = '22023';
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'A reason is required for a schedule revision' USING ERRCODE = '22023'; END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN RAISE EXCEPTION 'Nothing to change'; END IF;
  SELECT k INTO v_bad FROM jsonb_object_keys(p_patch) k WHERE NOT (k = ANY(v_keys)) LIMIT 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'Field % cannot be revised', v_bad USING ERRCODE = '22023'; END IF;
  IF p_patch ? 'duration_days' AND (p_patch->>'duration_days')::int < 0 THEN RAISE EXCEPTION 'Duration cannot be negative'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||t.project_id::text));
  PERFORM set_config('hstack.schedule_revise', 'on', true);
  UPDATE public.project_tasks SET
    task_name = CASE WHEN p_patch ? 'task_name' THEN p_patch->>'task_name' ELSE task_name END,
    duration_days = CASE WHEN p_patch ? 'duration_days' THEN (p_patch->>'duration_days')::int ELSE duration_days END,
    planned_start_date = CASE WHEN p_patch ? 'planned_start_date' THEN (p_patch->>'planned_start_date')::date ELSE planned_start_date END,
    planned_finish_date = CASE WHEN p_patch ? 'planned_finish_date' THEN (p_patch->>'planned_finish_date')::date ELSE planned_finish_date END,
    predecessor_ids = CASE WHEN p_patch ? 'predecessor_ids' THEN ARRAY(SELECT jsonb_array_elements_text(coalesce(nullif(p_patch->'predecessor_ids','null'::jsonb),'[]'::jsonb))) ELSE predecessor_ids END,
    display_order = CASE WHEN p_patch ? 'display_order' THEN (p_patch->>'display_order')::int ELSE display_order END,
    phase = CASE WHEN p_patch ? 'phase' THEN p_patch->>'phase' ELSE phase END,
    stage_name = CASE WHEN p_patch ? 'stage_name' THEN p_patch->>'stage_name' ELSE stage_name END,
    parent_task_id = CASE WHEN p_patch ? 'parent_task_id' THEN (p_patch->>'parent_task_id')::uuid ELSE parent_task_id END,
    parent_stage_number = CASE WHEN p_patch ? 'parent_stage_number' THEN p_patch->>'parent_stage_number' ELSE parent_stage_number END,
    responsible_role = CASE WHEN p_patch ? 'responsible_role' THEN p_patch->>'responsible_role' ELSE responsible_role END,
    library_task_id = CASE WHEN p_patch ? 'library_task_id' THEN (p_patch->>'library_task_id')::uuid ELSE library_task_id END,
    start_day = CASE WHEN p_patch ? 'start_day' THEN (p_patch->>'start_day')::int ELSE start_day END,
    unit_kind = CASE WHEN p_patch ? 'unit_kind' THEN p_patch->>'unit_kind' ELSE unit_kind END,
    unit_label = CASE WHEN p_patch ? 'unit_label' THEN p_patch->>'unit_label' ELSE unit_label END,
    updated_at = now()
  WHERE id = p_task_id RETURNING * INTO n;
  PERFORM set_config('hstack.schedule_revise', '', true);
  IF v_dates THEN
    PERFORM public._schedule_recalc_one(n.id, p_patch ? 'predecessor_ids' AND NOT p_patch ? 'start_day');
    SELECT * INTO n FROM public.project_tasks WHERE id = n.id;
    SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_seeds FROM public.project_tasks
    WHERE project_id = n.project_id AND id <> n.id AND n.task_id_in_schedule = ANY(predecessor_ids)
      AND unit_kind IS NOT DISTINCT FROM n.unit_kind AND unit_label IS NOT DISTINCT FROM n.unit_label;
    v_cascade := public._schedule_cascade_successors(n.project_id, v_seeds, n.id, v_reason, v_uid);
  END IF;
  v_audit_keys := ARRAY(SELECT k FROM unnest(v_keys) k WHERE p_patch ? k OR (v_dates AND k IN ('start_day','planned_start_date','planned_finish_date')));
  INSERT INTO public.schedule_audit_log(project_id, task_id, entity, action, reason, old_value, new_value, actor_id)
  VALUES (t.project_id, t.id, 'project_task', 'revise', v_reason,
    (SELECT jsonb_object_agg(k, to_jsonb(t)->k) FROM unnest(v_audit_keys) k),
    (SELECT jsonb_object_agg(k, to_jsonb(n)->k) FROM unnest(v_audit_keys) k), v_uid);
  v_legacy := coalesce((SELECT jsonb_object_agg(k, to_jsonb(n)->k) FROM unnest(v_keys) k WHERE p_patch ? k), '{}'::jsonb);
  RETURN v_legacy || jsonb_build_object(
    'task', jsonb_build_object('task_id', n.id, 'code', n.task_id_in_schedule, 'name', n.task_name,
      'old_start', t.planned_start_date, 'old_finish', t.planned_finish_date, 'new_start', n.planned_start_date, 'new_finish', n.planned_finish_date,
      'start_day', n.start_day, 'duration_days', n.duration_days),
    'moved', v_cascade->'moved', 'not_moved', v_cascade->'not_moved');
END $function$;

CREATE OR REPLACE FUNCTION public.schedule_add_task(p_project_id uuid, p_task jsonb, p_reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; r text:=nullif(btrim(p_reason),''); bad text; prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
 IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'A reason is required to add a schedule task' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
 IF NOT EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN RAISE EXCEPTION 'Publish a baseline before adding a revision task' USING ERRCODE='22023'; END IF;
 IF p_task IS NULL OR jsonb_typeof(p_task)<>'object' THEN RAISE EXCEPTION 'Task must be an object' USING ERRCODE='22023'; END IF;
 SELECT k INTO bad FROM jsonb_object_keys(p_task) k WHERE k<>ALL(ARRAY['task_id_in_schedule','task_name','phase','duration_days','planned_start_date','planned_finish_date','predecessor_ids','display_order','stage_name','parent_task_id','parent_stage_number','responsible_role','library_task_id','start_day','unit_kind','unit_label','work_category','stage_number']) LIMIT 1;
 IF bad IS NOT NULL THEN RAISE EXCEPTION 'Field % cannot be supplied',bad USING ERRCODE='22023'; END IF;
 IF nullif(btrim(p_task->>'task_name'),'') IS NULL OR nullif(btrim(p_task->>'task_id_in_schedule'),'') IS NULL THEN RAISE EXCEPTION 'Task code and name are required' USING ERRCODE='22023'; END IF;
 IF coalesce((p_task->>'duration_days')::int,0)<0 THEN RAISE EXCEPTION 'Duration cannot be negative' USING ERRCODE='22023'; END IF;
 IF p_task ? 'parent_task_id' AND NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=(p_task->>'parent_task_id')::uuid AND project_id=p_project_id AND NOT is_removed) THEN RAISE EXCEPTION 'Parent task must belong to this project' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=p_task->>'task_id_in_schedule' AND NOT is_removed) THEN RAISE EXCEPTION 'Task code already exists' USING ERRCODE='22023'; END IF;
 PERFORM set_config('hstack.schedule_membership','add',true);
 INSERT INTO public.project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,planned_start_date,planned_finish_date,predecessor_ids,display_order,stage_name,parent_task_id,parent_stage_number,responsible_role,library_task_id,start_day,unit_kind,unit_label,work_category,stage_number)
 VALUES(p_project_id,p_task->>'task_id_in_schedule',p_task->>'task_name',coalesce(p_task->>'phase','Pre-Production'),coalesce((p_task->>'duration_days')::int,0),(p_task->>'planned_start_date')::date,(p_task->>'planned_finish_date')::date,ARRAY(SELECT jsonb_array_elements_text(coalesce(p_task->'predecessor_ids','[]'::jsonb))),(p_task->>'display_order')::int,p_task->>'stage_name',(p_task->>'parent_task_id')::uuid,p_task->>'parent_stage_number',p_task->>'responsible_role',(p_task->>'library_task_id')::uuid,(p_task->>'start_day')::int,p_task->>'unit_kind',p_task->>'unit_label',coalesce(p_task->>'work_category','process'),p_task->>'stage_number') RETURNING * INTO t;
 PERFORM set_config('hstack.schedule_membership',prior,true);
 PERFORM public._schedule_recalc_one(t.id, t.start_day IS NULL);
 SELECT * INTO t FROM public.project_tasks WHERE id=t.id;
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,new_value,actor_id) VALUES(p_project_id,t.id,'project_task','add',r,to_jsonb(t),u);
 RETURN t.id;
END $function$;

CREATE OR REPLACE FUNCTION public.schedule_remove_task(p_task_id uuid, p_reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE; s public.project_tasks%ROWTYPE; r text:=nullif(btrim(p_reason),''); prior text:=coalesce(current_setting('hstack.schedule_revise',true),'');
  v_seeds uuid[]:=ARRAY[]::uuid[]; v_new text[]; v_cascade jsonb;
BEGIN
 SELECT * INTO t FROM project_tasks WHERE id=p_task_id;
 IF t.id IS NULL OR u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,t.project_id) THEN RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501'; END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'A reason is required to remove a schedule task' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||t.project_id::text));
 SELECT * INTO t FROM project_tasks WHERE id=p_task_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id=t.project_id) THEN RAISE EXCEPTION 'Publish a baseline before removing a revision task' USING ERRCODE='22023'; END IF;
 IF t.is_removed THEN RAISE EXCEPTION 'Task is already removed' USING ERRCODE='22023'; END IF;
 PERFORM set_config('hstack.schedule_revise','on',true);
 UPDATE project_tasks SET is_removed=true,removed_at=now(),removed_by=u,removed_reason=r,updated_at=now() WHERE id=p_task_id RETURNING * INTO n;
 FOR s IN SELECT * FROM project_tasks WHERE project_id=t.project_id AND NOT is_removed AND id<>t.id AND t.task_id_in_schedule=ANY(predecessor_ids)
   AND unit_kind IS NOT DISTINCT FROM t.unit_kind AND unit_label IS NOT DISTINCT FROM t.unit_label FOR UPDATE LOOP
   SELECT coalesce(array_agg(x ORDER BY o),ARRAY[]::text[]) INTO v_new FROM (
     SELECT x,min(o) o FROM unnest(array_remove(s.predecessor_ids,t.task_id_in_schedule)||coalesce(t.predecessor_ids,ARRAY[]::text[])) WITH ORDINALITY q(x,o)
     WHERE x<>s.task_id_in_schedule GROUP BY x) z;
   UPDATE project_tasks SET predecessor_ids=v_new,updated_at=now() WHERE id=s.id;
   INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,old_value,new_value,actor_id)
   VALUES(t.project_id,s.id,'project_task','relink',r,jsonb_build_object('predecessor_ids',s.predecessor_ids),jsonb_build_object('predecessor_ids',v_new),u);
   v_seeds:=v_seeds||s.id;
 END LOOP;
 PERFORM set_config('hstack.schedule_revise',prior,true);
 v_cascade:=public._schedule_cascade_successors(t.project_id,v_seeds,NULL,r,u);
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,old_value,new_value,actor_id) VALUES(t.project_id,t.id,'project_task','remove',r,to_jsonb(t),to_jsonb(n)||jsonb_build_object('relinked',to_jsonb(v_seeds),'cascade',v_cascade),u);
 RETURN t.id;
END $function$;