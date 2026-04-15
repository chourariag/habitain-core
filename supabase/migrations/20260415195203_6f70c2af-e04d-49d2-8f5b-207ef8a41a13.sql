
CREATE TABLE public.project_revenue_margin (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  original_valuation NUMERIC NOT NULL DEFAULT 0,
  expected_final_cost NUMERIC NOT NULL DEFAULT 0,
  anticipated_delivery_date DATE NULL,
  anticipated_handover_date DATE NULL,
  expected_variations NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NULL,
  tender_margin_pct NUMERIC NULL,
  gfc_margin_pct NUMERIC NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_revenue_margin ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view revenue margin"
  ON public.project_revenue_margin FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Finance and directors can insert revenue margin"
  ON public.project_revenue_margin FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'finance_manager'
    )
  );

CREATE POLICY "Finance and directors can update revenue margin"
  ON public.project_revenue_margin FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN (
      'super_admin', 'managing_director', 'finance_director', 'finance_manager'
    )
  );

CREATE POLICY "Only MD can delete revenue margin"
  ON public.project_revenue_margin FOR DELETE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('super_admin', 'managing_director')
  );

CREATE TRIGGER update_revenue_margin_updated_at
  BEFORE UPDATE ON public.project_revenue_margin
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_revenue_margin_project ON public.project_revenue_margin(project_id);
