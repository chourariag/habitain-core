-- Add signer display name columns so sign-off banners can show name + role
ALTER TABLE public.delivery_checklists
  ADD COLUMN IF NOT EXISTS modules_signed_by_name    text,
  ADD COLUMN IF NOT EXISTS tools_signed_by_name      text,
  ADD COLUMN IF NOT EXISTS additional_signed_by_name text;
