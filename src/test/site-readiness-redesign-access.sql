-- Rolled-back role checks for the Site Readiness redesign tables. Run with psql; nothing is committed.
-- Uses real active users per role; RLS is evaluated through request.jwt.claims (auth.uid()).
BEGIN;
CREATE TEMP TABLE sr_results(role text, check_name text, ok boolean);
DO $$
DECLARE r record; pid uuid := (SELECT id FROM public.projects WHERE NOT coalesce(is_archived,false) ORDER BY created_at LIMIT 1);
  uid uuid; can_write boolean; can_read_cost boolean; n int; st text;
BEGIN
  FOR r IN SELECT unnest(ARRAY['delivery_rm_lead','site_engineer','site_installation_mgr','stores_executive','hr_executive','finance_manager','head_of_projects','planning_head','managing_director']) AS role LOOP
    SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text = r.role AND is_active AND auth_user_id IS NOT NULL ORDER BY id LIMIT 1;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    -- write test (insert then update) in a savepoint
    BEGIN
      INSERT INTO public.site_readiness_tolerances(project_id, allowed_level_diff_mm, allowed_diagonal_diff_mm, allowed_spacing_dev_mm)
        VALUES (pid, 5, 10, 8) ON CONFLICT (project_id) DO UPDATE SET allowed_level_diff_mm = 5;
      INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric, comment)
        VALUES (pid, 'foundation', 'B1', 'ok', 3, null);
      UPDATE public.site_readiness_checks SET value_numeric = 4 WHERE project_id = pid AND item_key = 'B1';
      GET DIAGNOSTICS n = ROW_COUNT;
      INSERT INTO public.site_readiness_crane(project_id, vendor_name) VALUES (pid, 'Test vendor');
      UPDATE public.site_readiness_crane SET vendor_name = 'Test vendor 2' WHERE project_id = pid;
      INSERT INTO public.site_readiness_crane_cost(project_id, rate_inr) VALUES (pid, 1000);
      can_write := (n = 1);
      RAISE EXCEPTION 'rollback_savepoint';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'rollback_savepoint' THEN can_write := false; END IF;
    END;
    INSERT INTO sr_results VALUES (r.role, 'insert_update', can_write);
    -- cost read test: seed a cost row as a writer-owned row is not possible here, so evaluate the policy predicate
    INSERT INTO sr_results VALUES (r.role, 'cost_read', public.can_read_crane_cost(uid, gen_random_uuid()));
  END LOOP;
END $$;
-- Tolerance auto-flag and Not ok comment rule (as delivery_rm_lead)
DO $$
DECLARE pid uuid := (SELECT id FROM public.projects WHERE NOT coalesce(is_archived,false) ORDER BY created_at LIMIT 1); uid uuid; st text; msg text;
BEGIN
  SELECT auth_user_id INTO uid FROM public.profiles WHERE role::text='delivery_rm_lead' AND is_active LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid,'foundation','A5','ok',4);
  EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
  INSERT INTO sr_results VALUES ('delivery_rm_lead','measured_blocked_without_tolerance', msg ILIKE '%tolerances%');
  INSERT INTO public.site_readiness_tolerances(project_id, allowed_level_diff_mm, allowed_diagonal_diff_mm, allowed_spacing_dev_mm) VALUES (pid,5,10,8)
    ON CONFLICT (project_id) DO UPDATE SET allowed_level_diff_mm=5, allowed_diagonal_diff_mm=10, allowed_spacing_dev_mm=8;
  msg := NULL;
  BEGIN
    INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric) VALUES (pid,'foundation','B1','ok',7);
  EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
  INSERT INTO sr_results VALUES ('delivery_rm_lead','over_tolerance_needs_comment', msg ILIKE '%needs a comment%');
  INSERT INTO public.site_readiness_checks(project_id, section, item_key, status, value_numeric, comment) VALUES (pid,'foundation','B1','ok',7,'Pedestal P3 high');
  SELECT status INTO st FROM public.site_readiness_checks WHERE project_id=pid AND item_key='B1';
  INSERT INTO sr_results VALUES ('delivery_rm_lead','over_tolerance_auto_not_ok', st='not_ok');
  INSERT INTO sr_results VALUES ('delivery_rm_lead','change_log_written', EXISTS(SELECT 1 FROM public.site_readiness_change_log WHERE project_id=pid AND item_key='B1' AND changed_by=uid));
END $$;
SELECT role, check_name, ok FROM sr_results ORDER BY check_name, role;
ROLLBACK;
