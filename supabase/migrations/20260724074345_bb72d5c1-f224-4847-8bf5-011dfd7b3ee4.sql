
-- amc_contracts: restrict SELECT to finance/sales leadership
DROP POLICY IF EXISTS "Authenticated can view amc_contracts" ON public.amc_contracts;
CREATE POLICY "Finance and sales leadership can view amc_contracts"
ON public.amc_contracts FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'sales_director'::app_role,'finance_director'::app_role,'finance_manager'::app_role,
  'accounts_executive'::app_role
]));

-- boq_items: restrict SELECT to finance/planning/architecture leadership
DROP POLICY IF EXISTS "boq_read_all_authenticated" ON public.boq_items;
CREATE POLICY "boq_read_finance_planning_arch"
ON public.boq_items FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,
  'planning_head'::app_role,'planning_engineer'::app_role,'costing_engineer'::app_role,
  'quantity_surveyor'::app_role,'architecture_director'::app_role,
  'principal_architect'::app_role,'project_architect'::app_role,
  'head_operations'::app_role,'head_of_projects'::app_role
]));

-- project_boq: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view BOQ" ON public.project_boq;
CREATE POLICY "Finance/planning/arch can view project_boq"
ON public.project_boq FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,
  'planning_head'::app_role,'planning_engineer'::app_role,'costing_engineer'::app_role,
  'quantity_surveyor'::app_role,'architecture_director'::app_role,
  'principal_architect'::app_role,'project_architect'::app_role,
  'head_operations'::app_role,'head_of_projects'::app_role
]));

-- project_boq_items: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view BOQ items" ON public.project_boq_items;
CREATE POLICY "Finance/planning/arch can view project_boq_items"
ON public.project_boq_items FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,
  'planning_head'::app_role,'planning_engineer'::app_role,'costing_engineer'::app_role,
  'quantity_surveyor'::app_role,'architecture_director'::app_role,
  'principal_architect'::app_role,'project_architect'::app_role,
  'head_operations'::app_role,'head_of_projects'::app_role
]));

-- project_tender_budget: restrict SELECT to finance/planning/costing
DROP POLICY IF EXISTS "Authenticated users can view tender budgets" ON public.project_tender_budget;
CREATE POLICY "Finance/planning/costing can view tender budgets"
ON public.project_tender_budget FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,
  'planning_head'::app_role,'planning_engineer'::app_role,'costing_engineer'::app_role,
  'head_operations'::app_role
]));

-- project_tender_budget_items: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view tender budget items" ON public.project_tender_budget_items;
CREATE POLICY "Finance/planning/costing can view tender budget items"
ON public.project_tender_budget_items FOR SELECT TO authenticated
USING (user_has_any_role(auth.uid(), ARRAY[
  'super_admin'::app_role,'managing_director'::app_role,'chairman'::app_role,
  'finance_director'::app_role,'finance_manager'::app_role,'accounts_executive'::app_role,
  'planning_head'::app_role,'planning_engineer'::app_role,'costing_engineer'::app_role,
  'head_operations'::app_role
]));
