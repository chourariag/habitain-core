DROP POLICY IF EXISTS "Authorized roles can update punch_list_items" ON public.punch_list_items;
CREATE POLICY "Authorized roles can update punch_list_items"
ON public.punch_list_items FOR UPDATE TO authenticated
USING (
  (is_full_admin(auth.uid()) OR has_role(auth.uid(), 'site_installation_mgr'::app_role) OR has_role(auth.uid(), 'site_engineer'::app_role) OR is_director(auth.uid()))
  AND (is_full_admin(auth.uid()) OR is_director(auth.uid()) OR public.user_can_access_project(auth.uid(), project_id))
)
WITH CHECK (
  (is_full_admin(auth.uid()) OR has_role(auth.uid(), 'site_installation_mgr'::app_role) OR has_role(auth.uid(), 'site_engineer'::app_role) OR is_director(auth.uid()))
  AND (is_full_admin(auth.uid()) OR is_director(auth.uid()) OR public.user_can_access_project(auth.uid(), project_id))
);

DROP POLICY IF EXISTS "Authenticated users can view subcontractor_assignments" ON public.subcontractor_assignments;
CREATE POLICY "Scoped roles can view subcontractor_assignments"
ON public.subcontractor_assignments FOR SELECT TO authenticated
USING (
  public.can_access_subcontractors(auth.uid())
  OR is_director(auth.uid())
  OR has_role(auth.uid(), 'site_engineer'::app_role)
  OR public.user_can_access_project(auth.uid(), project_id)
);