
-- Stores inventory (project-scoped material stock at factory)
CREATE TABLE public.stores_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  material_name text NOT NULL,
  unit text NOT NULL DEFAULT 'units',
  available_qty numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dispatch packs
CREATE TABLE public.dispatch_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_pack_id text NOT NULL,
  project_id uuid NOT NULL,
  dispatch_date date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_type text,
  vehicle_number text,
  driver_name text,
  driver_phone text,
  transporter_name text,
  site_installation_manager_id uuid,
  team_member_ids uuid[] DEFAULT '{}',
  supervisor_accompanying boolean DEFAULT false,
  loading_checklist_complete boolean DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'dispatched'
);

-- Dispatch material log
CREATE TABLE public.dispatch_material_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_pack_id text NOT NULL,
  project_id uuid NOT NULL,
  material_name text NOT NULL,
  unit text,
  qty_dispatched numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_dispatch_packs_project ON public.dispatch_packs (project_id, dispatch_date DESC);
CREATE INDEX idx_dispatch_material_log_pack ON public.dispatch_material_log (dispatch_pack_id);
CREATE INDEX idx_stores_inventory_project ON public.stores_inventory (project_id);

-- Enable RLS
ALTER TABLE public.stores_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_material_log ENABLE ROW LEVEL SECURITY;

-- stores_inventory RLS
CREATE POLICY "Authenticated can view stores_inventory" ON public.stores_inventory
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Stores and factory can manage stores_inventory" ON public.stores_inventory
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'stores_executive'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role]))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'stores_executive'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role]));

-- dispatch_packs RLS
CREATE POLICY "Factory roles can insert dispatch_packs" ON public.dispatch_packs
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role]));

CREATE POLICY "Factory roles can update dispatch_packs" ON public.dispatch_packs
  FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role]));

CREATE POLICY "Authorized can view dispatch_packs" ON public.dispatch_packs
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'finance_director'::app_role, 'sales_director'::app_role, 'architecture_director'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role, 'planning_engineer'::app_role, 'head_operations'::app_role, 'site_installation_mgr'::app_role, 'site_engineer'::app_role, 'delivery_rm_lead'::app_role]));

-- dispatch_material_log RLS
CREATE POLICY "Factory roles can insert dispatch_material_log" ON public.dispatch_material_log
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'factory_floor_supervisor'::app_role, 'production_head'::app_role]));

CREATE POLICY "Authenticated can view dispatch_material_log" ON public.dispatch_material_log
  FOR SELECT TO authenticated
  USING (true);

-- Enable realtime for dispatch_packs
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_packs;
