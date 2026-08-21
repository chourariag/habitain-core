CREATE TABLE public.finance_audited_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_label text NOT NULL,
  statement text NOT NULL CHECK (statement IN ('pl','bs')),
  section text NOT NULL,
  line_label text NOT NULL,
  note_no text,
  amount_current numeric,
  amount_previous numeric,
  units_source text NOT NULL DEFAULT 'lakhs',
  sort_order integer NOT NULL DEFAULT 0,
  is_total boolean NOT NULL DEFAULT false,
  source_file text,
  auditor_firm text,
  signed_date date,
  is_confirmed boolean NOT NULL DEFAULT false,
  confirmed_by uuid,
  confirmed_at timestamptz,
  confirmation_note text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fy_label, statement, line_label)
);

GRANT SELECT, INSERT, UPDATE ON public.finance_audited_financials TO authenticated;
GRANT ALL ON public.finance_audited_financials TO service_role;

ALTER TABLE public.finance_audited_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance tier can view audited financials"
ON public.finance_audited_financials FOR SELECT TO authenticated
USING (public.is_finance_full_tier(auth.uid()) OR public.has_role(auth.uid(), 'finance_manager') OR public.has_role(auth.uid(), 'accounts_executive'));

CREATE POLICY "Finance leadership can insert audited financials"
ON public.finance_audited_financials FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'finance_director') OR public.has_role(auth.uid(), 'managing_director') OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Finance leadership can update audited financials"
ON public.finance_audited_financials FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'finance_director') OR public.has_role(auth.uid(), 'managing_director') OR public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'finance_director') OR public.has_role(auth.uid(), 'managing_director') OR public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_finance_audited_financials_updated_at
BEFORE UPDATE ON public.finance_audited_financials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();