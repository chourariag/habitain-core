-- B1 rolled-back checks: subcontract rates, "done by" quantities, snapshots, access.
-- Runs as a privileged session; the block always ends by raising its results, so nothing is committed.
DO $chk$
DECLARE
  pid uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';          -- Test project - 1
  md uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='managing_director' AND is_active ORDER BY id LIMIT 1);
  se uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='site_engineer' AND is_active ORDER BY id LIMIT 1);
  st uuid := (SELECT auth_user_id FROM public.profiles WHERE role::text='stores_executive' AND is_active ORDER BY id LIMIT 1);
  boq uuid := (SELECT id FROM public.project_boq WHERE project_id='e4f51cd6-fb25-475e-980a-5e46070d678f' ORDER BY version_number DESC, uploaded_at DESC LIMIT 1);
  b1 uuid; b2 uuid; b3 uuid; shiv uuid; dush uuid; d1 date; d2 date; rid uuid; rid2 uuid; v jsonb; res text := ''; n int; amt numeric; msg text;
  claims_md text; claims_se text; claims_st text; old14 jsonb;
BEGIN
  SELECT id INTO b1 FROM public.project_boq_items WHERE boq_id=boq AND sno=1;
  SELECT id INTO b2 FROM public.project_boq_items WHERE boq_id=boq AND sno=2;
  SELECT id INTO b3 FROM public.project_boq_items WHERE boq_id=boq AND sno=3;
  SELECT id INTO shiv FROM public.labour_contractors WHERE company_name='SHIV ENGINEERING';
  SELECT id INTO dush FROM public.labour_contractors WHERE company_name='DUSHYANTH ENTERPRISES';
  d2 := public.site_report_today(); d1 := d2 - 1;
  claims_md := json_build_object('sub', md, 'role', 'authenticated')::text;
  claims_se := json_build_object('sub', se, 'role', 'authenticated')::text;
  claims_st := json_build_object('sub', st, 'role', 'authenticated')::text;

  -- 1. Setup dry run (writes nothing)
  PERFORM set_config('request.jwt.claims', claims_md, true); EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.validate_subcontract_rates(pid, jsonb_build_array(
    jsonb_build_object('excel_row','2','contractor_name','SHIV ENGINEERING','boq_code','1','unit','cum','rate_type','Per Unit','rate','450'),
    jsonb_build_object('excel_row','3','contractor_name','UNKNOWN BUILDERS','boq_code','1','unit','cum','rate_type','Per Unit','rate','450'),
    jsonb_build_object('excel_row','4','contractor_name','DUSHYANTH ENTERPRISES','work_description','Waterproofing','unit','%','rate_type','Lump Sum','lump_sum','100000','package_qty','100')), '[]'::jsonb);
  res := res || 'DRYRUN=' || jsonb_build_object('errors',v->'errors','warnings',v->'warnings','valid',jsonb_array_length(v->'prepared'))::text || E'\n';
  res := res || 'DRYRUN_WROTE=' || (SELECT count(*) FROM public.subcontract_rates WHERE project_id=pid) || E'\n';

  -- 2. Commit rates (Subcontract Rates sheet only)
  v := public.commit_project_setup_excel_upload_v2(pid,'[]','[]','[]', jsonb_build_array(
    jsonb_build_object('excel_row','2','contractor_name','SHIV ENGINEERING','boq_code','1','unit','cum','rate_type','Per Unit','rate','450'),
    jsonb_build_object('excel_row','3','contractor_name','SHIV ENGINEERING','boq_code','2','unit','kg','rate_type','Lump Sum','lump_sum','10000','package_qty','100'),
    jsonb_build_object('excel_row','4','contractor_name','DUSHYANTH ENTERPRISES','work_description','Waterproofing','unit','%','rate_type','Lump Sum','lump_sum','100000','package_qty','100')));
  res := res || 'COMMIT=' || v::text || E'\n';

  -- 3. Save day-1 draft: own + subcontract + lump sum + other work + headcount
  rid := public.save_site_report_draft(pid, d1, jsonb_build_object('notes','B1 rolled-back check day 1','site_clean',true,
    'quantities', jsonb_build_array(
      jsonb_build_object('boq_item_id',b1,'today_qty',5),
      jsonb_build_object('boq_item_id',b1,'contractor_id',shiv,'today_qty',10),
      jsonb_build_object('boq_item_id',b2,'contractor_id',shiv,'today_qty',60),
      jsonb_build_object('contractor_id',dush,'extra_work_description','Waterproofing','today_qty',30),
      jsonb_build_object('extra_work_description','Debris removal','unit','trip','today_qty',2)),
    'headcount', jsonb_build_array(jsonb_build_object('contractor_id',shiv,'headcount',6))));
  -- save blocks a contractor with no rate on the item
  BEGIN
    PERFORM public.save_site_report_draft(pid, d1, jsonb_build_object('quantities', jsonb_build_array(jsonb_build_object('boq_item_id',b3,'contractor_id',shiv,'today_qty',1))));
    res := res || 'SAVE_NO_RATE=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'SAVE_NO_RATE=' || SQLERRM || E'\n'; END;
  -- lump-sum cap within one report
  BEGIN
    PERFORM public.save_site_report_draft(pid, d1, jsonb_build_object('quantities', jsonb_build_array(jsonb_build_object('boq_item_id',b2,'contractor_id',shiv,'today_qty',120))));
    res := res || 'CAP_SINGLE=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'CAP_SINGLE=' || SQLERRM || E'\n'; END;

  -- photos and site clean are required for submit: add them as the privileged session
  EXECUTE 'RESET ROLE';
  INSERT INTO public.site_report_photos(report_id,project_id,kind,elevation_id,storage_path,uploaded_by)
    SELECT rid,pid,'elevation',e.id,'b1-check/'||e.id,md FROM public.project_elevations e WHERE e.project_id=pid AND e.is_active;
  UPDATE public.daily_measurements SET site_clean=true, site_clean_photo_path='b1-check/clean' WHERE id=rid;
  PERFORM set_config('request.jwt.claims', claims_md, true); EXECUTE 'SET LOCAL ROLE authenticated';
  v := public.submit_site_report(rid);
  res := res || 'SUBMIT1=' || jsonb_build_object('subcontract_amount',v->'subcontract_amount','headcount_missing',v->'headcount_missing')::text || E'\n';
  SELECT jsonb_agg(jsonb_build_object('item',coalesce((SELECT sno::text FROM public.project_boq_items WHERE id=q.boq_item_id),q.extra_work_description),
     'by',coalesce((SELECT company_name FROM public.labour_contractors WHERE id=q.contractor_id),'own'),'qty',q.today_qty,'rate_used',q.rate_used,'amount',q.amount_inr) ORDER BY q.created_at)
    INTO v FROM public.site_report_quantities q WHERE q.report_id=rid;
  res := res || 'ROWS1=' || v::text || E'\n';

  -- 4. Rate edit: SHIV boq 1 goes to 500; the submitted snapshot must not change
  PERFORM public.commit_project_setup_excel_upload_v2(pid,'[]','[]','[]', jsonb_build_array(
    jsonb_build_object('excel_row','2','contractor_name','SHIV ENGINEERING','boq_code','1','unit','cum','rate_type','Per Unit','rate','500'),
    jsonb_build_object('excel_row','3','contractor_name','SHIV ENGINEERING','boq_code','2','unit','kg','rate_type','Lump Sum','lump_sum','10000','package_qty','100'),
    jsonb_build_object('excel_row','4','contractor_name','DUSHYANTH ENTERPRISES','work_description','Waterproofing','unit','%','rate_type','Lump Sum','lump_sum','100000','package_qty','100')));
  SELECT amount_inr INTO amt FROM public.site_report_quantities WHERE report_id=rid AND boq_item_id=b1 AND contractor_id=shiv;
  res := res || 'SNAPSHOT_AFTER_RATE_EDIT=' || amt || ' (rate now ' || (SELECT rate_inr FROM public.subcontract_rates WHERE project_id=pid AND boq_item_id=b1) || ')' || E'\n';

  -- 5. Lump-sum cap across reports: 60 already submitted of 100
  BEGIN
    PERFORM public.save_site_report_draft(pid, d2, jsonb_build_object('quantities', jsonb_build_array(jsonb_build_object('boq_item_id',b2,'contractor_id',shiv,'today_qty',50))));
    res := res || 'CAP_CUMULATIVE_50=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'CAP_CUMULATIVE_50=' || SQLERRM || E'\n'; END;
  rid2 := public.save_site_report_draft(pid, d2, jsonb_build_object('notes','B1 rolled-back check day 2','site_clean',true,
    'quantities', jsonb_build_array(jsonb_build_object('boq_item_id',b2,'contractor_id',shiv,'today_qty',40))));
  res := res || 'CAP_CUMULATIVE_40=saved' || E'\n';

  -- 6. Submit blocks a subcontract row with no active rate
  EXECUTE 'RESET ROLE';
  INSERT INTO public.site_report_photos(report_id,project_id,kind,elevation_id,storage_path,uploaded_by)
    SELECT rid2,pid,'elevation',e.id,'b1-check2/'||e.id,md FROM public.project_elevations e WHERE e.project_id=pid AND e.is_active;
  UPDATE public.daily_measurements SET site_clean=true, site_clean_photo_path='b1-check2/clean' WHERE id=rid2;
  INSERT INTO public.site_report_quantities(report_id,project_id,boq_item_id,contractor_id,today_qty) VALUES (rid2,pid,b3,shiv,2);
  PERFORM set_config('request.jwt.claims', claims_md, true); EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.submit_site_report(rid2);
    res := res || 'SUBMIT_NO_RATE=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'SUBMIT_NO_RATE=' || SQLERRM || E'\n'; END;

  -- 7. Existing own-labour report (14/11 or the oldest editable one) still saves and submits
  SELECT jsonb_build_object('id',d.id,'date',d.measurement_date) INTO old14 FROM public.daily_measurements d
    WHERE d.project_id=pid AND d.trade='daily_site_report' AND d.report_status='submitted' AND d.measurement_date < d1 AND d.measurement_date >= d2 - 2
    ORDER BY d.measurement_date DESC LIMIT 1;
  IF old14 IS NOT NULL THEN
    v := public.get_site_report(pid, (old14->>'date')::date);
    PERFORM public.save_site_report_draft(pid, (old14->>'date')::date, jsonb_build_object('notes', v->'report'->>'notes',
      'quantities', (SELECT coalesce(jsonb_agg(jsonb_build_object('boq_item_id',x->>'boq_item_id','today_qty',x->>'today_qty')),'[]'::jsonb) FROM jsonb_array_elements(v->'quantities') x)));
    v := public.submit_site_report((old14->>'id')::uuid);
    res := res || 'OWN_LABOUR_REPORT ' || (old14->>'date') || '=saved+submitted ' || jsonb_build_object('quantity_lines',v->'quantity_lines','subcontract_amount',v->'subcontract_amount')::text || E'\n';
  ELSE
    res := res || 'OWN_LABOUR_REPORT=none in window' || E'\n';
  END IF;

  -- 8. A site engineer cannot write rates
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', claims_se, true); EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.subcontract_rates(project_id,contractor_id,rate_type,boq_item_id,unit,rate_inr) VALUES (pid,shiv,'per_unit',b3,'sqm',10);
    res := res || 'SE_DIRECT_INSERT=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'SE_DIRECT_INSERT=blocked (' || SQLERRM || ')' || E'\n'; END;
  BEGIN
    UPDATE public.subcontract_rates SET rate_inr=1 WHERE project_id=pid; GET DIAGNOSTICS n = ROW_COUNT;
    res := res || 'SE_DIRECT_UPDATE rows=' || n || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'SE_DIRECT_UPDATE=blocked (' || SQLERRM || ')' || E'\n'; END;
  BEGIN
    PERFORM public.commit_project_setup_excel_upload_v2(pid,'[]','[]','[]','[]'::jsonb);
    res := res || 'SE_SETUP_UPLOAD=allowed(FAIL)' || E'\n';
  EXCEPTION WHEN OTHERS THEN res := res || 'SE_SETUP_UPLOAD=blocked (' || SQLERRM || ')' || E'\n'; END;

  -- 9. Read access: stores_executive sees none, MD sees all
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', claims_st, true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.subcontract_rates; res := res || 'READ stores_executive=' || n;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', claims_md, true); EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.subcontract_rates WHERE project_id=pid; res := res || ' managing_director=' || n || E'\n';
  EXECUTE 'RESET ROLE';
  res := res || 'REMINDER_EVENTS=' || (SELECT count(*) FROM public.reminder_events);
  RAISE EXCEPTION 'B1 RESULTS (rolled back)%', E'\n' || res;
END $chk$;
