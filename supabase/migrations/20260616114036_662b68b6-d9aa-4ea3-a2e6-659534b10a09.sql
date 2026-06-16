
CREATE OR REPLACE FUNCTION public.user_has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = _user_id AND is_active = true AND role = ANY(_roles)
  )
$$;

-- client_milestone_photos
DROP POLICY IF EXISTS "Authenticated users can manage milestone photos" ON public.client_milestone_photos;
CREATE POLICY "Site/ops can manage milestone photos" ON public.client_milestone_photos
  FOR ALL TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','architecture_director','head_operations','production_head','site_installation_mgr','site_engineer']::app_role[]))
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','architecture_director','head_operations','production_head','site_installation_mgr','site_engineer']::app_role[]));

-- construction_journal
DROP POLICY IF EXISTS "Authenticated users can manage journal entries" ON public.construction_journal;
CREATE POLICY "Site/ops can manage journal entries" ON public.construction_journal
  FOR ALL TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','site_installation_mgr','site_engineer']::app_role[]))
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','site_installation_mgr','site_engineer']::app_role[]));

-- material_alerts
DROP POLICY IF EXISTS "Authenticated users can create material alerts" ON public.material_alerts;
DROP POLICY IF EXISTS "Authenticated users can update material alerts" ON public.material_alerts;
CREATE POLICY "Planning/procurement/ops can create material alerts" ON public.material_alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer','procurement','procurement_assistant','stores_executive','production_head','site_installation_mgr','logistics_manager']::app_role[]));
CREATE POLICY "Planning/procurement/ops can update material alerts" ON public.material_alerts
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer','procurement','procurement_assistant','stores_executive','production_head','site_installation_mgr','logistics_manager']::app_role[]));

-- project_budget_manual_entries
DROP POLICY IF EXISTS "Authenticated can insert manual budget entries" ON public.project_budget_manual_entries;
DROP POLICY IF EXISTS "Authenticated can update manual budget entries" ON public.project_budget_manual_entries;
CREATE POLICY "Finance/procurement can insert manual budget entries" ON public.project_budget_manual_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','head_operations']::app_role[]));
CREATE POLICY "Finance/procurement can update manual budget entries" ON public.project_budget_manual_entries
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','head_operations']::app_role[]));

-- project_grns
DROP POLICY IF EXISTS "Authenticated can insert GRNs" ON public.project_grns;
DROP POLICY IF EXISTS "Authenticated can update GRNs" ON public.project_grns;
CREATE POLICY "Procurement/stores/finance can insert GRNs" ON public.project_grns
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','stores_executive','head_operations','production_head','site_installation_mgr','logistics_manager']::app_role[]));
CREATE POLICY "Procurement/stores/finance can update GRNs" ON public.project_grns
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','procurement','procurement_assistant','stores_executive','head_operations','production_head','site_installation_mgr','logistics_manager']::app_role[]));

-- project_material_plan_items
DROP POLICY IF EXISTS "Authenticated users can insert material plan items" ON public.project_material_plan_items;
DROP POLICY IF EXISTS "Authenticated users can update material plan items" ON public.project_material_plan_items;
CREATE POLICY "Planning/procurement/ops can insert material plan items" ON public.project_material_plan_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer','costing_engineer','procurement','procurement_assistant','stores_executive','production_head']::app_role[]));
CREATE POLICY "Planning/procurement/ops can update material plan items" ON public.project_material_plan_items
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer','costing_engineer','procurement','procurement_assistant','stores_executive','production_head']::app_role[]));

-- project_scope_of_work
DROP POLICY IF EXISTS "Authenticated users can insert scope" ON public.project_scope_of_work;
DROP POLICY IF EXISTS "Authenticated users can update scope" ON public.project_scope_of_work;
DROP POLICY IF EXISTS "Authenticated users can delete scope" ON public.project_scope_of_work;
CREATE POLICY "Architects/planning can insert scope" ON public.project_scope_of_work
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Architects/planning can update scope" ON public.project_scope_of_work
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Directors can delete scope" ON public.project_scope_of_work
  FOR DELETE TO authenticated USING (public.is_director(auth.uid()));

-- project_scope_items
DROP POLICY IF EXISTS "Authenticated users can insert scope items" ON public.project_scope_items;
DROP POLICY IF EXISTS "Authenticated users can update scope items" ON public.project_scope_items;
DROP POLICY IF EXISTS "Authenticated users can delete scope items" ON public.project_scope_items;
CREATE POLICY "Architects/planning can insert scope items" ON public.project_scope_items
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Architects/planning can update scope items" ON public.project_scope_items
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Directors can delete scope items" ON public.project_scope_items
  FOR DELETE TO authenticated USING (public.is_director(auth.uid()));

-- project_scope_exclusions
DROP POLICY IF EXISTS "Authenticated users can insert exclusions" ON public.project_scope_exclusions;
DROP POLICY IF EXISTS "Authenticated users can update exclusions" ON public.project_scope_exclusions;
DROP POLICY IF EXISTS "Authenticated users can delete exclusions" ON public.project_scope_exclusions;
CREATE POLICY "Architects/planning can insert exclusions" ON public.project_scope_exclusions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Architects/planning can update exclusions" ON public.project_scope_exclusions
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','architecture_director','sales_director','principal_architect','senior_architect','project_architect','structural_architect','operations_architect','planning_head','planning_engineer','head_operations']::app_role[]));
CREATE POLICY "Directors can delete exclusions" ON public.project_scope_exclusions
  FOR DELETE TO authenticated USING (public.is_director(auth.uid()));

-- project_stages
DROP POLICY IF EXISTS "Authenticated can insert project_stages" ON public.project_stages;
DROP POLICY IF EXISTS "Authenticated can update project_stages" ON public.project_stages;
CREATE POLICY "Production/planning/ops can insert project_stages" ON public.project_stages
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));
CREATE POLICY "Production/planning/ops can update project_stages" ON public.project_stages
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));

-- project_subtasks
DROP POLICY IF EXISTS "Authenticated users can insert project subtasks" ON public.project_subtasks;
DROP POLICY IF EXISTS "Authenticated users can update project subtasks" ON public.project_subtasks;
DROP POLICY IF EXISTS "Authenticated users can delete project subtasks" ON public.project_subtasks;
DROP POLICY IF EXISTS "Authenticated users can manage project subtasks" ON public.project_subtasks;
CREATE POLICY "Planning/production/ops can insert subtasks" ON public.project_subtasks
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));
CREATE POLICY "Planning/production/ops can update subtasks" ON public.project_subtasks
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));
CREATE POLICY "Planning/ops can delete subtasks" ON public.project_subtasks
  FOR DELETE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer']::app_role[]));

-- project_tasks
DROP POLICY IF EXISTS "Authenticated users can insert project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Authenticated users can update project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Authenticated users can delete project tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Authenticated users can manage project tasks" ON public.project_tasks;
CREATE POLICY "Planning/production/ops can insert project tasks" ON public.project_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));
CREATE POLICY "Planning/production/ops can update project tasks" ON public.project_tasks
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','production_head','planning_head','planning_engineer','site_installation_mgr','factory_floor_supervisor','factory_supervisor']::app_role[]));
CREATE POLICY "Planning/ops can delete project tasks" ON public.project_tasks
  FOR DELETE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','planning_head','planning_engineer']::app_role[]));

-- project_tender_budget
DROP POLICY IF EXISTS "Authenticated can update tender budgets" ON public.project_tender_budget;
DROP POLICY IF EXISTS "Authenticated users can update tender budgets" ON public.project_tender_budget;
CREATE POLICY "Finance/planning can update tender budgets" ON public.project_tender_budget
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','planning_head','planning_engineer','costing_engineer','head_operations']::app_role[]));

-- quotation_versions
DROP POLICY IF EXISTS "Authenticated users can create quotation versions" ON public.quotation_versions;
DROP POLICY IF EXISTS "Authenticated users can update quotation versions" ON public.quotation_versions;
DROP POLICY IF EXISTS "Authenticated can insert quotation versions" ON public.quotation_versions;
DROP POLICY IF EXISTS "Authenticated can update quotation versions" ON public.quotation_versions;
CREATE POLICY "Sales can create quotation versions" ON public.quotation_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','sales_executive','head_operations','principal_architect','project_architect','marketing']::app_role[]));
CREATE POLICY "Sales can update quotation versions" ON public.quotation_versions
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','sales_executive','head_operations','principal_architect','project_architect','marketing']::app_role[]));

-- sales_handover_checklists
DROP POLICY IF EXISTS "Authenticated users can manage sales handover checklists" ON public.sales_handover_checklists;
DROP POLICY IF EXISTS "Authenticated users can view sales handover checklists" ON public.sales_handover_checklists;
CREATE POLICY "Authenticated can view sales handover checklists" ON public.sales_handover_checklists
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Sales/ops can insert sales handover checklists" ON public.sales_handover_checklists
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','sales_executive','head_operations']::app_role[]));
CREATE POLICY "Sales/ops can update sales handover checklists" ON public.sales_handover_checklists
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director','sales_executive','head_operations']::app_role[]));
CREATE POLICY "Sales directors can delete sales handover checklists" ON public.sales_handover_checklists
  FOR DELETE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','sales_director']::app_role[]));

-- site_diary
DROP POLICY IF EXISTS "Authenticated users can insert site diary" ON public.site_diary;
DROP POLICY IF EXISTS "Authenticated can insert site diary" ON public.site_diary;
CREATE POLICY "Site/ops can insert site diary" ON public.site_diary
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','site_installation_mgr','site_engineer','production_head']::app_role[]));

-- subcontractor_schedules
DROP POLICY IF EXISTS "Authenticated users can insert subcontractor schedules" ON public.subcontractor_schedules;
DROP POLICY IF EXISTS "Authenticated users can update subcontractor schedules" ON public.subcontractor_schedules;
DROP POLICY IF EXISTS "Authenticated can insert subcontractor schedules" ON public.subcontractor_schedules;
DROP POLICY IF EXISTS "Authenticated can update subcontractor schedules" ON public.subcontractor_schedules;
CREATE POLICY "Site/ops can insert subcontractor schedules" ON public.subcontractor_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','site_installation_mgr','production_head','planning_head','planning_engineer','logistics_manager']::app_role[]));
CREATE POLICY "Site/ops can update subcontractor schedules" ON public.subcontractor_schedules
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','head_operations','site_installation_mgr','production_head','planning_head','planning_engineer','logistics_manager']::app_role[]));

-- variation_orders
DROP POLICY IF EXISTS "Authenticated users can manage variation orders" ON public.variation_orders;
CREATE POLICY "Authenticated can view variation orders" ON public.variation_orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Site/ops/finance can insert variation orders" ON public.variation_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','head_operations','site_installation_mgr','production_head']::app_role[]));
CREATE POLICY "Site/ops/finance can update variation orders" ON public.variation_orders
  FOR UPDATE TO authenticated
  USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','chairman','finance_director','finance_manager','accounts_executive','head_operations','site_installation_mgr','production_head']::app_role[]));
CREATE POLICY "Directors can delete variation orders" ON public.variation_orders
  FOR DELETE TO authenticated USING (public.is_director(auth.uid()));
