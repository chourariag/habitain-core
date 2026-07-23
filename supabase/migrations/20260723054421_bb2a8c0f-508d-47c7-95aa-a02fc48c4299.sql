
-- 1. Create private PII table
CREATE TABLE IF NOT EXISTS public.profile_private_info (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  date_of_birth date,
  wedding_anniversary date,
  children jsonb,
  home_base text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_private_info TO authenticated;
GRANT ALL ON public.profile_private_info TO service_role;

ALTER TABLE public.profile_private_info ENABLE ROW LEVEL SECURITY;

-- Only the owner or HR/leadership (via can_view_profile_pii) can read
CREATE POLICY "Owner or HR can read private info"
  ON public.profile_private_info
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.can_view_profile_pii(auth.uid())
  );

CREATE POLICY "Owner or HR can upsert private info"
  ON public.profile_private_info
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.can_view_profile_pii(auth.uid())
  );

CREATE POLICY "Owner or HR can update private info"
  ON public.profile_private_info
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.can_view_profile_pii(auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
    OR public.can_view_profile_pii(auth.uid())
  );

CREATE POLICY "HR can delete private info"
  ON public.profile_private_info
  FOR DELETE
  TO authenticated
  USING (public.can_view_profile_pii(auth.uid()));

-- 2. Backfill from profiles
INSERT INTO public.profile_private_info (profile_id, phone, date_of_birth, wedding_anniversary, children, home_base)
SELECT id, phone, date_of_birth, wedding_anniversary, children, home_base
FROM public.profiles
WHERE phone IS NOT NULL OR date_of_birth IS NOT NULL OR wedding_anniversary IS NOT NULL OR children IS NOT NULL OR home_base IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

-- 3. Update RPCs to read from new table
CREATE OR REPLACE FUNCTION public.get_my_profile_pii()
RETURNS TABLE(phone text, date_of_birth date, wedding_anniversary date, children jsonb, home_base text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pi.phone, pi.date_of_birth, pi.wedding_anniversary, pi.children, pi.home_base
  FROM public.profiles p
  LEFT JOIN public.profile_private_info pi ON pi.profile_id = p.id
  WHERE p.auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_profile_pii(_profile_id uuid)
RETURNS TABLE(profile_id uuid, phone text, date_of_birth date, wedding_anniversary date, children jsonb, home_base text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, pi.phone, pi.date_of_birth, pi.wedding_anniversary, pi.children, pi.home_base
  FROM public.profiles p
  LEFT JOIN public.profile_private_info pi ON pi.profile_id = p.id
  WHERE p.id = _profile_id
    AND (p.auth_user_id = auth.uid() OR public.can_view_profile_pii(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.get_employee_celebrations()
RETURNS TABLE(auth_user_id uuid, display_name text, date_of_birth date, wedding_anniversary date, children jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.auth_user_id, p.display_name, pi.date_of_birth, pi.wedding_anniversary, pi.children
  FROM public.profiles p
  LEFT JOIN public.profile_private_info pi ON pi.profile_id = p.id
  WHERE p.is_active = true
    AND public.can_view_profile_pii(auth.uid())
$$;

-- 4. Drop PII columns from profiles (now that data lives in profile_private_info)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS wedding_anniversary;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS children;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS home_base;

-- 5. Tally API keys: restrict key_hash visibility
REVOKE SELECT (key_hash) ON public.tally_api_keys FROM authenticated;
REVOKE SELECT (key_hash) ON public.tally_api_keys FROM anon;
