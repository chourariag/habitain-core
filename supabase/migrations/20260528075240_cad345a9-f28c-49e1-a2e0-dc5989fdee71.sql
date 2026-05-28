
-- 1) Lock down SECURITY DEFINER trigger helper functions that were callable by anon/public
REVOKE EXECUTE ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_role_permission_change() FROM PUBLIC, anon, authenticated;

-- 2) Restrict client_portal_access_log INSERT to authenticated users only
DROP POLICY IF EXISTS "Anyone can insert portal log" ON public.client_portal_access_log;
CREATE POLICY "Authenticated can insert portal log"
  ON public.client_portal_access_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3) Move kiosk_pin into a private table that no client role can read
CREATE TABLE IF NOT EXISTS public.profile_kiosk_pins (
  auth_user_id uuid PRIMARY KEY,
  kiosk_pin text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.profile_kiosk_pins TO service_role;

ALTER TABLE public.profile_kiosk_pins ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated => zero client access. Only service_role bypasses RLS.

-- Backfill from existing column if present
INSERT INTO public.profile_kiosk_pins (auth_user_id, kiosk_pin)
SELECT auth_user_id, kiosk_pin
FROM public.profiles
WHERE kiosk_pin IS NOT NULL AND kiosk_pin <> ''
ON CONFLICT (auth_user_id) DO UPDATE SET kiosk_pin = EXCLUDED.kiosk_pin, updated_at = now();

-- Drop the column from profiles so it can never be read by any employee
ALTER TABLE public.profiles DROP COLUMN IF EXISTS kiosk_pin;
