BEGIN;
CREATE TEMP TABLE fac_matrix(principal uuid,roles text[],flow text,expected boolean,allowed boolean,result text);
DO $test$
DECLARE u record; flow text; allow_expected boolean; allowed boolean; msg text; d date:=public.ist_today(); wid uuid; bid uuid; mid uuid; rid uuid; payload jsonb; v jsonb;
BEGIN
 SELECT id INTO wid FROM public.labour_workers WHERE status='active' LIMIT 1;
 SELECT id INTO mid FROM public.modules WHERE project_id='e4f51cd6-fb25-475e-980a-5e46070d678f' LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub','99b67080-a6eb-4feb-bd8e-92a287b430aa',true);
 INSERT INTO public.project_boq_items(boq_id,sno,item_description,unit,boq_qty,boq_rate) SELECT boq_id,999991,'FAC rollback verification','sqm',100,1000 FROM public.project_boq_items LIMIT 1 RETURNING id INTO bid;
 INSERT INTO public.factory_attendance_photos(work_date,storage_path,captured_at,gps_lat,gps_lng,gps_accuracy_m) VALUES(d,'factory-attendance/'||d||'/'||gen_random_uuid()||'.jpg',now(),12,77,10);
 payload:=jsonb_build_object('notes','FAC verification','blocks',jsonb_build_array(jsonb_build_object('module_id',mid,'stage','Main Frame','progress_pct',10,'stage_status','ongoing')),'task_workers','[]'::jsonb,'quantities','[]'::jsonb,'expenses','[]'::jsonb,'photos','[]'::jsonb);
 rid:=public.save_factory_report_draft(d,payload);
 FOR u IN SELECT ur.user_id,array_agg(ur.role::text ORDER BY ur.role::text) roles FROM public.user_roles ur JOIN public.profiles p ON p.auth_user_id=ur.user_id WHERE p.is_active GROUP BY ur.user_id HAVING bool_or(ur.role::text=ANY(ARRAY['factory_floor_supervisor','senior_factory_supervisor','production_head','head_operations','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','site_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin'])) LOOP
 PERFORM set_config('request.jwt.claim.sub',u.user_id::text,true);
 FOREACH flow IN ARRAY ARRAY['attendance','hours','draft','submit','cost','boq','read_attendance','read_report'] LOOP
 allow_expected:=CASE WHEN flow IN('attendance','hours','draft','submit') THEN u.roles&&ARRAY['factory_floor_supervisor','senior_factory_supervisor','production_head','head_operations','managing_director','finance_director','sales_director','architecture_director','super_admin'] WHEN flow='cost' THEN u.roles&&ARRAY['production_head','head_operations','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin'] WHEN flow='boq' THEN u.roles&&ARRAY['finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin'] ELSE u.roles&&ARRAY['factory_floor_supervisor','senior_factory_supervisor','production_head','head_operations','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer','managing_director','finance_director','sales_director','architecture_director','super_admin'] END;
 allowed:=false;msg:='';
 BEGIN
 SET LOCAL ROLE authenticated;
 CASE flow
 WHEN 'attendance' THEN PERFORM public.save_factory_attendance(d,jsonb_build_array(jsonb_build_object('worker_id',wid,'present',true)),'FAC rollback test');
 WHEN 'hours' THEN PERFORM public.save_factory_attendance(d,jsonb_build_array(jsonb_build_object('worker_id',wid,'present',true)),'FAC rollback test');PERFORM public.confirm_factory_hours(d,jsonb_build_array(jsonb_build_object('worker_id',wid,'hours',8)));
 WHEN 'draft' THEN PERFORM public.save_factory_report_draft(d,payload);
 WHEN 'submit' THEN PERFORM public.submit_factory_report(rid);
 WHEN 'cost' THEN v:=public.get_factory_cost(d,d);
 WHEN 'boq' THEN PERFORM public.set_boq_work_location(bid,'factory');
 WHEN 'read_attendance' THEN v:=public.get_factory_attendance(d); IF v::text ~ '"(amount|effective_hourly_rate|rate_used|rate_id)"' THEN RAISE EXCEPTION 'private data exposed'; END IF;
 WHEN 'read_report' THEN v:=public.get_factory_report(d); IF (v->'quantities')::text ~ '"(amount_inr|rate_used|rate_id)"' OR (v->'present_workers')::text ~ '"(amount|effective_hourly_rate)"' THEN RAISE EXCEPTION 'private data exposed'; END IF;
 END CASE;
 RAISE EXCEPTION 'rollback successful flow' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN allowed:=true;msg:='allowed; writes rolled back'; WHEN insufficient_privilege THEN msg:='denied 42501'; WHEN OTHERS THEN msg:=SQLSTATE||':'||SQLERRM;
 END;
 RESET ROLE;
 INSERT INTO fac_matrix VALUES(u.user_id,u.roles,flow,allow_expected,allowed,CASE WHEN allow_expected=allowed AND (allowed OR msg='denied 42501') THEN 'PASS: ' ELSE 'FAIL: ' END||msg);
 END LOOP; END LOOP;
 IF EXISTS(SELECT 1 FROM fac_matrix WHERE result LIKE 'FAIL:%') THEN RAISE EXCEPTION 'Factory role matrix failed: %',(SELECT jsonb_agg(to_jsonb(f)) FROM fac_matrix f WHERE result LIKE 'FAIL:%'); END IF;
END $test$;
SELECT * FROM fac_matrix ORDER BY roles,principal,flow;
ROLLBACK;
