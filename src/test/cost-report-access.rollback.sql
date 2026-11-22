BEGIN;
CREATE TEMP TABLE cost_access_evidence(roles text,allowed boolean,person_amounts boolean,factory_unallocated boolean);
DO $test$
DECLARE r record; v jsonb; allowed boolean; pc boolean; fc boolean; baseline jsonb; overview jsonb;
 p uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
BEGIN
 FOR r IN SELECT ur.user_id,array_agg(ur.role::text ORDER BY ur.role::text) roles FROM public.user_roles ur JOIN public.profiles pr ON pr.auth_user_id=ur.user_id WHERE pr.is_active GROUP BY ur.user_id LOOP
  PERFORM set_config('request.jwt.claim.sub',r.user_id::text,true);
  SET LOCAL ROLE authenticated;
  allowed:=public.can_view_running_bill(r.user_id);
  pc:=public.can_access_labour_compensation(r.user_id); fc:=public.can_view_factory_cost(r.user_id);
  IF allowed IS DISTINCT FROM (r.roles && ARRAY['managing_director','finance_director','sales_director','architecture_director','super_admin','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer']) THEN RAISE EXCEPTION 'Role mismatch %',r.roles; END IF;
  IF allowed THEN
   v:=public.get_cost_report(p,'2020-01-01','2026-11-22');
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'groups') g CROSS JOIN LATERAL jsonb_array_elements(g->'workers') w WHERE (w ? 'amount') IS DISTINCT FROM pc) THEN RAISE EXCEPTION 'Worker amount privacy %',r.roles; END IF;
   IF (v ? 'factory_unallocated') IS DISTINCT FROM fc THEN RAISE EXCEPTION 'Unallocated privacy %',r.roles; END IF;
   IF (v->'totals'->>'own_labour')::numeric<>6365.46 OR (v->'totals'->>'value_earned')::numeric<>151000 OR (v->'totals'->>'excess_value')::numeric<>19500 OR (v->'totals'->>'subcontract')::numeric<>0 THEN RAISE EXCEPTION 'Baseline mismatch %',r.roles; END IF;
  ELSE
   BEGIN PERFORM public.get_cost_report(p,'2020-01-01','2026-11-22'); RAISE EXCEPTION 'Denied role read %',r.roles; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END IF;
  RESET ROLE;
  INSERT INTO cost_access_evidence VALUES(array_to_string(r.roles,','),allowed,allowed AND pc,allowed AND fc);
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true); SET LOCAL ROLE anon;
 BEGIN PERFORM public.get_cost_report(p,'2020-01-01','2026-11-22'); RAISE EXCEPTION 'Anonymous execution'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 IF has_function_privilege('anon','public.get_cost_report(uuid,date,date)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous grant'; END IF;
 PERFORM set_config('request.jwt.claim.sub','99b67080-a6eb-4feb-bd8e-92a287b430aa',true); SET LOCAL ROLE authenticated;
 baseline:=public.get_running_bill(p,'2026-11-22'); overview:=public.get_site_overview('2026-11-22');
 IF (baseline->'totals'->>'value_earned')::numeric<>151000 OR (baseline->'totals'->>'own_labour_cost')::numeric<>6365.46 OR (baseline->'totals'->>'subcontract_accrued')::numeric<>0 OR (baseline->'totals'->>'excess_value')::numeric<>19500 THEN RAISE EXCEPTION 'Running Bill regression'; END IF;
 BEGIN PERFORM public.get_cost_report(p,'2026-11-22','2026-11-01'); RAISE EXCEPTION 'Inverted range accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Choose a valid date range' THEN RAISE; END IF; END;
 RESET ROLE;
END $test$;
SELECT count(*) principals,count(*) FILTER(WHERE allowed) allowed,count(*) FILTER(WHERE NOT allowed) denied,jsonb_agg(to_jsonb(e) ORDER BY roles) role_matrix FROM cost_access_evidence e;
ROLLBACK;