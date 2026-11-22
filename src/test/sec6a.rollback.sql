-- Existing principals only. No role/account changes. All test advances/tokens roll back.
BEGIN;
DO $test$
DECLARE r record; md uuid; project uuid; aid uuid; tid uuid; secret text; other_project uuid; result jsonb; changed integer; total integer:=0; approvers integer:=0; denied integer:=0; dual integer:=0; requests_before integer; events_before integer;
BEGIN
 SELECT user_id INTO md FROM public.user_roles WHERE role='managing_director' LIMIT 1;
 SELECT id INTO project FROM public.projects WHERE name='Test' LIMIT 1;
 IF project IS NULL THEN project:='e4f51cd6-fb25-475e-980a-5e46070d678f'; END IF;
 SELECT id INTO other_project FROM public.projects WHERE id<>project LIMIT 1;
 SELECT count(*) INTO requests_before FROM public.advance_requests;
 SELECT count(*) INTO events_before FROM public.reminder_events;
 FOR r IN SELECT p.id profile_id,p.auth_user_id uid,p.role,public.is_full_admin(p.auth_user_id) OR public.has_role(p.auth_user_id,'finance_manager') allowed,(SELECT count(*) FROM public.user_roles ur WHERE ur.user_id=p.auth_user_id)>1 multiple FROM public.profiles p WHERE p.is_active AND NOT coalesce(p.is_archived,false) LOOP
  total:=total+1; IF r.multiple THEN dual:=dual+1; END IF;
  PERFORM set_config('request.jwt.claim.sub',r.uid::text,true);
  -- Privileged fixture insertion still exercises the guard for EVERY actual principal.
  BEGIN
   INSERT INTO public.advance_requests(employee_id,amount,status) VALUES(r.profile_id,1,'approved');
   RAISE EXCEPTION 'Self-approved insertion accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO public.advance_requests(employee_id,amount,status) VALUES(r.profile_id,1,'pending') RETURNING id INTO aid;
  BEGIN UPDATE public.advance_requests SET status='approved',approved_by=r.uid,approved_at=now() WHERE id=aid; RAISE EXCEPTION 'Self approval accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.advance_requests SET status='released',released_by=r.uid,released_at=now() WHERE id=aid; RAISE EXCEPTION 'Self release accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.advance_requests SET status='paid' WHERE id=aid; RAISE EXCEPTION 'Self paid accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.advance_requests SET employee_id=md,requested_by=md WHERE id=aid; RAISE EXCEPTION 'Requester spoof accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- Genuine authenticated path: current policies remain the authority for approver roles.
  SET LOCAL ROLE authenticated;
  BEGIN
   UPDATE public.advance_requests SET status='approved',approved_by=r.uid,approved_at=now() WHERE id=aid;
   GET DIAGNOSTICS changed=ROW_COUNT;
   IF changed<>0 THEN RAISE EXCEPTION 'Authenticated self approval accepted'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- A different allowed approver still works; denied roles cannot update the row.
  PERFORM set_config('request.jwt.claim.sub',md::text,true);
  INSERT INTO public.advance_requests(employee_id,amount,status) VALUES(md,1,'pending') RETURNING id INTO aid;
  -- For MD use a different owner instead so the positive test isn't self approval.
  IF r.uid=md THEN
    PERFORM set_config('request.jwt.claim.sub','',true);
    INSERT INTO public.advance_requests(employee_id,amount,status) VALUES((SELECT auth_user_id FROM public.profiles WHERE is_active AND auth_user_id<>md LIMIT 1),1,'pending') RETURNING id INTO aid;
  END IF;
  PERFORM set_config('request.jwt.claim.sub',r.uid::text,true); SET LOCAL ROLE authenticated;
  UPDATE public.advance_requests SET status='approved',approved_by=r.uid,approved_at=now() WHERE id=aid;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF r.allowed AND changed<>1 THEN RAISE EXCEPTION 'Allowed different approver blocked: %',r.role; END IF;
  IF NOT r.allowed AND changed<>0 THEN RAISE EXCEPTION 'Denied role gained approval: %',r.role; END IF;
  RESET ROLE;
  IF r.allowed THEN approvers:=approvers+1; ELSE denied:=denied+1; END IF;
  -- All users of a bearer link receive precisely its project, not another project.
  PERFORM set_config('request.jwt.claim.sub',md::text,true);
  INSERT INTO public.client_portal_tokens(project_id,created_by) VALUES(project,md) RETURNING id,secret_token INTO tid,secret;
  IF length(secret)<>64 OR (SELECT expires_at FROM public.client_portal_tokens WHERE id=tid) IS DISTINCT FROM now()+interval '90 days' THEN RAISE EXCEPTION 'Token entropy/default expiry mismatch'; END IF;
  PERFORM set_config('request.jwt.claim.sub',r.uid::text,true); SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.get_project_by_any_portal_token(secret))<>1 OR (SELECT id FROM public.get_project_by_any_portal_token(secret))<>project THEN RAISE EXCEPTION 'Valid token failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token(secret) WHERE id=other_project) THEN RAISE EXCEPTION 'Cross-project token read'; END IF;
  RESET ROLE;
  UPDATE public.client_portal_tokens SET expires_at=now()-interval '1 second' WHERE id=tid;
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token(secret)) THEN RAISE EXCEPTION 'Expired token accepted'; END IF;
  RESET ROLE;
  UPDATE public.client_portal_tokens SET expires_at=now()+interval '7 days',is_active=false WHERE id=tid;
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token(secret)) THEN RAISE EXCEPTION 'Revoked token accepted'; END IF;
  RESET ROLE;
 END LOOP;
 -- Real token management policy: legacy screen's effective Tier 1/Super writers preserved.
 FOR r IN SELECT p.auth_user_id uid,public.is_tier1_or_super(p.auth_user_id) allowed FROM public.profiles p WHERE p.is_active AND NOT coalesce(p.is_archived,false) LOOP
  PERFORM set_config('request.jwt.claim.sub',r.uid::text,true); SET LOCAL ROLE authenticated;
  IF r.allowed THEN
    SELECT client_portal_token INTO secret FROM public.manage_project_portal_link(project,'generate',7);
    IF length(secret)<>64 THEN RAISE EXCEPTION 'Weak generated legacy token'; END IF;
    IF (SELECT id FROM public.get_project_by_any_portal_token(secret))<>project THEN RAISE EXCEPTION 'Generated link did not resolve'; END IF;
    PERFORM public.manage_project_portal_link(project,'revoke');
    IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token(secret)) THEN RAISE EXCEPTION 'Legacy revoke failed'; END IF;
  ELSE
    BEGIN PERFORM public.manage_project_portal_link(project,'generate'); RAISE EXCEPTION 'Unauthorized link manager'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  END IF;
  RESET ROLE;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub',md::text,true);
 INSERT INTO public.client_portal_tokens(project_id,created_by,expires_at) VALUES(project,md,now()+interval '7 days') RETURNING id,secret_token INTO tid,secret;
 IF (SELECT expires_at FROM public.client_portal_tokens WHERE id=tid)<>now()+interval '7 days' THEN RAISE EXCEPTION 'Configured expiry ignored'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true); SET LOCAL ROLE anon;
 IF (SELECT id FROM public.get_project_by_any_portal_token(secret))<>project THEN RAISE EXCEPTION 'Public live token failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token('not-a-token')) THEN RAISE EXCEPTION 'Bad token accepted'; END IF;
 IF EXISTS(SELECT 1 FROM public.get_project_by_any_portal_token(secret) p WHERE to_jsonb(p) ?| ARRAY['client_phone','client_email','client_portal_token','gfc_budget','planned_labour_cost','created_by']) THEN RAISE EXCEPTION 'Private project fields returned'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',md::text,true); SET LOCAL ROLE authenticated;
 result:=public.get_running_bill('e4f51cd6-fb25-475e-980a-5e46070d678f','2026-11-22');
 IF (result->'totals'->>'value_earned')::numeric<>151000 OR (result->'totals'->>'own_labour_cost')::numeric<>6365.46 OR (result->'totals'->>'subcontract_accrued')::numeric<>0 OR (result->'totals'->>'excess_value')::numeric<>19500 THEN RAISE EXCEPTION 'Running Bill changed'; END IF;
 RESET ROLE;
 IF (SELECT count(*) FROM public.reminder_events)<>events_before THEN RAISE EXCEPTION 'Reminder events changed'; END IF;
 RAISE NOTICE 'SEC6a passed: % principals, % allowed approvers, % denied, % multi-role; self insert/approve/release/paid/spoof, cross-project/expired/revoked/public tokens and Running Bill passed. All writes roll back.',total,approvers,denied,dual;
END $test$;
ROLLBACK;