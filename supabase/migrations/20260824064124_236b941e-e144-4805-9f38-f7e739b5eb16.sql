CREATE OR REPLACE FUNCTION public.can_edit_fixed_assets(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','procurement','stores_executive','production_head')
  )
$$;