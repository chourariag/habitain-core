-- KPI Definitions seed data
-- Populates kpi_definitions for all operational roles.
-- target_value = NULL (to be configured in Phase 5).
-- is_active = true for all.

INSERT INTO public.kpi_definitions
  (role, kpi_name, kpi_key, unit, target_value, measurement_period, is_active,
   coaching_template_below, coaching_template_above)
VALUES

-- ── factory_floor_supervisor ──────────────────────────────────────────────────
('factory_floor_supervisor', 'Production Output Rate',    'ffs_output_rate',    '%',   NULL, 'weekly', true,
 'Production output is below target — review bottlenecks and shift allocation.',
 'Great output this week — maintain schedule discipline.'),
('factory_floor_supervisor', 'First-Time Pass Rate',      'ffs_ftp_rate',       '%',   NULL, 'weekly', true,
 'First-time pass rate is low — increase pre-inspection checks.',
 'Excellent quality discipline — keep up the standard.'),
('factory_floor_supervisor', 'Downtime (Hours)',          'ffs_downtime_hrs',   'hrs', NULL, 'weekly', true,
 'Unplanned downtime is high — escalate maintenance issues promptly.',
 'Minimal downtime this week — good proactive maintenance.'),
('factory_floor_supervisor', 'Labour Attendance %',       'ffs_labour_attendance','%',NULL,'weekly', true,
 'Labour attendance is below target — follow up on absenteeism.',
 'Full attendance achieved — commendable.'),

-- ── qc_inspector ──────────────────────────────────────────────────────────────
('qc_inspector', 'Inspections Completed',       'qc_inspections_done',   'nos', NULL, 'weekly', true,
 'Fewer inspections than planned — prioritise backlog.',
 'All inspections completed on schedule — well done.'),
('qc_inspector', 'NCR Raised Rate',             'qc_ncr_rate',           '%',   NULL, 'weekly', true,
 'NCR rate is elevated — dig into root causes.',
 'NCR rate is under control — good attention to process.'),
('qc_inspector', 'NCR Closure Rate',            'qc_ncr_closure',        '%',   NULL, 'weekly', true,
 'Open NCRs are aging — prioritise closure with production team.',
 'Strong NCR closure rate — effective follow-through.'),
('qc_inspector', 'Checklist Compliance %',      'qc_checklist_compliance','%',  NULL, 'weekly', true,
 'Checklist compliance is low — reinforce documentation habit.',
 'Excellent checklist discipline this week.'),

-- ── planning_engineer ─────────────────────────────────────────────────────────
('planning_engineer', 'Schedule Adherence %',      'pe_schedule_adherence', '%',   NULL, 'weekly', true,
 'Schedule adherence is below target — replan and communicate delays early.',
 'Schedule is on track — good proactive planning.'),
('planning_engineer', 'Drawing Issue Turnaround',  'pe_drawing_tat',        'days',NULL, 'weekly', true,
 'Drawing turnaround is slow — identify blockers with design team.',
 'Drawings issued on time — strong coordination.'),
('planning_engineer', 'Material Plan Accuracy %', 'pe_material_plan_accuracy','%',NULL,'weekly', true,
 'Material planning accuracy is low — review forecasting inputs.',
 'Accurate material planning this week — well managed.'),

-- ── costing_engineer ──────────────────────────────────────────────────────────
('costing_engineer', 'BOQ Accuracy %',            'ce_boq_accuracy',       '%',   NULL, 'weekly', true,
 'BOQ accuracy needs improvement — double-check quantity take-offs.',
 'Accurate BOQs delivered — strong technical discipline.'),
('costing_engineer', 'Variance Report Timeliness','ce_variance_timeliness', '%',  NULL, 'weekly', true,
 'Variance reports are delayed — prioritise weekly reporting.',
 'Variance reports submitted on time — great accountability.'),
('costing_engineer', 'Cost Savings Identified',   'ce_cost_savings',       'INR', NULL, 'weekly', true,
 'Look for value-engineering opportunities in upcoming projects.',
 'Good cost savings identified — keep highlighting opportunities.'),

-- ── procurement ───────────────────────────────────────────────────────────────
('procurement', 'PO Cycle Time',                'proc_po_cycle_time',    'days',NULL, 'weekly', true,
 'PO cycle time is high — streamline approval flow.',
 'Fast PO turnaround — efficient procurement process.'),
('procurement', 'On-Time Delivery Rate',        'proc_otd_rate',         '%',   NULL, 'weekly', true,
 'On-time delivery rate is below target — follow up with vendors proactively.',
 'Strong on-time delivery rate — good vendor management.'),
('procurement', 'Pending RFQs',                 'proc_pending_rfqs',     'nos', NULL, 'weekly', true,
 'Several RFQs are pending — action them before they delay production.',
 'All RFQs actioned promptly — excellent.'),

-- ── stores_executive ──────────────────────────────────────────────────────────
('stores_executive', 'Inventory Accuracy %',    'se_inventory_accuracy', '%',   NULL, 'weekly', true,
 'Inventory accuracy is low — conduct cycle counts and reconcile discrepancies.',
 'High inventory accuracy — great stock control.'),
('stores_executive', 'GRN Turnaround (hrs)',     'se_grn_tat',            'hrs', NULL, 'weekly', true,
 'GRN processing is slow — goods received must be entered same day.',
 'GRNs processed promptly — keeps production flowing.'),
('stores_executive', 'Stock-out Incidents',      'se_stockout_incidents', 'nos', NULL, 'weekly', true,
 'Stock-outs this week disrupted production — improve reorder triggers.',
 'Zero stock-outs — excellent inventory management.'),

-- ── site_installation_mgr ─────────────────────────────────────────────────────
('site_installation_mgr', 'Installation Progress %', 'sim_install_progress','%',  NULL, 'weekly', true,
 'Installation progress is behind — reassess resource deployment.',
 'Installation is ahead of schedule — strong site execution.'),
('site_installation_mgr', 'Site Safety Observations','sim_safety_obs',     'nos', NULL, 'weekly', true,
 'Increase safety walk frequency and brief the team.',
 'Active safety observation — good safety culture.'),
('site_installation_mgr', 'Snag Closure Rate %',   'sim_snag_closure',    '%',   NULL, 'weekly', true,
 'Open snags are aging — prioritise closure before handover.',
 'Snags resolved quickly — client satisfaction protected.'),

-- ── finance_manager ───────────────────────────────────────────────────────────
('finance_manager', 'Debtor Collection Rate %', 'fm_debtor_collection',  '%',   NULL, 'weekly', true,
 'Collections are below target — escalate overdue invoices.',
 'Strong collections this week — good debtor management.'),
('finance_manager', 'Payment Processing TAT',   'fm_payment_tat',        'days',NULL, 'weekly', true,
 'Payments are being delayed — review approval bottlenecks.',
 'Payments processed on time — good financial discipline.'),
('finance_manager', 'MIS Report Timeliness',    'fm_mis_timeliness',     '%',   NULL, 'weekly', true,
 'MIS reports are delayed — set internal deadlines for data collection.',
 'MIS submitted on schedule — great reporting discipline.'),
('finance_manager', 'Budget Variance %',        'fm_budget_variance',    '%',   NULL, 'weekly', true,
 'Budget variance is high — investigate and report reasons to management.',
 'Budget variance is within acceptable range — well managed.'),

-- ── delivery_rm_lead ──────────────────────────────────────────────────────────
('delivery_rm_lead', 'On-Time Delivery %',       'drl_otd_rate',          '%',   NULL, 'weekly', true,
 'On-time delivery rate is below target — review logistics planning.',
 'Deliveries on track — great coordination with site teams.'),
('delivery_rm_lead', 'R&M Ticket Response Time', 'drl_rm_response_time',  'hrs', NULL, 'weekly', true,
 'R&M tickets are taking too long to respond — prioritise backlog.',
 'R&M tickets responded promptly — good service levels.'),
('delivery_rm_lead', 'Customer Satisfaction Score','drl_csat',            '/5',  NULL, 'weekly', true,
 'Satisfaction score is low — collect feedback and address root causes.',
 'High customer satisfaction — keep the standard up.'),

-- ── head_operations ───────────────────────────────────────────────────────────
('head_operations', 'Cross-Department Escalations','ho_escalations',      'nos', NULL, 'weekly', true,
 'High escalation count — investigate systemic blockers.',
 'Low escalations — teams are running smoothly.'),
('head_operations', 'Project Milestone Hit Rate %','ho_milestone_rate',   '%',   NULL, 'weekly', true,
 'Milestone hit rate is below target — replan and resource accordingly.',
 'Milestones being hit consistently — strong operations management.'),
('head_operations', 'KPI Submission Compliance %','ho_kpi_compliance',    '%',   NULL, 'weekly', true,
 'Team KPI submissions are incomplete — remind team leads to submit.',
 'Full KPI compliance from the team — good governance.'),

-- ── production_head ───────────────────────────────────────────────────────────
('production_head', 'Overall Factory Utilisation %','ph_utilisation',      '%',  NULL, 'weekly', true,
 'Factory utilisation is low — review capacity and forward load.',
 'Factory utilisation is high — strong capacity management.'),
('production_head', 'Weekly Output vs Plan %',   'ph_output_vs_plan',     '%',   NULL, 'weekly', true,
 'Output is behind plan — identify bottleneck stages and address.',
 'Output on or ahead of plan — commendable execution.'),
('production_head', 'Quality Reject Rate %',     'ph_reject_rate',        '%',   NULL, 'weekly', true,
 'Reject rate is above target — increase QC checkpoints.',
 'Reject rate is well controlled — good quality culture.'),
('production_head', 'Safety Incidents',          'ph_safety_incidents',   'nos', NULL, 'weekly', true,
 'Safety incident count is elevated — conduct immediate review and brief.',
 'Zero safety incidents — excellent safety culture.')

ON CONFLICT (kpi_key) DO NOTHING;
