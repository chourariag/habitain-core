-- Run with the privileged SQL test tool; all test operations are discarded.
BEGIN;
CREATE TEMP TABLE fac_access(test text, result text);
DO $test$
DECLARE t text; c text; q text; r record; args text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'factory\_%' OR tablename='boq_work_location_log') LOOP
  FOREACH c IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
   q:=CASE c WHEN 'INSERT' THEN format('INSERT INTO public.%I(id) SELECT gen_random_uuid() WHERE false',t) WHEN 'UPDATE' THEN format('UPDATE public.%I SET id=id WHERE false',t) ELSE format('DELETE FROM public.%I WHERE false',t) END;
   BEGIN
    SET LOCAL ROLE authenticated; EXECUTE q;
    RAISE EXCEPTION 'Unexpected direct write permission: % %',t,c;
   EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO fac_access VALUES(t||':'||c,'PASS denied 42501'); END;
  END LOOP;
 END LOOP;
 FOREACH c IN ARRAY ARRAY['amount_inr','rate_used','rate_id'] LOOP
  BEGIN
   SET LOCAL ROLE authenticated; EXECUTE format('SELECT %I FROM public.factory_report_quantities LIMIT 0',c);
   RAISE EXCEPTION 'Unexpected commercial column read: %',c;
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO fac_access VALUES('quantities:'||c,'PASS denied 42501'); END;
 END LOOP;
 FOREACH c IN ARRAY ARRAY['amount','effective_hourly_rate'] LOOP
  BEGIN
   SET LOCAL ROLE authenticated; EXECUTE format('SELECT %I FROM public.factory_labour_attendance LIMIT 0',c);
   RAISE EXCEPTION 'Unexpected attendance wage read: %',c;
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO fac_access VALUES('attendance:'||c,'PASS denied 42501'); END;
 END LOOP;
 FOR r IN SELECT oid,proname,proargtypes FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('can_read_factory','can_write_factory','can_view_factory_cost','_factory_can_boq','_factory_window','_factory_validate_workers','_factory_validate_subcontracts','add_factory_attendance_photo','get_factory_attendance','save_factory_attendance','confirm_factory_hours','get_factory_report','save_factory_report_draft','submit_factory_report','get_factory_cost','get_boq_work_locations','set_boq_work_location') LOOP
  SELECT coalesce(string_agg('NULL::'||arg.arg_type::regtype::text,','),'') INTO args FROM unnest(r.proargtypes) AS arg(arg_type);
  BEGIN
   SET LOCAL ROLE anon; EXECUTE format('SELECT public.%I(%s)',r.proname,args);
   RAISE EXCEPTION 'Unexpected anonymous function access: %',r.proname;
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; INSERT INTO fac_access VALUES(r.proname,'PASS denied 42501'); END;
 END LOOP;
 IF (SELECT count(*) FROM fac_access)<>52 THEN RAISE EXCEPTION 'Expected 52 access checks'; END IF;
END $test$;
SELECT * FROM fac_access ORDER BY test;
ROLLBACK;