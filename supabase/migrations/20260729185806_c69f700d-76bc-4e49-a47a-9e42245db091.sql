CREATE OR REPLACE FUNCTION public.get_admin_profiles_full()
 RETURNS TABLE(id uuid, auth_user_id uuid, display_name text, email text, role app_role, language text, reporting_manager_id uuid, is_active boolean, login_type text, is_archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, avatar_url text, home_base text, onboarding_completed boolean, onboarding_completed_at timestamp with time zone, onboarding_quiz_scores jsonb, department text, secondary_manager_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director']::app_role[]) THEN
    RAISE EXCEPTION 'Access denied: Employee Management is restricted to Super Admin and Managing Director'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.auth_user_id, p.display_name, p.email, p.role, p.language,
         p.reporting_manager_id, p.is_active, p.login_type, p.is_archived,
         p.created_at, p.updated_at, p.avatar_url, p.home_base,
         p.onboarding_completed, p.onboarding_completed_at, p.onboarding_quiz_scores,
         p.department, p.secondary_manager_id
  FROM public.profiles p
  ORDER BY p.created_at DESC;
END;
$function$;