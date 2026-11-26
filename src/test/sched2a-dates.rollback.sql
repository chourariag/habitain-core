-- Server date calculations with a real planning_engineer; every write rolls back.
DO $t$
DECLARE
 p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; pe uuid:='565152cc-961b-4974-80b2-93ebd156ec46';
 a uuid; b uuid; c uuid; m uuid; n uuid; un uuid; j jsonb; code text; msg text; ev text:='';
BEGIN
 IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id=p) THEN RAISE EXCEPTION 'Test project already baselined'; END IF;
 INSERT INTO project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'sched2a_dates','write' FROM profiles WHERE auth_user_id=pe ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',pe::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO project_schedule_units(project_id,unit_kind,unit_label,day1) VALUES(p,'module','S2DATE','2026-11-02'),(p,'module','S2NONE',NULL);
 PERFORM schedule_change_holiday('2026-11-04','SCHED2A mid-span holiday',true,'Rollback calendar fixture');
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label,predecessor_ids) VALUES
 (p,'S2D-A','Chain A','factory',3,1,'module','S2DATE',ARRAY[]::text[]) RETURNING id INTO a;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label,predecessor_ids) VALUES
 (p,'S2D-B','Chain B','factory',2,99,'module','S2DATE',ARRAY['S2D-A']) RETURNING id INTO b;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label,predecessor_ids) VALUES
 (p,'S2D-C','Chain C','factory',1,99,'module','S2DATE',ARRAY['S2D-B']) RETURNING id INTO c;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label) VALUES
 (p,'S2D-M','Zero day milestone','factory',0,6,'module','S2DATE') RETURNING id INTO m;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day,unit_kind,unit_label) VALUES
 (p,'S2D-N','No Day 1','factory',1,1,'module','S2NONE') RETURNING id INTO n;
 INSERT INTO project_tasks(project_id,task_id_in_schedule,task_name,phase,duration_days,start_day) VALUES
 (p,'S2D-U','No unit fallback','factory',1,1) RETURNING id INTO un;
 j:=schedule_recalculate_dates(p);
 IF NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=a AND start_day=1 AND planned_start_date='2026-11-02' AND planned_finish_date='2026-11-05')
  OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=b AND start_day=4 AND planned_start_date='2026-11-06' AND planned_finish_date='2026-11-07')
  OR NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=c AND start_day=6 AND planned_start_date='2026-11-09' AND planned_finish_date='2026-11-09') THEN RAISE EXCEPTION '(d) chain/calendar dates'; END IF;
 IF NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=m AND start_day=6 AND planned_start_date='2026-11-09' AND planned_finish_date='2026-11-09') THEN RAISE EXCEPTION '(d) milestone'; END IF;
 IF NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=n AND planned_start_date IS NULL AND planned_finish_date IS NULL) OR NOT j->>'warnings' LIKE '%S2NONE%' THEN RAISE EXCEPTION '(d) missing Day 1 warning %',j; END IF;
 IF NOT EXISTS(SELECT 1 FROM project_tasks WHERE id=un AND planned_start_date='2026-11-02') OR NOT j->>'warnings' LIKE '%S2D-U%' THEN RAISE EXCEPTION '(d) no-unit fallback'; END IF;
 ev:=ev||E'\n(d) A/B/C start_days 1/4/6; 04/11 holiday and 08/11 Sunday skipped; dates A 02–05/11, B 06–07/11, C 09/11; milestone, missing-Day1 warning/NULLs and no-unit fallback passed';
 UPDATE project_tasks SET predecessor_ids=ARRAY['S2D-C'] WHERE id=b;
 code:='allowed'; msg:=''; BEGIN PERFORM schedule_recalculate_dates(p); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; msg:=SQLERRM; END;
 IF code<>'22023' OR msg NOT LIKE '%S2D-B%' OR msg NOT LIKE '%S2D-C%' OR msg NOT LIKE '%cycle%' THEN RAISE EXCEPTION '(d) cycle % %',code,msg; END IF;
 UPDATE project_tasks SET predecessor_ids=ARRAY['S2D-A'] WHERE id=b;
 UPDATE project_tasks SET predecessor_ids=ARRAY['NO-SUCH-PREDECESSOR'] WHERE id=c;
 code:='allowed'; msg:=''; BEGIN PERFORM schedule_recalculate_dates(p); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; msg:=SQLERRM; END;
 IF code<>'22023' OR msg NOT LIKE '%NO-SUCH-PREDECESSOR%' OR msg NOT LIKE '%same project/unit%' THEN RAISE EXCEPTION '(d) missing predecessor % %',code,msg; END IF;
 UPDATE project_tasks SET predecessor_ids=ARRAY['S2D-B'] WHERE id=c;
 ev:=ev||E'\n(d) cycle 22023 names B and C; missing predecessor 22023 names missing code and same project/unit';
 PERFORM publish_schedule_baseline(p,NULL);
 code:='allowed'; BEGIN PERFORM schedule_recalculate_dates(p); EXCEPTION WHEN OTHERS THEN code:=SQLSTATE; END;
 IF code<>'42501' THEN RAISE EXCEPTION '(d) published recalc %',code; END IF;
 IF NOT EXISTS(SELECT 1 FROM schedule_audit_log WHERE project_id=p AND actor_id=pe AND action='recalculate_dates') THEN RAISE EXCEPTION '(d) recalc audit'; END IF;
 RESET ROLE;
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='SCHED2A DATES ROLLBACK EVIDENCE'||ev||E'\n(d) published recalculation 42501; successful recalculation audited';
END $t$;
