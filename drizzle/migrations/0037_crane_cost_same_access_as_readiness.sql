DROP POLICY IF EXISTS "Cost readers view crane cost" ON public.site_readiness_crane_cost;
CREATE POLICY "Site readiness readers view crane cost" ON public.site_readiness_crane_cost FOR SELECT TO authenticated
  USING (public.can_read_site_readiness(auth.uid(), project_id)
    OR public.is_tier1_or_super(auth.uid())
    OR public.user_has_any_role(auth.uid(), '{finance_manager,head_of_projects,planning_head}'::app_role[]));
DROP POLICY IF EXISTS "Readers view readiness change log" ON public.site_readiness_change_log;
CREATE POLICY "Readers view readiness change log" ON public.site_readiness_change_log FOR SELECT TO authenticated
  USING (public.can_read_site_readiness(auth.uid(), project_id)
    OR (source_table = 'site_readiness_crane_cost' AND (public.is_tier1_or_super(auth.uid())
        OR public.user_has_any_role(auth.uid(), '{finance_manager,head_of_projects,planning_head}'::app_role[]))));