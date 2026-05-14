ALTER TABLE public.project_variations
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_project_variations_active
  ON public.project_variations (project_id, variation_number)
  WHERE is_deleted = false;