ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS final_agreed_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS adjustment_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS adjustment_notes text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_approved_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz DEFAULT NULL;