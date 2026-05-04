
-- Helper: MD-only permission
CREATE OR REPLACE FUNCTION public.is_md(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id
      AND is_active = true
      AND role IN ('super_admin','managing_director')
  )
$$;

-- Add specific responsible user to task templates
ALTER TABLE public.production_task_templates
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Role / Feature access matrix
CREATE TABLE IF NOT EXISTS public.role_feature_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, feature)
);
ALTER TABLE public.role_feature_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages role access" ON public.role_feature_access FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Authenticated read role access" ON public.role_feature_access FOR SELECT TO authenticated USING (true);

-- Escalation matrix
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL UNIQUE,
  level1_owner_role text,
  level1_sla_hours integer,
  level2_owner_role text,
  level2_sla_hours integer,
  level3_owner_role text,
  level3_sla_hours integer,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages escalation" ON public.escalation_rules FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Auth read escalation" ON public.escalation_rules FOR SELECT TO authenticated USING (true);

-- Approval thresholds
CREATE TABLE IF NOT EXISTS public.approval_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type text NOT NULL UNIQUE,
  tier1_max_amount numeric,
  tier1_approver_role text,
  tier2_max_amount numeric,
  tier2_approver_role text,
  tier3_approver_role text,
  notes text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages thresholds" ON public.approval_thresholds FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Auth read thresholds" ON public.approval_thresholds FOR SELECT TO authenticated USING (true);

-- Master data uploads log (data bank)
CREATE TABLE IF NOT EXISTS public.master_data_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_set text NOT NULL,
  uploaded_by uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  record_count integer DEFAULT 0,
  file_name text,
  file_url text,
  notes text
);
ALTER TABLE public.master_data_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages uploads log" ON public.master_data_uploads FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));

-- Super admin audit log (read-only after insert)
CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  section text NOT NULL,
  action text NOT NULL,
  entity text,
  previous_value jsonb,
  new_value jsonb,
  summary text
);
ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD reads audit" ON public.super_admin_audit_log FOR SELECT TO authenticated USING (public.is_md(auth.uid()));
CREATE POLICY "MD writes audit" ON public.super_admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_md(auth.uid()));

-- Clients master
CREATE TABLE IF NOT EXISTS public.clients_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_person text,
  address text,
  email text,
  phone text,
  gstin text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages clients_master" ON public.clients_master FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Auth read clients_master" ON public.clients_master FOR SELECT TO authenticated USING (true);

-- Statutory calendar
CREATE TABLE IF NOT EXISTS public.statutory_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_name text NOT NULL,
  due_day integer,
  due_month integer,
  recurrence text NOT NULL DEFAULT 'monthly',
  applies_to text,
  notes text,
  active boolean DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.statutory_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages statutory" ON public.statutory_calendar FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Auth read statutory" ON public.statutory_calendar FOR SELECT TO authenticated USING (true);

-- Material rate benchmarks
CREATE TABLE IF NOT EXISTS public.material_rate_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  material_name text NOT NULL,
  unit text,
  benchmark_rate numeric NOT NULL,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, material_name)
);
ALTER TABLE public.material_rate_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MD manages benchmarks" ON public.material_rate_benchmarks FOR ALL TO authenticated
  USING (public.is_md(auth.uid())) WITH CHECK (public.is_md(auth.uid()));
CREATE POLICY "Auth read benchmarks" ON public.material_rate_benchmarks FOR SELECT TO authenticated USING (true);

-- Seed default approval thresholds
INSERT INTO public.approval_thresholds (approval_type, tier1_max_amount, tier1_approver_role, tier2_max_amount, tier2_approver_role, tier3_approver_role, notes) VALUES
  ('PO Approval', 50000, 'Vijay (Procurement)', 200000, 'Director', 'Managing Director', 'Purchase Order routing'),
  ('Work Order', 25000, 'Karthik alone', 200000, 'Karthik + Shiv', 'Managing Director (also required)', 'Site work orders'),
  ('Variation', 25000, 'Karan alone', 200000, 'Director', 'Managing Director', 'Variation orders >2L need MD'),
  ('Discount', NULL, 'Sales', NULL, 'Director (>15% below BOQ)', 'Managing Director', 'Director must approve before deal marked Won'),
  ('Expense Claim', 5000, 'HOD', NULL, 'Finance + HOD', 'Managing Director', 'Above ₹5,000 needs Finance + HOD')
ON CONFLICT (approval_type) DO NOTHING;

-- Seed default escalation rules
INSERT INTO public.escalation_rules (alert_type, level1_owner_role, level1_sla_hours, level2_owner_role, level2_sla_hours, level3_owner_role, level3_sla_hours) VALUES
  ('Labour Claim Approval', 'production_head', 4, 'head_operations', 8, 'managing_director', 24),
  ('NCR Closure', 'qc_inspector', 24, 'production_head', 48, 'managing_director', 72),
  ('Design Query', 'project_architect', 24, 'principal_architect', 48, 'architecture_director', 72),
  ('Payment Approval', 'finance_manager', 24, 'finance_director', 48, 'managing_director', 72),
  ('Material Request', 'procurement', 8, 'production_head', 24, 'head_operations', 48),
  ('Safety Incident (Serious)', 'site_installation_mgr', 1, 'head_operations', 4, 'managing_director', 8)
ON CONFLICT (alert_type) DO NOTHING;
