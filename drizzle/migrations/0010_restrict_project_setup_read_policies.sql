DROP POLICY "Authenticated can view project_design_files" ON public.project_design_files;
CREATE POLICY "Project members can view project_design_files"
ON public.project_design_files
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY "Authenticated can read project_stages" ON public.project_stages;
CREATE POLICY "Project members can read project_stages"
ON public.project_stages
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));

DROP POLICY "All authenticated view design stages" ON public.project_design_stages;
CREATE POLICY "Project members can view design stages"
ON public.project_design_stages
FOR SELECT
TO authenticated
USING (public.user_can_access_project(auth.uid(), project_id));