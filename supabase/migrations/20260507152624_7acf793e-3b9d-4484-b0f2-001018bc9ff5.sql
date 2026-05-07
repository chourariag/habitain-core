
ALTER TABLE public.project_boq_items
  ADD COLUMN IF NOT EXISTS tender_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gfc_amount NUMERIC DEFAULT 0;

ALTER TABLE public.project_boq
  ADD COLUMN IF NOT EXISTS gfc_pending_h1 BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tender_total_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gfc_total_value NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
