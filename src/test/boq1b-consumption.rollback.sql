-- Real principals, authenticated RLS, NEW fixture projects/teams/BOQs/reports only.
-- Intentional evidence exception undoes every fixture, audit entry and status change.
DO $$
DECLARE
 actor uuid; p uuid; b uuid; m uuid; sr uuid; fr uuid; consumed uuid; unused uuid;
 state jsonb; row1 jsonb; row2 jsonb; patch jsonb; message text; messages text:=''; checks int:=0; d date;
BEGIN
 FOREACH actor IN ARRAY ARRAY['fb73ad26-d2de-432c-9f90-c0c3bc99c3ff'::uuid,'e7554a18-8a12-4f45-b81d-468426c64f8b'::uuid] LOOP
  p:=gen_random_uuid();
  INSERT INTO public.projects(id,name,site_lat,site_lng,created_by,updated_by) VALUES(p,'BOQ1B rollback fixture',12.97,77.59,actor,actor);
  INSERT INTO public.project_team_members(project_id,profile_id,role,access_level) SELECT p,id,'boq1b_rollback','write' FROM public.profiles WHERE auth_user_id=actor;
  PERFORM set_config('request.jwt.claim.sub',actor::text,true);
  SET LOCAL ROLE authenticated;
  state:=public.boq1_mutate(p,'create','{"control_total":"2000","source_note":"Signed rollback BOQ"}');
  b:=(state->'header'->>'id')::uuid;
  row1:='{"sno":"1","item_description":"BOQ1B consumed concrete","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Civil","scope":"Both","work_location":"site"}';
  row2:='{"sno":"2","item_description":"BOQ1B unused panel","unit":"sqm","boq_qty":"10","boq_rate":"100","category":"Cladding","scope":"Factory","work_location":"factory"}';
  state:=public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(row1,row2)),0);
  IF (state->>'line_count')::int<>2 OR (state->>'sum')::numeric<>2000 THEN RAISE EXCEPTION 'New writer draft/save failed'; END IF;
  checks:=checks+1;
  SELECT id INTO consumed FROM public.project_boq_items WHERE boq_id=b AND sno=1;
  SELECT id INTO unused FROM public.project_boq_items WHERE boq_id=b AND sno=2;
  row1:=row1||jsonb_build_object('id',consumed); row2:=row2||jsonb_build_object('id',unused);
  RESET ROLE;
  -- Costing writer and Head Operations both create/save; exercise consumption matrix once on Head Operations.
  IF actor='e7554a18-8a12-4f45-b81d-468426c64f8b'::uuid THEN
   m:=gen_random_uuid(); sr:=gen_random_uuid(); fr:=gen_random_uuid();
   INSERT INTO public.modules(id,project_id,name,created_by,updated_by) VALUES(m,p,'BOQ1B rollback module',actor,actor);
   SELECT day::date INTO d FROM generate_series(current_date-10,current_date,interval '1 day') day WHERE NOT EXISTS(SELECT 1 FROM public.factory_daily_reports WHERE report_date=day::date) ORDER BY day LIMIT 1;
   IF d IS NULL THEN RAISE EXCEPTION 'No free factory report day for fixture'; END IF;
   INSERT INTO public.daily_measurements(id,project_id,measurement_date,location,trade,report_status,submitted_at,submitted_by,created_by,updated_by) VALUES(sr,p,d,'site','daily_site_report','submitted',now(),actor,actor,actor);
   INSERT INTO public.site_report_quantities(report_id,project_id,boq_item_id,today_qty,unit,rate_used,amount_inr,material_rate_used,material_amount_inr,material_rate_missing,created_by,updated_by) VALUES(sr,p,consumed,2,'sqm',NULL,NULL,50,100,false,actor,actor);
   INSERT INTO public.factory_daily_reports(id,report_date,status,submitted_at,submitted_by,created_by,updated_by) VALUES(fr,d,'submitted',now(),actor,actor,actor);
   INSERT INTO public.factory_report_blocks(report_id,module_id,stage,stage_status,progress_pct,created_by,updated_by) VALUES(fr,m,'Main Frame','ongoing',10,actor,actor);
   INSERT INTO public.factory_report_quantities(report_id,module_id,stage,boq_item_id,today_qty,unit,rate_used,amount_inr,material_rate_used,material_amount_inr,material_rate_missing,created_by,updated_by) VALUES(fr,m,'Main Frame',consumed,3,'sqm',NULL,NULL,50,150,false,actor,actor);
   SET LOCAL ROLE authenticated;
   -- Already consumed DRAFT removal/reduction obey the same guard.
   FOREACH patch IN ARRAY ARRAY[row1||'{"remove":true}'::jsonb,row1||'{"boq_qty":"4"}'::jsonb] LOOP
    BEGIN PERFORM public.boq1_mutate(p,'save',jsonb_build_object('rows',jsonb_build_array(patch)),1); RAISE EXCEPTION 'Draft consumed change accepted';
    EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
   END LOOP;
   -- Exact balance and final lock regression.
   BEGIN PERFORM public.boq1_mutate(p,'save','{"control_total":"2001"}',1); PERFORM public.boq1_mutate(p,'finalise','{}',2); RAISE EXCEPTION 'Mismatch finalisation accepted';
   EXCEPTION WHEN invalid_parameter_value THEN checks:=checks+1; END;
   state:=public.boq1_mutate(p,'finalise','{}',1);
   -- Existing direct table policy RLS-filters Head Operations; check the final trigger as MD.
   PERFORM set_config('request.jwt.claim.sub','99b67080-a6eb-4feb-bd8e-92a287b430aa',true);
   BEGIN UPDATE public.project_boq_items SET boq_qty=99 WHERE id=consumed; RAISE EXCEPTION 'Direct final edit accepted'; EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
   PERFORM set_config('request.jwt.claim.sub',actor::text,true);
   BEGIN PERFORM public.boq1_mutate(p,'revise','{"control_total":"2000"}',2); RAISE EXCEPTION 'Reasonless revision accepted'; EXCEPTION WHEN invalid_parameter_value THEN checks:=checks+1; END;
   FOREACH patch IN ARRAY ARRAY[row1||'{"remove":true}'::jsonb,row1||'{"boq_qty":"4"}'::jsonb,row1||'{"unit":"kg"}'::jsonb,row1||'{"boq_rate":"110"}'::jsonb] LOOP
    BEGIN PERFORM public.boq1_mutate(p,'revise',jsonb_build_object('reason','BOQ1B guarded correction','rows',jsonb_build_array(patch),'control_total','2000'),2); RAISE EXCEPTION 'Consumed revision accepted';
    EXCEPTION WHEN insufficient_privilege THEN
     GET STACKED DIAGNOSTICS message=MESSAGE_TEXT;
     IF message NOT LIKE 'Item 1 — BOQ1B consumed concrete%' OR message NOT LIKE '%5 sqm consumed%' OR message NOT LIKE '%factory reports 3%' OR message NOT LIKE '%site reports 2%' OR message NOT LIKE '%Running bill%' OR message NOT LIKE '%250.00%' THEN RAISE EXCEPTION 'Unreadable/wrong source message: %',message; END IF;
     messages:=messages||E'\n'||message; checks:=checks+1;
    END;
   END LOOP;
   state:=public.boq1_mutate(p,'revise',jsonb_build_object('reason','Raise contracted quantity','control_total','2200','rows',jsonb_build_array(row1||'{"boq_qty":"12"}'::jsonb)),2);
   IF (state->>'difference')::numeric<>0 OR NOT EXISTS(SELECT 1 FROM public.boq_entry_audit WHERE line_id=consumed AND action='revise' AND reason='Raise contracted quantity' AND created_by=actor AND (old_value->>'boq_qty')::numeric=10 AND (new_value->>'boq_qty')::numeric=12) THEN RAISE EXCEPTION 'Quantity raise/audit regression'; END IF;
   checks:=checks+1;
   state:=public.boq1_mutate(p,'revise',jsonb_build_object('reason','Unused rate correction','control_total','2300','rows',jsonb_build_array(row2||'{"boq_rate":"110"}'::jsonb)),3);
   IF (state->>'difference')::numeric<>0 THEN RAISE EXCEPTION 'Unused rate revision failed'; END IF; checks:=checks+1;
   state:=public.boq1_mutate(p,'revise',jsonb_build_object('reason','Remove unconsumed line','control_total','1200','rows',jsonb_build_array(row2||'{"remove":true}'::jsonb)),4);
   IF (state->>'line_count')::int<>1 OR (state->>'difference')::numeric<>0 OR NOT EXISTS(SELECT 1 FROM public.boq_entry_audit WHERE line_id=unused AND reason='Remove unconsumed line' AND (new_value->>'is_archived')::boolean) THEN RAISE EXCEPTION 'Unused removal/audit failed'; END IF; checks:=checks+1;
   RESET ROLE;
   PERFORM set_config('request.jwt.claim.sub','47f183de-2809-4c9d-91b0-ab323ff3d0ad',true);
   SET LOCAL ROLE authenticated;
   BEGIN PERFORM public.boq1_mutate(p,'save','{"control_total":"1"}',5); RAISE EXCEPTION 'Nonwriter accepted'; EXCEPTION WHEN insufficient_privilege THEN checks:=checks+1; END;
   RESET ROLE;
  END IF;
 END LOOP;
 RAISE EXCEPTION 'BOQ1B_ROLLBACK_OK: % checks; real Costing/Head Operations draft creation/save, draft and final removal/reduction/unit/rate refusal, quantity raise, unused rate/removal, exact balance/locks/audit, nonwriter. Messages:%',checks,messages;
END $$;
