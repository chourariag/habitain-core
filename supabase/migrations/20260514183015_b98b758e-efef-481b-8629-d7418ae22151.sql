ALTER TABLE public.advance_requests ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.advance_requests ADD COLUMN IF NOT EXISTS rejected_by uuid;
ALTER TABLE public.advance_requests ADD COLUMN IF NOT EXISTS rejected_at timestamptz;