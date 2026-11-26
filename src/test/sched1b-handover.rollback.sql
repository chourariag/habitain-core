-- Final confirmed restriction + permitted production role. All test writes roll back.
DO $t$
DECLARE p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; pe uuid:='565152cc-961b-4974-80b2-93ebd156ec46'; fs uuid:='47f183de-2809-4c9d-91b0-ab323ff3d0ad'; ph uuid:='822687f1-c516-4ddc-b54f-f574acd32859'; t uuid; b uuid; h uuid; ho uuid; code text; n int; ev text:='';
BEGIN
 INSERT INTO project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'sched1b_test','write' FROM profiles WHERE auth_user_id IN(pe,fs,ph);
 PERFORM set_config('request.jwt.claim.sub',pe::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name) VALUES(p,'SCHED1B-FINAL','Final baseline task') RETURNING id INTO t;
 PERFORM publish_schedule_baseline(p,NULL); RESET ROLE;
 code:='allowed'; BEGIN PERFORM clone_task_templates_to_project(p,'modular'); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=t) THEN RAISE EXCEPTION 'Template clone protection %',code; END IF;
 ev:=ev||E'\nTemplate re-clone as definer rejected 42501; original task retained';
 INSERT INTO panel_batches(project_id,bay_number,total_panels,completed_panels,current_stage,status) VALUES(p,103,4,4,'ready','in_progress') RETURNING id INTO b;
 PERFORM set_config('request.jwt.claim.sub',fs::text,true); SET LOCAL ROLE authenticated;
 code:='allowed'; BEGIN PERFORM create_panel_handover_task(b); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END; IF code<>'42501' THEN RAISE EXCEPTION 'Factory supervisor helper %',code; END IF;
 code:='allowed'; BEGIN INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name) VALUES(p,'SCHED1B-ARBITRARY','Arbitrary task'); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END; IF code<>'42501' THEN RAISE EXCEPTION 'Factory arbitrary task %',code; END IF;
 ev:=ev||E'\nConfirmed restriction: factory_supervisor helper and arbitrary INSERT both rejected 42501';
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',ph::text,true); SET LOCAL ROLE authenticated;
 h:=create_panel_handover_task(b);
 IF NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=h AND task_name='Collect panels' AND phase='Production' AND work_category='process' AND planned_start_date IS NULL AND planned_finish_date IS NULL AND baseline_version IS NULL) OR create_panel_handover_task(b)<>h THEN RAISE EXCEPTION 'Production helper payload/idempotence'; END IF;
 RESET ROLE; IF NOT EXISTS(SELECT 1 FROM schedule_audit_log WHERE task_id=h AND actor_id=ph AND action='handover_helper' AND length(reason)>0) THEN RAISE EXCEPTION 'Helper audit missing'; END IF; SET LOCAL ROLE authenticated;
 INSERT INTO panel_handovers(panel_batch_id,source_panel_bay,target_module_bay,project_id,related_task_id,created_by) VALUES(b,103,1,p,h,ph) RETURNING id INTO ho;
 IF NOT EXISTS(SELECT 1 FROM panel_handovers WHERE id=ho AND related_task_id=h) THEN RAISE EXCEPTION 'Handover readback'; END IF;
 UPDATE panel_batches SET status='handing_over' WHERE id=b; GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 OR NOT EXISTS(SELECT 1 FROM panel_batches WHERE id=b AND status='handing_over') THEN RAISE EXCEPTION 'Batch transition'; END IF;
 code:='allowed'; BEGIN INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name) VALUES(p,'SCHED1B-ARBITRARY','Arbitrary task'); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END; IF code<>'42501' THEN RAISE EXCEPTION 'Production arbitrary %',code; END IF;
 ev:=ev||E'\nExisting production_head: fixed helper/audit/idempotence passed; handover linked and read back; batch handing_over read back; arbitrary task INSERT rejected 42501';
 RESET ROLE; RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SCHED1B FINAL ROLLBACK EVIDENCE'||ev;
END $t$;
