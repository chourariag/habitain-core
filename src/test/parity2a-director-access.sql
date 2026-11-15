-- Execute with the privileged data tool; all session changes roll back.
BEGIN;
SET LOCAL ROLE authenticated;
DO $test$
DECLARE actor uuid; actual_role text; counts bigint[]; expected bigint[] := ARRAY[6,924,0,1,0,10]::bigint[];
BEGIN
 FOR actor,actual_role IN SELECT user_id,role::text FROM public.user_roles
 WHERE role IN ('managing_director','sales_director','architecture_director') LOOP
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  IF public.get_user_role(auth.uid())::text <> actual_role THEN RAISE EXCEPTION 'Wrong effective role'; END IF;
  IF NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Director lacks Tier 1 access'; END IF;
  SELECT ARRAY[(SELECT count(*) FROM public.projects),(SELECT count(*) FROM public.project_tasks),
   (SELECT count(*) FROM public.purchase_orders),(SELECT count(*) FROM public.qc_inspections),
   (SELECT count(*) FROM public.panels),(SELECT count(*) FROM public.expense_entries)] INTO counts;
  IF counts<>expected THEN RAISE EXCEPTION 'Director counts differ: % %',actual_role,counts; END IF;
 END LOOP;
END $test$;
ROLLBACK;