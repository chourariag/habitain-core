
-- 1) kpi_tracked_employees: restrict reads to directors + self
DROP POLICY IF EXISTS tracked_emp_read ON public.kpi_tracked_employees;
CREATE POLICY tracked_emp_read ON public.kpi_tracked_employees
  FOR SELECT TO authenticated
  USING (
    public.is_director(auth.uid())
    OR public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','hr_executive']::app_role[])
    OR user_id = auth.uid()
  );

-- 2) profiles: revoke broad SELECT, grant only safe columns
REVOKE SELECT ON public.profiles FROM authenticated, anon, PUBLIC;
GRANT SELECT (
  id, auth_user_id, display_name, role, language, reporting_manager_id,
  is_active, login_type, is_archived, created_at, updated_at, avatar_url,
  onboarding_completed, onboarding_completed_at, onboarding_quiz_scores,
  department, secondary_manager_id
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 3) projects: revoke direct SELECT on sensitive client columns
REVOKE SELECT (client_phone, client_email, client_portal_token) ON public.projects FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.projects TO service_role;

-- 4) Storage: chat-media — restrict reads to uploader, directors, and project team members
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
CREATE POLICY "Project members can view chat media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      owner = auth.uid()
      OR public.is_director(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.project_team_members ptm
        JOIN public.profiles pr ON pr.id = ptm.profile_id
        WHERE pr.auth_user_id = auth.uid()
          AND ptm.project_id::text = (storage.foldername(name))[1]
      )
    )
  );

-- 5) Storage: dry-run-videos — restrict both SELECT and INSERT
DROP POLICY IF EXISTS "Authenticated can view dry-run-videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dry-run-videos" ON storage.objects;
CREATE POLICY "Operations can view dry-run-videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dry-run-videos'
    AND (
      owner = auth.uid()
      OR public.user_has_any_role(auth.uid(), ARRAY[
        'super_admin','managing_director','finance_director','sales_director','architecture_director',
        'head_operations','production_head','site_installation_mgr','qc_inspector','factory_floor_supervisor'
      ]::app_role[])
    )
  );
CREATE POLICY "Operations can upload dry-run-videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dry-run-videos'
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','head_operations','production_head','site_installation_mgr','qc_inspector','factory_floor_supervisor'
    ]::app_role[])
  );

-- 6) Storage: rm-media — restrict SELECT/INSERT to R&M roles
DROP POLICY IF EXISTS "Authenticated users can read rm-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload rm-media" ON storage.objects;
CREATE POLICY "RM roles can view rm-media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rm-media'
    AND (
      owner = auth.uid()
      OR public.user_has_any_role(auth.uid(), ARRAY[
        'super_admin','managing_director','finance_director','sales_director','architecture_director',
        'head_operations','production_head','site_installation_mgr','site_engineer','qc_inspector',
        'principal_architect','project_architect'
      ]::app_role[])
    )
  );
CREATE POLICY "RM roles can upload rm-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rm-media'
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'super_admin','managing_director','head_operations','production_head','site_installation_mgr','site_engineer','qc_inspector',
      'principal_architect','project_architect'
    ]::app_role[])
  );

-- 7) Storage: voice-notes — restrict reads to uploader, directors, and design roles
DROP POLICY IF EXISTS "Authenticated can view voice-notes" ON storage.objects;
CREATE POLICY "Design roles can view voice-notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (
      owner = auth.uid()
      OR public.user_has_any_role(auth.uid(), ARRAY[
        'super_admin','managing_director','finance_director','sales_director','architecture_director',
        'head_operations','principal_architect','project_architect','structural_architect',
        'planning_head','planning_engineer','operations_architect'
      ]::app_role[])
    )
  );
