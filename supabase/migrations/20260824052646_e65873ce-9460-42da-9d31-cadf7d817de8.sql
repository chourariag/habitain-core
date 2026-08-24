
-- app_settings: only non-sensitive geofence keys readable by all staff; admins read all
DROP POLICY IF EXISTS "Authenticated can view app settings" ON public.app_settings;
CREATE POLICY "Staff read geofence settings" ON public.app_settings
FOR SELECT TO authenticated
USING (
  key IN ('factory_lat','factory_lng','factory_radius','factory_gps_enabled',
          'office_lat','office_lng','office_radius','office_gps_enabled')
  OR public.is_full_admin(auth.uid())
  OR public.is_director(auth.uid())
);

-- role_permissions: users see only their own role's rows; MD/admins see all
DROP POLICY IF EXISTS "role_perms_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_perms_select_own_role_or_admin" ON public.role_permissions
FOR SELECT TO authenticated
USING (
  public.is_md(auth.uid())
  OR public.is_full_admin(auth.uid())
  OR role_code = (public.get_user_role(auth.uid()))::text
);

-- project-scoped tables: restrict to project members
DROP POLICY IF EXISTS "Authenticated can view material_plan_items" ON public.material_plan_items;
CREATE POLICY "Project members view material_plan_items" ON public.material_plan_items
FOR SELECT TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authenticated can view site schedules" ON public.site_schedules;
CREATE POLICY "Project members view site schedules" ON public.site_schedules
FOR SELECT TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY IF EXISTS "Authenticated can view setup approvals" ON public.project_setup_approvals;
CREATE POLICY "Project members view setup approvals" ON public.project_setup_approvals
FOR SELECT TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

-- admin/config tables: leadership only
DROP POLICY IF EXISTS "Auth read escalation" ON public.escalation_rules;
CREATE POLICY "Leadership read escalation" ON public.escalation_rules
FOR SELECT TO authenticated
USING (public.is_md(auth.uid()) OR public.is_full_admin(auth.uid()) OR public.is_director(auth.uid()));

DROP POLICY IF EXISTS "Auth read statutory" ON public.statutory_calendar;
CREATE POLICY "Leadership read statutory" ON public.statutory_calendar
FOR SELECT TO authenticated
USING (public.is_md(auth.uid()) OR public.is_full_admin(auth.uid()) OR public.is_director(auth.uid()));

DROP POLICY IF EXISTS "All authenticated can read forecast settings" ON public.capacity_forecast_settings;
CREATE POLICY "Planning leadership read forecast settings" ON public.capacity_forecast_settings
FOR SELECT TO authenticated
USING (
  public.is_md(auth.uid()) OR public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['head_operations'::app_role,'production_head'::app_role,'planning_head'::app_role,'planning_engineer'::app_role])
);
