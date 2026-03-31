ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS submission_method text NOT NULL DEFAULT 'manual';
ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS uploaded_on_behalf_of uuid REFERENCES auth.users(id);
ALTER TABLE public.expense_entries ADD COLUMN IF NOT EXISTS rate_used numeric;