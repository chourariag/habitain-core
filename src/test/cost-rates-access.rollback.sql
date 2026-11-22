BEGIN;
CREATE TEMP TABLE access_evidence(roles text,allowed boolean,rpc_checks integer);
DO $test$ DECLARE actor uuid:='99b67080-a6eb-4feb-bd8e-92a287b430aa'; pid uuid:='e4f51cd6-fb25-475e-980a-5e46070d678f'; cid uuid:='152291ba-f894-401f-85fe-f68ba29af7d0'; bid uuid; item uuid; srid uuid; payload jsonb; calls text[]; call text; r record; allowed boolean; col text; table_name text;
BEGIN
SELECT id INTO bid FROM public.project_boq WHERE project_id=pid ORDER BY version_number DESC,uploaded_at DESC,id DESC LIMIT 1;
SELECT id INTO item FROM public.project_boq_items WHERE boq_id=bid ORDER BY sno LIMIT 1;
SELECT jsonb_build_array(jsonb_build_object('sno',sno,'description',item_description,'unit',unit,'work_location',work_location,'material_rate','125','contractor','','rate_type','','rate','','lump_sum','','package_qty','','includes_material','false')) INTO payload FROM public.project_boq_items WHERE id=item;
PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated; srid:=public.upsert_subcontract_rate(pid,item,cid,'per_unit',10); RESET ROLE;
calls:=ARRAY[format('SELECT public.get_cost_rates(%L)',pid),format('SELECT public.set_material_rate(%L,%L,125)',pid,item),format('SELECT public.upsert_subcontract_rate(%L,%L,%L,''per_unit'',10,NULL,NULL,false,true)',pid,item,cid),format('SELECT public.deactivate_subcontract_rate(%L,%L)',pid,srid),format('SELECT public.validate_cost_rates_upload(%L,%L::jsonb)',pid,payload),format('SELECT public.apply_cost_rates_upload(%L,%L,%L::jsonb)',pid,bid,payload)];
FOR r IN SELECT ur.user_id,array_agg(ur.role::text ORDER BY ur.role::text) roles FROM public.user_roles ur JOIN public.profiles p ON p.auth_user_id=ur.user_id WHERE p.is_active GROUP BY ur.user_id LOOP
PERFORM set_config('request.jwt.claim.sub',r.user_id::text,true); SET LOCAL ROLE authenticated; allowed:=public.can_view_running_bill(r.user_id);
IF allowed IS DISTINCT FROM (r.roles && ARRAY['managing_director','finance_director','sales_director','architecture_director','super_admin','finance_manager','head_of_projects','planning_head','quantity_surveyor','costing_engineer']) THEN RAISE EXCEPTION 'Assigned-role mismatch: %',r.roles; END IF;
FOREACH call IN ARRAY calls LOOP IF allowed THEN BEGIN EXECUTE call; RAISE EXCEPTION 'rollback' USING ERRCODE='ZX001'; EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END; ELSE BEGIN EXECUTE call; RAISE EXCEPTION 'Unexpected Rates access: %',r.roles; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END IF; END LOOP;
RESET ROLE; INSERT INTO access_evidence VALUES(array_to_string(r.roles,'+'),allowed,6);
END LOOP;
SET LOCAL ROLE anon; FOREACH call IN ARRAY calls LOOP BEGIN EXECUTE call; RAISE EXCEPTION 'Anonymous permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END LOOP; RESET ROLE; INSERT INTO access_evidence VALUES('anonymous',false,6);
PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
FOREACH call IN ARRAY ARRAY[format('INSERT INTO public.project_cost_rates(project_id,boq_item_id,material_rate_inr) VALUES(%L,%L,1)',pid,item),'UPDATE public.project_cost_rates SET material_rate_inr=1 WHERE false','DELETE FROM public.project_cost_rates WHERE false',format('INSERT INTO public.project_cost_rates_log(project_id,field) VALUES(%L,''test'')',pid),'UPDATE public.project_cost_rates_log SET field=''test'' WHERE false','DELETE FROM public.project_cost_rates_log WHERE false'] LOOP BEGIN EXECUTE call; RAISE EXCEPTION 'Direct write permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END LOOP;
FOREACH table_name IN ARRAY ARRAY['site_report_quantities','factory_report_quantities'] LOOP FOREACH col IN ARRAY ARRAY['material_rate_used','material_amount_inr','material_rate_missing'] LOOP BEGIN EXECUTE format('SELECT %I FROM public.%I LIMIT 1',col,table_name); RAISE EXCEPTION 'Commercial SELECT permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END LOOP; END LOOP;
BEGIN PERFORM rate_inr FROM public.subcontract_rates LIMIT 1; RAISE EXCEPTION 'Direct subcontract rate permitted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
RESET ROLE;
END $test$;
SELECT jsonb_build_object('matrix',(SELECT jsonb_agg(to_jsonb(e)) FROM access_evidence e),'principals',(SELECT count(*) FROM access_evidence WHERE roles<>'anonymous'),'allowed',(SELECT count(*) FROM access_evidence WHERE allowed),'denied',(SELECT count(*) FROM access_evidence WHERE NOT allowed AND roles<>'anonymous'),'rpc_checks',(SELECT sum(rpc_checks) FROM access_evidence),'direct_denials',13) evidence;
ROLLBACK;
