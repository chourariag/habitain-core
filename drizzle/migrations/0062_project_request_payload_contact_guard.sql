CREATE FUNCTION public._project_request_payload_contact_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF NEW.request_type='create_project' AND (jsonb_path_exists(NEW.payload,'$.**.client_phone') OR jsonb_path_exists(NEW.payload,'$.**.client_email') OR jsonb_path_exists(NEW.payload,'$.**.phone') OR jsonb_path_exists(NEW.payload,'$.**.email')) THEN RAISE EXCEPTION 'Client contact must be submitted through the private project request form'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._project_request_payload_contact_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER proj_loc_approval_payload_guard BEFORE INSERT OR UPDATE OF payload,request_type ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public._project_request_payload_contact_guard();