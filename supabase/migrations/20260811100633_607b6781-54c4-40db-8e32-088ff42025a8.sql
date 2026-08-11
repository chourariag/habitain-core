-- 1. Attendance: restrict self-edit to same/previous day records
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance_records;
CREATE POLICY "Users can update own recent attendance"
ON public.attendance_records FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND date >= ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)
)
WITH CHECK (
  user_id = auth.uid()
  AND date >= ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1)
);

-- 2. Expense entries: submitters can only edit pre-approval records
DROP POLICY IF EXISTS "Authorized update expense entries" ON public.expense_entries;
CREATE POLICY "Authorized update expense entries"
ON public.expense_entries FOR UPDATE TO authenticated
USING (
  (submitted_by = auth.uid() AND status = ANY (ARRAY['draft'::text, 'pending_hr'::text, 'flagged'::text]))
  OR get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'finance_director'::app_role, 'sales_director'::app_role, 'architecture_director'::app_role, 'hr_executive'::app_role, 'finance_manager'::app_role, 'production_head'::app_role, 'head_operations'::app_role])
)
WITH CHECK (
  (submitted_by = auth.uid() AND status = ANY (ARRAY['draft'::text, 'pending_hr'::text, 'flagged'::text]))
  OR get_user_role(auth.uid()) = ANY (ARRAY['super_admin'::app_role, 'managing_director'::app_role, 'finance_director'::app_role, 'sales_director'::app_role, 'architecture_director'::app_role, 'hr_executive'::app_role, 'finance_manager'::app_role, 'production_head'::app_role, 'head_operations'::app_role])
);

-- 3. Material transfers: restrict INSERT to operational roles
DROP POLICY IF EXISTS "Authenticated users can create transfers" ON public.material_transfers;
CREATE POLICY "Operational roles can create transfers"
ON public.material_transfers FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    is_full_admin(auth.uid())
    OR is_director(auth.uid())
    OR user_has_any_role(auth.uid(), ARRAY['head_operations'::app_role, 'production_head'::app_role, 'site_installation_mgr'::app_role, 'procurement'::app_role, 'procurement_assistant'::app_role, 'purchase_assistant'::app_role, 'stores_executive'::app_role, 'logistics_manager'::app_role, 'site_engineer'::app_role, 'factory_supervisor'::app_role, 'factory_floor_supervisor'::app_role, 'senior_factory_supervisor'::app_role])
  )
);