-- SCHED-2f evidence: real accounts on Test project - 1; everything rolls back through the final evidence exception.
DO $t$
DECLARE
  p uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';      -- Test project - 1
  azad uuid := '822687f1-c516-4ddc-b54f-f574acd32859';   -- named schedule editor
  sim uuid := '70650eb0-d265-453e-8abd-bcdd0f468399';    -- prod.dbr4, not an editor
  ev jsonb := '{}'; code text; r jsonb; v int; added uuid;
  f01 uuid; f03 uuid; f04 uuid; f05 uuid;
BEGIN
  SELECT id INTO f01 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F01-TEST-M1';
  SELECT id INTO f03 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F03-TEST-M1';
  SELECT id INTO f04 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F04-TEST-M1';
  SELECT id INTO f05 FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F05-TEST-M1';
  INSERT INTO project_team_members(project_id, profile_id, role, access_level)
  SELECT p, id, 'sched2f_test', 'write' FROM profiles WHERE auth_user_id IN (azad, sim) ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  -- (a) F01 start day 2, days 5 -> finish 05/12/2026
  r := schedule_revise_task(f01, '{"start_day":2,"duration_days":5}', 'SCHED-2f a');
  ev := ev || jsonb_build_object('a_task', r->'task');
  -- (b) successor moves when predecessor lengthens (F03 2 -> 4 days; F04 follows F03)
  r := schedule_revise_task(f03, '{"duration_days":4}', 'SCHED-2f b');
  ev := ev || jsonb_build_object('b_moved', r->'moved', 'b_not_moved', r->'not_moved',
    'b_audit_cascade_rows', (SELECT count(*) FROM schedule_audit_log WHERE task_id=f04 AND action='cascade' AND reason='SCHED-2f b' AND actor_id=azad));
  -- (e) cycle refused: F03 after F04 (F04 already follows F03)
  code := 'allowed'; BEGIN PERFORM schedule_revise_task(f03, '{"predecessor_ids":["F04-TEST-M1"]}', 'SCHED-2f e'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE||' '||SQLERRM; END;
  ev := ev || jsonb_build_object('e_cycle', code);
  -- (g) reason still required
  code := 'allowed'; BEGIN PERFORM schedule_revise_task(f01, '{"duration_days":4}', '  '); EXCEPTION WHEN OTHERS THEN code := SQLSTATE||' '||SQLERRM; END;
  ev := ev || jsonb_build_object('g_blank_reason', code);
  RESET ROLE;

  -- (c) successor with an actual start date is not moved (actual recorded by the non-editor, as on site)
  PERFORM set_config('request.jwt.claim.sub', sim::text, true); SET LOCAL ROLE authenticated;
  UPDATE project_tasks SET actual_start_date='2026-12-04' WHERE id=f04;
  -- (f) non-editor refused
  code := 'allowed'; BEGIN PERFORM schedule_revise_task(f03, '{"duration_days":1}', 'x'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE||' '||SQLERRM; END;
  ev := ev || jsonb_build_object('f_non_editor', code);
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  r := schedule_revise_task(f03, '{"duration_days":5}', 'SCHED-2f c');
  ev := ev || jsonb_build_object('c_moved', r->'moved', 'c_not_moved', r->'not_moved',
    'c_f04_unchanged', (SELECT jsonb_build_object('start_day',start_day,'start',planned_start_date,'finish',planned_finish_date) FROM project_tasks WHERE id=f04));
  RESET ROLE;

  -- (d) across a Sunday and an active holiday (Thu 03/12/2026 made a holiday inside this transaction)
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  PERFORM schedule_change_holiday('2026-12-03', 'SCHED-2f test holiday', true, 'SCHED-2f d holiday');
  r := schedule_revise_task(f01, '{"duration_days":5}', 'SCHED-2f d');
  ev := ev || jsonb_build_object('d_task', r->'task');
  -- (h) add: new task after F01 gets dates from the server; remove: F01's successor is re-linked and moves
  added := schedule_add_task(p, '{"task_id_in_schedule":"T2F-ADD","task_name":"Added after F01","unit_kind":"module","unit_label":"TEST-M1","duration_days":2,"predecessor_ids":["F01-TEST-M1"]}', 'SCHED-2f h add');
  ev := ev || jsonb_build_object('h_added', (SELECT jsonb_build_object('start_day',start_day,'start',planned_start_date,'finish',planned_finish_date) FROM project_tasks WHERE id=added));
  PERFORM schedule_remove_task(f01, 'SCHED-2f h remove');
  ev := ev || jsonb_build_object('h_after_remove', (SELECT jsonb_build_object('preds',predecessor_ids,'start_day',start_day,'start',planned_start_date,'finish',planned_finish_date) FROM project_tasks WHERE id=added),
    'h_relink_audit', (SELECT count(*) FROM schedule_audit_log WHERE task_id=added AND action='relink'));
  -- (i) publish a revision inside the rollback and compare with the previous snapshot
  v := publish_schedule_baseline(p, 'SCHED-2f history check');
  RESET ROLE;
  ev := ev || jsonb_build_object('i_version', v, 'i_diff', (
    SELECT jsonb_agg(jsonb_build_object('code',n->>'task_id_in_schedule','start',(o->>'planned_start_date')||' -> '||(n->>'planned_start_date'),'finish',(o->>'planned_finish_date')||' -> '||(n->>'planned_finish_date')))
    FROM jsonb_array_elements((SELECT snapshot FROM schedule_baselines WHERE project_id=p AND version=v)) n
    JOIN jsonb_array_elements((SELECT snapshot FROM schedule_baselines WHERE project_id=p AND version=v-1)) o ON o->>'id'=n->>'id'
    WHERE o->>'planned_finish_date' IS DISTINCT FROM n->>'planned_finish_date' OR o->>'planned_start_date' IS DISTINCT FROM n->>'planned_start_date'),
    'i_previous_snapshots_unchanged', (SELECT count(*) FROM schedule_baselines WHERE project_id=p AND version<v));
  RAISE EXCEPTION 'EVIDENCE %', ev::text;
END $t$;
