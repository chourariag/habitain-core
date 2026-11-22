REVOKE ALL ON public.project_client_contact_requests,public.project_location_contact_log FROM anon,authenticated;
GRANT ALL ON public.project_client_contact_requests,public.project_location_contact_log TO service_role;
CREATE OR REPLACE FUNCTION public._project_contact_guard_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.client_phone IS NULL AND NEW.client_email IS NULL THEN RETURN NEW; END IF;
  PERFORM public._validate_project_location(NEW.location,NEW.site_lat,NEW.site_lng,NEW.site_radius);
 ELSE
  IF NEW.client_phone IS NOT DISTINCT FROM OLD.client_phone AND NEW.client_email IS NOT DISTINCT FROM OLD.client_email THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to edit client contact' USING ERRCODE='42501'; END IF;
 END IF;
 NEW.client_phone:=public._normalise_project_phone(NEW.client_phone); PERFORM public._validate_project_email(NEW.client_email);
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public._project_contact_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.client_phone IS NULL AND NEW.client_email IS NULL THEN RETURN NEW; END IF;
 ELSE
  IF NEW.client_phone IS NOT DISTINCT FROM OLD.client_phone AND NEW.client_email IS NOT DISTINCT FROM OLD.client_email THEN RETURN NEW; END IF;
 END IF;
 INSERT INTO public.project_location_contact_log(project_id,action,fields,created_by,updated_by) VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN 'client_contact_created' ELSE 'client_contact_updated' END,ARRAY['client_phone','client_email'],coalesce(auth.uid(),NEW.created_by),coalesce(auth.uid(),NEW.created_by));
 INSERT INTO public.admin_audit_log(action,performed_by,entity_type,entity_id,new_value) VALUES(CASE WHEN TG_OP='INSERT' THEN 'client_contact_created' ELSE 'client_contact_updated' END,coalesce(auth.uid(),NEW.created_by),'projects',NEW.id,jsonb_build_object('fields',ARRAY['client_phone','client_email']));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public._project_contact_guard_log(),public._project_contact_audit() FROM PUBLIC,anon,authenticated;