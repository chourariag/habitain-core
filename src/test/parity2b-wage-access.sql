-- Run through the privileged data tool; session settings and any writes roll back.
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE actor uuid; role_key text; visible_rows bigint;
BEGIN
 FOR actor,role_key IN SELECT user_id,role::text FROM public.user_roles
 WHERE role IN ('managing_director','sales_director','architecture_director') LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  SELECT count(*) INTO visible_rows FROM public.labour_worker_compensation;
  IF visible_rows<>49 THEN RAISE EXCEPTION 'Wage visibility differs: % %',role_key,visible_rows; END IF;
  IF NOT public.can_access_labour_compensation(actor) THEN RAISE EXCEPTION 'Director wage access denied'; END IF;
  IF public.commit_labour_master_upload('[]'::jsonb)<>0 THEN RAISE EXCEPTION 'Empty upload changed rows'; END IF;
 END LOOP;
END $test$;
ROLLBACK;