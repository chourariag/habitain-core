
-- 1. Default existing projects to 'modular' for construction_type
UPDATE public.projects SET construction_type = 'modular' WHERE construction_type IS NULL OR construction_type = '';

-- 2. New SOP-driven checklist definitions table
CREATE TABLE public.qc_checklist_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  construction_type text NOT NULL CHECK (construction_type IN ('modular','panelised','both')),
  stage_id text NOT NULL,
  stage_label text NOT NULL,
  item_order integer NOT NULL,
  check_category text,
  check_text text NOT NULL,
  standard_specification text,
  checked_by_role text,
  evidence_required text,
  pass_criteria text,
  severity text CHECK (severity IN ('Critical','Major','Minor') OR severity IS NULL),
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (construction_type, stage_id, item_order)
);

GRANT SELECT ON public.qc_checklist_definitions TO authenticated;
GRANT ALL ON public.qc_checklist_definitions TO service_role;

ALTER TABLE public.qc_checklist_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read QC SOP definitions"
  ON public.qc_checklist_definitions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors manage QC SOP definitions insert"
  ON public.qc_checklist_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_director(auth.uid()));

CREATE POLICY "Directors manage QC SOP definitions update"
  ON public.qc_checklist_definitions FOR UPDATE TO authenticated
  USING (public.is_director(auth.uid()));

CREATE POLICY "Directors manage QC SOP definitions delete"
  ON public.qc_checklist_definitions FOR DELETE TO authenticated
  USING (public.is_director(auth.uid()));

CREATE TRIGGER update_qc_checklist_definitions_updated_at
  BEFORE UPDATE ON public.qc_checklist_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_qc_def_lookup ON public.qc_checklist_definitions(construction_type, stage_id, item_order) WHERE is_active = true AND is_archived = false;

-- 3. Extend qc_inspections + qc_inspection_items to support SOP definitions and N/A
ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS construction_type text,
  ADD COLUMN IF NOT EXISTS stage_id text,
  ADD COLUMN IF NOT EXISTS stage_label text,
  ADD COLUMN IF NOT EXISTS sop_pass_count integer,
  ADD COLUMN IF NOT EXISTS sop_fail_count integer,
  ADD COLUMN IF NOT EXISTS sop_na_count integer;

ALTER TABLE public.qc_inspection_items
  ADD COLUMN IF NOT EXISTS definition_id uuid REFERENCES public.qc_checklist_definitions(id),
  ADD COLUMN IF NOT EXISTS check_text_snapshot text,
  ADD COLUMN IF NOT EXISTS severity_snapshot text;

-- existing checklist_item_id is NOT NULL; relax so new SOP-driven items don't need it
ALTER TABLE public.qc_inspection_items ALTER COLUMN checklist_item_id DROP NOT NULL;

-- broaden result to include 'na'; no enum used, so this is informational
