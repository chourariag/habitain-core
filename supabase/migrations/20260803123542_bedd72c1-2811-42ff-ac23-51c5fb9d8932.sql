DROP POLICY IF EXISTS "Contracts: editors read" ON public.contracts_register;
CREATE POLICY "Contracts: editors read" ON public.contracts_register
FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','sales_director','architecture_director','head_operations','head_of_projects','principal_architect','operations_architect','procurement','planning_head','planning_engineer','finance_manager','sales_executive','sales_associate','site_installation_mgr']::app_role[]));