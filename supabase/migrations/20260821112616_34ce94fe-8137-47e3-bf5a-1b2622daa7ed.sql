DROP POLICY IF EXISTS "Stores and directors can insert inventory items" ON public.inventory_items;
CREATE POLICY "Stores and directors can insert inventory items"
ON public.inventory_items FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) = ANY (
  ARRAY['stores_executive','managing_director','super_admin','production_head']::public.app_role[]));

DROP POLICY IF EXISTS "Stores and directors can update inventory items" ON public.inventory_items;
CREATE POLICY "Stores and directors can update inventory items"
ON public.inventory_items FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) = ANY (
  ARRAY['stores_executive','managing_director','super_admin','production_head']::public.app_role[]))
WITH CHECK (public.get_user_role(auth.uid()) = ANY (
  ARRAY['stores_executive','managing_director','super_admin','production_head']::public.app_role[]));

DROP POLICY IF EXISTS "si_insert" ON public.site_inventory;
CREATE POLICY "si_insert" ON public.site_inventory FOR INSERT TO authenticated
  WITH CHECK (public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'production_head'));

DROP POLICY IF EXISTS "si_update" ON public.site_inventory;
CREATE POLICY "si_update" ON public.site_inventory FOR UPDATE TO authenticated
  USING (public.is_full_admin(auth.uid()) OR public.is_director(auth.uid())
    OR public.has_role(auth.uid(), 'site_installation_mgr')
    OR public.has_role(auth.uid(), 'site_engineer')
    OR public.has_role(auth.uid(), 'stores_executive')
    OR public.has_role(auth.uid(), 'procurement')
    OR public.has_role(auth.uid(), 'production_head'));