DROP POLICY IF EXISTS "Operations can update site readiness" ON public.site_readiness;
CREATE POLICY "Operations can update site readiness"
ON public.site_readiness
FOR UPDATE
TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'head_operations'::app_role, 'site_installation_mgr'::app_role, 'site_engineer'::app_role, 'planning_engineer'::app_role, 'delivery_rm_lead'::app_role]))
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'head_operations'::app_role, 'site_installation_mgr'::app_role, 'site_engineer'::app_role, 'planning_engineer'::app_role, 'delivery_rm_lead'::app_role]));