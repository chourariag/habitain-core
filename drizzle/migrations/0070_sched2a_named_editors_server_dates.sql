CREATE TABLE public.schedule_editor_users(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  added_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.schedule_editor_users TO authenticated;
GRANT ALL ON public.schedule_editor_users TO service_role;
ALTER TABLE public.schedule_editor_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read named schedule editors" ON public.schedule_editor_users
FOR SELECT TO authenticated USING (public.is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.can_edit_schedule(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT _uid IS NOT NULL
     AND (auth.uid() IS NULL OR _uid=auth.uid())
     AND public.is_active_staff(_uid)
     AND (EXISTS(
       SELECT 1 FROM public.user_roles ur
       JOIN public.schedule_editor_roles sr ON sr.role=ur.role
       WHERE ur.user_id=_uid
     ) OR EXISTS(
       SELECT 1 FROM public.schedule_editor_users su WHERE su.user_id=_uid
     ))
$$;

CREATE OR REPLACE FUNCTION public.schedule_task_membership_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  p uuid;
  mode text:=coalesce(current_setting('hstack.schedule_membership',true),'');
  trusted boolean:=current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.schedule_add_task(uuid,jsonb,text)'::regprocedure));
  followup boolean:=mode='followup' AND (
    current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.trg_project_closure_create_archive()'::regprocedure))
    OR current_user=pg_get_userbyid((SELECT proowner FROM pg_proc WHERE oid='public.trg_project_closure_amc_followup()'::regprocedure))
  );
  fixed_followup boolean:=false;
BEGIN
  p:=CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p::text));
  IF TG_OP='INSERT' AND followup THEN
    fixed_followup:=
      (NEW.task_id_in_schedule='ARCHIVE-UPLOAD-'||substr(NEW.project_id::text,1,8)
       AND NEW.phase='Closure' AND NEW.responsible_role='planning_engineer'
       AND NEW.status='Upcoming' AND NEW.task_type='task'
       AND NEW.planned_start_date=CURRENT_DATE AND NEW.planned_finish_date=CURRENT_DATE+3)
      OR
      (NEW.task_id_in_schedule='AMC-FU-'||substr(NEW.project_id::text,1,8)
       AND NEW.phase='Post-Production' AND NEW.responsible_role='sales_director'
       AND NEW.status='Pending' AND NEW.completion_percentage=0
       AND NEW.planned_start_date=CURRENT_DATE AND NEW.planned_finish_date=CURRENT_DATE+7);
  END IF;
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p) THEN
    IF TG_OP='DELETE' OR NOT ((trusted AND mode IN ('add','handover')) OR fixed_followup) THEN
      RAISE EXCEPTION 'Published schedule membership requires a reasoned revision; tasks must be archived, not deleted' USING ERRCODE='42501';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.baseline_version:=NULL;
    NEW.is_removed:=false;
    NEW.removed_at:=NULL;
    NEW.removed_by:=NULL;
    NEW.removed_reason:=NULL;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.trg_project_closure_create_archive()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _archive_id uuid;
  _task_id uuid;
  _project_name text:=COALESCE(NEW.name,'Project');
  _project_code text:=NEW.id::text;
  _cloud_report_url text:='/projects/'||NEW.id||'/archive';
  _planning_engineer_id uuid;
  _prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
  IF NEW.status<>'closed' OR OLD.status='closed' THEN RETURN NEW; END IF;
  INSERT INTO public.project_archives(project_id,cloud_report_url)
  VALUES(NEW.id,_cloud_report_url)
  ON CONFLICT(project_id) DO UPDATE SET cloud_report_url=EXCLUDED.cloud_report_url
  RETURNING id INTO _archive_id;
  SELECT ur.user_id INTO _planning_engineer_id FROM public.user_roles ur WHERE ur.role::text='planning_engineer' LIMIT 1;
  PERFORM set_config('hstack.schedule_membership','followup',true);
  INSERT INTO public.project_tasks(
    project_id,task_id_in_schedule,task_name,phase,planned_start_date,planned_finish_date,
    responsible_role,status,task_type
  ) VALUES(
    NEW.id,'ARCHIVE-UPLOAD-'||substring(NEW.id::text,1,8),
    'Upload '||_project_name||' archive to Zoho Drive','Closure',
    CURRENT_DATE,CURRENT_DATE+INTERVAL '3 days','planning_engineer','Upcoming','task'
  ) RETURNING id INTO _task_id;
  PERFORM set_config('hstack.schedule_membership',_prior,true);
  UPDATE public.project_archives SET karthik_upload_task_id=_task_id WHERE id=_archive_id;
  INSERT INTO public.notifications(recipient_id,title,body,content,type,category,related_table,related_id)
  SELECT DISTINCT ur.user_id,_project_name||' archive is being prepared',
    'Cloud Report: '||_cloud_report_url||E'\nDownload ZIP will be available shortly.',
    'Cloud Report: '||_cloud_report_url||E'\nDownload ZIP will be available shortly.\n\nAction for Planning Engineer: Download the ZIP and upload to Zoho Drive under Projects/'||_project_code||'/Archive. Mark the task complete in HStack.',
    'info','project_closure','project_archives',_archive_id
  FROM public.user_roles ur
  WHERE ur.role::text=ANY(ARRAY['managing_director','principal_architect','sales_director','head_of_projects','planning_head','planning_engineer','finance_director','architecture_director']);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_project_closure_amc_followup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  _client_name text;
  _task_id uuid;
  _prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
  IF NEW.status='closed' AND COALESCE(OLD.status,'')<>'closed' THEN
    _client_name:=COALESCE(NEW.client_name,'Client');
    PERFORM set_config('hstack.schedule_membership','followup',true);
    INSERT INTO public.project_tasks(
      project_id,task_id_in_schedule,task_name,phase,status,planned_start_date,planned_finish_date,
      responsible_role,remarks,completion_percentage
    ) VALUES(
      NEW.id,'AMC-FU-'||substr(NEW.id::text,1,8),
      'Follow up with '||_client_name||' for AMC and referrals','Post-Production','Pending',
      CURRENT_DATE,CURRENT_DATE+7,'sales_director',
      NEW.name||' has been closed. Contact the client to discuss Annual Maintenance Contract and request referrals.',0
    ) RETURNING id INTO _task_id;
    PERFORM set_config('hstack.schedule_membership',_prior,true);
    INSERT INTO public.notifications(recipient_id,title,body,content,type,category,related_table,related_id,priority)
    SELECT ur.user_id,NEW.name||' closed — AMC follow-up required',
      'Action: Follow up with '||_client_name||' for AMC within 7 days.',
      'Action: Follow up with '||_client_name||' for AMC within 7 days.',
      'amc_followup_task','action','project_tasks',_task_id,'high'
    FROM public.user_roles ur WHERE ur.role::text='sales_director';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.clone_task_templates_to_project(_project_id uuid,_system text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_count integer:=0; sys public.production_system_type;
BEGIN
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=_project_id) THEN
    RAISE EXCEPTION 'This project has a published baseline; change the production system through a schedule revision.' USING ERRCODE='42501';
  END IF;
  IF _system IS NULL OR _system NOT IN ('modular','panelised','hybrid') THEN RETURN 0; END IF;
  sys:=_system::public.production_system_type;
  DELETE FROM public.project_tasks WHERE project_id=_project_id;
  WITH inserted AS(
    INSERT INTO public.project_tasks(
      project_id,task_id_in_schedule,task_name,phase,duration_days,predecessor_ids,responsible_role,
      status,completion_percentage,delay_days,is_locked,task_type,is_qc_gate,display_order,stage_number,
      input_required,output_deliverable,hstack_action,remarks
    )
    SELECT _project_id,t.stage_number,t.task_name,t.phase_name,COALESCE(t.typical_duration_days,0)::int,
      COALESCE(t.predecessor_stage_numbers,ARRAY[]::text[]),t.responsible_role,'Upcoming',0,0,
      COALESCE(array_length(t.predecessor_stage_numbers,1),0)>0,t.task_type,COALESCE(t.is_qc_gate,false),
      t.display_order,t.stage_number,t.input_required,t.output_deliverable,t.hstack_action,t.notes
    FROM public.production_task_templates t WHERE t.production_system=sys ORDER BY t.display_order RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM inserted;
  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION public.trg_clone_templates_on_project_system_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE has_existing integer;
BEGIN
  IF NEW.production_system IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN PERFORM public.clone_task_templates_to_project(NEW.id,NEW.production_system); RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND COALESCE(OLD.production_system,'') IS DISTINCT FROM COALESCE(NEW.production_system,'') THEN
    IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=NEW.id) THEN
      RAISE EXCEPTION 'This project has a published baseline; change the production system through a schedule revision.' USING ERRCODE='42501';
    END IF;
    SELECT count(*) INTO has_existing FROM public.project_tasks WHERE project_id=NEW.id;
    IF has_existing=0 THEN PERFORM public.clone_task_templates_to_project(NEW.id,NEW.production_system); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.publish_schedule_baseline(p_project_id uuid,p_reason text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  WHERE t.project_id=p_project_id
    AND NOT (t.baseline_version IS NULL AND (t.task_id_in_schedule LIKE 'ARCHIVE-UPLOAD-%' OR t.task_id_in_schedule LIKE 'AMC-FU-%'));
  IF snap IS NULL THEN RAISE EXCEPTION 'No schedule tasks to publish' USING ERRCODE='22023'; END IF;
  INSERT INTO public.schedule_baselines(project_id,version,kind,reason,published_by,snapshot)
  VALUES(p_project_id,v,CASE WHEN v=1 THEN 'baseline' ELSE 'revision' END,r,u,snap);
  PERFORM set_config('hstack.schedule_revise','on',true);
  UPDATE public.project_tasks SET baseline_version=v
  WHERE project_id=p_project_id
    AND NOT (baseline_version IS NULL AND (task_id_in_schedule LIKE 'ARCHIVE-UPLOAD-%' OR task_id_in_schedule LIKE 'AMC-FU-%'));
  PERFORM set_config('hstack.schedule_revise',prior,true);
  INSERT INTO public.schedule_audit_log(project_id,entity,action,reason,new_value,actor_id)
  VALUES(p_project_id,'schedule_baseline','publish',r,jsonb_build_object('version',v,'task_count',jsonb_array_length(snap)),u);
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.schedule_recalculate_dates(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
      CASE WHEN l.is_qc_gate THEN 'qc_gate' WHEN l.is_payment_milestone THEN 'payment' ELSE 'task' END
    ) RETURNING * INTO t;
    v_added:=v_added+1;
    INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
    VALUES(p_project_id,t.id,'project_task','add_library',to_jsonb(t),u);
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $$;

CREATE OR REPLACE FUNCTION public.schedule_repeat_for_units(p_project_id uuid,p_source_unit_label text,p_target_unit_labels text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u uuid:=auth.uid(); t public.project_tasks%ROWTYPE; n public.project_tasks%ROWTYPE;
  v_kind text; v_kinds int; v_target text; v_base text; v_code text;
  v_preds text[]; v_added int:=0; v_skipped int:=0;
BEGIN
  IF u IS NULL OR NOT public.can_edit_schedule(u) OR NOT public.user_can_access_project(u,p_project_id) THEN
    RAISE EXCEPTION 'Schedule editor and project access required' USING ERRCODE='42501';
  END IF;
  IF nullif(btrim(p_source_unit_label),'') IS NULL OR p_target_unit_labels IS NULL OR cardinality(p_target_unit_labels)=0 THEN
    RAISE EXCEPTION 'Source and target units are required' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
  PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||p_project_id::text));
  IF EXISTS(SELECT 1 FROM public.schedule_baselines WHERE project_id=p_project_id) THEN
    RAISE EXCEPTION 'Units can be repeated only before a baseline' USING ERRCODE='42501';
  END IF;
  SELECT min(unit_kind),count(DISTINCT unit_kind) INTO v_kind,v_kinds
  FROM public.project_tasks
  WHERE project_id=p_project_id AND NOT is_removed AND unit_label=p_source_unit_label AND phase='factory';
  IF v_kinds=0 THEN RAISE EXCEPTION 'Source unit has no factory tasks in this project' USING ERRCODE='22023'; END IF;
  IF v_kinds<>1 THEN RAISE EXCEPTION 'Source unit label has multiple unit kinds' USING ERRCODE='22023'; END IF;
  FOREACH v_target IN ARRAY p_target_unit_labels LOOP
    IF nullif(btrim(v_target),'') IS NULL OR v_target=p_source_unit_label THEN CONTINUE; END IF;
    FOR t IN SELECT * FROM public.project_tasks
      WHERE project_id=p_project_id AND NOT is_removed AND unit_label=p_source_unit_label AND phase='factory'
      ORDER BY display_order NULLS LAST,task_id_in_schedule,id
    LOOP
      v_base:=CASE WHEN right(t.task_id_in_schedule,length(p_source_unit_label)+1)='-'||p_source_unit_label
        THEN left(t.task_id_in_schedule,length(t.task_id_in_schedule)-length(p_source_unit_label)-1)
        ELSE t.task_id_in_schedule END;
      v_code:=v_base||'-'||v_target;
      IF EXISTS(SELECT 1 FROM public.project_tasks WHERE project_id=p_project_id AND task_id_in_schedule=v_code) THEN
        v_skipped:=v_skipped+1; CONTINUE;
      END IF;
      SELECT coalesce(array_agg(
        CASE WHEN right(pred,length(p_source_unit_label)+1)='-'||p_source_unit_label
          THEN left(pred,length(pred)-length(p_source_unit_label)-1) ELSE pred END||'-'||v_target
        ORDER BY ord),ARRAY[]::text[]) INTO v_preds
      FROM unnest(coalesce(t.predecessor_ids,ARRAY[]::text[])) WITH ORDINALITY x(pred,ord);
      INSERT INTO public.project_tasks(
        project_id,task_id_in_schedule,task_name,phase,duration_days,predecessor_ids,responsible_role,
        display_order,stage_name,parent_stage_number,library_task_id,start_day,unit_kind,unit_label,
        work_category,stage_number,input_required,output_deliverable,hstack_action,remarks,
        task_type,is_qc_gate,is_payment_milestone
      ) VALUES(
        p_project_id,v_code,t.task_name,t.phase,t.duration_days,v_preds,t.responsible_role,
        t.display_order,t.stage_name,t.parent_stage_number,t.library_task_id,t.start_day,t.unit_kind,v_target,
        t.work_category,t.stage_number,t.input_required,t.output_deliverable,t.hstack_action,t.remarks,
        t.task_type,t.is_qc_gate,t.is_payment_milestone
      ) RETURNING * INTO n;
      v_added:=v_added+1;
      INSERT INTO public.schedule_audit_log(project_id,task_id,entity,action,new_value,actor_id)
      VALUES(p_project_id,n.id,'project_task','repeat_unit',jsonb_build_object('source_unit',p_source_unit_label,'target_unit',v_target,'source_task_id',t.id,'new_task',to_jsonb(n)),u);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('count',v_added,'skipped',v_skipped);
END $$;

REVOKE ALL ON FUNCTION public.can_edit_schedule(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_edit_schedule(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.schedule_recalculate_dates(uuid),public.schedule_add_library_tasks(uuid,text,text,uuid[]),public.schedule_repeat_for_units(uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.schedule_recalculate_dates(uuid),public.schedule_add_library_tasks(uuid,text,text,uuid[]),public.schedule_repeat_for_units(uuid,text,text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.schedule_task_membership_guard() FROM PUBLIC,anon,authenticated;
