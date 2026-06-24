
-- Restrict client_portal_access_log SELECT to senior leadership and hash stored tokens
DROP POLICY IF EXISTS "Staff can read all portal logs" ON public.client_portal_access_log;
CREATE POLICY "Directors can read portal logs"
  ON public.client_portal_access_log
  FOR SELECT
  TO authenticated
  USING (public.is_director(auth.uid()));

-- Hash tokens on write so the raw token is never persisted
CREATE OR REPLACE FUNCTION public.hash_portal_access_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.token_used IS NOT NULL AND length(NEW.token_used) < 64 THEN
    NEW.token_used := encode(digest(NEW.token_used, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TRIGGER IF EXISTS trg_hash_portal_access_token ON public.client_portal_access_log;
CREATE TRIGGER trg_hash_portal_access_token
  BEFORE INSERT OR UPDATE OF token_used ON public.client_portal_access_log
  FOR EACH ROW EXECUTE FUNCTION public.hash_portal_access_token();

-- Backfill: hash any existing raw tokens
UPDATE public.client_portal_access_log
   SET token_used = encode(digest(token_used, 'sha256'), 'hex')
 WHERE token_used IS NOT NULL AND length(token_used) < 64;

-- Tighten profiles SELECT policy so PII is not even surfaced via row visibility
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profile directory"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((is_active = true) OR (auth_user_id = auth.uid()));
-- Note: PII columns (phone, email, date_of_birth, wedding_anniversary, children, home_base)
-- already have column-level SELECT revoked from authenticated and anon. Access is exclusively
-- via SECURITY DEFINER RPCs: get_my_profile_pii, get_profile_pii, get_employee_celebrations,
-- get_my_profile_email, get_admin_profiles_full, get_active_profiles_directory.
