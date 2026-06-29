DROP POLICY IF EXISTS "Auth can view portal tokens" ON public.client_portal_tokens;
CREATE POLICY "Authorized roles can view portal tokens"
ON public.client_portal_tokens
FOR SELECT
TO authenticated
USING (
  public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','planning_head','sales_executive','site_installation_mgr']::app_role[]
  )
);