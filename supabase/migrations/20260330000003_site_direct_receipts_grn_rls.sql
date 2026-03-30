-- Add GRN reference number to site_direct_receipts for PO traceability
ALTER TABLE public.site_direct_receipts
  ADD COLUMN IF NOT EXISTS grn_id text;

-- UPDATE policy: stores/procurement can correct mis-logged receipts
CREATE POLICY "stores_procurement_update_site_receipts"
  ON public.site_direct_receipts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'stores_executive') OR
    public.has_role(auth.uid(), 'procurement') OR
    public.is_full_admin(auth.uid())
  );

-- DELETE policy: admin only
CREATE POLICY "admin_delete_site_receipts"
  ON public.site_direct_receipts FOR DELETE TO authenticated
  USING (public.is_full_admin(auth.uid()));
