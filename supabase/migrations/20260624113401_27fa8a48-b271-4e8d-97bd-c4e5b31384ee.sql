DROP FUNCTION IF EXISTS public.get_my_profile_pii();
DROP FUNCTION IF EXISTS public.get_profile_pii(uuid);

CREATE FUNCTION public.get_my_profile_pii()
RETURNS TABLE(phone text, date_of_birth date, wedding_anniversary date, children jsonb, home_base text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.phone, p.date_of_birth, p.wedding_anniversary, p.children, p.home_base
  FROM public.profiles p
  WHERE p.auth_user_id = auth.uid()
$function$;

CREATE FUNCTION public.get_profile_pii(_profile_id uuid)
RETURNS TABLE(profile_id uuid, phone text, date_of_birth date, wedding_anniversary date, children jsonb, home_base text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.phone, p.date_of_birth, p.wedding_anniversary, p.children, p.home_base
  FROM public.profiles p
  WHERE p.id = _profile_id
    AND (p.auth_user_id = auth.uid() OR public.can_view_profile_pii(auth.uid()))
$function$;