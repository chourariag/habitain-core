-- Add explicit SELECT policies so reads aren't silently denied for management roles.

CREATE POLICY "Management roles can view weekly manpower plans"
ON public.weekly_manpower_plans
FOR SELECT
TO authenticated
USING (
  public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','planning_head','planning_engineer','production_head','site_installation_mgr',
          'factory_floor_supervisor','site_engineer']::app_role[]
  )
);

CREATE POLICY "Management roles can view daily actuals"
ON public.daily_actuals
FOR SELECT
TO authenticated
USING (
  public.user_has_any_role(
    auth.uid(),
    ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director',
          'head_operations','planning_head','planning_engineer','production_head','site_installation_mgr',
          'factory_floor_supervisor','site_engineer']::app_role[]
  )
);
