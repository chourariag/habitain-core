-- B1b rolled-back checks: toolbox photo gate, back-dated/clock checks, exception roles, hours gate, photo readers.
DO $chk$
DECLARE
  pid uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';
  md uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='managing_director' AND is_active ORDER BY id LIMIT 1);
  hop uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='head_of_projects' AND is_active ORDER BY id LIMIT 1);
  sa uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='super_admin' AND is_active ORDER BY id LIMIT 1);
  ph uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='planning_head' AND is_active ORDER BY id LIMIT 1);
  st uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='stores_executive' AND is_active ORDER BY id LIMIT 1);
  w1 uuid := (SELECT id FROM public.labour_workers WHERE status='active' ORDER BY id LIMIT 1);
  w2 uuid := (SELECT id FROM public.labour_workers WHERE status='active' ORDER BY id OFFSET 1 LIMIT 1);
  d0 date := public.ist_today(); dpast date := public.ist_today() - 5;
  res text := ''; n int; rid uuid; v jsonb;
BEGIN
  -- 1. gate: today, no photo
  PERFORM set_config('request.jwt.claims', json_build_object('sub',md,'role','authenticated')::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.save_labour_attendance(pid, d0, jsonb_build_array(jsonb_build_object('worker_id',w1,'hours',8)), NULL); res := res||'NO_PHOTO_TODAY=allowed(FAIL)'||E'\n';
  EXCEPTION WHEN OTHERS THEN res := res||'NO_PHOTO_TODAY='||SQLERRM||E'\n'; END;
  -- 2. back-dated photo path rejected
  BEGIN PERFORM public.add_attendance_photo(pid, pid||'/'||to_char(d0-1,'YYYY-MM-DD')||'/x.jpg', now(), 12.9, 77.6, 10); res := res||'BACKDATED_PHOTO=allowed(FAIL)'||E'\n';
  EXCEPTION WHEN OTHERS THEN res := res||'BACKDATED_PHOTO='||SQLERRM||E'\n'; END;
  -- 3. captured_at 11 minutes off
  BEGIN PERFORM public.add_attendance_photo(pid, pid||'/'||to_char(d0,'YYYY-MM-DD')||'/y.jpg', now() - interval '11 minutes', 12.9, 77.6, 10); res := res||'CLOCK_OFF=allowed(FAIL)'||E'\n';
  EXCEPTION WHEN OTHERS THEN res := res||'CLOCK_OFF='||SQLERRM||E'\n'; END;
  -- 4. valid photo, then attendance passes
  v := to_jsonb(public.add_attendance_photo(pid, pid||'/'||to_char(d0,'YYYY-MM-DD')||'/ok.jpg', now(), 0, 0, 150));
  res := res||'PHOTO_OK flags='||(v->'flags')::text||E'\n';
  n := public.save_labour_attendance(pid, d0, jsonb_build_array(jsonb_build_object('worker_id',w1,'hours',8), jsonb_build_object('worker_id',w2,'hours',8)), NULL);
  res := res||'SAVE_WITH_PHOTO rows='||n||' unconfirmed='||(SELECT count(*) FROM public.labour_attendance WHERE project_id=pid AND work_date=d0 AND NOT hours_confirmed)||E'\n';
  -- 5. hours gate on report submit
  rid := public.save_site_report_draft(pid, d0, jsonb_build_object('notes','B1b rolled-back check','site_clean',true));
  res := res||'DRAFT_SAVED_WHILE_UNCONFIRMED=ok'||E'\n';
  EXECUTE 'RESET ROLE';
  INSERT INTO public.site_report_photos(report_id,project_id,kind,elevation_id,storage_path,uploaded_by)
    SELECT rid,pid,'elevation',e.id,'b1b-check/'||e.id,md FROM public.project_elevations e WHERE e.project_id=pid AND e.is_active;
  UPDATE public.daily_measurements SET site_clean=true, site_clean_photo_path='b1b-check/clean' WHERE id=rid;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',md,'role','authenticated')::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.submit_site_report(rid); res := res||'SUBMIT_UNCONFIRMED=allowed(FAIL)'||E'\n';
  EXCEPTION WHEN OTHERS THEN res := res||'SUBMIT_UNCONFIRMED='||SQLERRM||E'\n'; END;
  n := public.confirm_labour_hours(pid, d0, jsonb_build_array(jsonb_build_object('worker_id',w1,'hours',7.5), jsonb_build_object('worker_id',w2,'hours',8)));
  res := res||'CONFIRMED='||n||' w1_hours='||(SELECT hours FROM public.labour_attendance WHERE project_id=pid AND work_date=d0 AND worker_id=w1)||E'\n';
  v := public.submit_site_report(rid);
  res := res||'SUBMIT_AFTER_CONFIRM=ok'||E'\n';
  -- 6. exception path for an earlier day
  FOR v IN SELECT jsonb_build_object('who',x.who,'uid',x.uid) FROM (VALUES ('managing_director',md),('head_of_projects',hop),('super_admin',sa),('planning_head',ph)) x(who,uid) LOOP
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claims', json_build_object('sub',v->>'uid','role','authenticated')::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN PERFORM public.save_labour_attendance(pid, dpast, jsonb_build_array(jsonb_build_object('worker_id',w1,'hours',8)), 'short'); res := res||'EXC_SHORT_'||(v->>'who')||'=allowed(FAIL)'||E'\n';
    EXCEPTION WHEN OTHERS THEN res := res||'EXC_SHORT_'||(v->>'who')||'='||SQLERRM||E'\n'; END;
    BEGIN n := public.save_labour_attendance(pid, dpast, jsonb_build_array(jsonb_build_object('worker_id',w1,'hours',8)), 'Photo missed: phone battery died at site');
      res := res||'EXC_OK_'||(v->>'who')||'=saved'||E'\n';
    EXCEPTION WHEN OTHERS THEN res := res||'EXC_OK_'||(v->>'who')||'=blocked ('||SQLERRM||')'||E'\n'; END;
  END LOOP;
  EXECUTE 'RESET ROLE';
  res := res||'EXC_ROW_FLAG='||(SELECT no_photo_exception FROM public.labour_attendance WHERE project_id=pid AND work_date=dpast AND worker_id=w1)
       ||' EXC_LOG='||(SELECT count(*) FROM public.labour_attendance_photo_exceptions WHERE project_id=pid AND work_date=dpast)||E'\n';
  -- 7. photo readers
  PERFORM set_config('request.jwt.claims', json_build_object('sub',st,'role','authenticated')::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.labour_attendance_photos; res := res||'READ stores_executive='||n;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', json_build_object('sub',ph,'role','authenticated')::text, true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.labour_attendance_photos; res := res||' planning_head='||n||E'\n';
  EXECUTE 'RESET ROLE';
  res := res||'REMINDER_EVENTS='||(SELECT count(*) FROM public.reminder_events);
  RAISE EXCEPTION 'B1b RESULTS (rolled back)%', E'\n'||res;
END $chk$;
