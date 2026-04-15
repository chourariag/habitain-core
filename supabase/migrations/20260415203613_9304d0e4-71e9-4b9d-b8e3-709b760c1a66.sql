
-- Material plan headers (one per project per upload version)
CREATE TABLE public.project_material_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  version INT NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_material_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view material plans"
  ON public.project_material_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert material plans"
  ON public.project_material_plans FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_material_plans_project ON public.project_material_plans(project_id);

-- Material plan line items
CREATE TABLE public.project_material_plan_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID REFERENCES public.project_material_plans(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT 'Shell and Core',
  material_description TEXT NOT NULL,
  qty_variation_note TEXT,
  tender_qty NUMERIC,
  unit TEXT,
  gfc_qty NUMERIC,
  indent_qty NUMERIC,
  indent_unit TEXT,
  indent_received TEXT DEFAULT 'N',
  material_qty_ordered NUMERIC,
  planned_po_release_date DATE,
  planned_procurement_date DATE,
  planned_delivery_date DATE,
  actual_po_release_date DATE,
  actual_procurement_date DATE,
  supplier_committed_date DATE,
  actual_delivery_date DATE,
  material_qty_received NUMERIC,
  delay_days INT DEFAULT 0,
  reason_for_delay TEXT,
  status TEXT NOT NULL DEFAULT 'Upcoming',
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_material_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view material plan items"
  ON public.project_material_plan_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert material plan items"
  ON public.project_material_plan_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update material plan items"
  ON public.project_material_plan_items FOR UPDATE TO authenticated USING (true);

CREATE INDEX idx_material_plan_items_plan ON public.project_material_plan_items(plan_id);

CREATE TRIGGER update_material_plan_items_updated_at
  BEFORE UPDATE ON public.project_material_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
