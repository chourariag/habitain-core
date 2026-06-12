
-- advance_requests: drop broad ALL policies for production_head and head_operations
DROP POLICY IF EXISTS "Production head can manage advance requests" ON public.advance_requests;
DROP POLICY IF EXISTS "Head ops can manage advance requests" ON public.advance_requests;

-- payment_approvals: restrict insert/update to finance + directors
DROP POLICY IF EXISTS "Authenticated users can insert payment approvals" ON public.payment_approvals;
DROP POLICY IF EXISTS "Authenticated users can update payment approvals" ON public.payment_approvals;

CREATE POLICY "Finance and directors can insert payment approvals"
  ON public.payment_approvals FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'finance_manager'::app_role,'accounts_executive'::app_role,'head_operations'::app_role
    ])
  );

CREATE POLICY "Finance and directors can update payment approvals"
  ON public.payment_approvals FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'finance_manager'::app_role,'accounts_executive'::app_role
    ])
  );

-- project_variations: restrict UPDATE
DROP POLICY IF EXISTS "Authenticated users can update variations" ON public.project_variations;

CREATE POLICY "Approvers can update variations"
  ON public.project_variations FOR UPDATE TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'finance_manager'::app_role,'sales_director'::app_role,'architecture_director'::app_role,
      'head_operations'::app_role,'principal_architect'::app_role
    ])
    OR auth.uid() = initiated_by
  );

-- sales_deals: tighten SELECT to sales + directors + head_ops
DROP POLICY IF EXISTS "Sales roles can view sales_deals" ON public.sales_deals;

CREATE POLICY "Sales roles can view sales_deals"
  ON public.sales_deals FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'sales_director'::app_role,'architecture_director'::app_role,'head_operations'::app_role,
      'sales_executive'::app_role,'marketing'::app_role
    ])
  );

-- Revoke anon EXECUTE on SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.can_edit_design_schedule(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_edit_design_schedule(uuid) TO authenticated, service_role;
