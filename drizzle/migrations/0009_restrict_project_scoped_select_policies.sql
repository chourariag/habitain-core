DROP POLICY IF EXISTS "Authenticated can view daily_production_logs" ON public.daily_production_logs;
CREATE POLICY "Authenticated can view daily_production_logs" ON public.daily_production_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.modules AS m
    WHERE m.id = daily_production_logs.module_id
      AND public.user_can_access_project(auth.uid(), m.project_id)
  )
);

DROP POLICY IF EXISTS "Authenticated users can read delivery checklists" ON public.delivery_checklists;
CREATE POLICY "Authenticated users can read delivery checklists" ON public.delivery_checklists
FOR SELECT TO authenticated
USING (public.user_can_access_project(auth.uid(), delivery_checklists.project_id));

DROP POLICY IF EXISTS "Authenticated can view modules" ON public.modules;
CREATE POLICY "Authenticated can view modules" ON public.modules
FOR SELECT TO authenticated
USING (public.user_can_access_project(auth.uid(), modules.project_id));