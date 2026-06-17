
-- KPI snapshots
DROP POLICY IF EXISTS "System can insert kpi_snapshots" ON public.kpi_snapshots;

-- Material transfers
DROP POLICY IF EXISTS "Authenticated users can update transfers" ON public.material_transfers;
CREATE POLICY "Roles can update transfers" ON public.material_transfers
FOR UPDATE TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','head_operations','production_head','site_installation_mgr','procurement','stores_executive']::app_role[]))
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','head_operations','production_head','site_installation_mgr','procurement','stores_executive']::app_role[]));

-- Notifications: remove spoofing-friendly open insert
DROP POLICY IF EXISTS "System insert notifications" ON public.notifications;

-- Project messages: only sender can update own message
DROP POLICY IF EXISTS "Users can update read_by" ON public.project_messages;
CREATE POLICY "Senders can update own messages" ON public.project_messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Project revenue margin: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view revenue margin" ON public.project_revenue_margin;
CREATE POLICY "Finance/directors/planning can view revenue margin" ON public.project_revenue_margin
FOR SELECT TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','finance_manager','accounts_executive','head_operations','planning_head','planning_engineer','costing_engineer']::app_role[]));

-- Project subtasks: drop unrestricted write policies
DROP POLICY IF EXISTS "Authenticated users can insert subtasks" ON public.project_subtasks;
DROP POLICY IF EXISTS "Authenticated users can update subtasks" ON public.project_subtasks;
DROP POLICY IF EXISTS "Authenticated users can delete subtasks" ON public.project_subtasks;

-- Red flag alerts: restrict INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert red flags" ON public.red_flag_alerts;
DROP POLICY IF EXISTS "Authenticated users can update red flags" ON public.red_flag_alerts;
CREATE POLICY "Roles can insert red flags" ON public.red_flag_alerts
FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_head','planning_engineer','production_head','site_installation_mgr']::app_role[]));
CREATE POLICY "Roles can update red flags" ON public.red_flag_alerts
FOR UPDATE TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_head','planning_engineer','production_head','site_installation_mgr']::app_role[]))
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','finance_director','sales_director','architecture_director','head_operations','planning_head','planning_engineer','production_head','site_installation_mgr']::app_role[]));

-- Site receipt checklist: restrict INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert site receipt checklists" ON public.site_receipt_checklist;
DROP POLICY IF EXISTS "Authenticated users can update site receipt checklists" ON public.site_receipt_checklist;
CREATE POLICY "Roles can insert site receipt checklists" ON public.site_receipt_checklist
FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','stores_executive','procurement']::app_role[]));
CREATE POLICY "Roles can update site receipt checklists" ON public.site_receipt_checklist
FOR UPDATE TO authenticated
USING (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','stores_executive','procurement']::app_role[]))
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','site_installation_mgr','site_engineer','stores_executive','procurement']::app_role[]));

-- Task benchmarks: restrict INSERT
DROP POLICY IF EXISTS "Authenticated users can insert benchmarks" ON public.task_benchmarks;
CREATE POLICY "Roles can insert benchmarks" ON public.task_benchmarks
FOR INSERT TO authenticated
WITH CHECK (public.user_has_any_role(auth.uid(), ARRAY['super_admin','managing_director','head_operations','planning_head','planning_engineer','costing_engineer']::app_role[]));

-- Variation orders: drop catch-all
DROP POLICY IF EXISTS "Staff can manage variation orders" ON public.variation_orders;

-- profile_kiosk_pins: lock down (RLS enabled but no policy)
CREATE POLICY "Admin/MD can manage kiosk pins" ON public.profile_kiosk_pins
FOR ALL TO authenticated
USING (public.is_full_admin(auth.uid()))
WITH CHECK (public.is_full_admin(auth.uid()));
