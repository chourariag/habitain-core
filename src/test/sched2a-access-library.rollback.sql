-- Real existing principals; all account/role/project fixtures roll back via the evidence exception.
DO $t$
#variable_conflict use_column
DECLARE
 p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
 venkat uuid:='e7554a18-8a12-4f45-b81d-468426c64f8b';
 pe uuid:='565152cc-961b-4974-80b2-93ebd156ec46';
 ph uuid:='7078cbcd-8830-40f8-9cf9-603e331d1fce';
 hp uuid:='3e544aa3-29a2-4d92-b2db-d8a0a841d319';
 se uuid:='47f183de-2809-4c9d-91b0-ab323ff3d0ad';
 libs uuid[]; j jsonb; code text; ev text:='';
BEGIN
 IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id=p) THEN RAISE EXCEPTION 'Test project already baselined'; END IF;
 INSERT INTO project_team_members(project_id,profile_id,role,access_level)
 SELECT p,id,'sched2a_test','write' FROM profiles WHERE auth_user_id IN(venkat,pe,ph,hp,se) ON CONFLICT DO NOTHING;
 INSERT INTO schedule_editor_users(user_id,note) VALUES(venkat,'Head of design team (Venkat)') ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',venkat::text,true); SET LOCAL ROLE authenticated;
 IF NOT can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION '(a) Venkat is not editor'; END IF;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',pe::text,true); SET LOCAL ROLE authenticated;
 IF NOT can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION '(a) planning_engineer lost editor'; END IF;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',ph::text,true); SET LOCAL ROLE authenticated;
 IF NOT can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION '(a) planning_head lost editor'; END IF;
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',hp::text,true); SET LOCAL ROLE authenticated;
 IF NOT can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION '(a) head_of_projects lost editor'; END IF;
 RESET ROLE;
 -- No second live head_operations account exists. Add it only inside this rollback fixture.
 INSERT INTO user_roles(user_id,role) VALUES(se,'head_operations');
 PERFORM set_config('request.jwt.claim.sub',se::text,true); SET LOCAL ROLE authenticated;
 IF NOT EXISTS(SELECT 1 FROM user_roles WHERE user_id=se AND role='head_operations') THEN RAISE EXCEPTION '(a) head_operations fixture absent'; END IF;
 IF can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION '(a) head_operations widened'; END IF;
 code:='allowed'; BEGIN PERFORM schedule_recalculate_dates(p); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(g) site recalculate: %',code; END IF;
 code:='allowed'; BEGIN PERFORM schedule_add_library_tasks(p,'module','S2DENY',ARRAY[]::uuid[]); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(g) site add library: %',code; END IF;
 code:='allowed'; BEGIN PERFORM schedule_repeat_for_units(p,'S2DENY',ARRAY['S2DENY2']); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(g) site repeat: %',code; END IF;
 ev:=ev||E'\n(a) Venkat/planning_engineer/planning_head/head_of_projects allowed; temporary head_operations + site_engineer principal denied; (g) all three non-editor RPCs 42501';
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',pe::text,true); SET LOCAL ROLE authenticated;
 SELECT array_agg(id ORDER BY code) INTO libs FROM schedule_library_tasks WHERE code IN('F01','F02','F03');
 j:=schedule_add_library_tasks(p,'module','S2M1',libs);
 IF (j->>'count')::int<>3 OR (j->>'skipped')::int<>0 THEN RAISE EXCEPTION '(e) first library result %',j; END IF;
 IF (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label='S2M1' AND library_task_id=ANY(libs))<>3
   OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F01-S2M1' AND task_name='Material receipt & inspection' AND phase='factory' AND duration_days=1 AND start_day=1 AND unit_kind='module' AND work_category='process') THEN
   RAISE EXCEPTION '(e) library rows incorrect'; END IF;
 j:=schedule_add_library_tasks(p,'module','S2M1',libs);
 IF (j->>'count')::int<>0 OR (j->>'skipped')::int<>3 OR (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label='S2M1' AND library_task_id=ANY(libs))<>3 THEN RAISE EXCEPTION '(e) idempotence %',j; END IF;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label,work_category)
 VALUES(p,'R90-S2SRC','Repeat source A','factory',2,1,'module','S2SRC','process');
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label,work_category,predecessor_ids)
 VALUES(p,'R91-S2SRC','Repeat source B','factory',1,3,'module','S2SRC','process',ARRAY['R90-S2SRC']);
 j:=schedule_repeat_for_units(p,'S2SRC',ARRAY['S2T1','S2T2']);
 IF (j->>'count')::int<>4 THEN RAISE EXCEPTION '(f) repeat result %',j; END IF;
 IF (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label IN('S2T1','S2T2') AND task_id_in_schedule IN('R90-S2T1','R91-S2T1','R90-S2T2','R91-S2T2'))<>4
   OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='R91-S2T1' AND predecessor_ids=ARRAY['R90-S2T1'] AND duration_days=1 AND start_day=3)
   OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='R91-S2T2' AND predecessor_ids=ARRAY['R90-S2T2']) THEN RAISE EXCEPTION '(f) repeat rows/predecessors'; END IF;
 ev:=ev||E'\n(e) three correct module library rows; second run 0 added/3 skipped; post-baseline tested below; (f) two targets, four unique codes, remapped predecessors/durations';
 PERFORM publish_schedule_baseline(p,NULL);
 code:='allowed'; BEGIN PERFORM schedule_add_library_tasks(p,'module','S2AFTER',libs); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(e) post-baseline library %',code; END IF;
 code:='allowed'; BEGIN PERFORM schedule_repeat_for_units(p,'S2SRC',ARRAY['S2AFTER']); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(f) post-baseline repeat %',code; END IF;
 code:='allowed'; BEGIN PERFORM schedule_recalculate_dates(p); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(d) post-baseline recalc %',code; END IF;
 IF (SELECT count(*) FROM schedule_audit_log WHERE project_id=p AND actor_id=pe AND action IN('add_library','repeat_unit'))<>7 THEN RAISE EXCEPTION 'Library/repeat audit count'; END IF;
 RESET ROLE;
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SCHED2A ACCESS/LIBRARY ROLLBACK EVIDENCE'||ev||E'\nPost-baseline recalculate/library/repeat all 42501; seven library/repeat audit rows present';
END $t$;
