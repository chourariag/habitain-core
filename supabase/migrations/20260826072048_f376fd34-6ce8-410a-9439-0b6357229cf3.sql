
DROP POLICY IF EXISTS "Authenticated can view retention entries" ON public.client_wo_retention_entries;
CREATE POLICY "Finance and leadership view retention entries"
ON public.client_wo_retention_entries FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','finance_director','finance_manager','accounts_executive','planning_head','head_of_projects','head_operations']::app_role[])
);

DROP POLICY IF EXISTS "Authenticated can view rm_tickets" ON public.rm_tickets;
CREATE POLICY "Operations and finance view rm tickets"
ON public.rm_tickets FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','head_operations','delivery_rm_lead','head_of_projects','planning_head','planning_engineer','costing_engineer','site_installation_mgr','site_engineer','production_head','finance_director','finance_manager','accounts_executive']::app_role[])
);

DROP POLICY IF EXISTS "Authenticated can view variation orders" ON public.variation_orders;
CREATE POLICY "Finance ops and leadership view variation orders"
ON public.variation_orders FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','finance_director','finance_manager','accounts_executive','head_operations','head_of_projects','planning_head','planning_engineer','costing_engineer','quantity_surveyor','site_installation_mgr','production_head']::app_role[])
);
