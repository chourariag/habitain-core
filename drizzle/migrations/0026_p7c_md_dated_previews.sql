DO $migration$
DECLARE body text;
BEGIN
SELECT prosrc INTO body FROM pg_proc WHERE oid='public.run_reminders(boolean,timestamp with time zone)'::regprocedure;
IF strpos(body,'IF p_dry AND p_asof IS NOT NULL AND public.has_role(auth.uid(),''super_admin'') THEN v_now:=p_asof; END IF;')=0 THEN RAISE EXCEPTION 'Expected preview guard not found'; END IF;
body:=replace(body,'IF p_dry AND p_asof IS NOT NULL AND public.has_role(auth.uid(),''super_admin'') THEN v_now:=p_asof; END IF;','IF p_dry AND p_asof IS NOT NULL AND (public.has_role(auth.uid(),''super_admin'') OR public.has_role(auth.uid(),''managing_director'')) THEN v_now:=p_asof; END IF;');
EXECUTE format('CREATE OR REPLACE FUNCTION public.run_reminders(p_dry boolean,p_asof timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS %L',body);
END;
$migration$;