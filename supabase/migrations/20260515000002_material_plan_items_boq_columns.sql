-- =====================================================================
-- Extend material_plan_items with BOQ costing columns
-- These are used in Procurement.tsx but missing from the typed schema
-- =====================================================================

ALTER TABLE public.material_plan_items
  ADD COLUMN IF NOT EXISTS item_description text,
  ADD COLUMN IF NOT EXISTS tender_qty       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_qty       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wastage_pct      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boq_qty          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_rate    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labour_rate      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS oh_rate          numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS boq_rate         numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount     numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_pct       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scope            text,
  ADD COLUMN IF NOT EXISTS source           text DEFAULT 'boq';
    -- boq | material_plan

-- Backfill item_description from material_name where null
UPDATE public.material_plan_items
  SET item_description = material_name
  WHERE item_description IS NULL;
