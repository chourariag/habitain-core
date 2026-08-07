ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS quantity_note text,
  ADD COLUMN IF NOT EXISTS applies_to_all_modules boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS days_required integer;