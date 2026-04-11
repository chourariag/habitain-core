-- =====================================================================
-- COMPREHENSIVE MISSING TABLES MIGRATION
-- Adds all tables required by the full QC audit
-- =====================================================================

-- ── Punch List ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.punch_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  module_id uuid,
  description text NOT NULL,
  raised_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'open', -- open | resolved | waived
  resolved_at timestamptz,
  waived_reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.punch_list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access punch_list_items" ON public.punch_list_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Site-to-Factory Feedback ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_factory_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  module_id uuid,
  raised_by uuid REFERENCES auth.users(id),
  category text,
  description text NOT NULL,
  urgency text DEFAULT 'normal',  -- normal | high | critical
  status text DEFAULT 'open',     -- open | acknowledged | resolved | escalated
  factory_response text,
  responded_by uuid REFERENCES auth.users(id),
  responded_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.site_factory_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access site_factory_feedback" ON public.site_factory_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Subcontractor Assignments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subcontractor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  contractor_name text NOT NULL,
  work_scope text,
  start_date date,
  end_date date,
  contract_value numeric,
  status text DEFAULT 'planned', -- planned | active | completed | cancelled
  reminder_14d_sent boolean DEFAULT false,
  reminder_5d_sent boolean DEFAULT false,
  reminder_1d_sent boolean DEFAULT false,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.subcontractor_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access subcontractor_assignments" ON public.subcontractor_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Advance Requests ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.advance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  requested_by uuid REFERENCES auth.users(id),
  amount numeric NOT NULL,
  purpose text NOT NULL,
  is_emergency boolean DEFAULT false,
  status text DEFAULT 'pending', -- pending | approved | rejected | settled
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  settlement_method text, -- deduct_from_salary | carry_forward | direct_return
  carry_forward_amount numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.advance_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access advance_requests" ON public.advance_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Material Availability Confirmations ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_availability_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  material_name text NOT NULL,
  required_by_date date,
  stage_start_date date,
  alert_sent_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  notes text,
  status text DEFAULT 'pending', -- pending | confirmed | unavailable
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.material_availability_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access material_availability_confirmations" ON public.material_availability_confirmations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Weekly Manpower Plans ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_manpower_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  week_start_date date NOT NULL,
  role_category text,
  planned_count integer DEFAULT 0,
  actual_count integer DEFAULT 0,
  contractor_name text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.weekly_manpower_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access weekly_manpower_plans" ON public.weekly_manpower_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Rework Log Entries ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rework_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  module_id uuid,
  description text NOT NULL,
  root_cause text,
  contractor_name text,
  hours_worked numeric DEFAULT 0,
  rate_per_hour numeric DEFAULT 0,
  rework_cost numeric GENERATED ALWAYS AS (hours_worked * rate_per_hour) STORED,
  status text DEFAULT 'open', -- open | in_progress | closed
  logged_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rework_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access rework_log_entries" ON public.rework_log_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Activity Dependencies (Gantt) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  predecessor_module_id uuid,
  successor_module_id uuid,
  lag_days integer DEFAULT 0,
  dependency_type text DEFAULT 'finish_to_start',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access activity_dependencies" ON public.activity_dependencies
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Project Invoices ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  invoice_number text,
  invoice_type text DEFAULT 'part', -- part | final | advance
  milestone_description text,
  amount numeric,
  due_date date,
  status text DEFAULT 'draft', -- draft | sent | paid | overdue
  auto_triggered_by text,      -- dispatch | handover | manual
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access project_invoices" ON public.project_invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Retention Records ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.retention_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  client_type text DEFAULT 'b2b', -- b2b | b2c
  retention_pct numeric DEFAULT 2.5,
  retention_amount numeric,
  due_release_date date,
  released_at timestamptz,
  reminder_sent_at timestamptz,
  status text DEFAULT 'held', -- held | due | released
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.retention_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access retention_records" ON public.retention_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Bank Ledger Entries ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  description text,
  debit_amount numeric DEFAULT 0,
  credit_amount numeric DEFAULT 0,
  balance numeric,
  bank_name text,
  account_number text,
  reference text,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  date_range_start date,
  date_range_end date
);
ALTER TABLE public.bank_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Directors access bank_ledger_entries" ON public.bank_ledger_entries
  FOR ALL TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));

-- ── Creditor Ledger Entries ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.creditor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  invoice_date date,
  due_date date,
  invoice_number text,
  amount numeric,
  paid_amount numeric DEFAULT 0,
  balance numeric,
  payment_terms_days integer DEFAULT 30,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  date_range_start date,
  date_range_end date
  -- overdue_days is CALCULATED at view time: CURRENT_DATE - due_date (not stored)
);
ALTER TABLE public.creditor_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Directors access creditor_ledger_entries" ON public.creditor_ledger_entries
  FOR ALL TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));

-- ── Debtor Ledger Entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debtor_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  invoice_date date,
  due_date date,
  invoice_number text,
  amount numeric,
  received_amount numeric DEFAULT 0,
  balance numeric,
  payment_terms_days integer DEFAULT 30,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id),
  date_range_start date,
  date_range_end date
  -- overdue_days calculated at view time: CURRENT_DATE - due_date
);
ALTER TABLE public.debtor_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Directors access debtor_ledger_entries" ON public.debtor_ledger_entries
  FOR ALL TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));

-- ── Dry Assembly Checks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dry_assembly_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  checker_role text, -- factory_floor_supervisor | production_head
  checker_id uuid REFERENCES auth.users(id),
  azad_signoff boolean DEFAULT false,
  azad_signoff_at timestamptz,
  tagore_signoff boolean DEFAULT false,
  tagore_signoff_at timestamptz,
  notes text,
  passed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dry_assembly_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access dry_assembly_checks" ON public.dry_assembly_checks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Installation Sequence Docs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.installation_sequence_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  module_id uuid,
  doc_url text,
  azad_signoff boolean DEFAULT false,
  azad_signoff_at timestamptz,
  awaiz_signoff boolean DEFAULT false,
  awaiz_signoff_at timestamptz,
  karthik_signoff boolean DEFAULT false,
  karthik_signoff_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.installation_sequence_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access installation_sequence_docs" ON public.installation_sequence_docs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Asset Register ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.asset_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name text NOT NULL,
  asset_code text,
  category text,  -- factory_permanent | site_mobile
  location text,
  assigned_to_project uuid REFERENCES public.projects(id),
  assigned_to_user uuid REFERENCES auth.users(id),
  expected_return_date date,
  actual_return_date date,
  overdue_alert_sent boolean DEFAULT false,
  status text DEFAULT 'available', -- available | assigned | overdue | maintenance
  purchase_date date,
  purchase_value numeric,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.asset_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access asset_register" ON public.asset_register
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Site Inventory ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  material_name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit text,
  delivered_at timestamptz,
  return_requested boolean DEFAULT false,
  return_requested_at timestamptz,
  returned_at timestamptz,
  return_approved_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.site_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated access site_inventory" ON public.site_inventory
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Weekly Habit Tracking ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_habit_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  week_start_date date NOT NULL,
  habit_key text NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start_date, habit_key)
);
ALTER TABLE public.weekly_habit_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own habit tracking" ON public.weekly_habit_tracking
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =====================================================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- =====================================================================

-- design_queries: resolution timeline
ALTER TABLE public.design_queries ADD COLUMN IF NOT EXISTS resolution_timeline date;
ALTER TABLE public.design_queries ADD COLUMN IF NOT EXISTS urgency_level text DEFAULT 'normal';

-- drawings: revision reason
ALTER TABLE public.drawings ADD COLUMN IF NOT EXISTS revision_reason text;

-- profiles: secondary_role for dual-role support + sales targets
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_habitainer numeric DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_ads numeric DEFAULT 0;

-- sales_deals: experience centre visit, client_type, stagnation
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS client_type text DEFAULT 'b2c';
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS experience_centre_visit boolean DEFAULT false;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS experience_centre_visit_date date;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS last_activity_date date;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS division text DEFAULT 'habitainer'; -- habitainer | ads
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS quotation_version integer DEFAULT 1;
ALTER TABLE public.sales_deals ADD COLUMN IF NOT EXISTS handover_checklist_complete boolean DEFAULT false;

-- rm_tickets: before/after photos
ALTER TABLE public.rm_tickets ADD COLUMN IF NOT EXISTS before_photo_url text;
ALTER TABLE public.rm_tickets ADD COLUMN IF NOT EXISTS after_photo_url text;

-- purchase_orders: destination + quote fields + lead time
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS destination text DEFAULT 'factory'; -- factory | site
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS quote_required boolean DEFAULT false;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS quote_count integer DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS lead_time_promised_days integer;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS lead_time_actual_days integer;

-- modules: gfc gates
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS gfc_h1_approved boolean DEFAULT false;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS gfc_h1_approved_at timestamptz;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS gfc_h2_approved boolean DEFAULT false;
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS gfc_h2_approved_at timestamptz;

-- qc_checklist_items: stage_type filter
ALTER TABLE public.qc_checklist_items ADD COLUMN IF NOT EXISTS stage_type text DEFAULT 'shell_core';
-- shell_core | builder_finish | interiors

-- ncr_register: when_can_be_fixed field, assigned_to
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS when_can_be_fixed date;
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS fix_in_progress_at timestamptz;
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS awaiting_reinspection_at timestamptz;
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id);
ALTER TABLE public.ncr_register ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- hr_settings: add expense_flag_threshold if not seeded
INSERT INTO public.hr_settings (key, value, status)
VALUES ('expense_flag_threshold', '5000', 'active')
ON CONFLICT (key) DO NOTHING;

-- attendance_records: location_note already added in 000002, ensure column exists
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS location_note text;
