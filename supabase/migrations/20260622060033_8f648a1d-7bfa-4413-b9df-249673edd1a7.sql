-- Restrict direct column access to PII fields on profiles.
-- The app reads these via SECURITY DEFINER functions: get_profile_pii, get_my_profile_pii, get_employee_celebrations.
REVOKE SELECT (phone, date_of_birth, wedding_anniversary, children) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, date_of_birth, wedding_anniversary, children) ON public.profiles FROM anon;