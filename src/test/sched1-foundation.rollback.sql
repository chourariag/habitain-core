-- SCHED-1 role checks. Always rolls back: the block ends by raising its evidence as an exception.
-- Run through the managed SQL tool as a privileged session.
DO $t$
DECLARE p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
  se uuid:='47f183de-2809-4c9d-91b0-ab323ff3d0ad'; pe uuid:='565152cc-961b-4974-80b2-93ebd156ec46';
  sim uuid; ct uuid; nt uuid; v int; code text; d date; r uuid; cm uuid; n int; old_start date; pct int; j jsonb; bt uuid; ev text:='';
BEGIN
  SELECT ur.user_id INTO sim FROM public.user_roles ur WHERE ur.role='site_installation_mgr' AND public.is_active_staff(ur.user_id) AND NOT EXISTS(SELECT 1 FROM public.user_roles u2 JOIN public.schedule_editor_roles s ON s.role=u2.role WHERE u2.user_id=ur.user_id) LIMIT 1;
  INSERT INTO public.project_team_members(project_id,profile_id,role,access_level)
    SELECT p, pr.id, 'sched1_test', 'write' FROM public.profiles pr WHERE pr.auth_user_id IN (se,pe);
  SELECT id, planned_start_date, coalesce(completion_percentage,0) INTO ct, old_start, pct FROM public.project_tasks t WHERE project_id=p AND work_category='construction' ORDER BY EXISTS(SELECT 1 FROM public.project_boq_items b WHERE b.schedule_task_id=t.id), coalesce(completion_percentage,0) LIMIT 1;

  -- (a) site_engineer cannot change planned_start_date
  PERFORM set_config('request.jwt.claim.sub',se::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',se,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  code:='none'; BEGIN UPDATE public.project_tasks SET planned_start_date=coalesce(planned_start_date,current_date)+5 WHERE id=ct; GET DIAGNOSTICS n=ROW_COUNT; code:='rows='||n; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  IF (SELECT planned_start_date FROM public.project_tasks WHERE id=ct) IS DISTINCT FROM old_start THEN RAISE EXCEPTION '(a) date changed'; END IF;
  ev:=ev||E'\n'||'(a) site_engineer direct planned_start_date UPDATE'||': '||(code||' (unchanged)');
  IF sim IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub',sim::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',sim,'role','authenticated')::text,true);
    SET LOCAL ROLE authenticated;
    code:='none'; BEGIN UPDATE public.project_tasks SET planned_start_date=coalesce(planned_start_date,current_date)+5 WHERE id=ct; GET DIAGNOSTICS n=ROW_COUNT; code:='rows='||n; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
    RESET ROLE;
    IF code<>'42501' THEN RAISE EXCEPTION '(a2) expected 42501 got %',code; END IF;
    ev:=ev||E'\n'||'(a2) site_installation_mgr (has UPDATE policy) planned_start_date UPDATE'||': '||(code);
    SET LOCAL ROLE authenticated;
    UPDATE public.project_tasks SET remarks='sched1 actual', delay_cause='Weather' WHERE id=ct; GET DIAGNOSTICS n=ROW_COUNT;
    RESET ROLE;
    IF n<>1 THEN RAISE EXCEPTION '(a3) actual update blocked'; END IF;
    ev:=ev||E'\n'||'(a3) site_installation_mgr actual columns UPDATE'||': '||('rows=1 ok');
  END IF;

  -- (b) site_engineer Daily Report path updates completion_percentage
  SELECT day::date INTO d FROM generate_series(current_date-2,current_date,interval '1 day') day
   WHERE NOT EXISTS(SELECT 1 FROM public.daily_measurements WHERE project_id=p AND measurement_date=day::date AND trade='daily_site_report' AND NOT is_archived)
     AND NOT EXISTS(SELECT 1 FROM public.labour_attendance WHERE project_id=p AND work_date=day::date AND hours>0 AND NOT hours_confirmed)
     AND NOT EXISTS(SELECT 1 FROM public.site_report_task_progress sp JOIN public.daily_measurements dm ON dm.id=sp.report_id WHERE sp.task_id=ct AND dm.report_status='submitted' AND NOT dm.is_archived AND dm.measurement_date>day::date)
   ORDER BY day DESC LIMIT 1;
  IF d IS NULL THEN RAISE EXCEPTION '(b) no free date'; END IF;
  -- fixture: a construction task without BOQ lines, so progress comes from the reported % (BOQ-linked tasks derive % from quantities)
  INSERT INTO public.project_tasks(project_id,task_id_in_schedule,task_name,work_category,completion_percentage,planned_start_date,planned_finish_date)
    VALUES(p,'SCHED1-B','Sched1 DR fixture','construction',10,d,d+3) RETURNING id INTO bt; pct:=10;
  PERFORM set_config('request.jwt.claim.sub',se::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',se,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  r := public.save_site_report_draft(p,d,jsonb_build_object('progress',jsonb_build_array(jsonb_build_object('task_id',bt,'pct',least(pct+7,99)))));
  PERFORM public.submit_site_report(r);
  RESET ROLE;
  IF (SELECT completion_percentage FROM public.project_tasks WHERE id=bt)<>17 OR (SELECT actual_start_date FROM public.project_tasks WHERE id=bt)<>d THEN RAISE EXCEPTION '(b) pct not written'; END IF;
  ev:=ev||E'\n'||'(b) site_engineer Daily Report submit completion_percentage'||': '||(pct||' -> '||(SELECT completion_percentage FROM public.project_tasks WHERE id=bt)||', actual_start '||to_char(d,'DD/MM/YYYY'));

  -- (c) planning_engineer adds a task and changes duration before baseline
  PERFORM set_config('request.jwt.claim.sub',pe::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',pe,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.project_tasks(project_id,task_id_in_schedule,task_name,duration_days,baseline_version) VALUES(p,'SCHED1-T','Sched1 test task',3,99) RETURNING id INTO nt;
  UPDATE public.project_tasks SET duration_days=4 WHERE id=nt; GET DIAGNOSTICS n=ROW_COUNT;
  RESET ROLE;
  IF n<>1 OR (SELECT duration_days FROM public.project_tasks WHERE id=nt)<>4 OR (SELECT baseline_version FROM public.project_tasks WHERE id=nt) IS NOT NULL THEN RAISE EXCEPTION '(c) failed'; END IF;
  ev:=ev||E'\n'||'(c) planning_engineer INSERT + duration 3->4 (forged baseline_version cleared)'||': '||('ok');

  -- (d) publish, then direct duration update and reasonless revise are rejected
  SET LOCAL ROLE authenticated;
  v := public.publish_schedule_baseline(p, NULL);
  code:='none'; BEGIN UPDATE public.project_tasks SET duration_days=5 WHERE id=nt; code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  IF v<>1 OR code<>'42501' THEN RAISE EXCEPTION '(d) v=% code=%',v,code; END IF;
  ev:=ev||E'\n'||'(d1) publish v1 without reason / direct duration UPDATE'||': '||('v='||v||' / '||code);
  SET LOCAL ROLE authenticated;
  code:='none'; BEGIN PERFORM public.schedule_revise_task(nt,'{"duration_days":6}',''); code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE||' '||SQLERRM; END;
  ev:=ev||E'\n'||'(d2) schedule_revise_task without reason'||': '||(code);
  code:='none'; BEGIN PERFORM public.schedule_revise_task(nt,'{"completion_percentage":100}','x'); code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE||' '||SQLERRM; END;
  ev:=ev||E'\n'||'(d3) schedule_revise_task non-whitelisted field'||': '||(code);
  j := public.schedule_revise_task(nt,'{"duration_days":6}','Client moved slab pour');
  code:='none'; BEGIN UPDATE public.project_tasks SET baseline_version=NULL WHERE id=nt; code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  IF (SELECT duration_days FROM public.project_tasks WHERE id=nt)<>6 OR code<>'42501' THEN RAISE EXCEPTION '(d4) failed'; END IF;
  ev:=ev||E'\n'||'(d4) revise with reason / unlock attempt baseline_version=NULL'||': '||(j::text||' / '||code);
  ev:=ev||E'\n'||'(d5) audit rows'||': '||coalesce((SELECT string_agg(action||':'||coalesce(reason,'-'),', ') FROM public.schedule_audit_log WHERE project_id=p),'none');

  -- (e) version 2 needs a reason
  SET LOCAL ROLE authenticated;
  code:='none'; BEGIN PERFORM public.publish_schedule_baseline(p,'  '); code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE||' '||SQLERRM; END;
  v := public.publish_schedule_baseline(p,'Revised after design freeze');
  RESET ROLE;
  IF code NOT LIKE '22023%' OR v<>2 THEN RAISE EXCEPTION '(e) failed %',code; END IF;
  ev:=ev||E'\n'||'(e) v2 blank reason / v2 with reason'||': '||(code||' / v='||v);
  SET LOCAL ROLE authenticated;
  code:='none'; BEGIN UPDATE public.schedule_baselines SET reason='x'; GET DIAGNOSTICS n=ROW_COUNT; code:='rows='||n; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  ev:=ev||E'\n'||'(e2) editor UPDATE snapshot'||': '||(code);

  -- (f) comments
  PERFORM set_config('request.jwt.claim.sub',se::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',se,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.schedule_task_comments(project_id,task_id,body) VALUES(p,ct,'Crane not available until Thursday') RETURNING id INTO cm;
  code:='none'; BEGIN UPDATE public.schedule_task_comments SET status='resolved' WHERE id=cm; GET DIAGNOSTICS n=ROW_COUNT; code:='rows='||n; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  IF (SELECT status FROM public.schedule_task_comments WHERE id=cm)<>'open' THEN RAISE EXCEPTION '(f) status changed'; END IF;
  ev:=ev||E'\n'||'(f) site_engineer comment insert / status update'||': '||('inserted / '||code||' (still open)');
  ev:=ev||E'\n'||'(f2) notifications created'||': '||coalesce((SELECT count(*)||' to '||string_agg(DISTINCT ur.role::text,',') FROM public.notifications nn JOIN public.user_roles ur ON ur.user_id=nn.recipient_id AND ur.role IN ('planning_head','head_of_projects') WHERE nn.related_id=cm),'none');
  PERFORM set_config('request.jwt.claim.sub',pe::text,true); PERFORM set_config('request.jwt.claims',json_build_object('sub',pe,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.schedule_task_comments SET status='resolved' WHERE id=cm;
  code:='none'; BEGIN UPDATE public.schedule_task_comments SET body='edited' WHERE id=cm; code:='allowed'; EXCEPTION WHEN others THEN code:=SQLSTATE; END;
  RESET ROLE;
  ev:=ev||E'\n'||'(f3) planning_engineer resolve / body edit'||': '||coalesce((SELECT status||' by '||(resolved_by=pe)::text||' / '||code FROM public.schedule_task_comments WHERE id=cm),'none');

  -- (g) calendar: Sat 28/11/2026, Sun 29/11, holiday Mon 30/11
  SET LOCAL ROLE authenticated;
  INSERT INTO public.schedule_holidays(holiday_date,label) VALUES('2026-11-30','Sched1 test holiday');
  ev:=ev||E'\n'||concat_ws(E'\n',
   concat('(g1) working_date(Sat 28/11, 2): ', public.schedule_working_date('2026-11-28',2)::text),
   concat('(g2) working_date(Sun 29/11, 1) rolls forward: ', public.schedule_working_date('2026-11-29',1)::text),
   concat('(g3) working_date(Fri 27/11, 3) Sat counts, Sun+holiday skipped: ', public.schedule_working_date('2026-11-27',3)::text),
   concat('(g4) working_days_between(27/11, 01/12): ', public.schedule_working_days_between('2026-11-27','2026-12-01')::text),
   concat('(g5) 60-day span working_days_between(01/12/2026, 29/01/2027): ', public.schedule_working_days_between('2026-12-01','2027-01-29')::text),
   concat('(g6) working_date(01/12/2026, that count): ', public.schedule_working_date('2026-12-01', public.schedule_working_days_between('2026-12-01','2027-01-29'))::text));
  IF public.schedule_working_date('2026-11-28',2)<>'2026-12-01' OR public.schedule_working_date('2026-11-29',1)<>'2026-12-01'
     OR public.schedule_working_date('2026-11-27',3)<>'2026-12-01' OR public.schedule_working_days_between('2026-11-27','2026-12-01')<>3
     OR public.schedule_working_days_between('2026-12-01','2027-01-29')<>52 OR public.schedule_working_date('2026-12-01',52)<>'2027-01-29' THEN RAISE EXCEPTION '(g) calendar mismatch'; END IF;
  RESET ROLE;
  RAISE EXCEPTION 'SCHED1 EVIDENCE (rolled back):%', ev;
END $t$;
