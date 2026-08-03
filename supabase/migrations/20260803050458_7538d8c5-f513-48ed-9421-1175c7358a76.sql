DROP POLICY IF EXISTS "Authorized roles can view portal tokens" ON public.client_portal_tokens;
CREATE POLICY "Leadership can view portal tokens"
ON public.client_portal_tokens
FOR SELECT
TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'sales_director'::app_role,'planning_head'::app_role]));