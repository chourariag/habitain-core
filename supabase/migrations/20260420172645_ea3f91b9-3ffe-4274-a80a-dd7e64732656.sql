DROP VIEW IF EXISTS public.v_latest_panel_handover;

CREATE VIEW public.v_latest_panel_handover
WITH (security_invoker = true) AS
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