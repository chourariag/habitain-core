DROP POLICY IF EXISTS "Authenticated users can view billing milestones" ON public.project_billing_milestones;

CREATE POLICY "Finance and leadership can view billing milestones"
ON public.project_billing_milestones
FOR SELECT TO authenticated
USING (
  public.user_has_any_role(auth.uid(), ARRAY[
    'super_admin','managing_director','chairman','director',
    'finance_director','finance_manager','accounts_executive',
    'sales_director','head_of_projects','head_operations',
    'planning_head','planning_engineer','costing_engineer','quantity_surveyor'
  ]::app_role[])
);