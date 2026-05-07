ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gfc_budget_total NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actually_spent NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';