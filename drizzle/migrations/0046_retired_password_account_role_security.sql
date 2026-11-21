ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
GRANT SELECT (must_change_password) ON public.profiles TO authenticated;
UPDATE public.profiles SET must_change_password = true;
CREATE OR REPLACE FUNCTION public.guard_password_change_flag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password AND coalesce(auth.role(), '') <> 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Password-change completion requires the checked account function' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_password_change_flag BEFORE UPDATE OF must_change_password ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_password_change_flag();
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE caller_super boolean; target_super boolean;
BEGIN
 IF NEW.role IS NOT DISTINCT FROM OLD.role THEN RETURN NEW; END IF;
 IF auth.role() = 'service_role' OR session_user IN ('postgres','supabase_admin') THEN RETURN NEW; END IF;
 IF auth.uid() = OLD.auth_user_id THEN RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE='42501'; END IF;
 caller_super := public.has_role(auth.uid(), 'super_admin');
 target_super := OLD.role = 'super_admin' OR public.has_role(OLD.auth_user_id,'super_admin');
 IF NOT caller_super AND (NEW.role = 'super_admin' OR target_super) THEN RAISE EXCEPTION 'Only Super Admin may grant or revoke Super Admin' USING ERRCODE='42501'; END IF;
 IF NOT caller_super AND NOT public.is_tier1(auth.uid()) THEN RAISE EXCEPTION 'Director access required' USING ERRCODE='42501'; END IF;
 RAISE EXCEPTION 'Use the checked account role action' USING ERRCODE='42501';
END; $$;
CREATE OR REPLACE FUNCTION public.admin_set_account_access(_caller uuid, _target uuid, _role public.app_role DEFAULT NULL, _active boolean DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_profile public.profiles%ROWTYPE; caller_super boolean; target_super boolean; old_roles jsonb;
BEGIN
 IF coalesce(auth.role(),'') <> 'service_role' AND session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'Service only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(746460046);
 SELECT * INTO old_profile FROM public.profiles WHERE auth_user_id=_target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE auth_user_id=_caller AND is_active=true AND must_change_password=false) THEN RAISE EXCEPTION 'Active caller with completed password change required' USING ERRCODE='42501'; END IF;
 caller_super := public.has_role(_caller,'super_admin');
 IF NOT caller_super AND NOT public.is_tier1(_caller) THEN RAISE EXCEPTION 'Director access required' USING ERRCODE='42501'; END IF;
 target_super := old_profile.role='super_admin' OR public.has_role(_target,'super_admin');
 IF _role IS NOT NULL AND _caller=_target THEN RAISE EXCEPTION 'Cannot change your own role' USING ERRCODE='42501'; END IF;
 IF _role IS NOT NULL AND NOT caller_super AND (_role='super_admin' OR target_super) THEN RAISE EXCEPTION 'Only Super Admin may grant or revoke Super Admin' USING ERRCODE='42501'; END IF;
 IF target_super AND ((_role IS NOT NULL AND _role <> 'super_admin') OR _active=false) THEN
 IF EXISTS(SELECT 1 FROM public.get_sole_role_holders() WHERE role='super_admin' AND holder_profile_id=old_profile.id) OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.auth_user_id WHERE r.role='super_admin' AND p.is_active=true AND p.auth_user_id<>_target) THEN RAISE EXCEPTION 'Cannot demote or deactivate the last Super Admin' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(role),'[]'::jsonb) INTO old_roles FROM public.user_roles WHERE user_id=_target;
 IF _role IS NOT NULL THEN
 DELETE FROM public.user_roles WHERE user_id=_target;
 INSERT INTO public.user_roles(user_id,role) VALUES(_target,_role);
 UPDATE public.profiles SET role=_role WHERE auth_user_id=_target;
 INSERT INTO public.admin_audit_log(action,performed_by,entity_type,entity_id,old_value,new_value) VALUES('update_role',_caller,'profile',_target,jsonb_build_object('role',old_profile.role,'roles',old_roles),jsonb_build_object('role',_role));
 END IF;
 IF _active IS NOT NULL THEN
 UPDATE public.profiles SET is_active=_active,is_archived=NOT _active WHERE auth_user_id=_target;
 INSERT INTO public.admin_audit_log(action,performed_by,entity_type,entity_id,old_value,new_value) VALUES('update_account_status',_caller,'profile',_target,jsonb_build_object('is_active',old_profile.is_active),jsonb_build_object('is_active',_active));
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.admin_set_account_access(uuid,uuid,public.app_role,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_access(uuid,uuid,public.app_role,boolean) TO service_role;