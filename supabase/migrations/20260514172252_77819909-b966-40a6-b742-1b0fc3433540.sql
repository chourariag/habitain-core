
-- Payroll configuration per employee (set by HR)
CREATE TABLE IF NOT EXISTS public.payroll_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  monthly_ctc NUMERIC NOT NULL DEFAULT 0,
  basic_pct NUMERIC NOT NULL DEFAULT 40,
  hra_pct NUMERIC NOT NULL DEFAULT 50,
  pt_amount NUMERIC NOT NULL DEFAULT 200,
  tds_monthly NUMERIC NOT NULL DEFAULT 0,
  pan TEXT,
  pf_number TEXT,
  bank_account TEXT,
  bank_name TEXT,
  ifsc TEXT,
  designation TEXT,
  department TEXT,
  doj DATE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR manages payroll_config"
  ON public.payroll_config
  USING (public.can_manage_hr_documents(auth.uid()))
  WITH CHECK (public.can_manage_hr_documents(auth.uid()));

CREATE POLICY "Employees view own payroll_config"
  ON public.payroll_config FOR SELECT
  USING (user_id = auth.uid() OR public.can_manage_hr_documents(auth.uid()));

CREATE TRIGGER update_payroll_config_updated_at
  BEFORE UPDATE ON public.payroll_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend payslips with breakup columns required for the formal template
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS basic NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hra NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_allowance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_worked NUMERIC,
  ADD COLUMN IF NOT EXISTS days_in_month INTEGER,
  ADD COLUMN IF NOT EXISTS generated_by UUID,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
