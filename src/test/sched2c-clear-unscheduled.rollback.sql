-- SCHED-2c evidence: real accounts, everything rolls back through the final evidence exception.
DO $t$
DECLARE
  p uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';      -- Test project - 1 (no baseline)
  azad uuid := '822687f1-c516-4ddc-b54f-f574acd32859';   -- named schedule editor
  other uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';  -- active staff, not an editor
  a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; g uuid;
  result jsonb; code text; legacy_before int; audit_ok boolean;
BEGIN
  IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id = p) THEN RAISE EXCEPTION 'Test project already baselined'; END IF;
  INSERT INTO project_team_members(project_id, profile_id, role, access_level)
  SELECT p, id, 'sched2c_test', 'write' FROM profiles WHERE auth_user_id IN (azad, other) ON CONFLICT DO NOTHING;

  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name) VALUES (p, 'T2C-A', 'clean legacy') RETURNING id INTO a;
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name, completion_percentage) VALUES (p, 'T2C-B', 'has progress', 20) RETURNING id INTO b;
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name) VALUES (p, 'T2C-C', 'has comment') RETURNING id INTO c;
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name) VALUES (p, 'T2C-D', 'has subtask') RETURNING id INTO d;
  INSERT INTO project_subtasks(task_id, title) VALUES (d, 'sub');
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name, unit_kind, unit_label) VALUES (p, 'T2C-E', 'in a unit, no dates', 'module', 'Module T2C') RETURNING id INTO e;
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name, is_qc_gate) VALUES (p, 'T2C-F', 'qc gate', true) RETURNING id INTO f;
  INSERT INTO project_tasks(project_id, task_id_in_schedule, task_name, actual_start_date) VALUES (p, 'T2C-G', 'has actual date', CURRENT_DATE) RETURNING id INTO g;
  SELECT count(*) INTO legacy_before FROM project_tasks WHERE project_id = p AND unit_label IS NULL AND planned_start_date IS NULL AND planned_finish_date IS NULL;

  -- Comment written as the editor (database fills author/status).
  PERFORM set_config('request.jwt.claim.sub', azad::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO schedule_task_comments(project_id, task_id, body) VALUES (p, c, 'keep me');

  -- 1. Reason required.
  code := 'allowed';
  BEGIN PERFORM schedule_clear_unscheduled_tasks(p, '   '); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  IF code <> '22023' THEN RAISE EXCEPTION 'Blank reason returned %', code; END IF;

  -- 2. Editor run.
  result := schedule_clear_unscheduled_tasks(p, 'SCHED-2c rollback test');
  RESET ROLE;
  IF EXISTS(SELECT 1 FROM project_tasks WHERE id = a) THEN RAISE EXCEPTION 'Clean legacy row not deleted'; END IF;
  IF (SELECT count(*) FROM project_tasks WHERE id IN (b, c, d, e, f, g)) <> 6 THEN RAISE EXCEPTION 'A protected row was deleted'; END IF;
  IF (result->>'deleted')::int + (result->>'skipped_with_progress')::int <> legacy_before THEN RAISE EXCEPTION 'Counts do not add up: % vs %', result, legacy_before; END IF;
  IF (result->>'skipped_with_progress')::int < 5 THEN RAISE EXCEPTION 'Protected rows not counted as skipped: %', result; END IF;
  SELECT EXISTS(SELECT 1 FROM schedule_audit_log WHERE project_id = p AND actor_id = azad AND action = 'clear_unscheduled' AND reason = 'SCHED-2c rollback test' AND new_value = result) INTO audit_ok;
  IF NOT audit_ok THEN RAISE EXCEPTION 'Audit row missing'; END IF;

  -- 3. Non-editor with project access.
  PERFORM set_config('request.jwt.claim.sub', other::text, true);
  SET LOCAL ROLE authenticated;
  code := 'allowed';
  BEGIN PERFORM schedule_clear_unscheduled_tasks(p, 'not allowed'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  RESET ROLE;
  IF code <> '42501' THEN RAISE EXCEPTION 'Non-editor returned %', code; END IF;

  -- 4. After a baseline.
  INSERT INTO schedule_baselines(project_id, version, kind, published_by, snapshot) VALUES (p, 1, 'baseline', azad, '[]'::jsonb);
  PERFORM set_config('request.jwt.claim.sub', azad::text, true);
  SET LOCAL ROLE authenticated;
  code := 'allowed';
  BEGIN PERFORM schedule_clear_unscheduled_tasks(p, 'after baseline'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  RESET ROLE;
  IF code <> '42501' THEN RAISE EXCEPTION 'After-baseline returned %', code; END IF;

  RAISE EXCEPTION 'EVIDENCE OK (rolled back): legacy_without_dates_before=% editor_result=% blank_reason=22023 non_editor=42501 after_baseline=42501 audit_row=%', legacy_before, result, audit_ok;
END $t$;
