-- Scope design_queries reads/creates to project members (admins/directors covered by helper)
DROP POLICY IF EXISTS "Authenticated can view design_queries" ON public.design_queries;
CREATE POLICY "Project members can view design_queries"
ON public.design_queries
FOR SELECT
TO authenticated
USING (
  public.user_can_access_project(auth.uid(), project_id)
  OR raised_by = auth.uid()
  OR assigned_architect_id = auth.uid()
);

DROP POLICY IF EXISTS "Authenticated can insert design_queries" ON public.design_queries;
CREATE POLICY "Project members can insert design_queries"
ON public.design_queries
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_can_access_project(auth.uid(), project_id)
);

-- Scope floor_plans reads to project members
DROP POLICY IF EXISTS "view_floor_plans_authed" ON public.floor_plans;
CREATE POLICY "view_floor_plans_project_scoped"
ON public.floor_plans
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

-- Scope photo_positions reads to project members
DROP POLICY IF EXISTS "view_photo_positions_authed" ON public.photo_positions;
CREATE POLICY "view_photo_positions_project_scoped"
ON public.photo_positions
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

-- Scope site_position_photos reads to project members
DROP POLICY IF EXISTS "view_site_position_photos_authed" ON public.site_position_photos;
CREATE POLICY "view_site_position_photos_project_scoped"
ON public.site_position_photos
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));