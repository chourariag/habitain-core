REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;

GRANT SELECT (
  id, auth_user_id, display_name, role, language, reporting_manager_id,
  is_active, login_type, is_archived, created_at, updated_at, avatar_url,
  home_base, date_of_birth, wedding_anniversary, children,
  onboarding_completed, onboarding_completed_at, onboarding_quiz_scores,
  department, secondary_manager_id
) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_profiles_directory()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  display_name text,
  email text,
  role app_role,
  department text,
  is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.auth_user_id, p.display_name, p.email, p.role, p.department, p.is_active
  FROM public.profiles p
  WHERE p.is_active = true
    AND public.user_has_any_role(
      auth.uid(),
      ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
            'head_operations','hr_executive','finance_manager','planning_head','principal_architect']::app_role[]
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_active_profiles_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_email()
RETURNS TABLE (display_name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.display_name, p.email FROM public.profiles p WHERE p.auth_user_id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile_email() TO authenticated;