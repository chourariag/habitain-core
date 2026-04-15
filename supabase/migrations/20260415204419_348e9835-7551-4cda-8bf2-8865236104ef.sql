
CREATE TABLE public.project_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  variation_number TEXT NOT NULL,
  description TEXT NOT NULL,
  scope_change_type TEXT NOT NULL DEFAULT 'Addition',
  linked_boq_item_id UUID,
  tender_qty NUMERIC DEFAULT 0,
  gfc_qty NUMERIC DEFAULT 0,
  variance_qty NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'nos',
  material_rate NUMERIC DEFAULT 0,
  labour_rate NUMERIC DEFAULT 0,
  basic_rate NUMERIC DEFAULT 0,
  margin_pct NUMERIC DEFAULT 30,
  margin_rate NUMERIC DEFAULT 0,
  final_rate NUMERIC DEFAULT 0,
  final_cost NUMERIC DEFAULT 0,
  margin_amount NUMERIC DEFAULT 0,
  initiated_by UUID,
  date_raised DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'Draft',
  scope_approved_by UUID,
  scope_approved_at TIMESTAMPTZ,
  finance_approved_by UUID,
  finance_approved_at TIMESTAMPTZ,
  md_approved_by UUID,
  md_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  supporting_doc_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view variations"
  ON public.project_variations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create variations"
  ON public.project_variations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Authenticated users can update variations"
  ON public.project_variations FOR UPDATE TO authenticated
  USING (true);

CREATE INDEX idx_project_variations_project ON public.project_variations(project_id);
CREATE INDEX idx_project_variations_status ON public.project_variations(status);

CREATE TRIGGER update_project_variations_updated_at
  BEFORE UPDATE ON public.project_variations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
