DO $$ DECLARE d text; marker text:='client_email := CASE WHEN public.is_tier1_or_super(auth.uid()) THEN rec.client_email ELSE NULL END;'; BEGIN
 d:=pg_get_functiondef('public.get_project_by_client_portal_token(uuid)'::regprocedure);
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Portal preservation marker missing'; END IF;
 EXECUTE replace(d,marker,'client_email := rec.client_email;');
END $$;