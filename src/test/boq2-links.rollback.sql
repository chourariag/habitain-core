-- BOQ-2 rollback harness: real principals, authenticated role, NEW fixture project/BOQ/tasks only.
-- Ends with an intentional exception so every fixture, link, audit row and schedule change is undone.
DO $$
DECLARE
 writer uuid:='fb73ad26-d2de-432c-9f90-c0c3bc99c3ff'; -- costing_engineer (BOQ writer)
 md uuid:='99b67080-a6eb-4feb-bd8e-92a287b430aa';     -- managing_director (schedule editor)
 outsider uuid:='8f500e23-25e6-4455-a51c-36c9eedb8412'; -- marketing (non-writer)
 tp1 uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
 p uuid:=gen_random_uuid(); lib1 uuid; lib2 uuid;
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); t3 uuid:=gen_random_uuid(); t4 uuid:=gen_random_uuid(); t5 uuid:=gen_random_uuid();
 qc uuid:=gen_random_uuid(); pay uuid:=gen_random_uuid(); rem uuid:=gen_random_uuid();
 la uuid; lb uuid; st jsonb; sug jsonb; ver int; checks int:=0; msg text; rb_before text; rb_after text; cr_before text; cr_after text; s numeric;
BEGIN
 SELECT id INTO lib1 FROM public.schedule_library_tasks ORDER BY id LIMIT 1;
 SELECT id INTO lib2 FROM public.schedule_library_tasks ORDER BY id OFFSET 1 LIMIT 1;
 -- (j) existing readers before, as MD on Test project - 1
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_before:=md5(public.get_running_bill(tp1,current_date)::text); cr_before:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 RESET ROLE;
 INSERT INTO public.projects(id,name,site_lat,site_lng,created_by,updated_by) VALUES(p,'BOQ2 rollback fixture',12.97,77.59,writer,writer);
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'boq2_rollback','write' FROM public.profiles WHERE auth_user_id IN (writer,md,outsider);
 INSERT INTO public.project_schedule_units(project_id,unit_kind,unit_label,day1) VALUES(p,'module','M1',current_date),(p,'module','M2',current_date),(p,'module','M3',current_date);
 INSERT INTO public.project_tasks(id,project_id,task_id_in_schedule,task_name,task_type,unit_kind,unit_label,library_task_id,is_qc_gate,is_payment_milestone,is_removed) VALUES
  (t1,p,'B2-M1-01','Frame','task','module','M1',lib1,false,false,false),(t2,p,'B2-M1-02','Board','task','module','M1',lib2,false,false,false),
  (t3,p,'B2-M2-01','Frame','task','module','M2',lib1,false,false,false),(t4,p,'B2-M2-02','Board','task','module','M2',lib2,false,false,false),
  (t5,p,'B2-M3-01','Frame','task','module','M3',lib1,false,false,false),
  (qc,p,'B2-M1-QC','QC gate','qc_gate','module','M1',NULL,true,false,false),(pay,p,'B2-M1-PAY','Payment','payment','module','M1',NULL,false,true,false),
  (rem,p,'B2-M1-REM','Removed','task','module','M1',NULL,false,false,true);
 -- a removed task is made through the unchanged schedule function (inserts cannot start removed)
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.publish_schedule_baseline(p,'BOQ2 rollback fixture baseline'); -- fixture project only, rolled back
 PERFORM public.schedule_remove_task(rem,'BOQ2 rollback removed fixture');
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.boq1_mutate(p,'create','{"control_total":"633.33","source_note":"Signed BOQ2 rollback"}');
 st:=public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(
  '{"sno":"1","item_description":"BOQ2 walls","unit":"sqm","boq_qty":"10","boq_rate":"33.33","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb,
  '{"sno":"2","item_description":"BOQ2 roof","unit":"sqm","boq_qty":"3","boq_rate":"100.01","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb,
  '{"sno":"3","item_description":"BOQ2 zero line","unit":"nos","boq_qty":"0","boq_rate":"50","category":"Civil","scope":"Both","work_location":"site"}'::jsonb)),0);
 SELECT id INTO la FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=1;
 SELECT id INTO lb FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=2;
 -- fresh draft BOQ cannot be linked
 BEGIN PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',la,'allocations','[]'::jsonb)); RAISE EXCEPTION 'draft BOQ accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Finalise the fresh BOQ%' THEN RAISE; END IF; checks:=checks+1; END;
 PERFORM public.boq1_mutate(p,'finalise','{}',(st->'header'->>'entry_version')::int);
 -- (i) equal split remainder lands in the last unit
 sug:=public.boq2_suggest_equal_split(p,la,'[{"unit_kind":"module","unit_label":"M1"},{"unit_kind":"module","unit_label":"M2"},{"unit_kind":"module","unit_label":"M3"}]');
 IF (sug->0->>'quantity')::numeric<>3.33 OR (sug->1->>'quantity')::numeric<>3.33 OR (sug->2->>'quantity')::numeric<>3.34 THEN RAISE EXCEPTION 'equal split wrong %',sug; END IF;
 checks:=checks+1;
 -- (a) split not equal to line quantity
 BEGIN PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',la,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":3},{"unit_kind":"module","unit_label":"M2","quantity":3},{"unit_kind":"module","unit_label":"M3","quantity":3}]'::jsonb)); RAISE EXCEPTION 'bad split accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%add up to 9 but the line quantity is 10%' THEN RAISE; END IF; checks:=checks+1; END;
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',la,'allocations',sug));
 -- (b) shares not exactly 100.00
 BEGIN PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',50),jsonb_build_object('task_id',t2,'share_pct',49.99)))); RAISE EXCEPTION '99.99 accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%add up to 99.99%%' THEN RAISE; END IF; checks:=checks+1; END;
 -- (c) other-unit, removed, QC gate and payment tasks refused
 FOREACH ver IN ARRAY ARRAY[1,2,3,4] LOOP
  BEGIN PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',(ARRAY[t3,rem,qc,pay])[ver],'share_pct',100)))); RAISE EXCEPTION 'ineligible task % accepted',ver;
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%cannot be linked%' OR SQLERRM NOT LIKE '%'||(ARRAY['task is in module M2','removed from the schedule','QC gates','payment milestones'])[ver]||'%' THEN RAISE; END IF; checks:=checks+1; END;
 END LOOP;
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',33.33),jsonb_build_object('task_id',t2,'share_pct',66.67))));
 -- copy helper matches by library task, same project only
 sug:=public.boq2_suggest_copy_shares(p,la,'module','M1','[{"unit_kind":"module","unit_label":"M2"},{"unit_kind":"module","unit_label":"M3"}]');
 IF jsonb_array_length(sug->0->'shares')<>2 OR jsonb_array_length(sug->1->'shares')<>1 OR jsonb_array_length(sug->1->'unmatched')<>1 THEN RAISE EXCEPTION 'copy helper wrong %',sug; END IF;
 checks:=checks+1;
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M2','shares',sug->0->'shares'));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',la,'unit_kind','module','unit_label','M3','shares',jsonb_build_array(jsonb_build_object('task_id',t5,'share_pct',100))));
 -- (d) partial coverage refuses lock with the reason
 BEGIN PERFORM public.boq2_mutate(p,'lock','{}'); RAISE EXCEPTION 'partial lock accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Cannot lock yet: 1 of 2 line(s)%' THEN RAISE; END IF; checks:=checks+1; END;
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',lb,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":3}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',lb,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',100))));
 st:=public.boq2_mutate(p,'lock','{}');
 IF st->'set'->>'status'<>'locked' THEN RAISE EXCEPTION 'lock failed'; END IF; checks:=checks+1;
 -- (h) task budgets add up to BOQ total in paise
 SELECT sum((x->>'budget')::numeric) INTO s FROM jsonb_array_elements(st->'task_budgets') x;
 IF (st->'totals'->>'boq_total')::numeric<>633.33 OR s<>633.33 OR (st->'totals'->>'unlinked')::numeric<>0 THEN RAISE EXCEPTION 'budgets do not add up: % %',s,st->'totals'; END IF; checks:=checks+1;
 -- (e) after lock direct changes refused 42501; reasoned revision works and is audited
 BEGIN PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',lb,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t2,'share_pct',100)))); RAISE EXCEPTION 'locked change accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 BEGIN UPDATE public.boq_task_links SET share_pct=1 WHERE project_id=p; RAISE EXCEPTION 'direct table write accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 BEGIN PERFORM public.boq2_mutate(p,'revise',jsonb_build_object('reason','no','changes','[]'::jsonb)); RAISE EXCEPTION 'short reason accepted';
 EXCEPTION WHEN raise_exception THEN checks:=checks+1; END;
 st:=public.boq2_mutate(p,'revise',jsonb_build_object('reason','Client moved roof board work','changes',jsonb_build_array(jsonb_build_object('kind','shares','boq_item_id',lb,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',40),jsonb_build_object('task_id',t2,'share_pct',60))))));
 IF st->'set'->>'status'<>'locked' OR NOT EXISTS(SELECT 1 FROM public.boq_link_audit WHERE project_id=p AND action='revision' AND reason='Client moved roof board work' AND created_by=writer)
  OR NOT EXISTS(SELECT 1 FROM public.boq_link_audit WHERE project_id=p AND action='revision_shares' AND created_by=writer) THEN RAISE EXCEPTION 'revision not audited'; END IF; checks:=checks+1;
 -- (g) non-writer refused
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',outsider::text,true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.boq2_mutate(p,'lock','{}'); RAISE EXCEPTION 'non-writer accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 -- (f) removing a linked task through the unchanged schedule function flags the link broken
 RESET ROLE; PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.schedule_remove_task(t5,'BOQ2 rollback remove');
 st:=public.boq2_get(p);
 IF (st->'totals'->>'lines_broken')::int<>1 OR (st->'totals'->>'linked')::numeric>=633.33 OR NOT (st->>'revision_needed')::boolean OR st->'broken'->0->>'code'<>'B2-M3-01' THEN RAISE EXCEPTION 'broken link not flagged %',st->'totals'; END IF; checks:=checks+1;
 -- (j) readers unchanged
 rb_after:=md5(public.get_running_bill(tp1,current_date)::text); cr_after:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 IF rb_before<>rb_after OR cr_before<>cr_after THEN RAISE EXCEPTION 'reader output changed'; END IF; checks:=checks+1;
 msg:=st->'broken'->0->>'reason';
 RAISE EXCEPTION 'BOQ2_ROLLBACK_OK: % checks; broken reason "%"; running bill %, cost report %',checks,msg,rb_after,cr_after;
END $$;
