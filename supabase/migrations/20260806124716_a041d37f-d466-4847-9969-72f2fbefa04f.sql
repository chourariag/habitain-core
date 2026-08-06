-- project_grns
DROP POLICY IF EXISTS "Authenticated can view GRNs" ON public.project_grns;
CREATE POLICY "Finance procurement can view GRNs"
ON public.project_grns FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','purchase_assistant','stores_executive','head_operations','head_of_projects','production_head','planning_head','planning_engineer','costing_engineer','quantity_surveyor','logistics_manager','site_installation_mgr']::app_role[])
  OR created_by = auth.uid()
);

-- project_budget_manual_entries
DROP POLICY IF EXISTS "Authenticated can view manual budget entries" ON public.project_budget_manual_entries;
CREATE POLICY "Finance procurement can view manual budget entries"
ON public.project_budget_manual_entries FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','purchase_assistant','head_operations','head_of_projects','planning_head','planning_engineer','costing_engineer','quantity_surveyor']::app_role[])
  OR created_by = auth.uid()
);

-- quotation_versions
DROP POLICY IF EXISTS "Authenticated users can view quotation versions" ON public.quotation_versions;
CREATE POLICY "Sales leadership can view quotation versions"
ON public.quotation_versions FOR SELECT TO authenticated
USING (
  user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','director','sales_director','sales_executive','sales_associate','marketing','finance_director','finance_manager','architecture_director','head_operations','principal_architect','project_architect']::app_role[])
  OR created_by = auth.uid()
);