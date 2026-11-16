-- Rolled-back role checks for the Site Readiness redesign tables.
-- Run as a privileged session. Every write happens inside a subtransaction that is always undone,
-- and the whole block ends by raising its results, so nothing is ever committed.
DO $chk$
DECLARE r record; uid uuid; res text := ''; ok boolean; n int; st text; msg text; seen int;
  pid uuid := (SELECT id FROM public.projects WHERE NOT coalesce(is_archived,false) ORDER BY created_at LIMIT 1);
  cost_owner uuid;
BEGIN
  FOR r IN SELECT unnest(ARRAY['delivery_rm_lead','site_engineer','site_installation_mgr','managing_director','stores_executive','hr_executive','finance_manager','head_of_projects','planning_head']) AS role LOOP
    SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text = r.role AND is_active AND auth_user_id IS NOT NULL ORDER BY id LIMIT 1;
    ok := false;
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      INSERT INTO public.site_readiness_tolerances(project_id, allowed_level_diff_mm, allowed_diagonal_diff_mm, allowed_spacing_dev_mm) VALUES (pid, 5, 10, 8);
      UPDATE public.site_readiness_tolerances SET allowed_level_diff_mm = 6 WHERE project_id = pid; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'upd0'; END IF;
      INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid, 'foundation', 'B1', 'ok', 3);
      UPDATE public.site_readiness_checks SET value_numeric = 4 WHERE project_id = pid AND item_key = 'B1'; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'upd1'; END IF;
      INSERT INTO public.site_readiness_crane(project_id, vendor_name) VALUES (pid, 'Vendor');
      UPDATE public.site_readiness_crane SET vendor_name = 'Vendor 2' WHERE project_id = pid; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'upd2'; END IF;
      INSERT INTO public.site_readiness_crane_cost(project_id, rate_inr) VALUES (pid, 1000);
      UPDATE public.site_readiness_crane_cost SET rate_inr = 1200 WHERE project_id = pid; GET DIAGNOSTICS n = ROW_COUNT; IF n <> 1 THEN RAISE EXCEPTION 'upd3'; END IF;
      ok := true;
      RAISE EXCEPTION 'undo';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'undo' THEN ok := false; END IF;
    END;
    EXECUTE 'RESET ROLE';
    res := res || format('%s write=%s; ', r.role, ok);
  END LOOP;

  -- Cost read: a site_engineer enters the cost row; then count rows visible per role.
  SELECT auth_user_id INTO cost_owner FROM public.profiles WHERE role::text='site_engineer' AND is_active AND auth_user_id IS NOT NULL ORDER BY id LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', cost_owner, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.site_readiness_crane_cost(project_id, rate_inr) VALUES (pid, 1000);
    EXECUTE 'RESET ROLE';
    FOR r IN SELECT unnest(ARRAY['managing_director','finance_manager','head_of_projects','planning_head','site_engineer(owner)','site_engineer(other)','delivery_rm_lead','site_installation_mgr','stores_executive','hr_executive']) AS role LOOP
      IF r.role = 'site_engineer(owner)' THEN uid := cost_owner;
      ELSIF r.role = 'site_engineer(other)' THEN SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text='site_engineer' AND is_active AND auth_user_id IS NOT NULL AND auth_user_id <> cost_owner ORDER BY id LIMIT 1;
      ELSE SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text = r.role AND is_active AND auth_user_id IS NOT NULL ORDER BY id LIMIT 1; END IF;
      PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      SELECT count(*) INTO seen FROM public.site_readiness_crane_cost WHERE project_id = pid;
      EXECUTE 'RESET ROLE';
      res := res || format('%s cost_rows=%s; ', r.role, seen);
    END LOOP;
    RAISE EXCEPTION 'undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'undo' THEN res := res || 'cost_read_error=' || SQLERRM || '; '; END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- Tolerance auto-flag rules as delivery_rm_lead.
  SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text='delivery_rm_lead' AND is_active LIMIT 1;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    msg := NULL;
    BEGIN INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid,'foundation','A5','ok',4);
    EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
    res := res || format('blocked_without_tolerance=%s; ', coalesce(msg ILIKE '%tolerances%', false));
    INSERT INTO public.site_readiness_tolerances(project_id, allowed_level_diff_mm, allowed_diagonal_diff_mm, allowed_spacing_dev_mm) VALUES (pid,5,10,8);
    msg := NULL;
    BEGIN INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid,'foundation','B1','ok',7);
    EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
    res := res || format('over_tolerance_needs_comment=%s; ', coalesce(msg ILIKE '%needs a comment%', false));
    INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric, comment) VALUES (pid,'foundation','B1','ok',7,'P3 high');
    SELECT status INTO st FROM public.site_readiness_checks WHERE project_id=pid AND item_key='B1';
    res := res || format('B1_7mm_vs_5mm=%s; ', st);
    INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid,'foundation','A5','ok',10);
    SELECT status INTO st FROM public.site_readiness_checks WHERE project_id=pid AND item_key='A5';
    res := res || format('A5_10mm_vs_10mm=%s; ', st);
    res := res || format('change_log_rows=%s; ', (SELECT count(*) FROM public.site_readiness_change_log WHERE project_id=pid));
    RAISE EXCEPTION 'undo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'undo' THEN res := res || 'rule_error=' || SQLERRM || '; '; END IF;
  END;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '{}', true);
  RAISE EXCEPTION 'SR_RESULTS: %', res;
END $chk$;
