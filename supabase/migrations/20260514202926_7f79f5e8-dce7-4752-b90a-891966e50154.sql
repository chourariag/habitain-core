
-- 1) Drop anon SELECT policies on portal/journal/milestone tables
DROP POLICY IF EXISTS "Anon can view portal documents" ON public.client_portal_documents;
DROP POLICY IF EXISTS "Anyone can view journal entries" ON public.construction_journal;
DROP POLICY IF EXISTS "Anyone can view milestone photos" ON public.client_milestone_photos;

-- Ensure authenticated-only read remains
CREATE POLICY "Authenticated can view journal entries"
  ON public.construction_journal FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can view milestone photos"
  ON public.client_milestone_photos FOR SELECT
  TO authenticated USING (true);

-- 2) Restrict sales_deals SELECT to sales/finance/director roles
DROP POLICY IF EXISTS "Authenticated can view sales_deals" ON public.sales_deals;
CREATE POLICY "Sales roles can view sales_deals"
  ON public.sales_deals FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'sales_director'::app_role,'architecture_director'::app_role,'head_operations'::app_role,
      'finance_manager'::app_role,'accounts_executive'::app_role,'principal_architect'::app_role,
      'project_architect'::app_role
    ])
  );

-- 3) Restrict clients_master SELECT
DROP POLICY IF EXISTS "Auth read clients_master" ON public.clients_master;
CREATE POLICY "Sales/Finance can view clients_master"
  ON public.clients_master FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,
      'sales_director'::app_role,'architecture_director'::app_role,'head_operations'::app_role,
      'finance_manager'::app_role,'accounts_executive'::app_role,'principal_architect'::app_role,
      'project_architect'::app_role
    ])
  );

-- 4) Restrict design_consultants SELECT to architecture/director roles
DROP POLICY IF EXISTS "Authenticated can view design_consultants" ON public.design_consultants;
CREATE POLICY "Architects can view design_consultants"
  ON public.design_consultants FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) = ANY (ARRAY[
      'super_admin'::app_role,'managing_director'::app_role,'architecture_director'::app_role,
      'principal_architect'::app_role,'project_architect'::app_role,'structural_architect'::app_role,
      'operations_architect'::app_role,'head_operations'::app_role,'planning_engineer'::app_role
    ])
  );

-- 5) Restrict P&L uploads and line items to finance roles
DROP POLICY IF EXISTS "Authenticated can view P&L uploads" ON public.profit_loss_uploads;
CREATE POLICY "Finance can view P&L uploads"
  ON public.profit_loss_uploads FOR SELECT
  TO authenticated
  USING (can_manage_finance_pl(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view P&L line items" ON public.profit_loss_line_items;
CREATE POLICY "Finance can view P&L line items"
  ON public.profit_loss_line_items FOR SELECT
  TO authenticated
  USING (can_manage_finance_pl(auth.uid()));

-- 6) Restrict floor-plans storage upload/update to floor-plan managers
DROP POLICY IF EXISTS floor_plans_upload_authed ON storage.objects;
DROP POLICY IF EXISTS floor_plans_update_authed ON storage.objects;

CREATE POLICY floor_plans_upload_managers
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'floor-plans' AND public.can_manage_floor_plan(auth.uid()));

CREATE POLICY floor_plans_update_managers
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'floor-plans' AND public.can_manage_floor_plan(auth.uid()))
  WITH CHECK (bucket_id = 'floor-plans' AND public.can_manage_floor_plan(auth.uid()));
