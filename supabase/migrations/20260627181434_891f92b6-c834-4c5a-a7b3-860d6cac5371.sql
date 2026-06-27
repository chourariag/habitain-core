
CREATE POLICY "project_archives_read_leadership"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-archives'
    AND public.get_user_role(auth.uid())::text = ANY (ARRAY[
      'managing_director','super_admin','finance_director','head_of_projects',
      'planning_head','sales_director','principal_architect','planning_engineer'
    ])
  );

CREATE POLICY "project_archives_service_write"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'project-archives');
