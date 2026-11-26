-- SCHED-2e evidence: real accounts on Test project - 1; everything rolls back through the final evidence exception.
DO $t$
DECLARE
  p uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';      -- Test project - 1
  q uuid := '97a6d1cd-f85e-40f9-932c-6a792584027f';      -- Mahesh Villa (no unit tasks)
  azad uuid := '822687f1-c516-4ddc-b54f-f574acd32859';   -- named schedule editor
  vin uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';    -- factory_supervisor, not an editor
  legacy uuid := 'bb53c212-3892-421c-91f9-329112247c9f'; -- unit-less legacy task
  ut uuid := 'f4c8818e-bb29-458a-b3e6-e4158f34cb2c';     -- F01-TEST-M1
  s01 uuid := '3616ebea-0ccd-44a9-8dad-a441c9edf7d4';    -- library Z01 (activity 13 Site)
  sim uuid := '70650eb0-d265-453e-8abd-bcdd0f468399';    -- prod.dbr4: screen role site_installation_mgr, not an editor
  ev jsonb := '{}'; code text; snap jsonb; n int; added uuid; rm uuid; v int;
BEGIN
  IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id IN (p,q)) THEN RAISE EXCEPTION 'already baselined'; END IF;
  INSERT INTO project_team_members(project_id, profile_id, role, access_level)
  SELECT x, id, 'sched2e_test', 'write' FROM profiles, unnest(ARRAY[p,q]) x WHERE auth_user_id IN (azad, vin, sim) ON CONFLICT DO NOTHING;

  -- Editor adds a Site library task before the baseline (role copied from library).
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  PERFORM schedule_add_library_tasks(p, 'site', 'SITE-T', ARRAY[s01]);
  RESET ROLE;
  ev := ev || jsonb_build_object('g_site_task_role', (SELECT responsible_role FROM project_tasks WHERE project_id=p AND library_task_id=s01));

  -- (g) My Tasks / Actuals "My Open Tasks" filter, run under RLS as the user.
  PERFORM set_config('request.jwt.claim.sub', vin::text, true); SET LOCAL ROLE authenticated;
  ev := ev || jsonb_build_object('g_factory_supervisor_rows', (SELECT jsonb_agg(task_id_in_schedule ORDER BY task_id_in_schedule) FROM project_tasks WHERE project_id=p AND NOT is_removed AND responsible_role='factory_supervisor' AND library_task_id IS NOT NULL));
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', sim::text, true); SET LOCAL ROLE authenticated;
  ev := ev || jsonb_build_object('g_site_installation_mgr_rows', (SELECT jsonb_agg(task_id_in_schedule) FROM project_tasks WHERE project_id=p AND NOT is_removed AND responsible_role='site_installation_mgr'));

  -- (f) project with no unit tasks
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  code := 'allowed'; BEGIN PERFORM publish_schedule_baseline(q, NULL); EXCEPTION WHEN OTHERS THEN code := SQLSTATE||' '||SQLERRM; END;
  ev := ev || jsonb_build_object('f_no_unit_tasks', code);
  RESET ROLE;

  -- (d) non-editor publish
  PERFORM set_config('request.jwt.claim.sub', sim::text, true); SET LOCAL ROLE authenticated;
  code := 'allowed'; BEGIN PERFORM publish_schedule_baseline(p, NULL); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('d_non_editor_publish', code);
  code := 'allowed'; BEGIN PERFORM schedule_revise_task(ut, '{"duration_days":5}', 'x'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('d_non_editor_revise', code);
  RESET ROLE;

  -- (a) editor publishes v1
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  v := publish_schedule_baseline(p, NULL);
  RESET ROLE;
  SELECT snapshot INTO snap FROM schedule_baselines WHERE project_id=p AND version=v;
  ev := ev || jsonb_build_object('a_version', v, 'a_snapshot_count', jsonb_array_length(snap),
    'a_snapshot_unitless', (SELECT count(*) FROM jsonb_array_elements(snap) e WHERE e->>'unit_label' IS NULL),
    'a_unit_tasks_stamped_v1', (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label IS NOT NULL AND baseline_version=1),
    'a_unitless_baseline_null', (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label IS NULL AND baseline_version IS NULL),
    'a_unitless_total', (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label IS NULL));

  -- (b) legacy unit-less task after v1: actuals save, details/delete refused
  PERFORM set_config('request.jwt.claim.sub', sim::text, true); SET LOCAL ROLE authenticated;
  UPDATE project_tasks SET completion_percentage=40, status='In Progress', actual_start_date=CURRENT_DATE WHERE id=legacy;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  ev := ev || jsonb_build_object('b_actuals_rows_updated', n, 'b_after', (SELECT jsonb_build_object('pct',completion_percentage,'status',status,'actual_start',actual_start_date) FROM project_tasks WHERE id=legacy));
  PERFORM set_config('request.jwt.claim.sub', azad::text, true); SET LOCAL ROLE authenticated;
  code := 'allowed'; BEGIN UPDATE project_tasks SET task_name='renamed' WHERE id=legacy; EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('b_legacy_detail_edit', code);
  code := 'allowed'; BEGIN DELETE FROM project_tasks WHERE id=legacy; EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('b_legacy_delete', code);
  code := 'allowed'; BEGIN PERFORM schedule_clear_unscheduled_tasks(p, 'after baseline'); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('b_clear_after_baseline', code);

  -- (c) revise / add / remove unit tasks
  code := 'allowed'; BEGIN UPDATE project_tasks SET duration_days=9 WHERE id=ut; EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('c_direct_unit_edit', code);
  PERFORM schedule_revise_task(ut, '{"duration_days":5,"responsible_role":"production_head"}', 'SCHED-2e test revise');
  ev := ev || jsonb_build_object('c_revised', (SELECT jsonb_build_object('days',duration_days,'role',responsible_role) FROM project_tasks WHERE id=ut));
  PERFORM schedule_add_task(p, '{"task_id_in_schedule":"T2E-ADD","task_name":"Added after v1","unit_kind":"module","unit_label":"TEST-M1","duration_days":1,"responsible_role":"factory_supervisor"}', 'SCHED-2e test add');
  SELECT id INTO added FROM project_tasks WHERE project_id=p AND task_id_in_schedule='T2E-ADD';
  SELECT id INTO rm FROM project_tasks WHERE project_id=p AND task_id_in_schedule='F00-TEST-M1';
  PERFORM schedule_remove_task(rm, 'SCHED-2e test remove');
  ev := ev || jsonb_build_object('c_added', added IS NOT NULL, 'c_removed', (SELECT is_removed FROM project_tasks WHERE id=rm));

  -- (e) v2 needs a reason
  code := 'allowed'; BEGIN PERFORM publish_schedule_baseline(p, '  '); EXCEPTION WHEN OTHERS THEN code := SQLSTATE; END;
  ev := ev || jsonb_build_object('e_v2_without_reason', code);
  v := publish_schedule_baseline(p, 'SCHED-2e test v2');
  RESET ROLE;
  SELECT snapshot INTO snap FROM schedule_baselines WHERE project_id=p AND version=v;
  ev := ev || jsonb_build_object('e_v2', v, 'e_v2_count', jsonb_array_length(snap),
    'e_v2_has_added', snap @> jsonb_build_array(jsonb_build_object('task_id_in_schedule','T2E-ADD')),
    'e_v2_has_removed', snap @> jsonb_build_array(jsonb_build_object('task_id_in_schedule','F00-TEST-M1')),
    'e_unitless_still_null', (SELECT count(*) FROM project_tasks WHERE project_id=p AND unit_label IS NULL AND baseline_version IS NULL));
  RAISE EXCEPTION 'EVIDENCE OK (rolled back) %', ev;
END $t$;
