-- Phase 1: Project Budget Tracking
-- 1) GRN (Goods Receipt Notes) header table — tagged at header level to one BOQ category
CREATE TABLE public.project_grns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  boq_category TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  invoice_no TEXT,
  invoice_date DATE,
  description TEXT,
  basic_amount_excl_gst NUMERIC NOT NULL DEFAULT 0,
  gst_amount NUMERIC DEFAULT 0,
  remark TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_grns_project ON public.project_grns(project_id);
CREATE INDEX idx_project_grns_category ON public.project_grns(project_id, boq_category);

ALTER TABLE public.project_grns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view GRNs"
  ON public.project_grns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert GRNs"
  ON public.project_grns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update GRNs"
  ON public.project_grns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Directors can delete GRNs"
  ON public.project_grns FOR DELETE TO authenticated
  USING (public.is_director(auth.uid()));

CREATE TRIGGER trg_project_grns_updated_at
  BEFORE UPDATE ON public.project_grns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Manual budget entries (labour payments, direct purchases not on a GRN)
CREATE TABLE public.project_budget_manual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  boq_category TEXT NOT NULL,
  vendor_name TEXT,
  invoice_no TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  amount_excl_gst NUMERIC NOT NULL DEFAULT 0,
  remark TEXT,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_budget_manual_project ON public.project_budget_manual_entries(project_id);

ALTER TABLE public.project_budget_manual_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view manual budget entries"
  ON public.project_budget_manual_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert manual budget entries"
  ON public.project_budget_manual_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update manual budget entries"
  ON public.project_budget_manual_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Directors can delete manual budget entries"
  ON public.project_budget_manual_entries FOR DELETE TO authenticated
  USING (public.is_director(auth.uid()));

CREATE TRIGGER trg_project_budget_manual_updated_at
  BEFORE UPDATE ON public.project_budget_manual_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();