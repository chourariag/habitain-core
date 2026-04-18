-- Helper: who can manage finance P&L uploads
CREATE OR REPLACE FUNCTION public.can_manage_finance_pl(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive','head_operations')
  )
$$;

CREATE TABLE public.profit_loss_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_cogs NUMERIC NOT NULL DEFAULT 0,
  total_direct_expenses NUMERIC NOT NULL DEFAULT 0,
  total_indirect_expenses NUMERIC NOT NULL DEFAULT 0,
  total_other_income NUMERIC NOT NULL DEFAULT 0,
  gross_profit NUMERIC NOT NULL DEFAULT 0,
  gross_profit_pct NUMERIC NOT NULL DEFAULT 0,
  net_profit_loss NUMERIC NOT NULL DEFAULT 0,
  net_margin_pct NUMERIC NOT NULL DEFAULT 0,
  is_loss BOOLEAN NOT NULL DEFAULT false,
  is_current BOOLEAN NOT NULL DEFAULT true,
  source_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_uploads_fy ON public.profit_loss_uploads(financial_year, uploaded_at DESC);
CREATE INDEX idx_pl_uploads_current ON public.profit_loss_uploads(financial_year) WHERE is_current = true;

CREATE TABLE public.profit_loss_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES public.profit_loss_uploads(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('income','expense')),
  section_name TEXT NOT NULL,
  hstack_category TEXT,
  account_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_subtotal BOOLEAN NOT NULL DEFAULT false,
  is_section_header BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_lines_upload ON public.profit_loss_line_items(upload_id, display_order);

ALTER TABLE public.profit_loss_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_loss_line_items ENABLE ROW LEVEL SECURITY;

-- Uploads policies
CREATE POLICY "Authenticated can view P&L uploads"
ON public.profit_loss_uploads FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Finance managers can insert P&L uploads"
ON public.profit_loss_uploads FOR INSERT
TO authenticated WITH CHECK (public.can_manage_finance_pl(auth.uid()));

CREATE POLICY "Finance managers can update P&L uploads"
ON public.profit_loss_uploads FOR UPDATE
TO authenticated USING (public.can_manage_finance_pl(auth.uid()));

CREATE POLICY "Finance managers can delete P&L uploads"
ON public.profit_loss_uploads FOR DELETE
TO authenticated USING (public.can_manage_finance_pl(auth.uid()));

-- Line items policies
CREATE POLICY "Authenticated can view P&L line items"
ON public.profit_loss_line_items FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Finance managers can insert P&L line items"
ON public.profit_loss_line_items FOR INSERT
TO authenticated WITH CHECK (public.can_manage_finance_pl(auth.uid()));

CREATE POLICY "Finance managers can update P&L line items"
ON public.profit_loss_line_items FOR UPDATE
TO authenticated USING (public.can_manage_finance_pl(auth.uid()));

CREATE POLICY "Finance managers can delete P&L line items"
ON public.profit_loss_line_items FOR DELETE
TO authenticated USING (public.can_manage_finance_pl(auth.uid()));