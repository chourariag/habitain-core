-- Site Inventory table
CREATE TABLE public.site_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  material_name text NOT NULL,
  qty_received numeric NOT NULL DEFAULT 0,
  qty_used numeric NOT NULL DEFAULT 0,
  qty_remaining numeric GENERATED ALWAYS AS (qty_received - qty_used) STORED,
  last_updated_by uuid,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_select" ON public.site_inventory FOR SELECT TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'delivery_rm_lead')
    OR public.has_role(auth.uid(), 'factory_floor_supervisor')
  );

CREATE POLICY "si_insert" ON public.site_inventory FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
  );

CREATE POLICY "si_update" ON public.site_inventory FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
  );

-- Asset Register table
CREATE TABLE public.asset_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id text NOT NULL UNIQUE,
  asset_name text NOT NULL,
  category text NOT NULL DEFAULT 'site_mobile',
  condition text NOT NULL DEFAULT 'good',
  current_location text NOT NULL DEFAULT 'factory',
  assigned_project_id uuid REFERENCES public.projects(id),
  dispatch_date date,
  expected_return_date date,
  actual_return_date date,
  status text NOT NULL DEFAULT 'in_factory',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_register ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_select" ON public.asset_register FOR SELECT TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'factory_floor_supervisor')
  );

CREATE POLICY "ar_insert" ON public.asset_register FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
  );

CREATE POLICY "ar_update" ON public.asset_register FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'site_installation_mgr')
  );

CREATE TRIGGER update_ar_updated_at BEFORE UPDATE ON public.asset_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Material Returns table
CREATE TABLE public.material_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  initiated_by uuid,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_by uuid,
  confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'in_transit',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.material_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_select" ON public.material_returns FOR SELECT TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'production_head')
    OR public.has_role(auth.uid(), 'head_operations')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'stores_executive')
  );

CREATE POLICY "mr_insert" ON public.material_returns FOR INSERT TO authenticated
  WITH CHECK (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
  );

CREATE POLICY "mr_update" ON public.material_returns FOR UPDATE TO authenticated
  USING (
    public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
  );

CREATE TRIGGER update_mr_updated_at BEFORE UPDATE ON public.material_returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();