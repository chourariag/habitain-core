-- Ensure the broad directory read of profiles can never expose the email column.
REVOKE SELECT (email) ON public.profiles FROM authenticated;
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM anon;

-- Re-assert the safe, non-PII column set for authenticated users.
GRANT SELECT (
  id, auth_user_id, display_name, role, language,
  reporting_manager_id, is_active, login_type, is_archived,
  created_at, updated_at, avatar_url, onboarding_completed,
  onboarding_completed_at, onboarding_quiz_scores, department,
  secondary_manager_id
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;