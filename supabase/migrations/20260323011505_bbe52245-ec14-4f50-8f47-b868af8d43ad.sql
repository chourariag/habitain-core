
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
