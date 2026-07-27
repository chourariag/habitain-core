
-- 1. user_roles: scope SELECT to self + leadership/HR
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users can view own roles or leadership all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_md(auth.uid())
  OR is_director(auth.uid())
  OR has_role(auth.uid(), 'hr_admin'::app_role)
  OR has_role(auth.uid(), 'hr_executive'::app_role)
);

-- 2. client_portal_access_log: block direct authenticated inserts; only service_role writes
DROP POLICY IF EXISTS "Authenticated can insert portal log" ON public.client_portal_access_log;
-- (service_role bypasses RLS by default; no policy needed for it)

-- 3. design-files storage bucket: role-scoped SELECT
DROP POLICY IF EXISTS "Authenticated can read design-files" ON storage.objects;
CREATE POLICY "Design roles can read design-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'design-files'
  AND (
    owner = auth.uid()
    OR user_has_any_role(auth.uid(), ARRAY[
      'super_admin'::app_role,
      'managing_director'::app_role,
      'chairman'::app_role,
      'architecture_director'::app_role,
      'head_operations'::app_role,
      'head_of_projects'::app_role,
      'principal_architect'::app_role,
      'senior_architect'::app_role,
      'project_architect'::app_role,
      'structural_architect'::app_role,
      'operations_architect'::app_role,
      'planning_head'::app_role,
      'planning_engineer'::app_role,
      'costing_engineer'::app_role,
      'quantity_surveyor'::app_role,
      'production_head'::app_role,
      'site_installation_mgr'::app_role,
      'site_engineer'::app_role
    ])
  )
);
