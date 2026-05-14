
-- Fixed assets: status + insurance + disposal trail
DO $$ BEGIN
  CREATE TYPE public.fixed_asset_status AS ENUM ('active','under_repair','pending_disposal','disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS status public.fixed_asset_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS disposal_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposal_requested_by uuid,
  ADD COLUMN IF NOT EXISTS disposal_reason text,
  ADD COLUMN IF NOT EXISTS disposal_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS disposal_approved_by uuid;

-- Tools: add category & last_checked_date
ALTER TABLE public.tools_inventory
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'hand_tool',
  ADD COLUMN IF NOT EXISTS last_checked_date date;

-- Tool issuance log
CREATE TABLE IF NOT EXISTS public.tool_issuance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools_inventory(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  issued_to_name text NOT NULL,
  issued_to_team text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  issued_on date NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date date,
  returned_on date,
  return_qty integer,
  return_condition text,
  notes text,
  issued_by uuid REFERENCES public.profiles(id),
  returned_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tool_issuance_tool ON public.tool_issuance(tool_id, issued_on DESC);
CREATE INDEX IF NOT EXISTS idx_tool_issuance_open
  ON public.tool_issuance(tool_id) WHERE returned_on IS NULL;

ALTER TABLE public.tool_issuance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view tool issuance" ON public.tool_issuance;
CREATE POLICY "view tool issuance" ON public.tool_issuance
  FOR SELECT USING (public.can_view_fixed_assets(auth.uid()));

DROP POLICY IF EXISTS "manage tool issuance" ON public.tool_issuance;
CREATE POLICY "manage tool issuance" ON public.tool_issuance
  FOR ALL USING (public.can_edit_fixed_assets(auth.uid()))
  WITH CHECK (public.can_edit_fixed_assets(auth.uid()));

CREATE TRIGGER update_tool_issuance_updated_at
  BEFORE UPDATE ON public.tool_issuance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep tools_inventory.qty_in_use in sync with open issuances
CREATE OR REPLACE FUNCTION public.sync_tool_issuance_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tid uuid;
  open_qty integer;
BEGIN
  tid := COALESCE(NEW.tool_id, OLD.tool_id);
  SELECT COALESCE(SUM(qty),0) INTO open_qty
    FROM public.tool_issuance
   WHERE tool_id = tid AND returned_on IS NULL;
  UPDATE public.tools_inventory
     SET qty_in_use = LEAST(open_qty, qty_total),
         updated_at = now()
   WHERE id = tid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_tool_issuance ON public.tool_issuance;
CREATE TRIGGER trg_sync_tool_issuance
  AFTER INSERT OR UPDATE OR DELETE ON public.tool_issuance
  FOR EACH ROW EXECUTE FUNCTION public.sync_tool_issuance_counts();

-- Helper: only MD/super_admin may approve disposal
CREATE OR REPLACE FUNCTION public.can_approve_asset_disposal(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_md(_user_id)
$$;
