
-- 1) Storage: GFC-aware access on 'drawings' bucket, mirroring public.drawings SELECT RLS
DROP POLICY IF EXISTS "Authenticated can view drawings" ON storage.objects;

CREATE POLICY "Authenticated can view drawings"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'drawings'
  AND (
    public.is_director(auth.uid())
    OR public.user_has_any_role(
      auth.uid(),
      ARRAY['principal_architect','project_architect','structural_architect','planning_head','head_operations']::app_role[]
    )
    OR EXISTS (
      SELECT 1
      FROM public.drawings d
      WHERE (d.file_url LIKE '%' || storage.objects.name)
        AND (
          (
            COALESCE(d.drawing_type, '') !~~* 'gfc%'
            AND NOT ('gfc' = ANY(COALESCE(d.category_tags, ARRAY[]::text[])))
            AND NOT ('GFC' = ANY(COALESCE(d.category_tags, ARRAY[]::text[])))
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

-- 2) Profiles: explicitly revoke PII columns from anon/authenticated.
--    Personal/family data must only be reachable through SECURITY DEFINER RPCs
--    (get_my_profile_pii / get_profile_pii / get_employee_celebrations) that
--    enforce owner-or-HR checks.
REVOKE SELECT (phone, email, date_of_birth, wedding_anniversary, children, home_base)
  ON public.profiles FROM anon, authenticated;
