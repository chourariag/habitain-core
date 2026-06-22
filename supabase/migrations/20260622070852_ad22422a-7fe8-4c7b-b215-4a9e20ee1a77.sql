CREATE OR REPLACE FUNCTION public.get_admin_profiles_full()
RETURNS TABLE (
  id uuid,
  auth_user_id uuid,
  display_name text,
  email text,
  role app_role,
  language text,
  reporting_manager_id uuid,
  is_active boolean,
  login_type text,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  avatar_url text,
  home_base text,
  onboarding_completed boolean,
  onboarding_completed_at timestamptz,
  onboarding_quiz_scores jsonb,
  department text,
  secondary_manager_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.auth_user_id, p.display_name, p.email, p.role, p.language,
         p.reporting_manager_id, p.is_active, p.login_type, p.is_archived,
         p.created_at, p.updated_at, p.avatar_url, p.home_base,
         p.onboarding_completed, p.onboarding_completed_at, p.onboarding_quiz_scores,
         p.department, p.secondary_manager_id
  FROM public.profiles p
  WHERE public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','hr_executive']::app_role[]
  )
  ORDER BY p.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_profiles_full() TO authenticated;