-- Phase 2 Hybrid Production System: support override of Panel→Module dependency lock

ALTER TABLE public.panel_handovers
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS overridden_by uuid,
  ADD COLUMN IF NOT EXISTS overridden_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_panel_handovers_project_status
  ON public.panel_handovers(project_id, status);

-- Helper view: latest panel handover per project (used by Module Bay lock UI)
CREATE OR REPLACE VIEW public.v_latest_panel_handover AS
SELECT DISTINCT ON (project_id)
  project_id,
  id AS handover_id,
  panel_batch_id,
  source_panel_bay,
  target_module_bay,
  status,
  ready_at,
  received_at,
  override_reason,
  overridden_by,
  overridden_at
FROM public.panel_handovers
WHERE project_id IS NOT NULL
ORDER BY project_id, ready_at DESC NULLS LAST, created_at DESC;