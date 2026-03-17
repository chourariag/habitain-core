CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name TEXT NOT NULL,
  category TEXT NOT NULL,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'units',
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory items"
ON public.inventory_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Stores and directors can insert inventory items"
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE POLICY "Stores and directors can update inventory items"
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_archived ON public.inventory_items(is_archived);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);

CREATE TRIGGER update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  items_summary TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  raised_by UUID,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view purchase orders"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authorized users can insert purchase orders"
ON public.purchase_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE POLICY "Authorized users can update purchase orders"
ON public.purchase_orders
FOR UPDATE
TO authenticated
USING (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
)
WITH CHECK (
  public.get_user_role(auth.uid()) = ANY (
    ARRAY['procurement'::public.app_role, 'stores_executive'::public.app_role, 'managing_director'::public.app_role, 'super_admin'::public.app_role]
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_archived ON public.purchase_orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON public.purchase_orders(po_date DESC);

CREATE TRIGGER update_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();