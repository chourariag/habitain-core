
-- Add conveyance allowance to payroll config
ALTER TABLE public.payroll_config
  ADD COLUMN IF NOT EXISTS conveyance_allowance numeric NOT NULL DEFAULT 0;

-- Extend payslips with attendance breakdown + revision tracking
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS conveyance_allowance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_present numeric,
  ADD COLUMN IF NOT EXISTS days_absent numeric,
  ADD COLUMN IF NOT EXISTS leave_taken numeric,
  ADD COLUMN IF NOT EXISTS lop_days numeric,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

-- Replace unique (user_id, month, year) with partial unique on active versions
ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_user_id_month_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS payslips_active_unique_idx
  ON public.payslips (user_id, month, year)
  WHERE superseded_at IS NULL;
