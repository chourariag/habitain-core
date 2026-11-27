-- BOQ-3b rollback harness: real principals, NEW fixture rows only; the final exception undoes everything.
-- pg_temp.boq3_old is the pre-0087 boq3_task_report, used only to prove the factory section is unchanged.
CREATE OR REPLACE FUNCTION pg_temp.boq3_old(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE s public.boq_link_sets; st jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.boq2_can_read(p_project) THEN
  RAISE EXCEPTION 'You do not have access to this project''s BOQ links.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.boq_link_sets WHERE project_id=p_project AND NOT is_archived;
 IF s.id IS NULL OR s.status<>'locked' THEN RETURN jsonb_build_object('status','no_locked_links'); END IF;
 st := public._boq2_state(p_project);
 WITH lk AS (
  SELECT (l->>'id')::uuid boq_item_id,(l->>'sno')::int sno,l->>'description' description,l->>'unit' uom,
   (k->>'id')::uuid link_id,k->>'unit_kind' unit_kind,k->>'unit_label' unit_label,(k->>'task_id')::uuid task_id,k->>'code' code,k->>'task_name' task_name,
   (k->>'share_pct')::numeric share_pct,(k->>'budget')::numeric budget,k->>'problem' problem,
   coalesce((SELECT (a->>'quantity')::numeric FROM jsonb_array_elements(l->'allocations') a WHERE a->>'unit_kind'=k->>'unit_kind' AND a->>'unit_label'=k->>'unit_label' LIMIT 1),0) alloc_qty,
   lower(btrim(coalesce(i.work_location,''))) loc
  FROM jsonb_array_elements(st->'lines') l CROSS JOIN LATERAL jsonb_array_elements(l->'links') k
  JOIN public.project_boq_items i ON i.id=(l->>'id')::uuid),
 units AS (SELECT DISTINCT unit_kind,unit_label FROM lk WHERE loc='factory'),
 unit_link AS (
  SELECT u.unit_kind,u.unit_label,su.module_id linked_module_id,linked.id linked_id,linked.is_archived linked_archived
  FROM units u
  LEFT JOIN public.project_schedule_units su ON su.project_id=p_project AND su.unit_kind=u.unit_kind AND su.unit_label=u.unit_label
  LEFT JOIN public.modules linked ON linked.id=su.module_id AND linked.project_id=p_project),
 umap AS (SELECT ul.unit_kind,ul.unit_label,ul.linked_module_id,ul.linked_id,ul.linked_archived,m.ids,
   (SELECT coalesce(jsonb_agg(mo.name ORDER BY mo.name),'[]') FROM public.modules mo WHERE mo.project_id=p_project AND NOT mo.is_archived) all_names
  FROM unit_link ul LEFT JOIN LATERAL (SELECT array_agg(mo.id) ids FROM public.modules mo WHERE ul.linked_module_id IS NULL AND mo.project_id=p_project AND NOT mo.is_archived AND ul.unit_kind='module'
    AND (lower(btrim(coalesce(mo.name,'')))=lower(btrim(ul.unit_label)) OR lower(btrim(coalesce(mo.module_code,'')))=lower(btrim(ul.unit_label)))) m ON true),
 um AS (SELECT unit_kind,unit_label,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN linked_module_id
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN ids[1] END module_id,
   CASE WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND NOT linked_archived THEN 'link'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=1 THEN 'name' END mapped_by,
   CASE WHEN unit_kind<>'module' THEN 'Not a module unit'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NOT NULL AND linked_archived THEN 'Linked module is archived'
        WHEN linked_module_id IS NOT NULL AND linked_id IS NULL THEN 'Linked module is not available'
        WHEN linked_module_id IS NULL AND coalesce(cardinality(ids),0)=0 THEN 'No module matches this unit label'
        WHEN linked_module_id IS NULL AND cardinality(ids)>1 THEN 'More than one module matches this unit label' END unmapped_reason,
   all_names FROM umap),
 cons AS (SELECT q.boq_item_id,q.module_id,sum(coalesce(q.today_qty,0)) c,sum(coalesce(q.amount_inr,0)) amt
  FROM public.factory_report_quantities q JOIN public.factory_daily_reports r ON r.id=q.report_id
  JOIN public.modules mo ON mo.id=q.module_id AND mo.project_id=p_project
  WHERE NOT q.is_archived AND NOT r.is_archived AND r.status='submitted' GROUP BY 1,2),
 calc AS (SELECT lk.*,um.module_id,um.unmapped_reason,coalesce(c.c,0) consumed,coalesce(c.amt,0) amt,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL OR lk.alloc_qty=0 THEN 0 ELSE round(lk.budget*coalesce(c.c,0)/lk.alloc_qty,2) END earned,
   CASE WHEN lk.problem IS NOT NULL OR um.module_id IS NULL THEN 0 ELSE round(coalesce(c.amt,0)*lk.share_pct/100,2) END actual,
   greatest(coalesce(c.c,0)-lk.alloc_qty,0) overrun_qty
  FROM lk JOIN um USING (unit_kind,unit_label)
  LEFT JOIN cons c ON c.boq_item_id=lk.boq_item_id AND c.module_id=um.module_id WHERE lk.loc='factory'),
 tasks AS (SELECT unit_kind,unit_label,task_id,max(code) code,max(task_name) task_name,sum(budget) budget,sum(earned) earned,sum(actual) actual,
   bool_or(overrun_qty>0) overrun,bool_or(problem IS NOT NULL) broken,count(*) links FROM calc GROUP BY 1,2,3),
 site AS (SELECT boq_item_id,min(sno) sno,max(description) description,max(uom) uom,sum(budget) budget FROM lk WHERE loc<>'factory' GROUP BY 1)
 SELECT jsonb_build_object(
  'status','ok','link_set_version',s.version,
  'links',coalesce((SELECT jsonb_agg(jsonb_build_object('link_id',link_id,'boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'unit_kind',unit_kind,'unit_label',unit_label,
     'task_id',task_id,'code',code,'task_name',task_name,'share_pct',share_pct,'budget',budget,'allocated_qty',alloc_qty,'consumed_qty',consumed,'earned',earned,'actual',actual,
     'variance',earned-actual,'overrun_qty',overrun_qty,'mapped',module_id IS NOT NULL,'problem',problem) ORDER BY unit_kind,unit_label,code,sno) FROM calc),'[]'),
  'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',unit_kind,'unit_label',unit_label,'task_id',task_id,'code',code,'task_name',task_name,'budget',budget,'earned',earned,
     'actual',actual,'variance',earned-actual,'overrun',overrun,'broken',broken,'links',links) ORDER BY unit_kind,unit_label,code) FROM tasks),'[]'),
  'units',coalesce((SELECT jsonb_agg(jsonb_build_object('unit_kind',u.unit_kind,'unit_label',u.unit_label,'mapped',u.module_id IS NOT NULL,'mapped_by',u.mapped_by,
     'module_name',(SELECT name FROM public.modules WHERE id=u.module_id),'unmapped_reason',u.unmapped_reason,
     'modules_found',CASE WHEN u.module_id IS NULL THEN u.all_names ELSE '[]'::jsonb END,
     'budget',t.budget,'earned',t.earned,'actual',t.actual,'variance',t.earned-t.actual,'overrun',t.overrun) ORDER BY u.unit_kind,u.unit_label)
   FROM um u JOIN (SELECT unit_kind,unit_label,sum(budget) budget,sum(earned) earned,sum(actual) actual,bool_or(overrun) overrun FROM tasks GROUP BY 1,2) t USING (unit_kind,unit_label)),'[]'),
  'site_lines',coalesce((SELECT jsonb_agg(jsonb_build_object('boq_item_id',boq_item_id,'sno',sno,'description',description,'uom',uom,'budget',budget,
     'note','Waiting for unit on site reports') ORDER BY sno) FROM site),'[]'),
  'totals',jsonb_build_object('factory_budget',coalesce((SELECT sum(budget) FROM calc),0),'earned',coalesce((SELECT sum(earned) FROM calc),0),
     'actual',coalesce((SELECT sum(actual) FROM calc),0),'variance',coalesce((SELECT sum(earned-actual) FROM calc),0),
     'site_budget',coalesce((SELECT sum(budget) FROM site),0),'unmapped_units',(SELECT count(*) FROM um WHERE module_id IS NULL),
     'overrun_links',(SELECT count(*) FROM calc WHERE overrun_qty>0),'broken_links',(SELECT count(*) FROM calc WHERE problem IS NOT NULL)))
 INTO result;
 RETURN result;
END $function$;

DO $$
DECLARE
 writer uuid:='fb73ad26-d2de-432c-9f90-c0c3bc99c3ff'; -- costing_engineer: project member, cannot write site reports
 md uuid:='99b67080-a6eb-4feb-bd8e-92a287b430aa';     -- managing_director: site report writer
 tp1 uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f';
 p uuid:=gen_random_uuid(); t1 uuid:=gen_random_uuid(); t2 uuid:=gen_random_uuid(); t3 uuid:=gen_random_uuid();
 site_line uuid; fac_line uuid; st jsonb; r jsonb; g jsonb; rep uuid; qid uuid; fq uuid:=gen_random_uuid(); oldr jsonb; newr jsonb;
 checks int:=0; rb_before text; rb_after text; cr_before text; cr_after text; f_old text; f_new text; msg text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rb_before:=md5(public.get_running_bill(tp1,current_date)::text);
 cr_before:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 RESET ROLE;

 INSERT INTO public.projects(id,name,site_lat,site_lng,created_by,updated_by) VALUES (p,'BOQ3B rollback fixture',12.97,77.59,writer,writer);
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level)
 SELECT p,id,'boq3b_rollback','write' FROM public.profiles WHERE auth_user_id IN (writer,md);
 INSERT INTO public.project_schedule_units(project_id,unit_kind,unit_label,day1) VALUES (p,'module','M1',current_date),(p,'module','M2',current_date);
 INSERT INTO public.modules(project_id,name,is_archived,created_by) VALUES (p,'M1',false,writer);
 INSERT INTO public.project_tasks(id,project_id,task_id_in_schedule,task_name,task_type,unit_kind,unit_label,is_qc_gate,is_payment_milestone,is_removed,work_category) VALUES
  (t1,p,'B3-M1','Plaster','task','module','M1',false,false,false,'construction'),
  (t2,p,'B3-M2','Plaster','task','module','M2',false,false,false,'construction'),
  (t3,p,'B3-F1','Frame','task','module','M1',false,false,false,'process');
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.boq1_mutate(p,'create','{"control_total":"2000","source_note":"BOQ3B rollback"}');
 st:=public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(
  '{"sno":"1","item_description":"BOQ3B site plaster","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Civil","scope":"Both","work_location":"site"}'::jsonb,
  '{"sno":"2","item_description":"BOQ3B factory frame","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Civil","scope":"Both","work_location":"factory"}'::jsonb)),0);
 SELECT id INTO site_line FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=1;
 SELECT id INTO fac_line FROM public.project_boq_items WHERE boq_id=(st->'header'->>'id')::uuid AND sno=2;
 PERFORM public.boq1_mutate(p,'finalise','{}',(st->'header'->>'entry_version')::int);
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',site_line,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":4},{"unit_kind":"module","unit_label":"M2","quantity":6}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',site_line,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t1,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',site_line,'unit_kind','module','unit_label','M2','shares',jsonb_build_array(jsonb_build_object('task_id',t2,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'save_split',jsonb_build_object('boq_item_id',fac_line,'allocations','[{"unit_kind":"module","unit_label":"M1","quantity":10}]'::jsonb));
 PERFORM public.boq2_mutate(p,'save_shares',jsonb_build_object('boq_item_id',fac_line,'unit_kind','module','unit_label','M1','shares',jsonb_build_array(jsonb_build_object('task_id',t3,'share_pct',100))));
 PERFORM public.boq2_mutate(p,'lock','{}');
 RESET ROLE;

 -- Draft site report with 3 sqm of the site line, saved through the unchanged save_site_report_draft.
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 rep:=public.save_site_report_draft(p,public.site_report_today(),jsonb_build_object('notes','BOQ3B fixture','quantities',jsonb_build_array(jsonb_build_object('boq_item_id',site_line,'today_qty',3))));
 RESET ROLE;
 SELECT id INTO qid FROM public.site_report_quantities WHERE report_id=rep AND boq_item_id=site_line;
 INSERT INTO public.site_report_quantities(id,report_id,project_id,boq_item_id,today_qty,created_by,updated_by) VALUES (fq,rep,p,fac_line,1,md,md);

 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 -- 1-2 set and clear
 PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":2}]');
 IF (SELECT count(*) FROM public.site_quantity_units WHERE quantity_id=qid AND qty=2)<>1 THEN RAISE EXCEPTION 'set failed'; END IF;
 checks:=checks+1;
 PERFORM public.site_set_quantity_units(qid,'[]');
 IF EXISTS (SELECT 1 FROM public.site_quantity_units WHERE quantity_id=qid) THEN RAISE EXCEPTION 'clear failed'; END IF;
 checks:=checks+1;
 -- 3 unit not allocated
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M9","qty":1}]'); RAISE EXCEPTION 'unallocated accepted';
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg<>'Unit M9 is not allocated to this BOQ line' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; checks:=checks+1; END;
 -- 4 sum above quantity
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":2},{"unit_kind":"module","unit_label":"M2","qty":2}]'); RAISE EXCEPTION 'over-sum accepted';
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE 'Unit split (4) is more than%' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; checks:=checks+1; END;
 -- 4b zero / negative / NaN refused
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":0}]'); RAISE EXCEPTION 'zero accepted'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE '%more than 0' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; END;
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":-1}]'); RAISE EXCEPTION 'negative accepted'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE '%more than 0' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; END;
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":"NaN"}]'); RAISE EXCEPTION 'NaN accepted'; EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg NOT LIKE '%more than 0' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; END;
 checks:=checks+1;
 -- 5 factory line refused
 BEGIN PERFORM public.site_set_quantity_units(fq,'[{"unit_kind":"module","unit_label":"M1","qty":1}]'); RAISE EXCEPTION 'factory accepted';
 EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT; IF msg<>'Factory lines are reported in the Daily Factory Report' THEN RAISE EXCEPTION 'unexpected: %',msg; END IF; checks:=checks+1; END;
 RESET ROLE;
 -- 6 non-writer refused
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 IF public.can_write_site_report(auth.uid(),p) THEN RAISE EXCEPTION 'fixture writer unexpectedly writes site reports'; END IF;
 BEGIN PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":1}]'); RAISE EXCEPTION 'non-writer accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 -- 7 direct client insert refused (also for a writer below)
 BEGIN INSERT INTO public.site_quantity_units(quantity_id,project_id,unit_kind,unit_label,qty) VALUES (qid,p,'module','M1',1); RAISE EXCEPTION 'direct insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 BEGIN INSERT INTO public.site_quantity_units(quantity_id,project_id,unit_kind,unit_label,qty) VALUES (qid,p,'module','M1',1); RAISE EXCEPTION 'direct insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
 -- 8 draft report counts nothing
 PERFORM public.site_set_quantity_units(qid,'[{"unit_kind":"module","unit_label":"M1","qty":2}]');
 r:=public.boq3_task_report(p);
 IF (r->'totals'->>'site_earned')::numeric<>0 OR (r->'totals'->>'site_actual')::numeric<>0
    OR (SELECT (x->>'earned')::numeric FROM jsonb_array_elements(r->'site_units') x WHERE x->>'unit_label'='M1')<>0 THEN RAISE EXCEPTION 'draft counted %',r; END IF;
 checks:=checks+1;
 RESET ROLE;
 -- Submit the fixture report (status only; submit_site_report itself is not under test) with a frozen amount of 300.
 UPDATE public.daily_measurements SET report_status='submitted', submitted_by=md, submitted_at=now() WHERE id=rep;
 UPDATE public.site_report_quantities SET amount_inr=300 WHERE id=qid;
 PERFORM set_config('request.jwt.claim.sub',writer::text,true); SET LOCAL ROLE authenticated;
 r:=public.boq3_task_report(p);
 RESET ROLE;
 -- 9 submitted report counts; 10 earned = budget(400) x C(2) / A(4) = 200.00 exactly; actual = 300 x 2/3 = 200.00
 IF (SELECT count(*) FROM jsonb_array_elements(r->'site_links') x WHERE x->>'unit_label'='M1' AND (x->>'consumed_qty')::numeric=2
      AND (x->>'allocated_qty')::numeric=4 AND (x->>'budget')::numeric=400 AND (x->>'earned')::numeric=200.00 AND (x->>'actual')::numeric=200.00)<>1 THEN RAISE EXCEPTION 'site link maths %',r->'site_links'; END IF;
 checks:=checks+1;
 IF (SELECT (x->>'earned')::numeric FROM jsonb_array_elements(r->'site_units') x WHERE x->>'unit_label'='M1')<>200
    OR (SELECT (x->>'earned')::numeric FROM jsonb_array_elements(r->'site_units') x WHERE x->>'unit_label'='M2')<>0
    OR (r->'totals'->>'site_earned')::numeric<>200 OR (r->'totals'->>'site_actual')::numeric<>200 THEN RAISE EXCEPTION 'site units/totals %',r; END IF;
 checks:=checks+1;
 -- 11 unassigned remainder (3 - 2 = 1)
 IF (SELECT (x->>'site_unassigned_qty')::numeric FROM jsonb_array_elements(r->'site_lines') x WHERE (x->>'boq_item_id')::uuid=site_line)<>1
    OR (r->'totals'->>'site_unassigned_lines')::int<>1 THEN RAISE EXCEPTION 'unassigned %',r->'site_lines'; END IF;
 checks:=checks+1;
 -- 12 factory section identical to the pre-0087 definition on this fixture
 PERFORM set_config('request.jwt.claim.sub',writer::text,true);
 oldr:=pg_temp.boq3_old(p); newr:=public.boq3_task_report(p);
 f_old:=md5(jsonb_build_object('links',oldr->'links','tasks',oldr->'tasks','units',oldr->'units','totals',oldr->'totals')::text);
 f_new:=md5(jsonb_build_object('links',newr->'links','tasks',newr->'tasks','units',newr->'units','totals',(newr->'totals')-'site_earned'-'site_actual'-'site_unassigned_lines')::text);
 IF f_old<>f_new OR jsonb_array_length(newr->'units')<>1 OR (newr->'totals'->>'factory_budget')::numeric<>1000 THEN RAISE EXCEPTION 'factory output changed % %',f_old,f_new; END IF;
 checks:=checks+1;
 -- 13 stale split: quantity later reduced below the split
 UPDATE public.site_report_quantities SET today_qty=1, amount_inr=100 WHERE id=qid;
 SET LOCAL ROLE authenticated;
 r:=public.boq3_task_report(p);
 IF (SELECT x->>'problem' FROM jsonb_array_elements(r->'site_lines') x WHERE (x->>'boq_item_id')::uuid=site_line)<>'Unit split exceeds reported quantity'
    OR (r->'totals'->>'site_earned')::numeric<>0 OR (r->'totals'->>'site_actual')::numeric<>0 THEN RAISE EXCEPTION 'stale counted %',r; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 g:=public.site_get_quantity_units(rep);
 IF (SELECT count(*) FROM jsonb_array_elements(g->'quantities') x WHERE (x->>'quantity_id')::uuid=qid AND (x->>'stale')::boolean
      AND (x->>'split_total')::numeric=2 AND (x->>'unassigned')::numeric=-1 AND jsonb_array_length(x->'allocated')=2)<>1 THEN RAISE EXCEPTION 'reader stale %',g; END IF;
 checks:=checks+1;
 -- 14 Running Bill and Cost report unchanged
 rb_after:=md5(public.get_running_bill(tp1,current_date)::text);
 cr_after:=md5(public.get_cost_report(tp1,current_date-30,current_date)::text);
 IF rb_before<>rb_after OR cr_before<>cr_after THEN RAISE EXCEPTION 'reader output changed'; END IF;
 checks:=checks+1;
 RAISE EXCEPTION 'BOQ3B_ROLLBACK_OK: % checks; running bill %, cost report %, factory fixture %',checks,rb_after,cr_after,f_new;
END $$;
