-- Published closure/follow-up and production-system guard; all changes roll back.
DO $t$
DECLARE
 p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; pe uuid:='565152cc-961b-4974-80b2-93ebd156ec46';
 base uuid; archive uuid; amc uuid; v int; snap jsonb; code text; msg text; ev text:='';
BEGIN
 IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id=p) THEN RAISE EXCEPTION 'Test project already baselined'; END IF;
 INSERT INTO project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'sched2a_closure','write' FROM profiles WHERE auth_user_id=pe ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',pe::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name) VALUES(p,'S2C-BASE','Closure baseline fixture') RETURNING id INTO base;
 PERFORM publish_schedule_baseline(p,NULL);
 code:='allowed'; msg:=''; BEGIN UPDATE projects SET production_system='panelised' WHERE id=p; EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; msg:=SQLERRM; END;
 IF code<>'42501' OR msg<>'This project has a published baseline; change the production system through a schedule revision.' THEN RAISE EXCEPTION '(c) production-system guard % %',code,msg; END IF;
 IF (SELECT production_system FROM projects WHERE id=p)<>'modular' THEN RAISE EXCEPTION '(c) production system changed'; END IF;
 ev:=ev||E'\n(c) production-system UPDATE 42501 with exact clear message; original modular value retained';
 UPDATE projects SET status='closed' WHERE id=p;
 SELECT id INTO archive FROM project_tasks WHERE project_id=p AND task_id_in_schedule='ARCHIVE-UPLOAD-'||substr(p::text,1,8);
 SELECT id INTO amc FROM project_tasks WHERE project_id=p AND task_id_in_schedule='AMC-FU-'||substr(p::text,1,8);
 IF archive IS NULL OR amc IS NULL THEN RAISE EXCEPTION '(b) closure follow-ups missing'; END IF;
 IF EXISTS(SELECT 1 FROM project_tasks WHERE id IN(archive,amc) AND (baseline_version IS NOT NULL OR work_category<>'process')) THEN RAISE EXCEPTION '(b) follow-up marker/category'; END IF;
 IF NOT EXISTS(SELECT 1 FROM project_archives WHERE project_id=p AND karthik_upload_task_id=archive) THEN RAISE EXCEPTION '(b) archive linkage'; END IF;
 ev:=ev||E'\n(b) published project closed successfully; archive + AMC tasks created with baseline_version NULL/work_category process; archive linkage preserved';
 v:=publish_schedule_baseline(p,'Post-closure snapshot check');
 SELECT snapshot INTO snap FROM schedule_baselines WHERE project_id=p AND version=v;
 IF v<>2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(snap) e WHERE e->>'id' IN(archive::text,amc::text)) THEN RAISE EXCEPTION '(b) follow-up leaked into snapshot'; END IF;
 IF EXISTS(SELECT 1 FROM project_tasks WHERE id IN(archive,amc) AND baseline_version IS NOT NULL) OR (SELECT baseline_version FROM project_tasks WHERE id=base)<>2 THEN RAISE EXCEPTION '(b) follow-up version stamping'; END IF;
 RESET ROLE;
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SCHED2A CLOSURE ROLLBACK EVIDENCE'||ev||E'\n(b) version 2 excludes both follow-ups; both remain baseline_version NULL while normal task stamps version 2';
END $t$;
