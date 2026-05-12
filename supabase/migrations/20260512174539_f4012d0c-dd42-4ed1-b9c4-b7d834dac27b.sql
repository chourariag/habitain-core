
-- Helper functions
CREATE OR REPLACE FUNCTION public.can_view_fixed_assets(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','finance_director','sales_director','architecture_director',
                   'head_operations','procurement','stores_executive','production_head','site_installation_mgr','finance_manager')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_fixed_assets(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','procurement','stores_executive')
  )
$$;

CREATE OR REPLACE FUNCTION public.can_log_fixed_asset_service(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true
      AND role IN ('super_admin','managing_director','procurement','production_head')
  )
$$;

-- Asset category enum
DO $$ BEGIN
  CREATE TYPE public.fixed_asset_category AS ENUM (
    'machinery','vehicle','it_equipment','furniture','safety_equipment','tools','other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.tool_condition AS ENUM ('new','good','fair','damaged','retired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Fixed Assets table
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name text NOT NULL,
  asset_tag text UNIQUE NOT NULL,
  category public.fixed_asset_category NOT NULL DEFAULT 'machinery',
  make_model text,
  serial_number text,
  purchase_date date,
  purchase_value numeric(14,2),
  current_location text,
  assigned_to_profile_id uuid REFERENCES public.profiles(id),
  service_interval_days integer,
  last_service_date date,
  next_service_due date GENERATED ALWAYS AS (
    CASE WHEN last_service_date IS NOT NULL AND service_interval_days IS NOT NULL
      THEN last_service_date + service_interval_days
    END
  ) STORED,
  warranty_expiry date,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_next_due ON public.fixed_assets(next_service_due) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_fixed_assets_category ON public.fixed_assets(category) WHERE is_archived = false;

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view fixed assets" ON public.fixed_assets FOR SELECT
  USING (public.can_view_fixed_assets(auth.uid()));
CREATE POLICY "insert fixed assets" ON public.fixed_assets FOR INSERT
  WITH CHECK (public.can_edit_fixed_assets(auth.uid()));
CREATE POLICY "update fixed assets" ON public.fixed_assets FOR UPDATE
  USING (public.can_edit_fixed_assets(auth.uid()));

CREATE TRIGGER update_fixed_assets_updated_at
BEFORE UPDATE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service log table
CREATE TABLE IF NOT EXISTS public.fixed_asset_service_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  service_type text NOT NULL,
  done_by text,
  cost numeric(12,2),
  next_service_date_override date,
  notes text,
  attachment_url text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_log_asset ON public.fixed_asset_service_log(asset_id, service_date DESC);

ALTER TABLE public.fixed_asset_service_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view service log" ON public.fixed_asset_service_log FOR SELECT
  USING (public.can_view_fixed_assets(auth.uid()));
CREATE POLICY "insert service log" ON public.fixed_asset_service_log FOR INSERT
  WITH CHECK (public.can_log_fixed_asset_service(auth.uid()));

-- Trigger to update last_service_date on parent asset when service logged
CREATE OR REPLACE FUNCTION public.update_asset_after_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.fixed_assets
     SET last_service_date = GREATEST(COALESCE(last_service_date, NEW.service_date), NEW.service_date),
         service_interval_days = CASE
           WHEN NEW.next_service_date_override IS NOT NULL
             THEN GREATEST(1, (NEW.next_service_date_override - NEW.service_date))
           ELSE service_interval_days
         END,
         updated_at = now()
   WHERE id = NEW.asset_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_update_asset_after_service
AFTER INSERT ON public.fixed_asset_service_log
FOR EACH ROW EXECUTE FUNCTION public.update_asset_after_service();

-- Tools inventory
CREATE TABLE IF NOT EXISTS public.tools_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name text NOT NULL,
  qty_total integer NOT NULL DEFAULT 0,
  qty_in_use integer NOT NULL DEFAULT 0,
  qty_available integer GENERATED ALWAYS AS (GREATEST(qty_total - qty_in_use, 0)) STORED,
  location text,
  assigned_to_profile_id uuid REFERENCES public.profiles(id),
  condition public.tool_condition NOT NULL DEFAULT 'good',
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (qty_total >= 0 AND qty_in_use >= 0 AND qty_in_use <= qty_total)
);

ALTER TABLE public.tools_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view tools" ON public.tools_inventory FOR SELECT
  USING (public.can_view_fixed_assets(auth.uid()));
CREATE POLICY "insert tools" ON public.tools_inventory FOR INSERT
  WITH CHECK (public.can_edit_fixed_assets(auth.uid()));
CREATE POLICY "update tools" ON public.tools_inventory FOR UPDATE
  USING (public.can_edit_fixed_assets(auth.uid()));

CREATE TRIGGER update_tools_inventory_updated_at
BEFORE UPDATE ON public.tools_inventory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
