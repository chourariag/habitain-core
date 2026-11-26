-- BOQ-3a rollback harness: real principals, authenticated role, NEW fixture project/BOQ/tasks/modules/factory rows only.
-- Ends with an intentional exception so every fixture row is undone.
DO $$
DECLARE
 writer uuid:='fb73ad26-d2de-432c-9f90-c0c3bc99c3ff'; -- costing_engineer (BOQ writer)
 md uuid:='99b67080-a6eb-4feb-bd8e-92a287b430aa';     -- managing_director
 outsider uuid:='8f500e23-25e6-4455-a51c-36c9eedb8412'; -- marketing, not on the fixture team
 tp1 uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
 p uuid:=gen_random_uuid();
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); t3 uuid:=gen_random_uuid(); t5 uuid:=gen_random_uuid(); t6 uuid:=gen_random_uuid();
 m1 uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid(); m4 uuid:=gen_random_uuid();
 rs uuid:=gen_random_uuid(); rd uuid:=gen_random_uuid(); ra uuid:=gen_random_uuid();
 la uuid; lb uuid; lc uuid; st jsonb; r jsonb; checks int:=0; rb_before text; rb_after text; cr_before text; cr_after text; v numeric;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_before:=md5(public.get_running_bill(tp1,current_date)::text); cr_before:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 RESET ROLE;
 INSERT INTO public.projects(id,name,site_lat,site_lng,created_by,updated_by) VALUES(p,'BOQ3 rollback fixture',12.97,77.59,writer,writer);
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'boq3_rollback','write' FROM public.profiles WHERE auth_user_id IN (writer,md);
 INSERT INTO public.project_schedule_units(project_id,unit_kind,unit_label,day1) VALUES(p,'module','M1',current_date),(p,'module','M2',current_date),(p,'module','M3',current_date),(p,'module','M4',current_date);
 -- M1 matches by code (case/space-insensitive), M2 by name, M3 has no match, M4 by name
 INSERT INTO public.modules(id,project_id,name,module_code,created_by) VALUES(m1,p,'Module One',' m1 ',writer),(m2,p,' m2 ',NULL,writer),(m4,p,'M4',NULL,writer),(gen_random_uuid(),p,'Module Three',NULL,writer);
 INSERT INTO public.project_tasks(id,project_id,task_id_in_schedule,task_name,task_type,unit_kind,unit_label,is_qc_gate,is_payment_milestone,is_removed) VALUES
  (t1,p,'B3-M1-01','Frame','task','module','M1',false,false,false),(t2,p,'B3-M1-02','Board','task','module','M1',false,false,false),
  (t3,p,'B3-M2-01','Frame','task','module','M2',false,false,false),(t5,p,'B3-M3-01','Frame','task','module','M3',false,false,false),
  (t6,p,'B3-M4-01','Frame','task','module','M4',false,false,false);
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.boq1_mutate(p,'create','{"control_total":"1116.66","source_note":"Signed BOQ3 rollback"}');
 st:=public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(
  '{"sno":"1","item_description":"BOQ3 walls","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb,
  '{"sno":"2","item_description":"BOQ3 site line","unit":"nos","boq_qty":"1","boq_rate":"50","category":"Civil","scope":"Both","work_location":"site"}'::jsonb,
  '{"sno":"3","item_description":"BOQ3 trims","unit":"m","boq_qty":"2","boq_rate":"33.33","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb)),0);
 SELECT id INTO la FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=1;
 SELECT id INTO lb FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=2;
 SELECT id INTO lc FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=3;
 PERFORM public.boq1_mutate(p,'finalise','{}',(st->'header'->>'entry_version')::int);
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',la,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":4},{"unit_kind":"module","unit_label":"M2","quantity":3},{"unit_kind":"module","unit_label":"M3","quantity":2},{"unit_kind":"module","unit_label":"M4","quantity":1}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',50),jsonb_build_object('task_id',t2,'share_pct',50))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M2','shares',jsonb_build_array(jsonb_build_object('task_id',t3,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M3','shares',jsonb_build_array(jsonb_build_object('task_id',t5,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M4','shares',jsonb_build_array(jsonb_build_object('task_id',t6,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',lb,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":1}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',lb,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',lc,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":2}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',lc,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',33.33),jsonb_build_object('task_id',t2,'share_pct',66.67))));
 -- not locked yet
 IF public.boq3_task_report(p)->>'status'<>'no_locked_links' THEN RAISE EXCEPTION 'unlocked set reported'; END IF; checks:=checks+1;
 PERFORM public.boq2_mutate(p,'lock','{}');
 RESET ROLE;
 -- factory rows: submitted report, draft report, archived report, plus an archived row in the submitted report
 INSERT INTO public.factory_daily_reports(id,report_date,status,is_archived,created_by) VALUES(rs,'1990-01-01','submitted',false,writer),(rd,'1990-01-02','draft',false,writer),(ra,'1990-01-03','submitted',true,writer);
 INSERT INTO public.factory_report_blocks(report_id,module_id,stage,created_by,updated_by) VALUES(rs,m1,'s1',writer,writer),(rs,m1,'s2',writer,writer),(rd,m1,'s1',writer,writer),(ra,m1,'s1',writer,writer),(rs,m2,'s1',writer,writer);
 INSERT INTO public.factory_report_quantities(report_id,module_id,stage,boq_item_id,today_qty,amount_inr,is_archived,created_by) VALUES
  (rs,m1,'s1',la,2,500,false,writer),      -- C=A/2 on M1, actual 500
  (rs,m1,'s2',la,4,999,true,writer),       -- archived row: ignored
  (rd,m1,'s1',la,4,999,false,writer),      -- draft report: ignored
  (ra,m1,'s1',la,4,999,false,writer),      -- archived report: ignored
  (rs,m2,'s1',la,6,0,false,writer),        -- C>A on M2
  (rs,m1,'s1',lc,2,0,false,writer);        -- trims fully consumed
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 r:=public.boq3_task_report(p);
 -- (a) C=0 gives earned 0 (M4)
 SELECT (x->>'earned')::numeric INTO v FROM jsonb_array_elements(r->'links') x WHERE x->>'code'='B3-M4-01';
 IF v<>0 THEN RAISE EXCEPTION '(a) earned %',v; END IF; checks:=checks+1;
 -- (b) C=A/2 gives budget/2 exactly (M1 walls, each task budget 200 -> 100), and (e) draft/archived rows ignored
 IF (SELECT count(*) FROM jsonb_array_elements(r->'links') x WHERE x->>'unit_label'='M1' AND x->>'sno'='1' AND (x->>'budget')::numeric=200 AND (x->>'earned')::numeric=100 AND (x->>'consumed_qty')::numeric=2)<>2 THEN RAISE EXCEPTION '(b/e) %',r->'links'; END IF; checks:=checks+2;
 IF (SELECT (x->>'actual')::numeric FROM jsonb_array_elements(r->'links') x WHERE x->>'code'='B3-M1-01' AND x->>'sno'='1')<>250 THEN RAISE EXCEPTION 'actual share wrong'; END IF; checks:=checks+1;
 -- (c) C>A: overrun 3, earned 600 not capped at 300
 IF (SELECT count(*) FROM jsonb_array_elements(r->'links') x WHERE x->>'code'='B3-M2-01' AND (x->>'earned')::numeric=600 AND (x->>'overrun_qty')::numeric=3)<>1
  OR NOT (SELECT (x->>'overrun')::boolean FROM jsonb_array_elements(r->'tasks') x WHERE x->>'code'='B3-M2-01') THEN RAISE EXCEPTION '(c) %',r->'links'; END IF; checks:=checks+1;
 -- (d) unmapped M3 reported with module names, not guessed
 IF (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE x->>'unit_label'='M3' AND NOT (x->>'mapped')::boolean AND x->'modules_found' ? 'Module Three' AND (x->>'earned')::numeric=0)<>1
  OR (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE (x->>'mapped')::boolean)<>3 THEN RAISE EXCEPTION '(d) %',r->'units'; END IF; checks:=checks+1;
 -- (f) fully consumed trims line: earned equals line budget to the paisa (66.66)
 SELECT sum((x->>'earned')::numeric) INTO v FROM jsonb_array_elements(r->'links') x WHERE x->>'sno'='3';
 IF v<>66.66 OR (SELECT sum((x->>'budget')::numeric) FROM jsonb_array_elements(r->'links') x WHERE x->>'sno'='3')<>66.66 THEN RAISE EXCEPTION '(f) %',v; END IF; checks:=checks+1;
 -- site line listed with budget only; totals reconcile with BOQ
 IF (r->'site_lines'->0->>'budget')::numeric<>50 OR (r->'totals'->>'factory_budget')::numeric+(r->'totals'->>'site_budget')::numeric<>1116.66 THEN RAISE EXCEPTION 'site/totals %',r->'totals'; END IF; checks:=checks+1;
 -- (g) non-reader refused 42501
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',outsider::text,true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.boq3_task_report(p); RAISE EXCEPTION 'non-reader accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 -- (h) readers unchanged
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_after:=md5(public.get_running_bill(tp1,current_date)::text); cr_after:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 IF rb_before<>rb_after OR cr_before<>cr_after THEN RAISE EXCEPTION 'reader output changed'; END IF; checks:=checks+1;
 RAISE EXCEPTION 'BOQ3_ROLLBACK_OK: % checks; totals %; running bill %, cost report %',checks,r->'totals',rb_after,cr_after;
END $$;
