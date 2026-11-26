-- Real existing principals; all team/role/task/date/audit fixtures roll back via the evidence exception.
DO $t$
#variable_conflict use_column
DECLARE
  p uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';
  azad uuid := '822687f1-c516-4ddc-b54f-f574acd32859';
  other uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';
  result jsonb;
  code text := '';
BEGIN
  IF (SELECT count(*) FROM schedule_editor_users) <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two named schedule editors';
  END IF;
  IF EXISTS(SELECT 1 FROM schedule_baselines WHERE project_id = p) THEN
    RAISE EXCEPTION 'Test project already baselined';
  END IF;

  INSERT INTO project_team_members(project_id, profile_id, role, access_level)
  SELECT p, id, 'sched2a_fix_test', 'write'
  FROM profiles
  WHERE auth_user_id IN (azad, other)
  ON CONFLICT DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', azad::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT can_edit_schedule(auth.uid()) THEN
    RAISE EXCEPTION 'Azad is not a named schedule editor';
  END IF;
  result := schedule_recalculate_dates(p);
  IF NOT EXISTS(
    SELECT 1 FROM schedule_audit_log
    WHERE project_id = p AND actor_id = azad AND action = 'recalculate_dates'
  ) THEN
    RAISE EXCEPTION 'Azad recalculation audit row missing';
  END IF;
  RESET ROLE;

  -- There is no other persistent head_operations account. Vincent is a real
  -- active staff account and holds this role only inside this rollback test.
  INSERT INTO user_roles(user_id, role) VALUES(other, 'head_operations');
  PERFORM set_config('request.jwt.claim.sub', other::text, true);
  SET LOCAL ROLE authenticated;
  IF NOT EXISTS(
    SELECT 1 FROM user_roles WHERE user_id = other AND role = 'head_operations'
  ) THEN
    RAISE EXCEPTION 'Temporary head_operations fixture absent';
  END IF;
  IF can_edit_schedule(auth.uid()) THEN
    RAISE EXCEPTION 'head_operations alone still grants schedule editing';
  END IF;
  code := 'allowed';
  BEGIN
    PERFORM schedule_recalculate_dates(p);
  EXCEPTION WHEN OTHERS THEN
    code := SQLSTATE;
  END;
  IF code <> '42501' THEN
    RAISE EXCEPTION 'Non-named head_operations recalculation returned %', code;
  END IF;
  RESET ROLE;

  RAISE EXCEPTION USING ERRCODE = 'P0001',
    MESSAGE = 'SCHED2A-FIX ROLLBACK EVIDENCE: exactly two named editors; Azad (real account) recalculated dates and was audited; Vincent (real active account, temporary head_operations only) denied with 42501; all fixtures rolled back. Recalculation result: ' || result::text;
END $t$;
