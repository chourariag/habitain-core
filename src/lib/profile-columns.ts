// Columns selectable from public.profiles by regular authenticated users.
// PII columns (phone, date_of_birth, wedding_anniversary, children) are
// column-level revoked at the DB and must be fetched via RPCs:
//   - get_my_profile_pii()           -> caller's own PII
//   - get_profile_pii(profile_id)    -> owner or HR-only
//   - get_employee_celebrations()    -> HR-only directory
// The `email` column is also column-level revoked. Privileged admin
// screens should call the `get_admin_profiles_full` RPC to fetch profiles
// together with email addresses.
export const PROFILE_SAFE_COLUMNS =
  "id, auth_user_id, display_name, role, language, reporting_manager_id, is_active, login_type, is_archived, created_at, updated_at, avatar_url, home_base, onboarding_completed, onboarding_completed_at, onboarding_quiz_scores, department, secondary_manager_id";
