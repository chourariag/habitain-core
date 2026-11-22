CREATE TABLE public.project_client_contact_requests (
 request_id uuid PRIMARY KEY REFERENCES public.approval_requests(id), phone text, email text,
 created_by uuid NOT NULL DEFAULT auth.uid(), updated_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 is_archived boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.project_client_contact_requests TO service_role;
ALTER TABLE public.project_client_contact_requests ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.project_location_contact_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES public.projects(id), request_id uuid REFERENCES public.approval_requests(id),
 action text NOT NULL, fields text[] NOT NULL, old_location jsonb, new_location jsonb,
 created_by uuid NOT NULL DEFAULT auth.uid(), updated_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), is_archived boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.project_location_contact_log TO service_role;
ALTER TABLE public.project_location_contact_log ENABLE ROW LEVEL SECURITY;
-- Keep private columns outside direct Data API reads; existing RLS is untouched.
REVOKE SELECT ON public.projects FROM authenticated, anon;
DO $$ DECLARE cols text; BEGIN
 SELECT string_agg(quote_ident(attname),', ' ORDER BY attnum) INTO cols FROM pg_attribute WHERE attrelid='public.projects'::regclass AND attnum>0 AND NOT attisdropped AND attname NOT IN ('client_phone','client_email','client_portal_token');
 EXECUTE 'GRANT SELECT ('||cols||') ON public.projects TO authenticated';
END $$;
CREATE FUNCTION public._validate_project_location(p_address text,p_lat numeric,p_lng numeric,p_radius integer) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ BEGIN
 IF p_address IS NULL OR btrim(p_address)='' THEN RAISE EXCEPTION 'Site address is required'; END IF;
 IF p_lat IS NULL OR p_lng IS NULL OR p_lat::text IN ('NaN','Infinity','-Infinity') OR p_lng::text IN ('NaN','Infinity','-Infinity') OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 OR (p_lat=0 AND p_lng=0) THEN RAISE EXCEPTION 'Enter a valid site latitude and longitude; 0,0 is not allowed'; END IF;
 IF p_radius IS NULL OR p_radius NOT BETWEEN 50 AND 1000 THEN RAISE EXCEPTION 'Attendance radius must be between 50 and 1000 metres'; END IF;
END $$;
CREATE FUNCTION public._normalise_project_phone(p_phone text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ DECLARE v text:=regexp_replace(btrim(p_phone),'[[:space:]()-]','','g'); BEGIN
 IF v ~ '^[6-9][0-9]{9}$' THEN RETURN '+91'||v; ELSIF v ~ '^\+91[6-9][0-9]{9}$' THEN RETURN v; END IF;
 RAISE EXCEPTION 'Enter a valid 10-digit Indian mobile number, optionally prefixed with +91';
END $$;
CREATE FUNCTION public._validate_project_email(p_email text) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$ BEGIN
 IF p_email IS NULL OR btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@.]+(\.[^[:space:]@.]+)+$' THEN RAISE EXCEPTION 'Enter a valid client email address'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.get_project_client_contact(_project_id uuid) RETURNS TABLE(client_phone text,client_email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.client_phone,p.client_email FROM public.projects p WHERE p.id=_project_id AND public.is_tier1_or_super(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.get_project_client_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_client_contact(uuid) TO authenticated;
CREATE FUNCTION public.get_project_request_client_contact(p_request_id uuid) RETURNS TABLE(client_phone text,client_email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT r.phone,r.email FROM public.project_client_contact_requests r WHERE r.request_id=p_request_id AND NOT r.is_archived AND public.is_tier1_or_super(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.get_project_request_client_contact(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_project_request_client_contact(uuid) TO authenticated;
CREATE FUNCTION public.raise_project_request(p_payload jsonb,p_phone text,p_email text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_id uuid; v_name text; v_phone text; BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_tier1_or_super(auth.uid()) OR public.has_role(auth.uid(),'planning_head')) THEN RAISE EXCEPTION 'Not authorized to request a project' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN ('name','client_name','project_architect_id','division','production_system','module_count','panel_count','contract_value','start_date','est_completion','project_type','client_work_order_id','wo_line_item_ref','location','site_lat','site_lng','site_radius')) OR EXISTS(SELECT 1 FROM jsonb_each(p_payload) e WHERE jsonb_typeof(e.value) IN ('object','array')) THEN RAISE EXCEPTION 'Invalid project request fields'; END IF;
 PERFORM public._validate_project_location(p_payload->>'location',(p_payload->>'site_lat')::numeric,(p_payload->>'site_lng')::numeric,(p_payload->>'site_radius')::integer);
 v_phone:=public._normalise_project_phone(p_phone); PERFORM public._validate_project_email(p_email);
 IF nullif(btrim(p_payload->>'name'),'') IS NULL OR nullif(btrim(p_payload->>'client_name'),'') IS NULL THEN RAISE EXCEPTION 'Project and client names are required'; END IF;
 SELECT display_name INTO v_name FROM public.profiles WHERE auth_user_id=auth.uid();
 INSERT INTO public.approval_requests(request_type,payload,requested_by,requested_by_name) VALUES('create_project',p_payload,auth.uid(),v_name) RETURNING id INTO v_id;
 INSERT INTO public.project_client_contact_requests(request_id,phone,email) VALUES(v_id,v_phone,btrim(p_email));
 INSERT INTO public.project_location_contact_log(request_id,action,fields) VALUES(v_id,'contact_request_created',ARRAY['client_phone','client_email']);
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.raise_project_request(jsonb,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.raise_project_request(jsonb,text,text) TO authenticated;
CREATE FUNCTION public.approve_project_request(p_request_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.approval_requests; c public.project_client_contact_requests; p public.projects; v_id uuid; v_name text; BEGIN
 SELECT * INTO r FROM public.approval_requests WHERE id=p_request_id FOR UPDATE;
 IF r.id IS NULL OR r.request_type<>'create_project' THEN RAISE EXCEPTION 'Project request not found'; END IF;
 IF auth.uid() IS NULL OR NOT public.can_approve_request(auth.uid(),r) THEN RAISE EXCEPTION 'Not authorized to approve this project' USING ERRCODE='42501'; END IF;
 IF r.requested_by=auth.uid() THEN RAISE EXCEPTION 'You cannot approve your own project request' USING ERRCODE='42501'; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Project request has already been decided'; END IF;
 SELECT * INTO c FROM public.project_client_contact_requests WHERE request_id=r.id AND NOT is_archived FOR UPDATE;
 SELECT * INTO p FROM jsonb_populate_record(NULL::public.projects,r.payload - 'client_phone' - 'client_email' - 'client_portal_token');
 IF c.request_id IS NOT NULL THEN PERFORM public._validate_project_location(p.location,p.site_lat,p.site_lng,p.site_radius); END IF;
 INSERT INTO public.projects(name,client_name,project_architect_id,division,production_system,module_count,panel_count,contract_value,start_date,est_completion,project_type,client_work_order_id,wo_line_item_ref,location,site_lat,site_lng,site_radius,client_phone,client_email,status,created_by,updated_by)
 VALUES(p.name,p.client_name,p.project_architect_id,p.division,p.production_system,coalesce(p.module_count,0),coalesce(p.panel_count,0),coalesce(p.contract_value,0),p.start_date,p.est_completion,p.project_type,p.client_work_order_id,p.wo_line_item_ref,p.location,p.site_lat,p.site_lng,coalesce(p.site_radius,300),c.phone,c.email,'Active',r.requested_by,r.requested_by) RETURNING id INTO v_id;
 SELECT display_name INTO v_name FROM public.profiles WHERE auth_user_id=auth.uid();
 UPDATE public.approval_requests SET status='approved',approved_by=auth.uid(),approved_by_name=v_name,approved_at=now() WHERE id=r.id;
 UPDATE public.project_client_contact_requests SET phone=NULL,email=NULL,is_archived=true,updated_by=auth.uid(),updated_at=now() WHERE request_id=r.id;
 INSERT INTO public.project_location_contact_log(project_id,request_id,action,fields) VALUES(v_id,r.id,'project_request_approved',ARRAY['status']);
 INSERT INTO public.admin_audit_log(action,performed_by,entity_type,entity_id,old_value,new_value) VALUES('approve_create_project',auth.uid(),'projects',v_id,jsonb_build_object('status','pending'),jsonb_build_object('status','approved'));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.approve_project_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_project_request(uuid) TO authenticated;
CREATE FUNCTION public.set_project_client_contact(p_project_id uuid,p_phone text,p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_phone text; BEGIN
 IF auth.uid() IS NULL OR NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to edit client contact' USING ERRCODE='42501'; END IF;
 v_phone:=public._normalise_project_phone(p_phone); PERFORM public._validate_project_email(p_email);
 UPDATE public.projects SET client_phone=v_phone,client_email=btrim(p_email),updated_by=auth.uid(),updated_at=now() WHERE id=p_project_id AND NOT coalesce(is_archived,false);
 IF NOT FOUND THEN RAISE EXCEPTION 'Active project not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_project_client_contact(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_project_client_contact(uuid,text,text) TO authenticated;
CREATE FUNCTION public.set_project_site_location(p_project_id uuid,p_address text,p_lat numeric,p_lng numeric,p_radius integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE old_pin jsonb; BEGIN
 IF auth.uid() IS NULL OR NOT (public.is_tier1_or_super(auth.uid()) OR public.has_role(auth.uid(),'head_of_projects')) THEN RAISE EXCEPTION 'Not authorized to edit site location' USING ERRCODE='42501'; END IF;
 PERFORM public._validate_project_location(p_address,p_lat,p_lng,p_radius);
 SELECT jsonb_build_object('location',location,'site_lat',site_lat,'site_lng',site_lng,'site_radius',site_radius) INTO old_pin FROM public.projects WHERE id=p_project_id AND NOT coalesce(is_archived,false) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active project not found'; END IF;
 UPDATE public.projects SET location=btrim(p_address),site_lat=p_lat,site_lng=p_lng,site_radius=p_radius,updated_by=auth.uid(),updated_at=now() WHERE id=p_project_id;
 INSERT INTO public.project_location_contact_log(project_id,action,fields,old_location,new_location) VALUES(p_project_id,'site_location_updated',ARRAY['location','site_lat','site_lng','site_radius'],old_pin,jsonb_build_object('location',btrim(p_address),'site_lat',p_lat,'site_lng',p_lng,'site_radius',p_radius));
END $$;
REVOKE ALL ON FUNCTION public.set_project_site_location(uuid,text,numeric,numeric,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_project_site_location(uuid,text,numeric,numeric,integer) TO authenticated;
CREATE FUNCTION public._project_contact_guard_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.client_phone IS NULL AND NEW.client_email IS NULL THEN RETURN NEW; END IF;
 ELSE
  IF NEW.client_phone IS NOT DISTINCT FROM OLD.client_phone AND NEW.client_email IS NOT DISTINCT FROM OLD.client_email THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to edit client contact' USING ERRCODE='42501'; END IF;
 END IF;
 NEW.client_phone:=public._normalise_project_phone(NEW.client_phone); PERFORM public._validate_project_email(NEW.client_email);
 INSERT INTO public.project_location_contact_log(project_id,action,fields) VALUES(NULL,CASE WHEN TG_OP='INSERT' THEN 'client_contact_created' ELSE 'client_contact_updated' END,ARRAY['client_phone','client_email']);
 RETURN NEW;
END $$;
-- AFTER trigger for audit keeps the project FK valid and stores no contact values.
CREATE FUNCTION public._project_contact_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.client_phone IS NULL AND NEW.client_email IS NULL THEN RETURN NEW; END IF;
 ELSE
  IF NEW.client_phone IS NOT DISTINCT FROM OLD.client_phone AND NEW.client_email IS NOT DISTINCT FROM OLD.client_email THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.admin_audit_log(action,performed_by,entity_type,entity_id,new_value) VALUES(CASE WHEN TG_OP='INSERT' THEN 'client_contact_created' ELSE 'client_contact_updated' END,coalesce(auth.uid(),NEW.created_by),'projects',NEW.id,jsonb_build_object('fields',ARRAY['client_phone','client_email']));
 RETURN NEW;
END $$;
CREATE TRIGGER proj_loc_contact_validate BEFORE INSERT OR UPDATE OF client_phone,client_email ON public.projects FOR EACH ROW EXECUTE FUNCTION public._project_contact_guard_log();
CREATE TRIGGER proj_loc_contact_audit AFTER INSERT OR UPDATE OF client_phone,client_email ON public.projects FOR EACH ROW EXECUTE FUNCTION public._project_contact_audit();
CREATE FUNCTION public._require_project_site_location(p_project_id uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p_project_id AND site_lat IS NOT NULL AND site_lng IS NOT NULL AND site_lat BETWEEN -90 AND 90 AND site_lng BETWEEN -180 AND 180 AND NOT (site_lat=0 AND site_lng=0)) THEN RAISE EXCEPTION 'Site location is not set. Ask a director or the Head of Projects to set it.'; END IF;
END $$;
CREATE FUNCTION public._site_checkin_location_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.location_type='site' THEN PERFORM public._require_project_site_location(NEW.project_id); END IF; RETURN NEW;
END $$;
CREATE TRIGGER proj_loc_site_checkin BEFORE INSERT OR UPDATE OF project_id,location_type ON public.attendance_records FOR EACH ROW EXECUTE FUNCTION public._site_checkin_location_guard();
-- Insert only the missing-pin check into the existing checked writers, preserving all other rules byte-for-byte.
DO $$ DECLARE d text; marker text; BEGIN
 d:=pg_get_functiondef('public.save_labour_attendance(uuid,date,jsonb,text)'::regprocedure); marker:='  IF p_work_date > public.ist_today() THEN';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'save_labour_attendance marker missing'; END IF;
 EXECUTE replace(d,marker,'  PERFORM public._require_project_site_location(p_project_id);'||chr(10)||marker);
 d:=pg_get_functiondef('public.add_attendance_photo(uuid,text,timestamptz,numeric,numeric,numeric)'::regprocedure); marker:='  IF p_storage_path IS NULL';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'add_attendance_photo marker missing'; END IF;
 EXECUTE replace(d,marker,'  PERFORM public._require_project_site_location(p_project_id);'||chr(10)||marker);
 -- The legacy portal reader must not disclose the project email through a different path.
 d:=pg_get_functiondef('public.get_project_by_client_portal_token(uuid)'::regprocedure); marker:='client_email := rec.client_email;';
 IF strpos(d,marker)=0 THEN RAISE EXCEPTION 'client portal email marker missing'; END IF;
 EXECUTE replace(d,marker,'client_email := CASE WHEN public.is_tier1_or_super(auth.uid()) THEN rec.client_email ELSE NULL END;');
END $$;
REVOKE ALL ON FUNCTION public._validate_project_location(text,numeric,numeric,integer),public._normalise_project_phone(text),public._validate_project_email(text),public._project_contact_guard_log(),public._project_contact_audit(),public._require_project_site_location(uuid),public._site_checkin_location_guard() FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.project_client_contact_requests IS 'Private contact staging. No direct client grants. Approval atomically copies contacts then clears values and archives metadata; no hard deletion.';
COMMENT ON TABLE public.project_location_contact_log IS 'Metadata-only contact audit; location edits record pins. Never store phone or email values here.';