-- Run as the managed privileged test connection. All writes are rolled back; no roles/accounts or existing requests are changed.
BEGIN;
DO $test$
DECLARE r record; director uuid; grantee uuid; architect uuid; pid uuid; payload jsonb; v jsonb; total integer:=0; allow_count integer:=0; deny_count integer:=0; n integer; baseline integer; pending integer; audit_before integer;
BEGIN
 SELECT user_id INTO director FROM public.user_roles WHERE role='managing_director' LIMIT 1;
 SELECT ur.user_id INTO grantee FROM public.user_roles ur JOIN public.profiles p ON p.auth_user_id=ur.user_id WHERE ur.role='site_engineer' AND p.is_active AND NOT public.is_tier1_or_super(ur.user_id) LIMIT 1;
 SELECT p.id INTO architect FROM public.profiles p JOIN public.user_roles ur ON ur.user_id=p.auth_user_id WHERE ur.role='architecture_director' AND p.is_active LIMIT 1;
 IF director IS NULL OR grantee IS NULL OR architect IS NULL THEN RAISE EXCEPTION 'Required active principals unavailable'; END IF;
 SELECT count(*) INTO baseline FROM public.projects;
 SELECT count(*) INTO pending FROM public.approval_requests WHERE request_type='create_project' AND status='pending';
 SELECT count(*) INTO audit_before FROM public.super_admin_audit_log WHERE section='Project Creators';
 payload:=jsonb_build_object('name','PROJ-ACCESS rollback validation','client_name','Validation client','project_architect_id',architect,'division','Habitainer','production_system','hybrid','module_count',2,'panel_count',3,'contract_value',100000,'start_date','2026-11-22','est_completion','2027-01-22','location','Bengaluru','site_lat',12.9716,'site_lng',77.5946,'site_radius',300);
 FOR r IN SELECT p.auth_user_id AS uid,public.is_tier1_or_super(p.auth_user_id) AS allowed FROM public.profiles p WHERE p.is_active AND NOT coalesce(p.is_archived,false) LOOP
  total:=total+1;
  PERFORM set_config('request.jwt.claim.sub',r.uid::text,true); SET LOCAL ROLE authenticated;
  IF public.can_create_project(r.uid) IS DISTINCT FROM r.allowed THEN RAISE EXCEPTION 'Creation role mismatch for %',r.uid; END IF;
  IF r.allowed THEN
   allow_count:=allow_count+1;
   PERFORM public.list_project_creators();
   -- Each active built-in principal can create atomically, not only read the helper.
   pid:=public.create_project(payload,'9876543210','access-check@example.invalid');
  ELSE
   deny_count:=deny_count+1;
   BEGIN PERFORM public.create_project(payload,'9876543210','access-check@example.invalid'); RAISE EXCEPTION 'Unauthorized create RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN INSERT INTO public.projects(name,status,created_by) VALUES('Denied direct insertion','Active',r.uid); RAISE EXCEPTION 'Unauthorized direct insertion'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.list_project_creators(); RAISE EXCEPTION 'Unauthorized list'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.grant_project_creator(grantee,'unauthorized'); RAISE EXCEPTION 'Unauthorized grant'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.revoke_project_creator(grantee); RAISE EXCEPTION 'Unauthorized revoke'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   BEGIN PERFORM public.approve_project_request(gen_random_uuid()); RAISE EXCEPTION 'Legacy approval bypass'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
   IF to_regprocedure('public.raise_project_request(jsonb,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'Retired legacy request still exists'; END IF;
  END IF;
  BEGIN PERFORM user_id FROM public.project_creators; RAISE EXCEPTION 'Direct creator read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.project_creators(user_id,granted_by) VALUES(grantee,r.uid); RAISE EXCEPTION 'Direct creator write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',director::text,true); SET LOCAL ROLE authenticated;
 BEGIN PERFORM public.grant_project_creator(director,'built-in'); RAISE EXCEPTION 'Built-in grant accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Super Admin, MD and Directors are always allowed and cannot receive explicit grants' THEN RAISE; END IF; END;
 BEGIN PERFORM public.revoke_project_creator(director); RAISE EXCEPTION 'Built-in revoke accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Super Admin, MD and Directors are always allowed and cannot be revoked' THEN RAISE; END IF; END;
 PERFORM public.grant_project_creator(grantee,'Rollback-only creation check');
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.project_creators WHERE user_id=grantee AND is_active AND granted_by=director) THEN RAISE EXCEPTION 'Grant missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',grantee::text,true); SET LOCAL ROLE authenticated;
 IF NOT public.can_create_project(grantee) THEN RAISE EXCEPTION 'Grant not effective'; END IF;
 pid:=public.create_project(payload,'9876543210','access-check@example.invalid');
 IF EXISTS(SELECT 1 FROM public.get_project_client_contact(pid)) THEN RAISE EXCEPTION 'Granted creator received private contact'; END IF;
 BEGIN PERFORM client_phone FROM public.projects WHERE id=pid; RAISE EXCEPTION 'Direct private contact read'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.modules(project_id,name) VALUES(pid,'Denied direct child'); RAISE EXCEPTION 'Child policy widened'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 -- A grant permits direct project insertion under the INSERT policy, without widening UPDATE/DELETE.
 INSERT INTO public.projects(name,status,created_by,updated_by) VALUES('Granted direct insertion','Active',grantee,grantee);
 RESET ROLE;
 SELECT count(*) INTO n FROM public.modules WHERE project_id=pid; IF n<>3 THEN RAISE EXCEPTION 'Expected 2 modules + panel parent, got %',n; END IF;
 SELECT count(*) INTO n FROM public.panels q JOIN public.modules m ON m.id=q.module_id WHERE m.project_id=pid; IF n<>3 THEN RAISE EXCEPTION 'Expected 3 panels, got %',n; END IF;
 SELECT count(*) INTO n FROM public.production_stages s JOIN public.modules m ON m.id=s.module_id WHERE m.project_id=pid; IF n<>22 THEN RAISE EXCEPTION 'Expected 22 initial stages, got %',n; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=pid AND client_phone='+919876543210' AND client_email='access-check@example.invalid' AND created_by=grantee AND updated_by=grantee AND NOT project_setup_approved) THEN RAISE EXCEPTION 'Project actor/contact/unchanged gate mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.super_admin_audit_log WHERE entity=pid::text AND (coalesce(new_value::text,'')||coalesce(previous_value::text,'')) ~ '(9876543210|access-check@example.invalid)') THEN RAISE EXCEPTION 'Contact leaked to creator audit'; END IF;
 PERFORM set_config('request.jwt.claim.sub',director::text,true); SET LOCAL ROLE authenticated;
 PERFORM public.revoke_project_creator(grantee);
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM public.project_creators WHERE user_id=grantee AND NOT is_active AND revoked_by=director AND revoked_at IS NOT NULL) THEN RAISE EXCEPTION 'Soft revocation missing'; END IF;
 IF (SELECT count(*) FROM public.super_admin_audit_log WHERE section='Project Creators')<>audit_before+2 THEN RAISE EXCEPTION 'Expected grant and revoke audit entries'; END IF;
 PERFORM set_config('request.jwt.claim.sub',grantee::text,true); SET LOCAL ROLE authenticated;
 IF public.can_create_project(grantee) THEN RAISE EXCEPTION 'Revoked user still allowed'; END IF;
 BEGIN PERFORM public.create_project(payload,'9876543210','access-check@example.invalid'); RAISE EXCEPTION 'Revoked create RPC'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.projects(name,status,created_by) VALUES('Revoked direct insertion','Active',grantee); RAISE EXCEPTION 'Revoked direct insert'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','',true); SET LOCAL ROLE anon;
 BEGIN PERFORM public.can_create_project(director); RAISE EXCEPTION 'Anonymous helper allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.create_project(payload,'9876543210','access-check@example.invalid'); RAISE EXCEPTION 'Anonymous create allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN INSERT INTO public.projects(name,status) VALUES('Anonymous insertion','Active'); RAISE EXCEPTION 'Anonymous insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',director::text,true); SET LOCAL ROLE authenticated;
 v:=public.get_running_bill('e4f51cd6-fb25-475e-980a-5e46070d678f','2026-11-22');
 IF (v->'totals'->>'value_earned')::numeric<>151000 OR (v->'totals'->>'own_labour_cost')::numeric<>6365.46 OR (v->'totals'->>'subcontract_accrued')::numeric<>0 OR (v->'totals'->>'excess_value')::numeric<>19500 THEN RAISE EXCEPTION 'Running Bill regression'; END IF;
 RESET ROLE;
 IF (SELECT count(*) FROM public.approval_requests WHERE request_type='create_project' AND status='pending')<>pending THEN RAISE EXCEPTION 'Pending requests modified'; END IF;
 RAISE NOTICE 'PROJ-ACCESS passed: % active principals, % built-in allowed, % denied; granted/revoked/anonymous checks, exact 3 modules/22 stages/3 panels and Running Bill passed. Everything rolls back.',total,allow_count,deny_count;
END $test$;
DO $matrix$
DECLARE u record; target uuid; inactive uuid;
BEGIN
 SELECT p.auth_user_id INTO target FROM public.profiles p WHERE p.is_active=true AND NOT public.is_tier1_or_super(p.auth_user_id) LIMIT 1;
 SELECT auth_user_id INTO inactive FROM public.profiles WHERE is_active=false LIMIT 1;
 FOR u IN SELECT p.auth_user_id AS uid FROM public.profiles p WHERE p.is_active=true AND public.is_tier1_or_super(p.auth_user_id) LOOP
  PERFORM set_config('request.jwt.claim.sub',u.uid::text,true); SET LOCAL ROLE authenticated;
  PERFORM public.grant_project_creator(target,'Rollback matrix');
  PERFORM public.list_project_creators();
  PERFORM public.revoke_project_creator(target);
  RESET ROLE;
 END LOOP;
 IF inactive IS NOT NULL AND public.can_create_project(inactive) THEN RAISE EXCEPTION 'Inactive user allowed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',target::text,true); SET LOCAL ROLE authenticated;
 BEGIN UPDATE public.project_creators SET is_active=true WHERE user_id=target; RAISE EXCEPTION 'Direct update allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN DELETE FROM public.project_creators WHERE user_id=target; RAISE EXCEPTION 'Direct delete allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 RESET ROLE;
END $matrix$;
ROLLBACK;