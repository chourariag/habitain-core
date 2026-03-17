-- Recreate projects RLS policies with direct profile role checks
DROP POLICY IF EXISTS "Authenticated can view projects" ON public.projects;
DROP POLICY IF EXISTS "Management can create projects" ON public.projects;
DROP POLICY IF EXISTS "Management can update projects" ON public.projects;
DROP POLICY IF EXISTS "Allow directors and engineers to create and view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow directors and engineers to view projects" ON public.projects;
DROP POLICY IF EXISTS "Allow all authenticated users to view projects" ON public.projects;

CREATE POLICY "Authenticated users can view projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allowed roles can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
);

CREATE POLICY "Allowed roles can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.auth_user_id = auth.uid()
      AND public.profiles.role IN (
        'managing_director'::public.app_role,
        'finance_director'::public.app_role,
        'sales_director'::public.app_role,
        'head_operations'::public.app_role,
        'planning_engineer'::public.app_role
      )
  )
);