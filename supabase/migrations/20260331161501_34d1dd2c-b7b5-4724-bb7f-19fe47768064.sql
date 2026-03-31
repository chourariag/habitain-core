
-- Add new columns to purchase_orders for Tally PO upload
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS vendor_code text,
  ADD COLUMN IF NOT EXISTS item_description text,
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS unit_rate numeric,
  ADD COLUMN IF NOT EXISTS total_amount numeric,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS uploaded_by uuid;

-- Add unique constraint on po_number (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_po_number_unique ON public.purchase_orders (po_number) WHERE po_number IS NOT NULL;

-- Drop existing RLS policies to recreate
DROP POLICY IF EXISTS "procurement_insert" ON public.purchase_orders;
DROP POLICY IF EXISTS "procurement_read" ON public.purchase_orders;
DROP POLICY IF EXISTS "directors_full" ON public.purchase_orders;
DROP POLICY IF EXISTS "authenticated_read" ON public.purchase_orders;

-- Procurement and production_head can insert and read all
CREATE POLICY "procurement_prod_insert" ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'production_head') OR
    public.is_director(auth.uid())
  );

CREATE POLICY "procurement_prod_read" ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (true);

-- Directors and MD can update (approve/reject)
CREATE POLICY "directors_update" ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (public.is_director(auth.uid()))
  WITH CHECK (public.is_director(auth.uid()));
