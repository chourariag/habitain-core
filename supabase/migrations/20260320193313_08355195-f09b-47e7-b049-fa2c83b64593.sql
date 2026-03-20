
-- Finance MIS uploads
CREATE TABLE public.finance_mis_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label text NOT NULL,
  upload_date date NOT NULL DEFAULT CURRENT_DATE,
  uploaded_by uuid NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  ads_split jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_mis_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view MIS" ON public.finance_mis_uploads FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert MIS" ON public.finance_mis_uploads FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can update MIS" ON public.finance_mis_uploads FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Ledger mappings
CREATE TABLE public.ledger_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_name text NOT NULL UNIQUE,
  mis_category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ledger_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view ledger_mappings" ON public.ledger_mappings FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert ledger_mappings" ON public.ledger_mappings FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can update ledger_mappings" ON public.ledger_mappings FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- P&L monthly data
CREATE TABLE public.finance_pl_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  revenue numeric DEFAULT 0,
  materials numeric DEFAULT 0,
  labour numeric DEFAULT 0,
  logistics numeric DEFAULT 0,
  other_cogs numeric DEFAULT 0,
  office_admin numeric DEFAULT 0,
  marketing numeric DEFAULT 0,
  rm_costs numeric DEFAULT 0,
  depreciation numeric DEFAULT 0,
  other_opex numeric DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);
ALTER TABLE public.finance_pl_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view PL" ON public.finance_pl_data FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert PL" ON public.finance_pl_data FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can update PL" ON public.finance_pl_data FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Cash flow entries
CREATE TABLE public.finance_cashflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'inflow',
  description text,
  project_name text,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Other',
  entered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_cashflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view cashflow" ON public.finance_cashflow FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert cashflow" ON public.finance_cashflow FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Cash flow opening balances
CREATE TABLE public.finance_cashflow_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);
ALTER TABLE public.finance_cashflow_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view balances" ON public.finance_cashflow_balances FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can manage balances" ON public.finance_cashflow_balances FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive')) WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Project cash flow uploads
CREATE TABLE public.finance_project_cashflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  inflow_client_payment numeric DEFAULT 0,
  inflow_advance numeric DEFAULT 0,
  inflow_retention numeric DEFAULT 0,
  inflow_other numeric DEFAULT 0,
  outflow_materials numeric DEFAULT 0,
  outflow_labour numeric DEFAULT 0,
  outflow_logistics numeric DEFAULT 0,
  outflow_subcontract numeric DEFAULT 0,
  outflow_admin numeric DEFAULT 0,
  outflow_other numeric DEFAULT 0,
  notes text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_name, month, year)
);
ALTER TABLE public.finance_project_cashflow ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view project cashflow" ON public.finance_project_cashflow FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert project cashflow" ON public.finance_project_cashflow FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Project budgets
CREATE TABLE public.finance_project_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  sanctioned_budget numeric DEFAULT 0,
  labour_budget numeric DEFAULT 0,
  logistics_budget numeric DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_project_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view budgets" ON public.finance_project_budgets FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert budgets" ON public.finance_project_budgets FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can update budgets" ON public.finance_project_budgets FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Payment milestones
CREATE TABLE public.finance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name text NOT NULL,
  client_name text NOT NULL,
  milestone_description text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  entered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view payments" ON public.finance_payments FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can insert payments" ON public.finance_payments FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can update payments" ON public.finance_payments FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));

-- Statutory filings
CREATE TABLE public.finance_statutory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_type text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_statutory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Finance roles can view statutory" ON public.finance_statutory FOR SELECT TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive'));
CREATE POLICY "Finance roles can manage statutory" ON public.finance_statutory FOR ALL TO authenticated USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive')) WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','finance_manager','accounts_executive'));
