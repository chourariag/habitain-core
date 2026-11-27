-- BOQ-3a2 rollback harness: real principals, NEW fixture rows only; intentional exception undoes everything.
DO $$
DECLARE
 writer uuid:='fb73ad26-d2de-432c-9f90-c0c3bc99c3ff'; -- costing_engineer, project member, not schedule editor
 md uuid:='99b67080-a6eb-4feb-bd8e-92a287b430aa';     -- managing_director and schedule editor
 tp1 uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
 p uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid();
 u1 uuid:=gen_random_uuid(); u2 uuid:=gen_random_uuid(); u3 uuid:=gen_random_uuid(); u4 uuid:=gen_random_uuid();
 u5 uuid:=gen_random_uuid(); u6 uuid:=gen_random_uuid(); u7 uuid:=gen_random_uuid(); u8 uuid:=gen_random_uuid();
 u9 uuid:=gen_random_uuid(); u10 uuid:=gen_random_uuid();
 m1 uuid:=gen_random_uuid(); m2 uuid:=gen_random_uuid(); m3 uuid:=gen_random_uuid(); m_override uuid:=gen_random_uuid();
 m_general uuid:=gen_random_uuid(); m_wrong uuid:=gen_random_uuid(); m_archived uuid:=gen_random_uuid();
 m_existing uuid:=gen_random_uuid(); m_taken uuid:=gen_random_uuid();
 t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); t3 uuid:=gen_random_uuid();
 report_id uuid:=gen_random_uuid(); line_id uuid; st jsonb; a jsonb; r jsonb;
 checks int:=0; rb_before text; rb_after text; cr_before text; cr_after text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_before:=md5(public.get_running_bill(tp1,current_date)::text);
 cr_before:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 RESET ROLE;

 INSERT INTO public.projects(id,name,site_lat,site_lng,created_by,updated_by) VALUES
  (p,'BOQ3A2 rollback fixture',12.97,77.59,writer,writer),
  (p2,'BOQ3A2 wrong-project fixture',12.97,77.59,writer,writer);
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level)
 SELECT p,id,'boq3a2_rollback','write' FROM public.profiles WHERE auth_user_id IN (writer,md);
 INSERT INTO public.project_schedule_units(id,project_id,unit_kind,unit_label,day1) VALUES
  (u1,p,'module','M1',current_date),(u2,p,'module','M2',current_date),
  (u3,p,'module','M3',current_date),(u4,p,'module','M4',current_date),
  (u5,p,'module','M5',current_date),(u6,p,'module','M6',current_date),
  (u7,p,'module','M7',current_date),(u8,p,'module','M8',current_date),
  (u9,p,'module','M9',current_date),(u10,p,'module','M10',current_date);
 INSERT INTO public.modules(id,project_id,name,module_code,is_archived,created_by) VALUES
  (m1,p,'Module 1',NULL,false,writer),
  (m2,p,'M2',NULL,false,writer),
  (m3,p,'M3',NULL,false,writer),
  (m_override,p,'Other M3',NULL,false,writer),
  (m_general,p,'General module',NULL,false,writer),
  (m_wrong,p2,'Wrong project module',NULL,false,writer),
  (m_archived,p,'Archived module',NULL,true,writer),
  (m_existing,p,'M7',NULL,false,writer),
  (m_taken,p,'M8',NULL,false,writer),
  (gen_random_uuid(),p,'M5',NULL,false,writer),
  (gen_random_uuid(),p,'M5',NULL,false,writer);

 -- Non-editor with project access is refused.
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 IF public.can_edit_schedule(auth.uid()) THEN RAISE EXCEPTION 'Fixture writer unexpectedly edits schedules'; END IF;
 BEGIN PERFORM public.schedule_set_unit_module(u1,m1); RAISE EXCEPTION 'non-editor accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 RESET ROLE;

 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 -- Set and clear.
 PERFORM public.schedule_set_unit_module(u4,m_general);
 IF (SELECT module_id FROM public.project_schedule_units WHERE id=u4)<>m_general THEN RAISE EXCEPTION 'set link failed'; END IF;
 PERFORM public.schedule_set_unit_module(u4,NULL);
 IF (SELECT module_id FROM public.project_schedule_units WHERE id=u4) IS NOT NULL THEN RAISE EXCEPTION 'clear link failed'; END IF;
 checks:=checks+2;
 -- Wrong-project and archived modules rejected.
 BEGIN PERFORM public.schedule_set_unit_module(u4,m_wrong); RAISE EXCEPTION 'wrong-project module accepted';
 EXCEPTION WHEN invalid_parameter_value THEN checks:=checks+1; END;
 BEGIN PERFORM public.schedule_set_unit_module(u4,m_archived); RAISE EXCEPTION 'archived module accepted';
 EXCEPTION WHEN invalid_parameter_value THEN checks:=checks+1; END;
 -- One module cannot be linked to two units.
 PERFORM public.schedule_set_unit_module(u4,m_general);
 BEGIN PERFORM public.schedule_set_unit_module(u10,m_general); RAISE EXCEPTION 'duplicate module accepted';
 EXCEPTION WHEN invalid_parameter_value THEN checks:=checks+1; END;
 PERFORM public.schedule_set_unit_module(u4,NULL);
 -- Direct authenticated writes in a new request (no transaction-local flag) are refused even for an editor.
 PERFORM set_config('hstack.schedule_unit_module_link','off',true);
 BEGIN UPDATE public.project_schedule_units SET module_id=m_general WHERE id=u4; RAISE EXCEPTION 'direct module_id update accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 -- Existing links used to verify auto-match never overwrites and never reuses a taken module.
 PERFORM public.schedule_set_unit_module(u7,m_existing);
 PERFORM public.schedule_set_unit_module(u9,m_taken);
 a:=public.schedule_auto_match_units(p);
 IF (a->>'linked')::int<>2 THEN RAISE EXCEPTION 'auto-match count %',a; END IF;
 IF (SELECT module_id FROM public.project_schedule_units WHERE id=u1) IS NOT NULL
    OR (SELECT module_id FROM public.project_schedule_units WHERE id=u2)<>m2
    OR (SELECT module_id FROM public.project_schedule_units WHERE id=u3)<>m3 THEN RAISE EXCEPTION 'exact matches not linked: %',a; END IF;
 IF (SELECT module_id FROM public.project_schedule_units WHERE id=u7)<>m_existing THEN RAISE EXCEPTION 'existing link overwritten'; END IF;
 IF (SELECT module_id FROM public.project_schedule_units WHERE id=u5) IS NOT NULL
    OR (SELECT module_id FROM public.project_schedule_units WHERE id=u6) IS NOT NULL
    OR (SELECT module_id FROM public.project_schedule_units WHERE id=u8) IS NOT NULL THEN RAISE EXCEPTION 'ambiguous/missing/taken match linked: %',a; END IF;
 IF NOT (a->'skipped' @> '[{"unit_label":"M5","reason":"More than one module matches"}]'::jsonb)
    OR NOT (a->'skipped' @> '[{"unit_label":"M6","reason":"No exact module name or code match"}]'::jsonb)
    OR NOT (a->'skipped' @> '[{"unit_label":"M7","reason":"Already linked"}]'::jsonb) THEN RAISE EXCEPTION 'skip reasons %',a; END IF;
 checks:=checks+2;
 -- Explicit links connect M1 to Module 1 and override M3's conflicting name match; clear M2 to test name fallback.
 PERFORM public.schedule_set_unit_module(u1,m1);
 PERFORM public.schedule_set_unit_module(u2,NULL);
 PERFORM public.schedule_set_unit_module(u3,m_override);
 checks:=checks+1;
 RESET ROLE;

 -- Locked BOQ with three units; M1 is half consumed.
 INSERT INTO public.project_tasks(id,project_id,task_id_in_schedule,task_name,task_type,unit_kind,unit_label,is_qc_gate,is_payment_milestone,is_removed) VALUES
  (t1,p,'A2-M1','Frame','task','module','M1',false,false,false),
  (t2,p,'A2-M2','Frame','task','module','M2',false,false,false),
  (t3,p,'A2-M3','Frame','task','module','M3',false,false,false);
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.boq1_mutate(p,'create','{"control_total":"1000","source_note":"BOQ3A2 rollback"}');
 st:=public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(
  '{"sno":"1","item_description":"BOQ3A2 walls","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb)),0);
 SELECT id INTO line_id FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=1;
 PERFORM public.boq1_mutate(p,'finalise','{}',(st->'header'->>'entry_version')::int);
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',line_id,'allocations',
  '[{"unit_kind":"module","unit_label":"M1","quantity":4},{"unit_kind":"module","unit_label":"M2","quantity":3},{"unit_kind":"module","unit_label":"M3","quantity":3}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',line_id,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',line_id,'unit_kind','module','unit_label','M2','shares',jsonb_build_array(jsonb_build_object('task_id',t2,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',line_id,'unit_kind','module','unit_label','M3','shares',jsonb_build_array(jsonb_build_object('task_id',t3,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'lock','{}');
 RESET ROLE;
 INSERT INTO public.factory_daily_reports(id,report_date,status,is_archived,created_by) VALUES(report_id,'1990-01-01','submitted',false,writer);
 INSERT INTO public.factory_report_blocks(report_id,module_id,stage,created_by,updated_by) VALUES(report_id,m1,'s1',writer,writer);
 INSERT INTO public.factory_report_quantities(report_id,module_id,stage,boq_item_id,today_qty,amount_inr,is_archived,created_by)
 VALUES(report_id,m1,'s1',line_id,2,200,false,writer);

 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 r:=public.boq3_task_report(p);
 -- Link maps M1 to Module 1 and earns budget 400 * C2/A4 = 200 exactly.
 IF (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE x->>'unit_label'='M1'
   AND (x->>'mapped')::boolean AND x->>'mapped_by'='link' AND x->>'module_name'='Module 1'
   AND (x->>'budget')::numeric=400 AND (x->>'earned')::numeric=200 AND (x->>'actual')::numeric=200)<>1 THEN RAISE EXCEPTION 'M1 link report %',r->'units'; END IF;
 checks:=checks+1;
 -- No link on M2: exact name fallback remains.
 IF (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE x->>'unit_label'='M2'
   AND (x->>'mapped')::boolean AND x->>'mapped_by'='name' AND x->>'module_name'='M2')<>1 THEN RAISE EXCEPTION 'name fallback changed %',r->'units'; END IF;
 checks:=checks+1;
 -- M3 uses Other M3 through its explicit link, not the conflicting name match M3.
 IF (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE x->>'unit_label'='M3'
   AND (x->>'mapped')::boolean AND x->>'mapped_by'='link' AND x->>'module_name'='Other M3')<>1 THEN RAISE EXCEPTION 'link did not override name %',r->'units'; END IF;
 checks:=checks+1;
 RESET ROLE;
 -- Archiving the explicitly linked module makes it unmapped without a name fallback.
 UPDATE public.modules SET is_archived=true WHERE id=m_override;
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 r:=public.boq3_task_report(p);
 IF (SELECT count(*) FROM jsonb_array_elements(r->'units') x WHERE x->>'unit_label'='M3'
   AND NOT (x->>'mapped')::boolean AND x->>'mapped_by' IS NULL AND x->>'unmapped_reason'='Linked module is archived')<>1 THEN RAISE EXCEPTION 'archived link handling %',r->'units'; END IF;
 checks:=checks+1;
 RESET ROLE;

 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_after:=md5(public.get_running_bill(tp1,current_date)::text);
 cr_after:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 IF rb_before<>rb_after OR cr_before<>cr_after THEN RAISE EXCEPTION 'reader output changed'; END IF;
 checks:=checks+1;
 RAISE EXCEPTION 'BOQ3A2_ROLLBACK_OK: % checks; running bill %, cost report %',checks,rb_after,cr_after;
END $$;
