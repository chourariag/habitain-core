DROP POLICY IF EXISTS "Users see own leave requests" ON public.leave_requests;
CREATE POLICY "Users see own leave requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('super_admin','managing_director','hr_executive')
    OR public.is_reporting_manager_of(auth.uid(), user_id)
  );

DROP POLICY IF EXISTS "HR and managers can update leave" ON public.leave_requests;
CREATE POLICY "HR and managers can update leave" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('super_admin','hr_executive')
    OR public.is_reporting_manager_of(auth.uid(), user_id)
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('super_admin','hr_executive')
    OR public.is_reporting_manager_of(auth.uid(), user_id)
  );