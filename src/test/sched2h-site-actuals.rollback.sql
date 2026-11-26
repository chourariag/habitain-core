-- Real existing principals; every fixture and write rolls back via final evidence exception.
DO $$
DECLARE
 pid uuid := 'e4f51cd6-fb25-475e-980a-5e46070d678f';
 engineer uuid := '47f183de-2809-4c9d-91b0-ab323ff3d0ad';
 noaccess uuid := '4df3e09d-d187-4baa-bb61-0b48e65ddd90';
 prod uuid := '822687f1-c516-4ddc-b54f-f574acd32859';
 tid uuid := 'f4c8818e-bb29-458a-b3e6-e4158f34cb2c';
 factory uuid := '48d440e6-6ded-44e6-b3f7-d3dd711d1c10';
 oldrow jsonb; afterrow jsonb; n int; cmd text; denied int := 0; result text := '';
BEGIN
 INSERT INTO public.project_team_members(project_id,profile_id,role,access_level)
 SELECT pid,id,'sched2h_test','write' FROM public.profiles WHERE auth_user_id IN (engineer,prod) ON CONFLICT DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',prod::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM public.schedule_revise_task(tid,'{"responsible_role":"site_installation_mgr"}'::jsonb,'SCHED-2h rollback fixture');
 RESET ROLE;
 SELECT to_jsonb(t) INTO oldrow FROM public.project_tasks t WHERE id=tid;
 IF (oldrow->>'baseline_version')::int <> 2 THEN RAISE EXCEPTION 'Expected existing baseline v2'; END IF;
 PERFORM set_config('request.jwt.claim.sub',engineer::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.project_tasks SET completion_percentage=40,status='In Progress',actual_start_date='2026-11-27',remarks='SCHED-2h proof',delay_cause=NULL,delay_resolution=NULL WHERE id=tid;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Engineer save failed'; END IF;
 SELECT to_jsonb(t) INTO afterrow FROM public.project_tasks t WHERE id=tid;
 IF (oldrow - ARRAY['completion_percentage','status','actual_start_date','remarks','delay_cause','delay_resolution','updated_at']) IS DISTINCT FROM
    (afterrow - ARRAY['completion_percentage','status','actual_start_date','remarks','delay_cause','delay_resolution','updated_at']) THEN RAISE EXCEPTION 'Baseline/details changed'; END IF;
 FOREACH cmd IN ARRAY ARRAY[
  'duration_days=99','planned_start_date=''2026-12-15''','planned_finish_date=''2026-12-20''',
  'predecessor_ids=ARRAY[''UNAUTHORISED'']','responsible_role=''site_engineer''','task_name=''Unauthorised name''',
  'updated_at=now()+interval ''1 day''','is_payment_milestone=true','unit_label=''BAD'''
 ] LOOP
  BEGIN
   EXECUTE 'UPDATE public.project_tasks SET '||cmd||' WHERE id=$1' USING tid;
   RAISE EXCEPTION 'Expected 42501 for %',cmd;
  EXCEPTION WHEN insufficient_privilege THEN denied:=denied+1;
  END;
 END LOOP;
 UPDATE public.project_tasks SET completion_percentage=40 WHERE id=factory;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Factory task allowed'; END IF;
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.schedule_audit_log WHERE task_id=tid AND actor_id=engineer AND action='site_actuals_update' AND new_value->>'completion_percentage'='40') THEN RAISE EXCEPTION 'Missing actuals audit'; END IF;
 -- Test both explicit flags and task types; all are row-filtered by RLS.
 FOREACH cmd IN ARRAY ARRAY['is_qc_gate=true','is_payment_milestone=true','task_type=''qc_gate''','task_type=''payment''','is_removed=true'] LOOP
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('hstack.schedule_revise','on',true);
  EXECUTE 'UPDATE public.project_tasks SET '||cmd||' WHERE id=$1' USING tid;
  PERFORM set_config('request.jwt.claim.sub',engineer::text,true);
  SET LOCAL ROLE authenticated;
  UPDATE public.project_tasks SET completion_percentage=50 WHERE id=tid;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Restricted type/flag allowed: %',cmd; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','',true);
  UPDATE public.project_tasks SET is_qc_gate=false,is_payment_milestone=false,task_type='task',is_removed=false WHERE id=tid;
 END LOOP;
 IF public.user_can_access_project(noaccess,pid) THEN RAISE EXCEPTION 'Expected no-access principal'; END IF;
 PERFORM set_config('request.jwt.claim.sub',noaccess::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.project_tasks SET completion_percentage=60 WHERE id=tid;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'No-access engineer allowed'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',prod::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.project_tasks SET completion_percentage=40,status='In Progress',actual_start_date='2026-11-27' WHERE id=factory;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Production head regression'; END IF;
 RESET ROLE;
 -- Actual finish and completion allowed too; no immutable snapshot is rewritten.
 PERFORM set_config('request.jwt.claim.sub',engineer::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.project_tasks SET completion_percentage=100,status='Completed',actual_finish_date='2026-11-27',delay_cause='External — Weather',delay_resolution='Resolved' WHERE id=tid;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Complete failed'; END IF;
 RESET ROLE;
 RAISE EXCEPTION 'SCHED2H EVIDENCE: Vincent 40%% + actual start PASS; baseline v2 columns unchanged PASS; forbidden columns %=42501; factory/QC/payment/removed/no-access=0 rows PASS; production_head 1 row PASS; completion/actual finish PASS; actor/status audit PASS. ALL UNDONE',denied;
END $$;