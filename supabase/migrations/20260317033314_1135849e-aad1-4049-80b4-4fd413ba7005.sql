CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND role IN ('managing_director', 'finance_director', 'sales_director', 'architecture_director')
      AND is_active = true
  )
$$;