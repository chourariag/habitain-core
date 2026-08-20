CREATE OR REPLACE FUNCTION public.test_site_readiness_rls()
RETURNS TABLE(check_name text, passed boolean, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  ins_expr text;
  upd_expr text;
  r text;
  blocked text[] := ARRAY['finance_manager','costing_engineer','qc_inspector','hr_executive','sales_executive','project_architect','stores_executive','procurement'];
BEGIN
  SELECT with_check INTO ins_expr FROM pg_policies
    WHERE schemaname='public' AND tablename='site_readiness' AND cmd='INSERT' LIMIT 1;
  SELECT qual INTO upd_expr FROM pg_policies
    WHERE schemaname='public' AND tablename='site_readiness' AND cmd='UPDATE' LIMIT 1;

  check_name := 'insert_policy_exists'; passed := ins_expr IS NOT NULL; detail := coalesce(ins_expr,'MISSING'); RETURN NEXT;
  check_name := 'update_policy_exists'; passed := upd_expr IS NOT NULL; detail := coalesce(upd_expr,'MISSING'); RETURN NEXT;

  check_name := 'insert_allows_delivery_rm_lead';
  passed := coalesce(ins_expr,'') LIKE '%delivery_rm_lead%'; detail := coalesce(ins_expr,'MISSING'); RETURN NEXT;

  check_name := 'update_allows_delivery_rm_lead';
  passed := coalesce(upd_expr,'') LIKE '%delivery_rm_lead%'; detail := coalesce(upd_expr,'MISSING'); RETURN NEXT;

  check_name := 'insert_allows_site_engineer';
  passed := coalesce(ins_expr,'') LIKE '%site_engineer%'; detail := coalesce(ins_expr,'MISSING'); RETURN NEXT;

  FOREACH r IN ARRAY blocked LOOP
    check_name := 'insert_blocks_' || r;
    passed := coalesce(ins_expr,'') NOT LIKE '%''' || r || '''%'; detail := r; RETURN NEXT;

    check_name := 'update_blocks_' || r;
    passed := coalesce(upd_expr,'') NOT LIKE '%''' || r || '''%'; detail := r; RETURN NEXT;
  END LOOP;

  check_name := 'rls_enabled';
  SELECT c.relrowsecurity INTO passed FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='site_readiness';
  detail := 'row level security on site_readiness'; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.test_site_readiness_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_site_readiness_rls() TO authenticated, service_role;