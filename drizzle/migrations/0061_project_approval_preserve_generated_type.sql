DO $$ DECLARE d text; marker text; BEGIN
 d:=pg_get_functiondef('public.approve_project_request(uuid)'::regprocedure);
 marker:='start_date,est_completion,project_type,client_work_order_id';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Project approval column marker missing'; END IF;
 d:=replace(d,marker,'start_date,est_completion,client_work_order_id');
 marker:='p.start_date,p.est_completion,p.project_type,p.client_work_order_id';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'Project approval value marker missing'; END IF;
 d:=replace(d,marker,'p.start_date,p.est_completion,p.client_work_order_id');
 EXECUTE d;
END $$;