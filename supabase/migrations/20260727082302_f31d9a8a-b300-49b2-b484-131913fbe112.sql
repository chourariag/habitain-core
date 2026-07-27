-- Drop tables that store salary/compensation/banking PII
DROP TABLE IF EXISTS public.payslips CASCADE;
DROP TABLE IF EXISTS public.payroll_config CASCADE;
DROP TABLE IF EXISTS public.labour_worker_rate_history CASCADE;
DROP TABLE IF EXISTS public.labour_worker_compensation CASCADE;

-- Drop helpers that only existed to gate salary access / snapshot rates
DROP FUNCTION IF EXISTS public.snapshot_worker_rate() CASCADE;
DROP FUNCTION IF EXISTS public.can_access_labour_compensation(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_labour_salary(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_labour_avg_daily_rate_by_skill() CASCADE;
DROP FUNCTION IF EXISTS public.get_labour_worker_rate_history(uuid) CASCADE;