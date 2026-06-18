
DROP POLICY IF EXISTS "Authenticated users can update installation_checklist" ON public.installation_checklist;
CREATE POLICY "Site/ops can update installation_checklist"
ON public.installation_checklist
FOR UPDATE
TO authenticated
USING (
  public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer']::public.app_role[])
  OR submitted_by = auth.uid()::text
)
WITH CHECK (
  public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer']::public.app_role[])
  OR submitted_by = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can manage handover checklists" ON public.sales_handover_checklists;
DROP POLICY IF EXISTS "Authenticated users can view handover checklists" ON public.sales_handover_checklists;

DROP POLICY IF EXISTS "Authenticated users can upload drawings" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload design-files" ON storage.objects;

CREATE POLICY "Architects/directors can upload drawings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'drawings'
  AND public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','architecture_director','principal_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::public.app_role[]
  )
);

CREATE POLICY "Architects/directors can upload design-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'design-files'
  AND public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','architecture_director','principal_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::public.app_role[]
  )
);
