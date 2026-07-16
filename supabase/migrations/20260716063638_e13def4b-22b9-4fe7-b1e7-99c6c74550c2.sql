
CREATE OR REPLACE FUNCTION public.can_access_labour_salary(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN (
        'super_admin','managing_director',
        'finance_director','sales_director','architecture_director',
        'finance_manager','hr_executive'
      )
  )
$$;
