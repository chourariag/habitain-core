
CREATE TABLE public.project_tender_budget (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  deal_id UUID,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_tender_value NUMERIC DEFAULT 0,
  tender_margin_pct NUMERIC DEFAULT 0,
  quotation_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tender_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tender budgets"
  ON public.project_tender_budget FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tender budgets"
  ON public.project_tender_budget FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can update tender budgets"
  ON public.project_tender_budget FOR UPDATE TO authenticated USING (true);

CREATE TABLE public.project_tender_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.project_tender_budget(id) ON DELETE CASCADE,
  category TEXT,
  description TEXT,
  tender_qty NUMERIC DEFAULT 0,
  unit TEXT,
  material_rate NUMERIC DEFAULT 0,
  labour_rate NUMERIC DEFAULT 0,
  oh_rate NUMERIC DEFAULT 0,
  total_rate NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  margin_pct NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tender_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tender budget items"
  ON public.project_tender_budget_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create tender budget items"
  ON public.project_tender_budget_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE TRIGGER update_project_tender_budget_updated_at
  BEFORE UPDATE ON public.project_tender_budget
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
