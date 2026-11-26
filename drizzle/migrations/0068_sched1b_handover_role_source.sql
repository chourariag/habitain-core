CREATE OR REPLACE FUNCTION public.create_panel_handover_task(p_batch_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); b public.panel_batches%ROWTYPE; m uuid; mp uuid; tid uuid; prior text:=coalesce(current_setting('hstack.schedule_membership',true),'');
BEGIN
 IF u IS NULL OR NOT public.is_active_staff(u) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=u AND role IN ('factory_supervisor','factory_floor_supervisor','production_head','managing_director','finance_director','sales_director','architecture_director','super_admin')) THEN RAISE EXCEPTION 'Factory handover access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM panel_batches WHERE id=p_batch_id FOR UPDATE;
 IF b.id IS NULL OR b.project_id IS NULL OR NOT public.user_can_access_project(u,b.project_id) THEN RAISE EXCEPTION 'Panel batch project access required' USING ERRCODE='42501'; END IF;
 IF b.bay_assignment_id IS NOT NULL THEN
   SELECT a.module_id,mo.project_id INTO m,mp FROM bay_assignments a JOIN modules mo ON mo.id=a.module_id WHERE a.id=b.bay_assignment_id AND NOT coalesce(mo.is_archived,false);
   IF m IS NULL OR mp IS DISTINCT FROM b.project_id OR NOT public.user_can_access_project(u,mp) THEN RAISE EXCEPTION 'Module must belong to the accessible batch project' USING ERRCODE='42501'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('schedule_calendar'));
 PERFORM pg_advisory_xact_lock(hashtext('schedule_baseline:'||b.project_id::text));
 SELECT id INTO tid FROM project_tasks WHERE project_id=b.project_id AND task_id_in_schedule='PHO-'||b.id::text AND NOT is_removed;
 IF tid IS NOT NULL THEN RETURN tid; END IF;
 PERFORM set_config('hstack.schedule_membership','handover',true);
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,work_category,responsible_role,status)
 VALUES(b.project_id,'PHO-'||b.id::text,'Collect panels','Production','process','factory_floor_supervisor','Upcoming') RETURNING id INTO tid;
 PERFORM set_config('hstack.schedule_membership',prior,true);
 INSERT INTO schedule_audit_log(project_id,task_id,entity,action,reason,new_value,actor_id) VALUES(b.project_id,tid,'project_task','handover_helper','Panel batch marked ready for module handover',jsonb_build_object('panel_batch_id',b.id,'module_id',m,'task_name','Collect panels','phase','Production','work_category','process'),u);
 RETURN tid;
END $$;