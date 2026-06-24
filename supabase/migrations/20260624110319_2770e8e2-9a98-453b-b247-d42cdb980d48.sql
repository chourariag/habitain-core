
-- Restrict PII columns on profiles via column-level privileges
-- Safe (broadly readable) columns:
GRANT SELECT (
  id, auth_user_id, display_name, role, department, avatar_url, language,
  reporting_manager_id, secondary_manager_id, is_active, is_archived,
  login_type, onboarding_completed, onboarding_completed_at, onboarding_quiz_scores,
  created_at, updated_at
) ON public.profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Explicitly revoke sensitive PII column reads from authenticated/anon.
-- Owner self-reads and HR/admin reads must go through the SECURITY DEFINER
-- RPCs (get_my_profile_pii, get_profile_pii, get_my_profile_email,
-- get_employee_celebrations, get_admin_profiles_full).
REVOKE SELECT (email, phone, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM authenticated;
REVOKE SELECT (email, phone, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM anon;
