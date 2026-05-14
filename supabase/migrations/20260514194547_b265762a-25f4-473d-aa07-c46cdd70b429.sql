
-- ============ kpi_tracked_employees ============
CREATE TABLE IF NOT EXISTS public.kpi_tracked_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name_hint text,
  role_hint text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kpi_tracked_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracked_emp_read" ON public.kpi_tracked_employees
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tracked_emp_write" ON public.kpi_tracked_employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin') OR public.is_md(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'super_admin') OR public.is_md(auth.uid()));

CREATE TRIGGER trg_kpi_tracked_emp_updated
  BEFORE UPDATE ON public.kpi_tracked_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ kpi_md_notes ============
CREATE TABLE IF NOT EXISTS public.kpi_md_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month date NOT NULL,
  note text NOT NULL,
  written_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);
ALTER TABLE public.kpi_md_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "md_notes_read" ON public.kpi_md_notes
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_director(auth.uid())
  );
CREATE POLICY "md_notes_write" ON public.kpi_md_notes
  FOR ALL TO authenticated
  USING (public.is_md(auth.uid()))
  WITH CHECK (public.is_md(auth.uid()));

CREATE TRIGGER trg_kpi_md_notes_updated
  BEFORE UPDATE ON public.kpi_md_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ extend kpi_snapshots ============
ALTER TABLE public.kpi_snapshots
  ADD COLUMN IF NOT EXISTS period_type text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS period_date date,
  ADD COLUMN IF NOT EXISTS metric_payload jsonb DEFAULT '{}'::jsonb;

UPDATE public.kpi_snapshots SET period_date = week_start_date WHERE period_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_user_period ON public.kpi_snapshots(user_id, period_type, period_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_snapshots_user_kpi_period ON public.kpi_snapshots(user_id, kpi_key, period_type, period_date);

-- ============ seed kpi_definitions ============
INSERT INTO public.kpi_definitions (role, kpi_name, kpi_key, target_value, unit, measurement_period, data_source_table, coaching_template_below, coaching_template_above, is_active)
VALUES
-- Rakesh (factory_floor_supervisor)
('factory_floor_supervisor','Daily Measurement Submission Rate','rakesh.measurement_submission_rate',100,'%','daily','daily_measurements','Submit measurement sheet every working day.','Excellent — 100% submissions.',true),
('factory_floor_supervisor','Stage Checklist Completion Rate','rakesh.stage_checklist_completion',95,'%','weekly','project_tasks','Complete all checklist items before moving stage.','All checklists ticked on time.',true),
('factory_floor_supervisor','NCR Rate per Module','rakesh.ncr_rate_per_module',2,'count','weekly','ncr_register','High NCR count — review process discipline.','NCRs within target.',true),
('factory_floor_supervisor','On-time Stage Completion','rakesh.stage_on_time_pct',90,'%','weekly','module_schedule','Stages slipping — escalate blockers earlier.','Stages on schedule.',true),

-- Azad (production_head)
('production_head','On-time Module Dispatch','azad.module_on_time_dispatch',95,'%','weekly','dispatch_packs','Modules dispatching late vs planned.','Dispatch on plan.',true),
('production_head','NCR Closure Time (hrs)','azad.ncr_closure_hours',48,'hours','weekly','ncr_register','NCRs closing slowly — follow up daily.','NCRs closing within SLA.',true),
('production_head','Daily Labour Attendance','azad.labour_attendance_pct',85,'%','daily','attendance_records','Attendance below 85% — review absentees.','Attendance strong.',true),
('production_head','Labour Cost vs Budget','azad.labour_cost_variance',0,'%','weekly','module_team_assignments','Labour cost over budget.','Labour cost under control.',true),

-- Awaiz (site_installation_mgr)
('site_installation_mgr','Installation Sequence Filed T-14','awaiz.installation_sequence_lead_days',14,'days','weekly','installation_sequence_docs','File installation sequence 14 days before dispatch.','Sequence filed on time.',true),
('site_installation_mgr','Site Diary Submission Rate','awaiz.site_diary_submission_rate',100,'%','daily','site_diary','Submit site diary every active day.','Diary submitted daily.',true),
('site_installation_mgr','Snag List Closure Rate','awaiz.snag_closure_rate',80,'%','weekly','installation_checklist','Close snags within DLP window.','Snags closing well.',true),

-- Karthik (planning_engineer)
('planning_engineer','Project Setup Completeness','karthik.setup_completeness',100,'%','weekly','project_task_schedule_uploads','Upload all 4 setup sheets per project.','Setup sheets complete.',true),
('planning_engineer','Schedule Accuracy','karthik.schedule_variance_pct',10,'%','weekly','project_tasks','Schedule slipping vs plan.','Schedule accurate.',true),
('planning_engineer','Material Plan Accuracy','karthik.material_plan_accuracy',90,'%','weekly','project_grns','Materials arriving after stage start.','Material planning on point.',true),

-- Nakeem (costing_engineer)
('costing_engineer','BOQ Upload Completeness','nakeem.boq_completeness',100,'%','weekly','boq_items','Upload BOQ for every active project.','BOQ uploads complete.',true),
('costing_engineer','WO/PO Approval Turnaround','nakeem.wo_approval_hours',24,'hours','daily','work_orders','Approve WOs/POs within 24 hours.','Approvals fast.',true),
('costing_engineer','Variation Costing Turnaround','nakeem.variation_turnaround_hours',48,'hours','weekly','project_variations','Variation costing taking over 48h.','Variations costed quickly.',true),

-- Vijay (procurement)
('procurement','PO Lead Time Hit Rate','vijay.po_lead_time_hit',90,'%','weekly','work_orders','POs raised too late — materials arriving after stage start.','POs raised in time.',true),
('procurement','GRN Completion within 24h','vijay.grn_within_24h',100,'%','weekly','project_grns','GRNs not booked within 24 hours.','GRNs prompt.',true),
('procurement','Vendor On-time Delivery','vijay.vendor_on_time_delivery',85,'%','weekly','project_grns','Vendor deliveries delayed.','Vendors performing well.',true),

-- Tagore (qc_inspector)
('qc_inspector','QC Inspection Turnaround (hrs)','tagore.qc_turnaround_hours',4,'hours','daily','ncr_register','Inspections taking over 4h after trigger.','Inspections on time.',true),
('qc_inspector','NCR Accuracy (rectified)','tagore.ncr_accuracy_pct',90,'%','weekly','ncr_register','Some NCRs not leading to rectification — refine criteria.','NCRs accurate.',true),
('qc_inspector','QC Checklist Completion','tagore.qc_checklist_completion',100,'%','weekly','ncr_register','Some QC checklist items missed.','All items ticked.',true),

-- Venkat (principal_architect)
('principal_architect','DQ Response Time (hrs)','venkat.dq_response_hours',48,'hours','weekly','design_queries','DQs taking over 48h to respond.','DQs answered quickly.',true),
('principal_architect','Drawing Issue On-time','venkat.drawing_on_time_pct',95,'%','weekly','drawings','Drawings issued late vs schedule.','Drawings on schedule.',true),
('principal_architect','Client Approval Turnaround','venkat.client_approval_hours',72,'hours','weekly','drawings','Client approvals lagging.','Client approvals fast.',true),

-- Mary (finance_manager)
('finance_manager','Invoice within Milestone Window','mary.invoice_within_milestone',100,'%','weekly','project_invoices','Invoices raised after milestone window.','Invoices on time.',true),
('finance_manager','Payslip by 5th of Month','mary.payslip_by_5th',100,'%','monthly','payslips','Payslips generated after 5th of month.','Payslips on time.',true),
('finance_manager','Tally TB Upload by 10th','mary.tally_upload_by_10th',100,'%','monthly','admin_audit_log','Tally TB upload missed monthly deadline.','Tally upload on time.',true),

-- Bala (delivery_rm_lead)
('delivery_rm_lead','R&M Response Time (hrs)','bala.rm_response_hours',48,'hours','weekly','rm_tickets','R&M tickets taking over 48h to respond.','R&M responses fast.',true),
('delivery_rm_lead','AMC Renewal Lead Time (days)','bala.amc_renewal_days',30,'days','weekly','amc_contracts','AMC renewals slipping past 30-day window.','AMC renewals on time.',true),

-- Sandeep (stores_executive)
('stores_executive','GRN Quantity Accuracy','sandeep.grn_qty_accuracy',98,'%','weekly','project_grns','GRN quantities not matching POs — recount.','GRNs accurate.',true),
('stores_executive','Monthly Stock Count Done','sandeep.stock_count_done',100,'%','monthly','admin_audit_log','Monthly stock count not submitted.','Stock count done.',true),
('stores_executive','Dispatch Sign-off within 2h','sandeep.dispatch_signoff_hours',2,'hours','weekly','dispatch_signoffs','Dispatch sign-offs taking too long.','Sign-offs on time.',true),

-- Suraj (head_operations)
('head_operations','Projects on Schedule','suraj.projects_on_schedule_pct',80,'%','weekly','project_tasks','Several projects slipping vs plan.','Projects on track.',true),
('head_operations','Weekly Review Completion','suraj.weekly_review_done',100,'%','weekly','admin_audit_log','Weekly schedule review not logged.','Reviews logged.',true),
('head_operations','Escalations within SLA','suraj.escalations_within_sla',90,'%','weekly','escalation_rules','Escalations not resolved within SLA.','Escalations resolved.',true)
ON CONFLICT (kpi_key) DO UPDATE SET
  kpi_name = EXCLUDED.kpi_name,
  target_value = COALESCE(public.kpi_definitions.target_value, EXCLUDED.target_value),
  unit = EXCLUDED.unit,
  measurement_period = EXCLUDED.measurement_period,
  data_source_table = EXCLUDED.data_source_table,
  coaching_template_below = EXCLUDED.coaching_template_below,
  coaching_template_above = EXCLUDED.coaching_template_above,
  is_active = true,
  updated_at = now();
