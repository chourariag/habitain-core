-- SEC-6a(a): independently reversible by disabling only sec6a_advance_guard.
ALTER TABLE public.advance_requests ADD COLUMN IF NOT EXISTS requested_by uuid DEFAULT auth.uid();
CREATE OR REPLACE FUNCTION public.sec6a_advance_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid := auth.uid(); owner_auth uuid; sensitive_change boolean; actors uuid[];
BEGIN
 IF TG_OP='INSERT' THEN
   IF actor IS NOT NULL THEN NEW.requested_by := actor; END IF;
 ELSE
   IF NEW.requested_by IS DISTINCT FROM OLD.requested_by OR NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
     RAISE EXCEPTION 'Advance requester cannot be changed' USING ERRCODE='42501';
   END IF;
 END IF;
 SELECT pr.auth_user_id INTO owner_auth FROM public.profiles pr WHERE pr.id=NEW.employee_id OR pr.auth_user_id=NEW.employee_id LIMIT 1;
 IF TG_OP='INSERT' THEN
   sensitive_change := lower(NEW.status) ~ '(approv|releas|paid)' OR NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.hod_approved_by IS NOT NULL OR NEW.hod_approved_at IS NOT NULL OR NEW.md_approved_by IS NOT NULL OR NEW.md_approved_at IS NOT NULL OR NEW.released_by IS NOT NULL OR NEW.released_at IS NOT NULL;
   actors := ARRAY[actor,NEW.approved_by,NEW.hod_approved_by,NEW.md_approved_by,NEW.released_by];
 ELSE
   sensitive_change := (NEW.status IS DISTINCT FROM OLD.status AND lower(NEW.status) ~ '(approv|releas|paid)') OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.hod_approved_by IS DISTINCT FROM OLD.hod_approved_by OR NEW.hod_approved_at IS DISTINCT FROM OLD.hod_approved_at OR NEW.md_approved_by IS DISTINCT FROM OLD.md_approved_by OR NEW.md_approved_at IS DISTINCT FROM OLD.md_approved_at OR NEW.released_by IS DISTINCT FROM OLD.released_by OR NEW.released_at IS DISTINCT FROM OLD.released_at;
   actors := ARRAY[actor,CASE WHEN NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN NEW.approved_by END,CASE WHEN NEW.hod_approved_by IS DISTINCT FROM OLD.hod_approved_by THEN NEW.hod_approved_by END,CASE WHEN NEW.md_approved_by IS DISTINCT FROM OLD.md_approved_by THEN NEW.md_approved_by END,CASE WHEN NEW.released_by IS DISTINCT FROM OLD.released_by THEN NEW.released_by END];
 END IF;
 IF sensitive_change AND (NEW.requested_by=ANY(actors) OR owner_auth=ANY(actors) OR NEW.employee_id=ANY(actors)) THEN
   RAISE EXCEPTION 'You cannot approve, release or mark paid your own advance request.' USING ERRCODE='42501';
 END IF;
 -- Own inserts must always start pending, even if someone forges another approver.
 IF TG_OP='INSERT' AND actor IS NOT NULL AND sensitive_change THEN
   RAISE EXCEPTION 'An advance request must be created pending approval' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sec6a_advance_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sec6a_advance_guard BEFORE INSERT OR UPDATE ON public.advance_requests FOR EACH ROW EXECUTE FUNCTION public.sec6a_advance_guard();

-- SEC-6a(b): UUID column retained for old links; new public credentials are 32 random bytes.
ALTER TABLE public.client_portal_tokens ADD COLUMN IF NOT EXISTS secret_token text;
CREATE UNIQUE INDEX IF NOT EXISTS client_portal_secret_token_unique ON public.client_portal_tokens(secret_token) WHERE secret_token IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sec6a_client_token_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   NEW.secret_token := encode(extensions.gen_random_bytes(32),'hex');
   NEW.expires_at := coalesce(NEW.expires_at,now()+interval '90 days');
   NEW.created_by := coalesce(auth.uid(),NEW.created_by);
 ELSE
   IF NEW.token IS DISTINCT FROM OLD.token OR NEW.secret_token IS DISTINCT FROM OLD.secret_token OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
     RAISE EXCEPTION 'Portal token identity and project cannot be changed' USING ERRCODE='42501';
   END IF;
   IF NEW.expires_at IS DISTINCT FROM OLD.expires_at AND NEW.expires_at IS NULL THEN
     RAISE EXCEPTION 'A renewed portal link must have an expiry';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sec6a_client_token_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sec6a_client_token_guard BEFORE INSERT OR UPDATE ON public.client_portal_tokens FOR EACH ROW EXECUTE FUNCTION public.sec6a_client_token_guard();
CREATE OR REPLACE FUNCTION public.sec6a_legacy_token_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.client_portal_token IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.client_portal_token IS DISTINCT FROM OLD.client_portal_token AND NEW.client_portal_token IS NOT NULL) THEN
   NEW.client_portal_token := encode(extensions.gen_random_bytes(32),'hex');
   NEW.client_portal_expires_at := coalesce(NEW.client_portal_expires_at,now()+interval '90 days');
 END IF;
 IF TG_OP='UPDATE' AND NEW.client_portal_expires_at IS DISTINCT FROM OLD.client_portal_expires_at AND NEW.client_portal_expires_at IS NULL THEN
   RAISE EXCEPTION 'A renewed portal link must have an expiry';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sec6a_legacy_token_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sec6a_legacy_token_guard BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.sec6a_legacy_token_guard();
CREATE OR REPLACE FUNCTION public.manage_project_portal_link(p_project_id uuid,p_action text,p_days integer DEFAULT 90)
 RETURNS TABLE(client_portal_token text,client_portal_enabled boolean,client_portal_expires_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- The legacy screen's effective existing writers are Tier 1/Super only; no role widening.
 IF auth.uid() IS NULL OR NOT public.is_tier1_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not authorized to manage this project portal link' USING ERRCODE='42501'; END IF;
 IF p_days IS NULL OR p_days<1 THEN RAISE EXCEPTION 'Expiry days must be positive'; END IF;
 IF p_action='generate' THEN
   UPDATE public.projects p SET client_portal_token=encode(extensions.gen_random_bytes(32),'hex'),client_portal_enabled=true,client_portal_expires_at=now()+make_interval(days=>p_days) WHERE p.id=p_project_id;
 ELSIF p_action='renew' THEN
   UPDATE public.projects p SET client_portal_expires_at=now()+make_interval(days=>p_days) WHERE p.id=p_project_id AND p.client_portal_token IS NOT NULL;
 ELSIF p_action='revoke' THEN
   UPDATE public.projects p SET client_portal_enabled=false WHERE p.id=p_project_id;
 ELSE RAISE EXCEPTION 'Unknown portal link action'; END IF;
 RETURN QUERY SELECT p.client_portal_token,p.client_portal_enabled,p.client_portal_expires_at FROM public.projects p WHERE p.id=p_project_id;
END $$;
REVOKE ALL ON FUNCTION public.manage_project_portal_link(uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_project_portal_link(uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_client_portal_token(_token text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT id FROM (
   SELECT t.project_id AS id FROM public.client_portal_tokens t WHERE (t.secret_token=_token OR (t.secret_token IS NULL AND t.token::text=_token)) AND t.is_active AND (t.expires_at IS NULL OR t.expires_at>now())
   UNION ALL
   SELECT p.id FROM public.projects p WHERE p.client_portal_token=_token AND p.client_portal_enabled AND (p.client_portal_expires_at IS NULL OR p.client_portal_expires_at>now())
 ) matches LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_client_portal_token(text) FROM PUBLIC,anon,authenticated;
-- Return shape narrowed; no caller outside ClientPortal uses these project readers.
DROP FUNCTION public.get_project_by_any_portal_token(text);
CREATE FUNCTION public.get_project_by_any_portal_token(_token text)
 RETURNS TABLE(id uuid,name text,client_name text,division text,start_date date,status text,client_portal_expires_at timestamptz,client_portal_status_message text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := public.resolve_client_portal_token(_token);
BEGIN
 IF pid IS NULL THEN RETURN; END IF;
 UPDATE public.client_portal_tokens t SET last_accessed_at=now() WHERE t.project_id=pid AND (t.secret_token=_token OR (t.secret_token IS NULL AND t.token::text=_token));
 RETURN QUERY SELECT p.id,p.name,p.client_name,p.division::text,p.start_date,p.status::text,p.client_portal_expires_at,p.client_portal_status_message FROM public.projects p WHERE p.id=pid;
END $$;
REVOKE ALL ON FUNCTION public.get_project_by_any_portal_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_by_any_portal_token(text) TO anon,authenticated;
DROP FUNCTION public.get_project_by_portal_token(text);
CREATE FUNCTION public.get_project_by_portal_token(_token text)
 RETURNS TABLE(id uuid,name text,client_name text,division text,start_date date,status text,client_portal_expires_at timestamptz,client_portal_status_message text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.name,p.client_name,p.division::text,p.start_date,p.status::text,p.client_portal_expires_at,p.client_portal_status_message FROM public.projects p WHERE p.client_portal_token=_token AND p.client_portal_enabled AND (p.client_portal_expires_at IS NULL OR p.client_portal_expires_at>now()) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_project_by_portal_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_by_portal_token(text) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public._cpt_validate(_token uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT project_id FROM public.client_portal_tokens WHERE token=_token AND secret_token IS NULL AND is_active AND (expires_at IS NULL OR expires_at>now()) LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.get_project_by_client_portal_token(_token uuid)
 RETURNS TABLE(project_id uuid,project_name text,project_code text,client_name text,client_email text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := public._cpt_validate(_token);
BEGIN
 IF pid IS NULL THEN RETURN; END IF;
 UPDATE public.client_portal_tokens t SET last_accessed_at=now() WHERE t.token=_token;
 RETURN QUERY SELECT p.id,p.name,NULL::text,t.client_name,NULL::text FROM public.client_portal_tokens t JOIN public.projects p ON p.id=t.project_id WHERE t.token=_token AND p.id=pid;
END $$;
CREATE OR REPLACE FUNCTION public.get_design_stages_by_portal_token(_token text)
 RETURNS TABLE(id uuid,stage_code text,stage_name text,stage_order integer,stage_group text,status text,planned_start_date date,planned_end_date date,actual_date date,deliverable_url text,deliverable_required boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid := public.resolve_client_portal_token(_token);
BEGIN
 IF pid IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT pds.id,d.stage_code,d.stage_name,d.stage_order,d.stage_group,pds.status,pds.planned_start_date,coalesce(pds.planned_end_date,pds.planned_date),pds.actual_date,pds.deliverable_url,d.deliverable_required FROM public.project_design_stages pds JOIN public.design_stage_definitions d ON d.id=pds.stage_definition_id WHERE pds.project_id=pid AND d.is_combined_child IS NOT TRUE ORDER BY d.stage_order;
END $$;
-- No existing records, policies, schedules, roles, grants or reminder events modified.
