
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS gfc_h3_approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gfc_h3_approved_at TIMESTAMPTZ;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_setup_approved BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.stage_wastage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  stage_name TEXT NOT NULL,
  material_category TEXT,
  qty_issued NUMERIC NOT NULL DEFAULT 0,
  qty_consumed NUMERIC NOT NULL DEFAULT 0,
  wastage_qty NUMERIC GENERATED ALWAYS AS (GREATEST(qty_issued - qty_consumed, 0)) STORED,
  wastage_percent NUMERIC GENERATED ALWAYS AS (
    CASE WHEN qty_issued > 0 THEN ROUND(((qty_issued - qty_consumed) / qty_issued) * 100, 2) ELSE 0 END
  ) STORED,
  notes TEXT,
  flag_level TEXT NOT NULL DEFAULT 'green',
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.stage_wastage TO authenticated;
GRANT ALL ON public.stage_wastage TO service_role;

ALTER TABLE public.stage_wastage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view stage wastage"
  ON public.stage_wastage FOR SELECT TO authenticated USING (true);

CREATE POLICY "Production can record stage wastage"
  ON public.stage_wastage FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','head_operations','production_head','factory_floor_supervisor']::app_role[]));

CREATE POLICY "Production heads can update stage wastage"
  ON public.stage_wastage FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(),
    ARRAY['super_admin','managing_director','head_operations','production_head']::app_role[]));

CREATE TRIGGER update_stage_wastage_updated_at
  BEFORE UPDATE ON public.stage_wastage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_stage_wastage_project ON public.stage_wastage(project_id);
CREATE INDEX IF NOT EXISTS idx_stage_wastage_module ON public.stage_wastage(module_id);
