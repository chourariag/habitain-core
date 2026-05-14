
-- ============== STAGE 1: Dispatch Pack — extend ==============
ALTER TABLE public.dispatch_packs
  ADD COLUMN IF NOT EXISTS module_name text,
  ADD COLUMN IF NOT EXISTS items_table jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS factory_works_completed jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS site_works_pending text,
  ADD COLUMN IF NOT EXISTS connection_photos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS special_handling text,
  ADD COLUMN IF NOT EXISTS planned_dispatch_date date;

-- ============== STAGE 2: Delivery Checklist — extend ==============
ALTER TABLE public.delivery_checklists
  ADD COLUMN IF NOT EXISTS dispatch_pack_id uuid REFERENCES public.dispatch_packs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grn_destination text CHECK (grn_destination IN ('factory','site') OR grn_destination IS NULL),
  ADD COLUMN IF NOT EXISTS rakesh_signed_by uuid,
  ADD COLUMN IF NOT EXISTS rakesh_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sandeep_signed_by uuid,
  ADD COLUMN IF NOT EXISTS sandeep_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS awaiz_signed_by uuid,
  ADD COLUMN IF NOT EXISTS awaiz_signed_at timestamptz;

-- ============== STAGE 3: Installation Sequence — extend ==============
ALTER TABLE public.installation_sequence_docs
  ADD COLUMN IF NOT EXISTS crane_position text,
  ADD COLUMN IF NOT EXISTS crane_type text,
  ADD COLUMN IF NOT EXISTS erection_sequence jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_tools jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_requirements text,
  ADD COLUMN IF NOT EXISTS risk_register jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS site_readiness jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS unlock_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlocked_by_md_at timestamptz,
  ADD COLUMN IF NOT EXISTS module_no text;
