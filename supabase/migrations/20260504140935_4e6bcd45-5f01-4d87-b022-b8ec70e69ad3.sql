
ALTER TABLE public.project_tender_budget_items
  ADD COLUMN IF NOT EXISTS gfc_qty numeric;

ALTER TABLE public.project_boq_items
  ADD COLUMN IF NOT EXISTS tender_qty numeric;
