
-- Revoke column-level SELECT on PII fields from regular users
REVOKE SELECT (phone, date_of_birth, wedding_anniversary, children) ON public.profiles FROM authenticated;
REVOKE SELECT (phone, date_of_birth, wedding_anniversary, children) ON public.profiles FROM anon;

-- HR-only helper for the celebrations widget
CREATE OR REPLACE FUNCTION public.can_view_profile_pii(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','hr_executive','head_operations')
  )
$$;

-- Owner-or-HR profile PII lookup
CREATE OR REPLACE FUNCTION public.get_profile_pii(_profile_id uuid)
RETURNS TABLE(profile_id uuid, phone text, date_of_birth date, wedding_anniversary date, children jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.phone, p.date_of_birth, p.wedding_anniversary, p.children
  FROM public.profiles p
  WHERE p.id = _profile_id
    AND (p.auth_user_id = auth.uid() OR public.can_view_profile_pii(auth.uid()))
$$;

-- Caller's own PII
CREATE OR REPLACE FUNCTION public.get_my_profile_pii()
RETURNS TABLE(phone text, date_of_birth date, wedding_anniversary date, children jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.phone, p.date_of_birth, p.wedding_anniversary, p.children
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
$$;

-- HR-only celebrations directory (used by HR settings tab)
CREATE OR REPLACE FUNCTION public.get_employee_celebrations()
RETURNS TABLE(auth_user_id uuid, display_name text, date_of_birth date, wedding_anniversary date, children jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.auth_user_id, p.display_name, p.date_of_birth, p.wedding_anniversary, p.children
  FROM public.profiles p
  WHERE p.is_active = true
    AND public.can_view_profile_pii(auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_pii(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_pii() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_celebrations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_profile_pii(uuid) TO authenticated;
