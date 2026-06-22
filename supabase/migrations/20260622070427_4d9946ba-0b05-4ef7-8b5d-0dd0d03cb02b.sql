DROP POLICY IF EXISTS "Employees view own payroll_config" ON public.payroll_config;
CREATE POLICY "Employees view own payroll_config"
ON public.payroll_config
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  OR public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','finance_manager']::app_role[])
);