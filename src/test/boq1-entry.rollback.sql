-- Existing real principals; only new fixture headers/lines/team access are inserted.
-- Every write is undone by the final evidence exception. No existing BOQ line is edited.
DO $$
DECLARE
 p uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';
 writer uuid := '565152cc-961b-4974-80b2-93ebd156ec46';
 nonwriter uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';
 b uuid := gen_random_uuid(); other uuid; ob uuid; line uuid; rows jsonb; state jsonb; preview jsonb; v int; n int; key text; before_count int; tests int := 0; result text := '';
BEGIN
 SELECT count(*) INTO before_count FROM public.project_boq_items;
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level)
 SELECT p,id,'boq1_rollback','write' FROM public.profiles WHERE auth_user_id IN (writer,nonwriter) ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',writer::text,true);
 PERFORM set_config('hstack.boq_entry',b::text,true);
 PERFORM set_config('hstack.boq_action','test_header_fixture',true);
 INSERT INTO public.project_boq(id,project_id,version_number,entry_mode,control_total,source_note)
 VALUES(b,p,999999,'fresh',0,'BOQ-1 rollback fixture; no existing BOQ touched');
 FOR n IN 1..3 LOOP
 INSERT INTO public.projects(name,site_lat,site_lng,created_by,updated_by) VALUES('BOQ1 rollback reference '||n,12.97,77.59,writer,writer);
 END LOOP;
 -- Anonymous median fixture: three distinct OTHER projects, one observation per project.
 FOR other IN SELECT id FROM public.projects WHERE name LIKE 'BOQ1 rollback reference %' AND id<>p AND NOT is_archived AND NOT EXISTS(SELECT 1 FROM public.project_boq h WHERE h.project_id=projects.id AND h.entry_mode='fresh') ORDER BY id LIMIT 3 LOOP
   ob:=gen_random_uuid();
   INSERT INTO public.project_boq(id,project_id,version_number) VALUES(ob,other,999999);
   INSERT INTO public.project_boq_items(boq_id,sno,item_description,unit,boq_qty,boq_rate,total_amount) VALUES(ob,1,'BOQ1 ROLLBACK concrete','sqm',1,100,100);
 END LOOP;
 IF (SELECT count(*) FROM public.project_boq_items WHERE item_description='BOQ1 ROLLBACK concrete')<>3 THEN RAISE EXCEPTION 'Expected three median fixture projects'; END IF;
 SELECT jsonb_agg(jsonb_build_object('sno',i::text,'item_description',CASE WHEN i IN(1,2) THEN 'BOQ1 ROLLBACK panel' WHEN i=3 THEN 'BOQ1 ROLLBACK concrete' ELSE 'BOQ1 ROLLBACK line '||i END,'unit','sqm','boq_qty','1','boq_rate',CASE WHEN i=3 THEN '130' ELSE '100' END,'category','Structure','scope','Factory','work_location','factory') ORDER BY i) INTO rows FROM generate_series(1,12) i;
 SET LOCAL ROLE authenticated;
 state:=public.boq1_mutate(p,'save','{"control_total":"1231.00","source_note":"Signed contract rollback / 27/11/2026"}',0);
 preview:=public.boq1_mutate(p,'preview',jsonb_build_object('rows',rows),1);
 IF jsonb_array_length(preview->'rows')<>12 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(preview->'rows') r CROSS JOIN LATERAL jsonb_array_elements(r->'warnings') w WHERE w->>'kind'='duplicate') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(preview->'rows') r CROSS JOIN LATERAL jsonb_array_elements(r->'warnings') w WHERE w->>'kind'='outlier' AND (w->>'project_count')::int=3 AND (w->>'median_rate')::numeric=100) THEN RAISE EXCEPTION 'Paste warnings missing: %',preview; END IF;
 IF preview::text ILIKE '%project_id%' OR preview::text ILIKE '%project_name%' THEN RAISE EXCEPTION 'Other project identity exposed'; END IF;
 tests:=tests+1;
 state:=public.boq1_mutate(p,'save',jsonb_build_object('rows',rows),1);
 IF (state->>'line_count')::int<>12 OR (state->>'sum')::numeric<>1230 OR (state->>'difference')::numeric<>1 THEN RAISE EXCEPTION 'Server totals wrong: %',state; END IF;
 BEGIN PERFORM public.boq1_mutate(p,'finalise','{}',2); RAISE EXCEPTION 'Unbalanced finalisation accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 state:=public.boq1_mutate(p,'save','{"control_total":"1230.00"}',2);
 state:=public.boq1_mutate(p,'finalise','{}',3);
 IF state->'header'->>'status'<>'final' OR state->'header'->>'final_by'<>writer::text OR state->'header'->>'final_at' IS NULL THEN RAISE EXCEPTION 'Final metadata wrong'; END IF;
 SELECT id INTO line FROM public.project_boq_items WHERE boq_id=b AND sno=1;
 BEGIN UPDATE public.project_boq_items SET boq_qty=9 WHERE id=line; RAISE EXCEPTION 'Direct final edit accepted'; EXCEPTION WHEN insufficient_privilege THEN tests:=tests+1; END;
 BEGIN UPDATE public.project_boq SET control_total=999 WHERE id=b; RAISE EXCEPTION 'Direct final header edit accepted'; EXCEPTION WHEN insufficient_privilege THEN tests:=tests+1; END;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"1230.00"}',4); RAISE EXCEPTION 'Reasonless revision accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"1231.00","reason":"unbalanced test"}',4); RAISE EXCEPTION 'Unbalanced revision accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 state:=public.boq1_mutate(p,'revise',jsonb_build_object('control_total','1330.00','reason','Signed contract correction','rows',jsonb_build_array((rows->0)||jsonb_build_object('id',line,'boq_qty','2'))),4);
 IF (state->>'sum')::numeric<>1330 OR (state->>'difference')::numeric<>0 OR state->'header'->>'status'<>'final' THEN RAISE EXCEPTION 'Balanced revision not applied'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.boq_entry_audit WHERE boq_id=b AND line_id=line AND action='revise' AND reason='Signed contract correction' AND created_by=writer AND (old_value->>'boq_qty')::numeric=1 AND (new_value->>'boq_qty')::numeric=2) THEN RAISE EXCEPTION 'Revision audit absent'; END IF;
 tests:=tests+1;
 SELECT w->>'key' INTO key FROM jsonb_array_elements(state->'lines') i CROSS JOIN LATERAL jsonb_array_elements(i->'warnings') w WHERE i->>'id'=line::text AND w->>'kind'='duplicate';
 state:=public.boq1_mutate(p,'acknowledge',jsonb_build_object('line_id',line,'warning_key',key,'note','Reviewed against signed BOQ'),5);
 IF NOT EXISTS(SELECT 1 FROM public.boq_warning_acknowledgements WHERE line_id=line AND warning_key=key AND created_by=writer) THEN RAISE EXCEPTION 'Acknowledgement not logged'; END IF;
 tests:=tests+1;
 -- Bad numbers are row errors and do not lose the remaining reviewed rows; revisions are atomic.
 preview:=public.boq1_mutate(p,'preview',jsonb_build_object('rows',jsonb_build_array((rows->0)||jsonb_build_object('id',line,'boq_qty','NaN'),(rows->0)||jsonb_build_object('id',line,'boq_qty','-1'))),6);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(preview->'rows') r WHERE jsonb_array_length(r->'errors')=0) THEN RAISE EXCEPTION 'NaN/negative accepted'; END IF; tests:=tests+1;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"NaN","reason":"bad number"}',6); RAISE EXCEPTION 'NaN total accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"-1","reason":"bad number"}',6); RAISE EXCEPTION 'Negative total accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"1330.001","reason":"fractional paise"}',6); RAISE EXCEPTION 'Fractional paise accepted'; EXCEPTION WHEN invalid_parameter_value THEN tests:=tests+1; END;
 BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"1330","reason":"stale"}',5); RAISE EXCEPTION 'Stale version accepted'; EXCEPTION WHEN serialization_failure THEN tests:=tests+1; END;
 BEGIN PERFORM public.commit_project_setup_excel_upload_v2(p,'[]',rows,'[]',NULL); RAISE EXCEPTION 'Workbook BOQ accepted'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM NOT LIKE 'BOQ sheet uploading is off%' THEN RAISE; END IF; tests:=tests+1; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',nonwriter::text,true);
 SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.boq1_mutate(p,'save','{"control_total":"1"}',6); RAISE EXCEPTION 'Non-writer accepted'; EXCEPTION WHEN insufficient_privilege THEN tests:=tests+1; END;
 RESET ROLE;
 -- Writer access did not change any pre-existing line: new fixtures only.
 IF (SELECT count(*) FROM public.project_boq_items)<>before_count+15 THEN RAISE EXCEPTION 'Unexpected line count'; END IF;
 RAISE EXCEPTION 'BOQ1_ROLLBACK_OK: % assertions; 12-line paste/duplicate/outlier, anonymous lookup, mismatch/final lock, balanced audited revision, acknowledgement, nonwriter, NaN/negative/paise/stale, workbook refusal; all undone.',tests;
END $$;
