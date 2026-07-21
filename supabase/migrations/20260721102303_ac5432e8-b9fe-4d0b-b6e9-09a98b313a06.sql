
DROP POLICY IF EXISTS "All authenticated view quotations" ON public.quotations;
CREATE POLICY "Scoped view quotations" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    is_director(auth.uid())
    OR user_has_any_role(auth.uid(), ARRAY[
      'super_admin'::app_role,
      'managing_director'::app_role,
      'head_of_projects'::app_role,
      'head_operations'::app_role,
      'architecture_director'::app_role,
      'principal_architect'::app_role,
      'project_architect'::app_role,
      'structural_architect'::app_role,
      'operations_architect'::app_role,
      'planning_head'::app_role,
      'planning_engineer'::app_role,
      'finance_director'::app_role,
      'finance_manager'::app_role,
      'sales_director'::app_role,
      'sales_executive'::app_role,
      'sales_associate'::app_role,
      'marketing'::app_role
    ])
  );

ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS storage_path text;
UPDATE public.drawings
SET storage_path = regexp_replace(file_url, '^.*/storage/v1/object/(?:public|sign)/drawings/', '')
WHERE storage_path IS NULL AND file_url ~ '/drawings/';
CREATE INDEX IF NOT EXISTS drawings_storage_path_idx ON public.drawings(storage_path);

DROP POLICY IF EXISTS "Authenticated can view drawings" ON storage.objects;
CREATE POLICY "Authenticated can view drawings" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'drawings' AND (
      is_director(auth.uid())
      OR user_has_any_role(auth.uid(), ARRAY[
        'principal_architect'::app_role,
        'project_architect'::app_role,
        'structural_architect'::app_role,
        'planning_head'::app_role,
        'head_operations'::app_role
      ])
      OR EXISTS (
        SELECT 1 FROM public.drawings d
        WHERE d.storage_path = storage.objects.name
          AND (
            (COALESCE(d.drawing_type,'') !~~* 'gfc%'
              AND NOT ('gfc' = ANY (COALESCE(d.category_tags, ARRAY[]::text[])))
              AND NOT ('GFC' = ANY (COALESCE(d.category_tags, ARRAY[]::text[])))
            )
            OR EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = d.project_id
                AND COALESCE(p.project_setup_approved, false) = true
            )
          )
      )
    )
  );
