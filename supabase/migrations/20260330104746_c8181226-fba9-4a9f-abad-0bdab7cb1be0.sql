
-- Add delivery_destination column to inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS delivery_destination text NOT NULL DEFAULT 'factory',
  ADD COLUMN IF NOT EXISTS received_by_on_site text,
  ADD COLUMN IF NOT EXISTS site_receipt_notes text,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- Create site_direct_receipts table
CREATE TABLE IF NOT EXISTS public.site_direct_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  material_name text NOT NULL,
  qty numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'units',
  vendor_name text,
  received_by_on_site text,
  site_receipt_notes text,
  category text DEFAULT 'General',
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.site_direct_receipts ENABLE ROW LEVEL SECURITY;

-- RLS for site_direct_receipts
CREATE POLICY "stores_procurement_insert_site_receipts"
  ON public.site_direct_receipts FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  );

CREATE POLICY "stores_procurement_site_select_site_receipts"
  ON public.site_direct_receipts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.has_role(auth.uid(), 'site_installation_mgr') OR
    public.is_director(auth.uid())
  );
