-- Sale Agreement upload is a sales responsibility: give sales exec/associate read + create/edit on contracts
DROP POLICY IF EXISTS "Contracts: editors read" ON public.contracts_register;
CREATE POLICY "Contracts: editors read" ON public.contracts_register
FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','procurement','planning_head','finance_manager','sales_executive','sales_associate']::app_role[]));

DROP POLICY IF EXISTS "Contracts: editors insert" ON public.contracts_register;
CREATE POLICY "Contracts: editors insert" ON public.contracts_register
FOR INSERT TO authenticated
WITH CHECK (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','procurement','planning_head','sales_executive','sales_associate']::app_role[]));

DROP POLICY IF EXISTS "Contracts: editors update" ON public.contracts_register;
CREATE POLICY "Contracts: editors update" ON public.contracts_register
FOR UPDATE TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','procurement','planning_head','sales_executive','sales_associate']::app_role[]));

-- Sales Associate gets the same read access to the pipeline that Sales Executive has
DROP POLICY IF EXISTS "Sales roles can view sales_deals" ON public.sales_deals;
CREATE POLICY "Sales roles can view sales_deals" ON public.sales_deals
FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','sales_executive','marketing','sales_associate']::app_role[]));