DO $cleanup$
DECLARE d text;
BEGIN
 LOCK TABLE public.project_client_contact_requests IN ACCESS EXCLUSIVE MODE;
 IF EXISTS (SELECT 1 FROM public.project_client_contact_requests) THEN
  RAISE EXCEPTION 'Contact staging contains rows; cleanup must preserve its legacy readers and writers';
 END IF;
 d:=pg_get_functiondef('public.approve_project_request(uuid)'::regprocedure);
 IF position('c public.project_client_contact_requests;' in d)=0 OR position('c.phone,c.email' in d)=0 THEN RAISE EXCEPTION 'Unexpected legacy approval definition'; END IF;
 d:=replace(d,'c public.project_client_contact_requests; ','');
 d:=replace(d,' SELECT * INTO c FROM public.project_client_contact_requests WHERE request_id=r.id AND NOT is_archived FOR UPDATE;','');
 d:=replace(d,' IF c.request_id IS NOT NULL THEN PERFORM public._validate_project_location(p.location,p.site_lat,p.site_lng,p.site_radius); END IF;','');
 d:=replace(d,',site_radius,client_phone,client_email,status,created_by,updated_by)',',site_radius,status,created_by,updated_by)');
 d:=replace(d,',c.phone,c.email,',',');
 d:=replace(d,' UPDATE public.project_client_contact_requests SET phone=NULL,email=NULL,is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE request_id=r.id;','');
 IF position('project_client_contact_requests' in d)>0 OR position('c.phone' in d)>0 THEN RAISE EXCEPTION 'Staging reference remains'; END IF;
 EXECUTE d;
END $cleanup$;
DROP FUNCTION public.raise_project_request(jsonb,text,text);
DROP FUNCTION public.get_project_request_client_contact(uuid);
COMMENT ON TABLE public.project_client_contact_requests IS 'DEPRECATED: empty legacy project-approval contact store. Direct can_create_project-checked create_project writes contact to projects. No application readers or writers remain; retained because table drops are blocked.';