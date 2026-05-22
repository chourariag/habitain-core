
ALTER TABLE public.amc_contracts ADD CONSTRAINT chk_amc_contracts_status
  CHECK (status IN ('active','expired','terminated','pending','draft'));
ALTER TABLE public.amc_contracts ADD CONSTRAINT chk_amc_contracts_tier
  CHECK (tier IN ('basic','standard','premium'));
ALTER TABLE public.design_queries ADD CONSTRAINT chk_design_queries_status
  CHECK (status IN ('open','in_review','responded','resolved','closed'));
ALTER TABLE public.design_queries ADD CONSTRAINT chk_design_queries_urgency
  CHECK (urgency IN ('low','medium','high','critical','normal','High'));
ALTER TABLE public.design_queries ADD CONSTRAINT chk_design_queries_query_type
  CHECK (query_type IN ('architectural','structural','mep','interior','site','other','Other','Material Specification'));
ALTER TABLE public.design_consultants ADD CONSTRAINT chk_design_consultants_status
  CHECK (status IN ('active','inactive','pending','completed','brief_issued','awaiting_brief'));
ALTER TABLE public.design_consultants ADD CONSTRAINT chk_design_consultants_type
  CHECK (consultant_type IN ('architect','structural','mep','interior','landscape','other','Other','MEP Consultant'));
ALTER TABLE public.attendance_records ADD CONSTRAINT chk_attendance_location_type
  CHECK (location_type IN ('office','site','remote','wfh','factory'));
ALTER TABLE public.rm_tickets ADD CONSTRAINT chk_rm_tickets_status
  CHECK (status IN ('open','in_progress','resolved','closed','escalated'));

CREATE OR REPLACE VIEW public.design_queries_with_names AS
SELECT
  dq.*,
  raiser.display_name    AS raised_by_name_live,
  responder.display_name AS responded_by_name_live
FROM public.design_queries dq
LEFT JOIN public.profiles raiser    ON raiser.id    = dq.raised_by
LEFT JOIN public.profiles responder ON responder.id = dq.responded_by;

DROP POLICY IF EXISTS "Authenticated users can update site_readiness" ON public.site_readiness;
DROP POLICY IF EXISTS "Operations can update site readiness" ON public.site_readiness;
CREATE POLICY "Operations can update site readiness"
ON public.site_readiness FOR UPDATE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role,'planning_engineer'::app_role,'delivery_rm_lead'::app_role));

DROP POLICY IF EXISTS "Authenticated users can insert dispatch_log" ON public.dispatch_log;
DROP POLICY IF EXISTS "Operations can insert dispatch log" ON public.dispatch_log;
CREATE POLICY "Operations can insert dispatch log"
ON public.dispatch_log FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'head_operations'::app_role,'factory_floor_supervisor'::app_role,'delivery_rm_lead'::app_role,'stores_executive'::app_role));

DROP POLICY IF EXISTS "Sales roles can update sales_amc_contacts" ON public.sales_amc_contacts;
CREATE POLICY "Sales roles can update sales_amc_contacts"
ON public.sales_amc_contacts FOR UPDATE
USING (get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'sales_director'::app_role));

DROP POLICY IF EXISTS "Authorized users can update purchase orders" ON public.purchase_orders;
CREATE POLICY "Authorized users can update purchase orders"
ON public.purchase_orders FOR UPDATE
USING (get_user_role(auth.uid()) IN ('procurement'::app_role,'stores_executive'::app_role,'managing_director'::app_role,'super_admin'::app_role,'finance_director'::app_role,'head_operations'::app_role));

ALTER TABLE public.attendance_exports ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
DROP TRIGGER IF EXISTS trg_attendance_exports_updated_at ON public.attendance_exports;
CREATE TRIGGER trg_attendance_exports_updated_at
BEFORE UPDATE ON public.attendance_exports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.dispute_log ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
DROP TRIGGER IF EXISTS trg_dispute_log_updated_at ON public.dispute_log;
CREATE TRIGGER trg_dispute_log_updated_at
BEFORE UPDATE ON public.dispute_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales_amc_contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
DROP TRIGGER IF EXISTS trg_sales_amc_contacts_updated_at ON public.sales_amc_contacts;
CREATE TRIGGER trg_sales_amc_contacts_updated_at
BEFORE UPDATE ON public.sales_amc_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Finance roles can view MIS" ON public.finance_mis_uploads;
CREATE POLICY "Finance roles can view MIS"
ON public.finance_mis_uploads FOR SELECT
USING (
  get_user_role(auth.uid()) IN ('super_admin'::app_role,'managing_director'::app_role,'finance_director'::app_role,'sales_director'::app_role,'architecture_director'::app_role,'finance_manager'::app_role)
  OR (
    get_user_role(auth.uid()) = 'accounts_executive'::app_role
    AND uploaded_by = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date ON public.attendance_records(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_project   ON public.attendance_records(project_id);
CREATE INDEX IF NOT EXISTS idx_design_queries_project_status ON public.design_queries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_design_queries_raised_by     ON public.design_queries(raised_by);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient      ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_labour_claims_module         ON public.labour_claims(module_id);
CREATE INDEX IF NOT EXISTS idx_ncr_register_inspection      ON public.ncr_register(inspection_id);
CREATE INDEX IF NOT EXISTS idx_drawings_project             ON public.drawings(project_id);
