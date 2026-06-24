
-- 1. Lock down sensitive columns on public.projects.
-- Table-level grants override column REVOKEs, so we revoke table SELECT and
-- re-grant SELECT only on non-sensitive columns. Sensitive columns
-- (client_phone, client_email, client_portal_token) remain accessible only
-- via the existing security-definer RPCs.
REVOKE SELECT ON public.projects FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id, name, client_name, location, type, status, start_date, est_completion,
  created_by, created_at, updated_at, updated_by, is_archived,
  construction_type, site_lat, site_lng, site_radius, division,
  is_design_only, site_ready_confirmed, wip_start_date, wip_close_date, wip_status,
  gfc_budget, planned_labour_cost,
  client_portal_enabled, client_portal_expires_at, client_portal_status_message,
  milestones_locked, production_system, archived_at, archive_reason,
  contract_value, gfc_budget_total, actually_spent,
  site_schedule_unlocked_at, site_schedule_notified_at, site_schedule_escalated_at,
  setup_uploaded_at, setup_uploaded_by_name,
  module_count, panel_count, project_type
) ON public.projects TO authenticated;

-- Preserve write privileges for authenticated (RLS policies still gate rows).
GRANT INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

-- 2. Storage: chat-media DELETE/UPDATE policies
DROP POLICY IF EXISTS "chat-media owner or director can delete" ON storage.objects;
CREATE POLICY "chat-media owner or director can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (owner = auth.uid() OR public.is_director(auth.uid()))
);

DROP POLICY IF EXISTS "chat-media owner or director can update" ON storage.objects;
CREATE POLICY "chat-media owner or director can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (owner = auth.uid() OR public.is_director(auth.uid()))
)
WITH CHECK (
  bucket_id = 'chat-media'
  AND (owner = auth.uid() OR public.is_director(auth.uid()))
);

-- 3. Storage: qc-photos, site-photos, safety-photos — admin/director-only DELETE & UPDATE
DROP POLICY IF EXISTS "evidence photos directors can delete" ON storage.objects;
CREATE POLICY "evidence photos directors can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('qc-photos', 'site-photos', 'safety-photos')
  AND public.is_director(auth.uid())
);

DROP POLICY IF EXISTS "evidence photos directors can update" ON storage.objects;
CREATE POLICY "evidence photos directors can update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('qc-photos', 'site-photos', 'safety-photos')
  AND public.is_director(auth.uid())
)
WITH CHECK (
  bucket_id IN ('qc-photos', 'site-photos', 'safety-photos')
  AND public.is_director(auth.uid())
);
