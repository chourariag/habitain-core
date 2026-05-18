-- === 20260320173632_f3de5d67-ad84-4705-9067-2ae45024ca84.sql ===

-- Create rm-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('rm-media', 'rm-media', true);

-- Allow authenticated users to upload to rm-media
CREATE POLICY "Authenticated users can upload rm-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rm-media');

-- Allow authenticated users to read rm-media
CREATE POLICY "Authenticated users can read rm-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rm-media');

-- === 20260320181712_fdf52b54-7a1f-4131-b540-e13adfb953d5.sql ===

CREATE TABLE public.sales_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  contact_number text,
  email text,
  project_type text NOT NULL DEFAULT 'Other',
  temperature text NOT NULL DEFAULT 'warm',
  lead_source text DEFAULT 'Other',
  estimated_sqft numeric,
  contract_value numeric NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'Inquiry',
  assigned_to uuid,
  next_followup_date date,
  notes text,
  amc_interest text DEFAULT 'not_discussed',
  lost_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false
);

ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_deals" ON public.sales_deals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_deals" ON public.sales_deals
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE POLICY "Sales roles can update sales_deals" ON public.sales_deals
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE TABLE public.sales_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_stage_history" ON public.sales_stage_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_stage_history" ON public.sales_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

CREATE TABLE public.sales_amc_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  contacted_by uuid,
  notes text,
  followup_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_amc_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales_amc_contacts" ON public.sales_amc_contacts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sales roles can insert sales_amc_contacts" ON public.sales_amc_contacts
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director'));

-- === 20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql ===

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

-- === 20260320202509_8a852d95-18f1-447f-88f8-2fad172246f4.sql ===

-- attendance_records
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz,
  check_out_time timestamptz,
  location_type text NOT NULL DEFAULT 'office',
  project_id uuid REFERENCES public.projects(id),
  gps_lat numeric,
  gps_lng numeric,
  gps_verified boolean DEFAULT false,
  remote_reason text,
  hours_worked numeric,
  is_manual_override boolean DEFAULT false,
  override_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own attendance" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','hr_executive','finance_manager','head_operations','production_head')
  );

CREATE POLICY "Users can insert own attendance" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive'));

CREATE POLICY "HR can update attendance" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive'));

-- leave_requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days_count numeric NOT NULL DEFAULT 1,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  rejection_reason text,
  requested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','finance_director','sales_director','architecture_director','hr_executive','finance_manager','head_operations','production_head')
  );

CREATE POLICY "Users can insert own leave" ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "HR and managers can update leave" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','head_operations','production_head')
  );

-- app_settings
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (is_full_admin(auth.uid()))
  WITH CHECK (is_full_admin(auth.uid()));

-- Pre-seed factory coordinates
INSERT INTO public.app_settings (key, value) VALUES ('factory_lat', ''), ('factory_lng', '');

-- attendance_exports
CREATE TABLE public.attendance_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL,
  year integer NOT NULL,
  generated_by uuid,
  sent_to_finance_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.attendance_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR and finance can manage exports" ON public.attendance_exports
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','finance_manager'))
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive','finance_manager'));

-- === 20260320204513_4f37e4a1-8a5f-40fa-9cae-51be024eba13.sql ===

-- Add columns to attendance_records
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS offline_captured boolean DEFAULT false;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- Add site GPS columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lat numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_lng numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS site_radius integer DEFAULT 300;

-- Pre-seed factory GPS settings if not exist
INSERT INTO public.app_settings (key, value) VALUES ('factory_lat', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('factory_lng', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value) VALUES ('factory_radius', '200') ON CONFLICT (key) DO NOTHING;

-- === 20260322032508_04b74744-fd56-4e76-a61c-a72deb8b648a.sql ===

CREATE TABLE public.expense_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  description text NOT NULL,
  receipt_url text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending_costing',
  stage1_approved_by uuid,
  stage1_approved_at timestamptz,
  stage1_note text,
  stage2_approved_by uuid,
  stage2_approved_at timestamptz,
  rejection_reason text,
  budget_flag boolean DEFAULT false,
  budget_overrun_amount numeric,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

-- Everyone can see own expenses
CREATE POLICY "Users can view own expenses" ON public.expense_reports
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'hr_executive', 'finance_manager', 'costing_engineer', 'production_head', 'head_operations')
  );

-- Any non-architect authenticated user can submit
CREATE POLICY "Users can insert own expenses" ON public.expense_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND get_user_role(auth.uid()) NOT IN ('principal_architect', 'project_architect', 'structural_architect')
  );

-- Approval roles can update
CREATE POLICY "Approval roles can update expenses" ON public.expense_reports
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'costing_engineer', 'production_head', 'head_operations', 'finance_manager', 'accounts_executive')
  );

-- === 20260323011505_bbe52245-ec14-4f50-8f47-b868af8d43ad.sql ===

-- 1) Create expense_entries table
CREATE TABLE IF NOT EXISTS public.expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  expense_type text NOT NULL DEFAULT 'regular',
  category text,
  amount numeric NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id),
  description text,
  receipt_url text,
  vehicle_type text,
  from_location text,
  to_location text,
  distance_km numeric,
  rate_per_km numeric,
  status text NOT NULL DEFAULT 'draft',
  hr_reviewed_by uuid,
  hr_reviewed_at timestamptz,
  hr_flag_note text,
  hr_flag_response text,
  hod_approved_by uuid,
  hod_approved_at timestamptz,
  finance_paid_by uuid,
  finance_paid_at timestamptz,
  rejection_reason text,
  budget_flag boolean DEFAULT false,
  report_period text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;

-- Employee sees own
CREATE POLICY "Users see own expense entries" ON public.expense_entries
  FOR SELECT TO authenticated
  USING (
    submitted_by = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'hr_executive', 'finance_manager')
    OR (status = 'pending_hod' AND get_user_role(auth.uid()) IN ('production_head', 'head_operations'))
  );

CREATE POLICY "Users insert own expense entries" ON public.expense_entries
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Authorized update expense entries" ON public.expense_entries
  FOR UPDATE TO authenticated
  USING (
    submitted_by = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'sales_director', 'architecture_director', 'hr_executive', 'finance_manager', 'production_head', 'head_operations')
  );

CREATE POLICY "Users delete own draft expense entries" ON public.expense_entries
  FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND status = 'draft');

-- 2) Create hr_settings table
CREATE TABLE IF NOT EXISTS public.hr_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  proposed_value text,
  proposed_by uuid,
  effective_date date,
  approval1_by uuid,
  approval1_at timestamptz,
  approval2_by uuid,
  approval2_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hr_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read hr_settings" ON public.hr_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR can insert hr_settings" ON public.hr_settings
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'hr_executive'));

CREATE POLICY "HR and directors update hr_settings" ON public.hr_settings
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) IN ('super_admin', 'managing_director', 'finance_director', 'hr_executive'));

-- Pre-seed hr_settings
INSERT INTO public.hr_settings (key, value, status) VALUES
  ('car_rate_per_km', '9.5', 'active'),
  ('bike_rate_per_km', '3.5', 'active')
ON CONFLICT (key) DO NOTHING;

-- 3) Add profile fields if not exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_base text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wedding_anniversary date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS children jsonb;

-- 4) Add misc_budget to finance_project_budgets
ALTER TABLE public.finance_project_budgets ADD COLUMN IF NOT EXISTS misc_budget numeric DEFAULT 0;

-- === 20260325175554_1c05bc99-5825-498c-a962-b7816328ce7e.sql ===

-- KPI Definitions table
CREATE TABLE public.kpi_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  kpi_name text NOT NULL,
  kpi_key text NOT NULL UNIQUE,
  target_value numeric,
  unit text NOT NULL DEFAULT '%',
  measurement_period text NOT NULL DEFAULT 'weekly',
  data_source_table text,
  data_source_query text,
  coaching_template_below text,
  coaching_template_above text,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated read kpi_definitions" ON public.kpi_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Directors can insert kpi_definitions" ON public.kpi_definitions
  FOR INSERT TO authenticated WITH CHECK (is_director(auth.uid()));

CREATE POLICY "Directors can update kpi_definitions" ON public.kpi_definitions
  FOR UPDATE TO authenticated USING (is_director(auth.uid()));

-- KPI Snapshots table
CREATE TABLE public.kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  kpi_key text NOT NULL,
  target_value numeric,
  actual_value numeric,
  score integer DEFAULT 0,
  status text NOT NULL DEFAULT 'no_data',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own kpi_snapshots" ON public.kpi_snapshots
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_director(auth.uid())
    OR is_full_admin(auth.uid())
    OR (
      get_user_role(auth.uid()) IN ('production_head', 'head_operations', 'finance_manager', 'sales_director', 'architecture_director')
    )
  );

CREATE POLICY "System can insert kpi_snapshots" ON public.kpi_snapshots
  FOR INSERT TO authenticated WITH CHECK (true);

-- Weekly Digests table
CREATE TABLE public.weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  overall_score integer DEFAULT 0,
  wins jsonb DEFAULT '[]'::jsonb,
  focus_areas jsonb DEFAULT '[]'::jsonb,
  digest_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own weekly_digests" ON public.weekly_digests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_director(auth.uid()));

CREATE POLICY "System can insert weekly_digests" ON public.weekly_digests
  FOR INSERT TO authenticated WITH CHECK (true);

-- KPI Targets History table
CREATE TABLE public.kpi_targets_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_key text NOT NULL,
  role app_role NOT NULL,
  old_target numeric,
  new_target numeric,
  changed_by uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

ALTER TABLE public.kpi_targets_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors can view kpi_targets_history" ON public.kpi_targets_history
  FOR SELECT TO authenticated USING (is_director(auth.uid()));

CREATE POLICY "Directors can insert kpi_targets_history" ON public.kpi_targets_history
  FOR INSERT TO authenticated WITH CHECK (is_director(auth.uid()));

