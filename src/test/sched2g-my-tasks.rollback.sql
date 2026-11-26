-- SCHED-2g evidence: real accounts with RLS on Test project - 1; ends with an exception so nothing persists.
DO $$
DECLARE
  pid uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';
  azad uuid := '822687f1-c516-4ddc-b54f-f574acd32859';
  nazim uuid := '70650eb0-d265-453e-8abd-bcdd0f468399';
  vincent uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';
  hr uuid := '26cdc75e-072c-4f4e-8d2e-d0d02b711763';
  a text; b text; d int; e text; e2 text; tid uuid; n int;
  home_filter text := $q$ not is_removed and status <> 'Completed' and (unit_label is not null or actual_start_date is not null or completion_percentage > 0) $q$;
BEGIN
  INSERT INTO project_team_members(project_id, profile_id, role, access_level)
  SELECT pid, id, 'sched2g_test', 'write' FROM profiles WHERE auth_user_id IN (azad, nazim, vincent) ON CONFLICT DO NOTHING;
  -- Azad adds one site task (post-baseline, reasoned) so a site task exists
  PERFORM set_config('request.jwt.claim.sub', azad::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.schedule_add_task(pid, jsonb_build_object('task_id_in_schedule','S2G-SITE','task_name','Site erection test','unit_label','TEST-M1','unit_kind','module','duration_days',2,'start_day',10,'phase','site','responsible_role','site_installation_mgr'), 'SCHED-2g proof');
  RESET ROLE;

  -- (a) factory_supervisor mapping as Vincent
  PERFORM set_config('request.jwt.claim.sub', vincent::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'select string_agg(task_id_in_schedule, '','' order by task_id_in_schedule) from project_tasks where project_id=$1 and responsible_role = any($2) and'||home_filter
    INTO a USING pid, ARRAY['factory_supervisor'];
  -- (d) legacy undated factory rows exist but are excluded
  SELECT count(*) INTO d FROM project_tasks WHERE project_id=pid AND NOT is_removed AND responsible_role='factory_supervisor' AND unit_label IS NULL;
  RESET ROLE;

  -- (b) site_installation_mgr mapping as Nazim
  PERFORM set_config('request.jwt.claim.sub', nazim::text, true);
  SET LOCAL ROLE authenticated;
  EXECUTE 'select string_agg(task_id_in_schedule, '','') from project_tasks where project_id=$1 and responsible_role = any($2) and'||home_filter
    INTO b USING pid, ARRAY['site_installation_mgr','site_installation_manager'];
  RESET ROLE;

  -- (e) Vincent saves 40% with the exact TaskUpdateSheet "Save progress" payload after baseline
  SELECT id INTO tid FROM project_tasks WHERE project_id=pid AND task_id_in_schedule='F05-TEST-M2';
  PERFORM set_config('request.jwt.claim.sub', vincent::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE project_tasks SET completion_percentage=40, remarks=null, delay_cause=null, delay_resolution=null,
         actual_start_date=current_date, status='In Progress' WHERE id=tid;
  GET DIAGNOSTICS n = ROW_COUNT;
  SELECT format('%s rows; %s %s%% %s baseline v%s', n, status, completion_percentage, actual_start_date, baseline_version) INTO e FROM project_tasks WHERE id=tid;
  EXECUTE 'select string_agg(task_id_in_schedule, '','') from project_tasks where project_id=$1 and responsible_role=''factory_supervisor'' and (completion_percentage>0 or actual_start_date is not null) and'||home_filter INTO e2 USING pid;
  RESET ROLE;

  RAISE EXCEPTION 'EVIDENCE a=% | legacy_undated_factory_excluded=% | b=% | e=% | in_progress_now=%', a, d, b, e, e2;
END $$;
