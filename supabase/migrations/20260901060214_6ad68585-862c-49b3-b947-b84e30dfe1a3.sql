CREATE OR REPLACE FUNCTION public.is_role_admin_tier(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','hr_executive','hr_admin')
  )
$$;

DROP POLICY IF EXISTS "Leadership can manage user_roles" ON public.user_roles;

CREATE POLICY "Role admins can manage user_roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.is_role_admin_tier(auth.uid()))
WITH CHECK (
  public.is_role_admin_tier(auth.uid())
  AND (
    role <> ALL (ARRAY['super_admin'::app_role,'managing_director'::app_role])
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);