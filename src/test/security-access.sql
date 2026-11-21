-- Privileged regression harness. The final exception always rolls back fixtures,
-- permission checks, corrections, audit rows and notifications. No app roles/accounts change.
DO $test$
DECLARE
 pid uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; ro text; uid uuid; pr uuid; md uuid;
 rep jsonb; bill jsonb; result jsonb:='[]'; checks integer:=0; skipped integer:=0;
 commercial boolean; n integer; expected integer; bad boolean; col text;
 rid uuid; rate uuid:=gen_random_uuid(); cid uuid; bi uuid; qi uuid:=gen_random_uuid();
 diary uuid:=gen_random_uuid(); dm uuid:=gen_random_uuid(); oldboq uuid:=gen_random_uuid(); li uuid:=gen_random_uuid();
 rec record; got jsonb; payload text:='Literal quote ''; SELECT 1; --';
BEGIN
 SELECT user_id INTO md FROM public.user_roles WHERE role='managing_director' ORDER BY user_id LIMIT 1;
 SELECT id INTO rid FROM public.daily_measurements WHERE project_id=pid AND trade='daily_site_report' AND measurement_date=public.site_report_today() AND NOT is_archived;
 SELECT b.id INTO bi FROM public.project_boq_items b JOIN public.project_boq h ON h.id=b.boq_id WHERE h.project_id=pid AND b.sno=1 ORDER BY h.version_number DESC LIMIT 1;
 SELECT id INTO cid FROM public.labour_contractors ORDER BY id LIMIT 1;
 IF rid IS NULL OR bi IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Missing populated Test project fixtures'; END IF;
 INSERT INTO public.subcontract_rates(id,project_id,contractor_id,rate_type,boq_item_id,unit,rate_inr,created_by,updated_by) VALUES(rate,pid,cid,'per_unit',bi,'cum',123,md,md);
 INSERT INTO public.site_report_quantities(id,report_id,project_id,boq_item_id,contractor_id,rate_id,today_qty,rate_used,amount_inr,created_by,updated_by) VALUES(qi,rid,pid,bi,cid,rate,1,123,123,md,md);
 FOR ro IN SELECT unnest(ARRAY['site_engineer','site_installation_mgr','factory_floor_supervisor','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin','planning_engineer']) LOOP
  SELECT ur.user_id,p.id INTO uid,pr FROM public.user_roles ur JOIN public.profiles p ON p.auth_user_id=ur.user_id WHERE ur.role::text=ro AND p.role::text=ro AND p.is_active ORDER BY ur.user_id LIMIT 1;
  IF uid IS NULL THEN skipped:=skipped+1; result:=result||jsonb_build_array(jsonb_build_object('role',ro,'live_test','skipped: no existing account')); CONTINUE; END IF;
  -- Project membership is a temporary test fixture, not an app-role/account change.
  INSERT INTO public.project_team_members(project_id,profile_id,role,access_level,assigned_by) SELECT pid,pr,'security_test','read',(SELECT id FROM public.profiles WHERE auth_user_id=md) WHERE NOT EXISTS(SELECT 1 FROM public.project_team_members WHERE project_id=pid AND profile_id=pr AND is_active);
  commercial:=ro=ANY(ARRAY['finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin']);
  expected:=(SELECT count(*) FROM public.role_feature_access r WHERE public.is_tier1_or_super(uid) OR EXISTS(SELECT 1 FROM public.user_roles u WHERE u.user_id=uid AND u.role::text=r.role));
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.role_feature_access; IF n<>expected THEN RAISE EXCEPTION '% navigation mismatch',ro; END IF; checks:=checks+1;
  IF NOT public.is_tier1_or_super(uid) AND EXISTS(SELECT 1 FROM public.role_feature_access r WHERE NOT EXISTS(SELECT 1 FROM public.user_roles u WHERE u.user_id=uid AND u.role::text=r.role)) THEN RAISE EXCEPTION '% foreign navigation rows',ro; END IF; checks:=checks+1;
  rep:=public.get_site_report(pid,public.site_report_today()); IF rep IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rep->'quantities') q WHERE q->>'id'=qi::text AND q->>'today_qty'='1') THEN RAISE EXCEPTION '% report quantity missing',ro; END IF; checks:=checks+1;
  IF (rep->>'can_see_rates')::boolean IS DISTINCT FROM commercial THEN RAISE EXCEPTION '% monetary audience mismatch',ro; END IF;
  IF NOT commercial AND EXISTS(SELECT 1 FROM jsonb_array_elements(rep->'quantities') q WHERE q ?| ARRAY['rate_id','rate_used','amount_inr']) THEN RAISE EXCEPTION '% snapshot leak',ro; END IF;
  IF commercial AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rep->'quantities') q WHERE q->>'id'=qi::text AND q->>'amount_inr'='123' AND q->>'rate_used'='123' AND q->>'rate_id'=rate::text) THEN RAISE EXCEPTION '% commercial snapshots missing',ro; END IF; checks:=checks+1;
  IF NOT commercial AND EXISTS(SELECT 1 FROM jsonb_array_elements(rep->'rates') q WHERE q ?| ARRAY['id','effective_rate','lump_sum_inr']) THEN RAISE EXCEPTION '% active rate cost leak',ro; END IF; checks:=checks+1;
  FOR col IN SELECT unnest(ARRAY['amount_inr','rate_used','rate_id']) LOOP
   bad:=false; BEGIN EXECUTE format('SELECT %I FROM public.site_report_quantities LIMIT 1',col); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END;
   IF NOT bad THEN RAISE EXCEPTION '% direct % read permitted',ro,col; END IF; checks:=checks+1;
  END LOOP;
  bill:=NULL; bad:=false; BEGIN bill:=public.get_running_bill(pid,public.site_report_today()); EXCEPTION WHEN insufficient_privilege THEN bad:=true; END;
  IF commercial AND (bad OR (bill->'totals'->>'value_earned')::numeric<>151000 OR (bill->'totals'->>'own_labour_cost')::numeric<>6365.46 OR (bill->'totals'->>'subcontract_accrued')::numeric<>123) THEN RAISE EXCEPTION '% Running Bill parity failure',ro; END IF;
  IF NOT commercial AND NOT bad THEN RAISE EXCEPTION '% Running Bill unexpectedly allowed',ro; END IF; checks:=checks+1;
  result:=result||jsonb_build_array(jsonb_build_object('role',ro,'menu_rows',n,'report','loaded','snapshots',CASE WHEN commercial THEN 'checked path only' ELSE 'absent' END,'bill',CASE WHEN commercial THEN 'allowed' ELSE 'denied' END));
  EXECUTE 'RESET ROLE';
 END LOOP;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',md,'role','authenticated')::text,true);
 INSERT INTO public.site_diary(id,project_id,submitted_by,submitted_by_user_id,notes) VALUES(diary,pid,'Security rollback fixture',md,'Old');
 INSERT INTO public.daily_measurements(id,project_id,measurement_date,location,trade,created_by,submitted_by) VALUES(dm,pid,'2098-01-01','factory','general',md,md);
 INSERT INTO public.boq_items(id,project_id,description,unit,boq_qty,boq_rate) VALUES(oldboq,pid,'Security rollback fixture','unit',10,100);
 INSERT INTO public.measurement_line_items(id,measurement_id,boq_item_id) VALUES(li,dm,oldboq);
 EXECUTE 'SET LOCAL ROLE authenticated';
 FOR rec IN SELECT 'site_diary' t,diary id,'notes' k,payload val UNION ALL SELECT 'daily_measurements',dm,'notes',payload UNION ALL SELECT 'measurement_line_items',li,'today_qty','2' UNION ALL SELECT 'qc_inspection_items',id,'notes',payload FROM public.qc_inspection_items LIMIT 4 LOOP
  got:=public.apply_record_edit(rec.t,rec.id,jsonb_build_object(rec.k,jsonb_build_object('new',rec.val)),'mistyped','Rolled-back security regression');
  IF NOT (got->>'changed')::boolean OR NOT EXISTS(SELECT 1 FROM public.edit_history e WHERE e.edit_action_id=(got->>'edit_action_id')::uuid AND e.new_value=rec.val AND e.edited_by=md) THEN RAISE EXCEPTION 'Typed/audited % correction failed',rec.t; END IF; checks:=checks+1;
 END LOOP;
 FOR rec IN SELECT 'marketing_funnel_monthly' t,id,'total_leads' k,(total_leads+1)::text val FROM public.marketing_funnel_monthly LIMIT 1 LOOP
  got:=public.apply_record_edit(rec.t,rec.id,jsonb_build_object(rec.k,jsonb_build_object('new',rec.val)),'mistyped'); IF NOT (got->>'changed')::boolean THEN RAISE EXCEPTION 'Marketing correction failed'; END IF; checks:=checks+1;
 END LOOP;
 FOR rec IN SELECT 'call_funnel_monthly' t,id,'calls_made' k,(calls_made+1)::text val FROM public.call_funnel_monthly LIMIT 1 LOOP
  got:=public.apply_record_edit(rec.t,rec.id,jsonb_build_object(rec.k,jsonb_build_object('new',rec.val)),'mistyped'); IF NOT (got->>'changed')::boolean THEN RAISE EXCEPTION 'Call correction failed'; END IF; checks:=checks+1;
 END LOOP;
 FOR rec IN SELECT id,status FROM public.qc_inspections LIMIT 1 LOOP
  got:=public.apply_record_edit('qc_inspections',rec.id,jsonb_build_object('status',jsonb_build_object('new',rec.status)),'mistyped'); IF got->>'changed'<>'false' THEN RAISE EXCEPTION 'QC no-change contract failed'; END IF; checks:=checks+1;
 END LOOP;
 bad:=false; BEGIN PERFORM public.apply_record_edit('site_diary; SELECT 1',diary,'{"notes":{"new":"x"}}','mistyped'); EXCEPTION WHEN OTHERS THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Table injection accepted'; END IF; checks:=checks+1;
 bad:=false; BEGIN PERFORM public.apply_record_edit('site_diary',diary,'{"notes = NULL":{"new":"x"}}','mistyped'); EXCEPTION WHEN OTHERS THEN bad:=true; END; IF NOT bad THEN RAISE EXCEPTION 'Field injection accepted'; END IF; checks:=checks+1;
 EXECUTE 'RESET ROLE';
 IF EXISTS(SELECT 1 FROM public.reminder_events) THEN RAISE EXCEPTION 'Reminder events written'; END IF; checks:=checks+1;
 RAISE EXCEPTION 'EXPECTED_SUCCESS_ROLLBACK checks=% skipped_live_roles=% matrix=%',checks,skipped,result;
END $test$;
