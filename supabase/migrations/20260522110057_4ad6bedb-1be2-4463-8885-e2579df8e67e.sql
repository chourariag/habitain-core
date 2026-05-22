
-- Idempotent: drop existing same-named policies first
DO $$
DECLARE r record;
DECLARE policies text[] := ARRAY[
  ['projects','Allowed roles can delete projects'],
  ['modules','Authorized can delete modules'],
  ['panels','Authorized can delete panels'],
  ['production_stages','Production can delete stages'],
  ['qc_inspections','QC can delete inspections'],
  ['qc_inspection_items','QC can delete inspection items'],
  ['qc_checklist_items','Directors can delete checklist items'],
  ['ncr_register','QC can delete NCRs'],
  ['labour_claims','Admins can delete labour claims'],
  ['labour_approvals','Admins can delete labour approvals'],
  ['dispute_log','Admins can delete disputes'],
  ['material_requests','Admins can delete material requests'],
  ['material_plan_items','Planners can delete material plan items'],
  ['inventory_items','Stores and directors can delete inventory items'],
  ['purchase_orders','Authorized can delete purchase orders'],
  ['drawings','Architects can delete drawings'],
  ['design_queries','Authorized can delete design queries'],
  ['design_stages','Architects can delete design stages'],
  ['design_consultants','Architects can delete design consultants'],
  ['project_design_files','Architects can delete project design files'],
  ['site_readiness','Operations can delete site readiness'],
  ['dispatch_log','Operations can delete dispatch log'],
  ['installation_checklist','Operations can delete installation checklist'],
  ['site_diary','Operations can delete site diary'],
  ['handover_pack','Operations can delete handover pack'],
  ['rm_tickets','Authorized can delete rm tickets'],
  ['amc_contracts','Directors can delete amc contracts'],
  ['sales_deals','Sales directors can delete sales deals'],
  ['sales_stage_history','Super admin can delete sales stage history'],
  ['sales_amc_contacts','Sales can delete amc contacts'],
  ['announcements','Directors can delete announcements'],
  ['notifications','Users can delete own notifications'],
  ['finance_mis_uploads','Finance directors can delete MIS'],
  ['app_settings','Super admin can delete app settings'],
  ['attendance_records','HR or admin can delete attendance records'],
  ['rate_cards','Directors can delete rate cards']
];
DECLARE i int;
BEGIN
  FOR i IN 1..array_length(policies,1) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policies[i][2], policies[i][1]);
  END LOOP;
END $$;

-- PROJECTS
CREATE POLICY "Allowed roles can delete projects" ON public.projects FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.auth_user_id = auth.uid()
  AND profiles.role IN ('super_admin','managing_director')));

-- MODULES
CREATE POLICY "Authorized can delete modules" ON public.modules FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','planning_engineer'));

-- PANELS
CREATE POLICY "Authorized can delete panels" ON public.panels FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','planning_engineer'));

-- PRODUCTION STAGES
CREATE POLICY "Production can delete stages" ON public.production_stages FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','production_head'));

-- QC INSPECTIONS
CREATE POLICY "QC can delete inspections" ON public.qc_inspections FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','qc_inspector','production_head'));

-- QC INSPECTION ITEMS
CREATE POLICY "QC can delete inspection items" ON public.qc_inspection_items FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','qc_inspector','production_head'));

-- QC CHECKLIST ITEMS
CREATE POLICY "Directors can delete checklist items" ON public.qc_checklist_items FOR DELETE
USING (is_director(auth.uid()));

-- NCR REGISTER
CREATE POLICY "QC can delete NCRs" ON public.ncr_register FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','qc_inspector','production_head','head_operations'));

-- LABOUR CLAIMS
CREATE POLICY "Admins can delete labour claims" ON public.labour_claims FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','production_head'));

-- LABOUR APPROVALS
CREATE POLICY "Admins can delete labour approvals" ON public.labour_approvals FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director'));

-- DISPUTE LOG
CREATE POLICY "Admins can delete disputes" ON public.dispute_log FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director'));

-- MATERIAL REQUESTS
CREATE POLICY "Admins can delete material requests" ON public.material_requests FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','procurement'));

-- MATERIAL PLAN ITEMS
CREATE POLICY "Planners can delete material plan items" ON public.material_plan_items FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','planning_engineer','procurement'));

-- INVENTORY ITEMS
CREATE POLICY "Stores and directors can delete inventory items" ON public.inventory_items FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','stores_executive'));

-- PURCHASE ORDERS
CREATE POLICY "Authorized can delete purchase orders" ON public.purchase_orders FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','procurement'));

-- DRAWINGS
CREATE POLICY "Architects can delete drawings" ON public.drawings FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','principal_architect','project_architect'));

-- DESIGN QUERIES
CREATE POLICY "Authorized can delete design queries" ON public.design_queries FOR DELETE
USING ((raised_by = auth.uid())
  OR get_user_role(auth.uid())::text IN ('super_admin','managing_director','principal_architect'));

-- DESIGN STAGES
CREATE POLICY "Architects can delete design stages" ON public.design_stages FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','principal_architect','project_architect'));

-- DESIGN CONSULTANTS
CREATE POLICY "Architects can delete design consultants" ON public.design_consultants FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','principal_architect','project_architect'));

-- PROJECT DESIGN FILES
CREATE POLICY "Architects can delete project design files" ON public.project_design_files FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','principal_architect','project_architect'));

-- SITE READINESS
CREATE POLICY "Operations can delete site readiness" ON public.site_readiness FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations'));

-- DISPATCH LOG
CREATE POLICY "Operations can delete dispatch log" ON public.dispatch_log FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations'));

-- INSTALLATION CHECKLIST
CREATE POLICY "Operations can delete installation checklist" ON public.installation_checklist FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations'));

-- SITE DIARY
CREATE POLICY "Operations can delete site diary" ON public.site_diary FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations'));

-- HANDOVER PACK
CREATE POLICY "Operations can delete handover pack" ON public.handover_pack FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations'));

-- RM TICKETS
CREATE POLICY "Authorized can delete rm tickets" ON public.rm_tickets FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','head_operations','delivery_rm_lead'));

-- AMC CONTRACTS
CREATE POLICY "Directors can delete amc contracts" ON public.amc_contracts FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','sales_director'));

-- SALES DEALS
CREATE POLICY "Sales directors can delete sales deals" ON public.sales_deals FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','sales_director'));

-- SALES STAGE HISTORY
CREATE POLICY "Super admin can delete sales stage history" ON public.sales_stage_history FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director'));

-- SALES AMC CONTACTS
CREATE POLICY "Sales can delete amc contacts" ON public.sales_amc_contacts FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','sales_director'));

-- ANNOUNCEMENTS
CREATE POLICY "Directors can delete announcements" ON public.announcements FOR DELETE
USING (is_director(auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE
USING ((recipient_id = auth.uid()) OR is_full_admin(auth.uid()));

-- FINANCE MIS UPLOADS
CREATE POLICY "Finance directors can delete MIS" ON public.finance_mis_uploads FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','finance_director'));

-- APP SETTINGS
CREATE POLICY "Super admin can delete app settings" ON public.app_settings FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director'));

-- ATTENDANCE RECORDS
CREATE POLICY "HR or admin can delete attendance records" ON public.attendance_records FOR DELETE
USING (get_user_role(auth.uid())::text IN ('super_admin','managing_director','hr_manager'));

-- RATE CARDS
CREATE POLICY "Directors can delete rate cards" ON public.rate_cards FOR DELETE
USING (is_director(auth.uid()));
