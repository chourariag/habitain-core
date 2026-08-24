-- Fix 1: dry-run-videos storage policies must match SITE_READINESS_SUBMIT_ROLES exactly.
DROP POLICY IF EXISTS "Operations can view dry-run-videos" ON storage.objects;
DROP POLICY IF EXISTS "Operations can upload dry-run-videos" ON storage.objects;

CREATE POLICY "Operations can view dry-run-videos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dry-run-videos'
    AND (
      owner = auth.uid()
      OR public.user_has_any_role(auth.uid(), ARRAY[
        'site_engineer','site_installation_mgr','delivery_rm_lead','head_operations','super_admin','managing_director'
      ]::app_role[])
    )
  );

CREATE POLICY "Operations can upload dry-run-videos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dry-run-videos'
    AND public.user_has_any_role(auth.uid(), ARRAY[
      'site_engineer','site_installation_mgr','delivery_rm_lead','head_operations','super_admin','managing_director'
    ]::app_role[])
  );

-- Fix 2: module_id is no longer populated on project-scoped site readiness checklists.
ALTER TABLE public.site_readiness ALTER COLUMN module_id DROP NOT NULL;