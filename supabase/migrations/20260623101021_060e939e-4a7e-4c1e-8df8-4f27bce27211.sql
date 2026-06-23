
-- 1) Lock down user_roles writes to MD/super_admin only and prevent privilege escalation
DROP POLICY IF EXISTS "Directors can manage roles" ON public.user_roles;

CREATE POLICY "Only MD can manage user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_md(auth.uid()))
WITH CHECK (
  public.is_md(auth.uid())
  AND (
    role NOT IN ('super_admin','managing_director')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

-- 2) Re-revoke sensitive columns on projects from authenticated (column-level)
REVOKE SELECT (client_phone, client_email, client_portal_token) ON public.projects FROM authenticated;
