ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS gfc_budget numeric;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS planned_labour_cost numeric;