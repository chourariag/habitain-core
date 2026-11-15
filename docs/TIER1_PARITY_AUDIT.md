# Tier 1 parity audit — pre-change inventory

Literal MD references missing one or more director keys; helper-mediated parity is noted, not assumed.
Legacy objects remain unchanged pending review. Counts are objects, not unique tables.

## Database inventory
271 policies + 63 functions + 8 triggers = 342 objects.

| Object | Source file(s) | Gates |
|---|---|---|
| Policy `public.material_plan_items.Planners can insert material_plan_items` | supabase/migrations/20260320145355_beb15f47-460f-4d89-a1ba-8fb0dd7b674f.sql | insert |
| Policy `public.material_plan_items.Planners can update material_plan_items` | supabase/migrations/20260320145355_beb15f47-460f-4d89-a1ba-8fb0dd7b674f.sql | update |
| Policy `public.variation_register.Finance manager and MD can insert variations` | supabase/migrations/20260623160115_f9a2e69d-f7e4-4dad-a814-ee113c2b9608.sql | insert |
| Policy `public.variation_register.Finance manager and MD can update variations` | supabase/migrations/20260623160115_f9a2e69d-f7e4-4dad-a814-ee113c2b9608.sql | update |
| Policy `public.variation_register.MD can delete variations` | supabase/migrations/20260623160115_f9a2e69d-f7e4-4dad-a814-ee113c2b9608.sql | delete |
| Policy `public.stage_wastage.Production can record stage wastage` | supabase/migrations/20260627170343_89569dda-9edb-406e-bbc9-283af003dde3.sql | insert |
| Policy `public.stage_wastage.Production heads can update stage wastage` | supabase/migrations/20260627170343_89569dda-9edb-406e-bbc9-283af003dde3.sql | update |
| Policy `public.modules.Authorized can insert modules` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.modules.Authorized can update modules` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.panels.Authorized can insert panels` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.panels.Authorized can update panels` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.production_stages.Production can insert stages` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.production_stages.Production can update stages` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.qc_inspections.QC can insert inspections` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.qc_inspections.QC can update inspections` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.qc_inspection_items.QC can insert items` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.qc_inspection_items.QC can update items` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.ncr_register.QC can insert NCRs` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.ncr_register.QC can update NCRs` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.labour_claims.Supervisors or admins can update claims` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.labour_claims.View own or managed claims` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | view |
| Policy `public.labour_approvals.Supervisors or admins can create approvals` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.dispute_log.Insert disputes` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260316172242_1fe4f4ca-d8fb-4c01-885f-26161ad884df.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.dispute_log.View disputes` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | view |
| Policy `public.material_requests.Requestors can insert material requests` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | insert |
| Policy `public.material_requests.Update material requests` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql | update |
| Policy `public.feature_flags.Directors can update feature flags` | drizzle/migrations/0000_create_feature_flags.sql | update |
| Policy `public.purchase_orders.Authorized users can insert purchase orders` | supabase/migrations/20260317152729_d0597ab0-614a-4a0d-b04a-657f64a340fd.sql | insert |
| Policy `public.receivables_tracker.Finance manager and MD insert receivables` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | insert |
| Policy `public.rm_tickets.Authorized can insert rm_tickets` | supabase/migrations/20260317162640_1302dffb-1801-4079-9bbc-1f1650d6e681.sql | insert |
| Policy `public.module_schedule.Planners can insert module_schedule` | Live database (no source match) | insert |
| Policy `public.rm_tickets.Authorized can update rm_tickets` | supabase/migrations/20260317162640_1302dffb-1801-4079-9bbc-1f1650d6e681.sql | update |
| Policy `public.amc_contracts.Directors can insert amc_contracts` | supabase/migrations/20260317162640_1302dffb-1801-4079-9bbc-1f1650d6e681.sql | insert |
| Policy `public.amc_contracts.Directors can update amc_contracts` | supabase/migrations/20260317162640_1302dffb-1801-4079-9bbc-1f1650d6e681.sql | update |
| Policy `public.daily_production_logs.Supervisors can insert daily_production_logs` | Live database (no source match) | insert |
| Policy `public.daily_production_logs.Production heads can update daily_production_logs` | Live database (no source match) | update |
| Policy `public.module_schedule.Planners can update module_schedule` | Live database (no source match) | update |
| Policy `public.dispatch_signoffs.Production heads can insert dispatch_signoffs` | Live database (no source match) | insert |
| Policy `public.receivables_tracker.Finance manager and MD update receivables` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | update |
| Policy `public.receivables_tracker.MD delete receivables` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | delete |
| Policy `public.setup_change_log.Setup upload roles can log changes` | drizzle/migrations/0004_project_setup_excel_upload.sql | insert |
| Policy `public.setup_change_log.Setup audit readers can view changes` | drizzle/migrations/0004_project_setup_excel_upload.sql | view |
| Policy `public.design_queries.Authorized can update design_queries` | supabase/migrations/20260318143941_f9e7b2d1-75c5-469a-a16e-58d8745f1e0b.sql | update |
| Policy `public.billing_sales_tracker.Finance manager and MD insert billing tracker` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | insert |
| Policy `public.design_consultants.Architects can manage design_consultants` | supabase/migrations/20260318183855_ff008157-a709-4ca7-98dd-c91eb31778d4.sql | view / write |
| Policy `public.billing_sales_tracker.Finance manager and MD update billing tracker` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | update |
| Policy `public.finance_mis_uploads.Finance roles can insert MIS` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | insert |
| Policy `public.finance_mis_uploads.Finance roles can update MIS` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | update |
| Policy `public.ledger_mappings.Finance roles can insert ledger_mappings` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | insert |
| Policy `public.wo_requests.wo_requests_select` | supabase/migrations/20260627174735_f4085aa6-297d-482f-b976-b571d51acb00.sql | view |
| Policy `public.ledger_mappings.Finance roles can update ledger_mappings` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | update |
| Policy `public.finance_cashflow_balances.Finance roles can manage balances` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | view / write |
| Policy `public.finance_project_cashflow.Finance roles can insert project cashflow` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | insert |
| Policy `public.finance_statutory.Finance roles can manage statutory` | supabase/migrations/20260320193313_08355195-f09b-47e7-b049-fa2c83b64593.sql | view / write |
| Policy `public.attendance_records.Users can insert own attendance` | supabase/migrations/20260320202509_8a852d95-18f1-447f-88f8-2fad172246f4.sql | insert |
| Policy `public.attendance_records.HR can update attendance` | supabase/migrations/20260320202509_8a852d95-18f1-447f-88f8-2fad172246f4.sql | update |
| Policy `public.labour_attendance.Labour roles read project attendance` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql | view |
| Policy `public.labour_attendance.Labour roles insert project attendance` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql | insert |
| Policy `public.billing_sales_tracker.MD delete billing tracker` | supabase/migrations/20260623160547_539455ce-9b89-48dc-bdca-a32d29e55e6e.sql | delete |
| Policy `public.labour_attendance.Labour roles update project attendance` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql | update |
| Policy `public.design_qc_checklist.Architects can update design_qc_checklist` | supabase/migrations/20260325185606_ecee79b0-74a2-4645-9c17-f3c60935774b.sql | update |
| Policy `public.design_qc_checklist.Architects can insert design_qc_checklist` | supabase/migrations/20260325185606_ecee79b0-74a2-4645-9c17-f3c60935774b.sql | insert |
| Policy `public.design_detail_library.Architects can update design_detail_library` | supabase/migrations/20260325185606_ecee79b0-74a2-4645-9c17-f3c60935774b.sql | update |
| Policy `public.design_detail_library.Architects can insert design_detail_library` | supabase/migrations/20260325185606_ecee79b0-74a2-4645-9c17-f3c60935774b.sql | insert |
| Policy `public.special_material_requests.smr_select` | supabase/migrations/20260627175102_9f90b720-8aaa-49c0-8ac3-bb5ac56dadf4.sql | view |
| Policy `storage.objects.project_archives_read_leadership` | supabase/migrations/20260627181434_891f92b6-c834-4c5a-a7b3-860d6cac5371.sql | view |
| Policy `public.stores_inventory.Stores and factory can manage stores_inventory` | supabase/migrations/20260327174740_c6e119bf-3502-400e-8539-c8f3452eb7a5.sql | view / write |
| Policy `public.dispatch_packs.Factory roles can insert dispatch_packs` | supabase/migrations/20260327174740_c6e119bf-3502-400e-8539-c8f3452eb7a5.sql | insert |
| Policy `public.dispatch_packs.Factory roles can update dispatch_packs` | supabase/migrations/20260327174740_c6e119bf-3502-400e-8539-c8f3452eb7a5.sql | update |
| Policy `public.dispatch_material_log.Factory roles can insert dispatch_material_log` | supabase/migrations/20260327174740_c6e119bf-3502-400e-8539-c8f3452eb7a5.sql | insert |
| Policy `public.material_delivery_tracker.MDT editors can insert` | supabase/migrations/20260623160853_a93f85ed-9a81-401c-b701-29c81c112460.sql | insert |
| Policy `public.material_delivery_tracker.MDT editors can update` | supabase/migrations/20260623160853_a93f85ed-9a81-401c-b701-29c81c112460.sql | update |
| Policy `public.boq_items.boq_read_finance_planning_arch` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `public.material_delivery_tracker.MDT editors can delete` | supabase/migrations/20260623160853_a93f85ed-9a81-401c-b701-29c81c112460.sql | delete |
| Policy `public.project_boq.Finance/planning/arch can view project_boq` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `public.labour_attendance_edit_log.Labour roles read attendance edit history` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql | view |
| Policy `public.project_storage_cleanup_log.cleanup_log_select_leadership` | supabase/migrations/20260627181713_05689221-b32c-4d27-bfbd-a6d0994ddf34.sql | view |
| Policy `public.project_billing_milestones.Finance and directors can manage billing milestones` | supabase/migrations/20260415194624_2b26bfdd-26a6-4632-b68a-6e343bb650cf.sql | insert |
| Policy `public.project_billing_milestones.Finance and directors can update billing milestones` | supabase/migrations/20260415194624_2b26bfdd-26a6-4632-b68a-6e343bb650cf.sql | update |
| Policy `public.project_billing_milestones.Only MD can delete billing milestones` | supabase/migrations/20260415194624_2b26bfdd-26a6-4632-b68a-6e343bb650cf.sql | delete |
| Policy `public.project_revenue_margin.Finance and directors can insert revenue margin` | supabase/migrations/20260415195203_6f70c2af-e04d-49d2-8f5b-207ef8a41a13.sql | insert |
| Policy `public.project_revenue_margin.Finance and directors can update revenue margin` | supabase/migrations/20260415195203_6f70c2af-e04d-49d2-8f5b-207ef8a41a13.sql | update |
| Policy `public.project_revenue_margin.Only MD can delete revenue margin` | supabase/migrations/20260415195203_6f70c2af-e04d-49d2-8f5b-207ef8a41a13.sql | delete |
| Policy `public.project_boq.Authorized roles can insert BOQ` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | insert |
| Policy `public.project_boq.Authorized roles can update BOQ` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | update |
| Policy `public.project_boq.Only MD can delete BOQ` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | delete |
| Policy `public.project_boq_items.Authorized roles can insert BOQ items` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | insert |
| Policy `public.project_boq_items.Authorized roles can update BOQ items` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | update |
| Policy `public.project_boq_items.Only MD can delete BOQ items` | supabase/migrations/20260415195709_3ed60572-ecbe-42bc-a2d0-074606688d06.sql | delete |
| Policy `public.gfc_qc_checklist.Architects manage GFC QC` | supabase/migrations/20260504192144_e347f6dc-cd5e-4f4e-bb45-2b1e33ef3c8b.sql | view / write |
| Policy `public.design_stage_history.Architects insert design stage history` | supabase/migrations/20260504192144_e347f6dc-cd5e-4f4e-bb45-2b1e33ef3c8b.sql | insert |
| Policy `public.daily_labour_logs.Insert daily labour logs` | supabase/migrations/20260506190612_c06614b9-9d70-4637-90e9-ed2b545aa438.sql | insert |
| Policy `public.module_team_assignments.Insert module team assignments` | supabase/migrations/20260514191638_dc2209f6-4382-47f7-8dec-d414fa2db28b.sql | insert |
| Policy `public.contracts_register.Contracts: editors delete` | supabase/migrations/20260623161153_bbc268cc-2fdf-4e23-9b7e-2c966d494b14.sql | delete |
| Policy `public.qc_inspection_items.QC can delete inspection items` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.reminder_rules.reminder_rules_read` | drizzle/migrations/0024_p7_shadow_reminders.sql | view |
| Policy `public.modules.Authorized can delete modules` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.panels.Authorized can delete panels` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.production_stages.Production can delete stages` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.qc_inspections.QC can delete inspections` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.ncr_register.QC can delete NCRs` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.labour_claims.Admins can delete labour claims` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.labour_approvals.Admins can delete labour approvals` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.dispute_log.Admins can delete disputes` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.material_requests.Admins can delete material requests` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.installation_checklist.Operations can delete installation checklist` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.material_plan_items.Planners can delete material plan items` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.inventory_items.Stores and directors can delete inventory items` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.purchase_orders.Authorized can delete purchase orders` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.drawings.Architects can delete drawings` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.design_queries.Authorized can delete design queries` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.design_consultants.Architects can delete design consultants` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.project_design_files.Architects can delete project design files` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.site_readiness.Operations can delete site readiness` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.dispatch_log.Operations can delete dispatch log` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.site_diary.Operations can delete site diary` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.handover_pack.Operations can delete handover pack` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.rm_tickets.Authorized can delete rm tickets` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.amc_contracts.Directors can delete amc contracts` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.sales_deals.Sales directors can delete sales deals` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.sales_stage_history.Super admin can delete sales stage history` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.sales_amc_contacts.Sales can delete amc contacts` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.finance_mis_uploads.Finance directors can delete MIS` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.app_settings.Super admin can delete app settings` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.attendance_records.HR or admin can delete attendance records` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql | delete |
| Policy `public.profiles.Directors can insert profiles` | supabase/migrations/20260316172216_748d3016-1c56-4592-9da4-18d1a00f950a.sql<br>supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | insert |
| Policy `public.profiles.Super admin can insert any role profile` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | insert |
| Policy `public.escalation_levels.escalation_levels_read` | drizzle/migrations/0024_p7_shadow_reminders.sql | view |
| Policy `public.expense_reports.Finance directors can delete expense reports` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | delete |
| Policy `public.expense_entries.Finance directors can delete expense entries` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | delete |
| Policy `public.reminder_events.reminder_events_read` | drizzle/migrations/0024_p7_shadow_reminders.sql | view |
| Policy `public.reminder_change_log.reminder_change_log_read` | drizzle/migrations/0024_p7_shadow_reminders.sql | view |
| Policy `public.attendance_exports.Finance roles can view attendance exports` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | view |
| Policy `public.attendance_exports.HR can insert attendance exports` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | insert |
| Policy `public.attendance_exports.HR can delete attendance exports` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql | delete |
| Policy `public.project_team_members.Team members can view their own project memberships` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | view |
| Policy `public.project_team_members.Managers can add team members` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | insert |
| Policy `public.project_team_members.Managers can update team members` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | update |
| Policy `public.project_team_members.Managers can remove team members` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | delete |
| Policy `public.file_attachments.Uploader or admin can delete files` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | delete |
| Policy `public.expense_approvals.View expense approvals` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | view |
| Policy `public.expense_approvals.Finance roles can insert expense approvals` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | insert |
| Policy `public.expense_approvals.Finance directors can delete expense approvals` | supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql | delete |
| Policy `public.dispatch_log.Operations can insert dispatch log` | supabase/migrations/20260522114928_46361b6b-fc9f-4ce4-a1cf-2f3036c9fe79.sql | insert |
| Policy `public.sales_amc_contacts.Sales roles can update sales_amc_contacts` | supabase/migrations/20260522114928_46361b6b-fc9f-4ce4-a1cf-2f3036c9fe79.sql | update |
| Policy `public.purchase_orders.Authorized users can update purchase orders` | supabase/migrations/20260317152729_d0597ab0-614a-4a0d-b04a-657f64a340fd.sql<br>supabase/migrations/20260522114928_46361b6b-fc9f-4ce4-a1cf-2f3036c9fe79.sql | update |
| Policy `public.payment_approvals.Finance and directors can insert payment approvals` | supabase/migrations/20260612091313_632d81e0-0458-4d38-a230-9b5cc60b32b5.sql | insert |
| Policy `public.payment_approvals.Finance and directors can update payment approvals` | supabase/migrations/20260612091313_632d81e0-0458-4d38-a230-9b5cc60b32b5.sql | update |
| Policy `public.order_book.Order book: leadership delete` | supabase/migrations/20260623161153_bbc268cc-2fdf-4e23-9b7e-2c966d494b14.sql | delete |
| Policy `public.kpi_tracked_employees.tracked_emp_read` | supabase/migrations/20260514194547_b265762a-25f4-473d-aa07-c46cdd70b429.sql<br>supabase/migrations/20260624065921_496a4d23-98af-4802-9225-e0387198211c.sql | view |
| Policy `storage.objects.RM roles can upload rm-media` | supabase/migrations/20260624065921_496a4d23-98af-4802-9225-e0387198211c.sql | insert |
| Policy `public.client_portal_tokens.Authorized roles can manage portal tokens` | supabase/migrations/20260627171717_48a0a923-245f-47f3-bb1a-7647e2421afa.sql | insert |
| Policy `public.material_alerts.Planning/procurement/ops can create material alerts` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.material_alerts.Planning/procurement/ops can update material alerts` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.client_portal_tokens.Authorized roles can update portal tokens` | supabase/migrations/20260627171717_48a0a923-245f-47f3-bb1a-7647e2421afa.sql | update |
| Policy `public.wo_requests.wo_requests_update` | supabase/migrations/20260627174735_f4085aa6-297d-482f-b976-b571d51acb00.sql | update |
| Policy `public.project_scope_items.Architects/planning can update scope items` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_scope_exclusions.Architects/planning can insert exclusions` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.work_order_register.wo_register_select` | supabase/migrations/20260627174735_f4085aa6-297d-482f-b976-b571d51acb00.sql | view |
| Policy `storage.objects.production_photos_insert_supervisor` | supabase/migrations/20260627173530_ad04fac5-3fe2-494e-ba2f-56b5ae6141ad.sql | insert |
| Policy `public.client_milestone_photos.Site/ops can manage milestone photos` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | view / write |
| Policy `public.construction_journal.Site/ops can manage journal entries` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | view / write |
| Policy `storage.objects.production_photos_select_leadership` | supabase/migrations/20260627173530_ad04fac5-3fe2-494e-ba2f-56b5ae6141ad.sql | view |
| Policy `public.project_archives.archive_select_leadership` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql | view |
| Policy `public.project_budget_manual_entries.Finance/procurement can insert manual budget entries` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_budget_manual_entries.Finance/procurement can update manual budget entries` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_grns.Procurement/stores/finance can insert GRNs` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_grns.Procurement/stores/finance can update GRNs` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_material_plan_items.Planning/procurement/ops can insert material plan items` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_material_plan_items.Planning/procurement/ops can update material plan items` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_scope_of_work.Architects/planning can insert scope` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_scope_items.Architects/planning can insert scope items` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_scope_exclusions.Architects/planning can update exclusions` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_stages.Production/planning/ops can insert project_stages` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_stages.Production/planning/ops can update project_stages` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_subtasks.Planning/production/ops can insert subtasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_subtasks.Planning/production/ops can update subtasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_subtasks.Planning/ops can delete subtasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | delete |
| Policy `public.project_tasks.Planning/production/ops can insert project tasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.project_tasks.Planning/production/ops can update project tasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.project_tasks.Planning/ops can delete project tasks` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | delete |
| Policy `public.project_tender_budget.Finance/planning can update tender budgets` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.quotation_versions.Sales can create quotation versions` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.quotation_versions.Sales can update quotation versions` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.sales_handover_checklists.Sales/ops can insert sales handover checklists` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.sales_handover_checklists.Sales/ops can update sales handover checklists` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.material_transfers.Roles can update transfers` | supabase/migrations/20260617111603_1fdcda3c-cd50-464f-80b3-56ace8afd911.sql | update |
| Policy `public.sales_handover_checklists.Sales directors can delete sales handover checklists` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | delete |
| Policy `public.site_diary.Site/ops can insert site diary` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.subcontractor_schedules.Site/ops can insert subcontractor schedules` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.subcontractor_schedules.Site/ops can update subcontractor schedules` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.variation_orders.Site/ops/finance can insert variation orders` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | insert |
| Policy `public.variation_orders.Site/ops/finance can update variation orders` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql | update |
| Policy `public.site_receipt_checklist.Roles can insert site receipt checklists` | supabase/migrations/20260617111603_1fdcda3c-cd50-464f-80b3-56ace8afd911.sql | insert |
| Policy `public.site_receipt_checklist.Roles can update site receipt checklists` | supabase/migrations/20260617111603_1fdcda3c-cd50-464f-80b3-56ace8afd911.sql | update |
| Policy `public.task_benchmarks.Roles can insert benchmarks` | supabase/migrations/20260617111603_1fdcda3c-cd50-464f-80b3-56ace8afd911.sql | insert |
| Policy `public.installation_checklist.Site/ops can update installation_checklist` | supabase/migrations/20260618073516_8e13b395-a5a2-4c2c-85ad-ba55292d65a5.sql | update |
| Policy `storage.objects.Architects/directors can upload drawings` | supabase/migrations/20260618073516_8e13b395-a5a2-4c2c-85ad-ba55292d65a5.sql | insert |
| Policy `storage.objects.Architects/directors can upload design-files` | supabase/migrations/20260618073516_8e13b395-a5a2-4c2c-85ad-ba55292d65a5.sql | insert |
| Policy `public.design_consultants.Architecture leadership can view design_consultants` | supabase/migrations/20260622103331_c1a6a876-a82d-43d8-8141-5de29c48762a.sql | view |
| Policy `public.advance_requests.Finance leadership can view advance requests` | supabase/migrations/20260622103331_c1a6a876-a82d-43d8-8141-5de29c48762a.sql | view |
| Policy `public.project_material_plans.Allowed roles can insert material plans` | supabase/migrations/20260622104840_7478da7d-44d8-4c19-8269-6ab410e3ee63.sql | insert |
| Policy `public.project_tender_budget_items.Allowed roles can insert tender budget items` | supabase/migrations/20260622104840_7478da7d-44d8-4c19-8269-6ab410e3ee63.sql | insert |
| Policy `public.project_task_schedule_uploads.Allowed roles can insert schedule uploads` | supabase/migrations/20260622104840_7478da7d-44d8-4c19-8269-6ab410e3ee63.sql | insert |
| Policy `public.special_material_requests.smr_update_approver_issuer` | supabase/migrations/20260627175102_9f90b720-8aaa-49c0-8ac3-bb5ac56dadf4.sql | update |
| Policy `public.client_visits.cv_select` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql | view |
| Policy `public.client_visits.cv_insert_site` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql | insert |
| Policy `public.client_visits.cv_update_site` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql | update |
| Policy `public.kickoff_meetings.Architects manage kickoff_meetings` | supabase/migrations/20260627180634_73220044-b12f-444b-8a88-d20fe1b2c998.sql | insert |
| Policy `public.kickoff_meetings.Architects update kickoff_meetings` | supabase/migrations/20260627180634_73220044-b12f-444b-8a88-d20fe1b2c998.sql | update |
| Policy `public.kickoff_meetings.Admins delete kickoff_meetings` | supabase/migrations/20260627180634_73220044-b12f-444b-8a88-d20fe1b2c998.sql | delete |
| Policy `public.project_archives.archive_update_leadership` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql | update |
| Policy `public.quality_flags.view quality flags scoped` | supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | view |
| Policy `public.safety_incidents.view safety scoped` | supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | view |
| Policy `public.site_diary.Site staff can insert site_diary` | supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | insert |
| Policy `public.installation_checklist.Site staff can insert installation_checklist` | supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | insert |
| Policy `public.site_readiness.Site staff can insert site_readiness` | supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | insert |
| Policy `public.scope_signoff_tokens.Sales roles read tokens` | supabase/migrations/20260710083841_4b610860-ac9b-477e-950e-80e424a67466.sql | view |
| Policy `public.scope_signoff_tokens.Sales roles create tokens` | supabase/migrations/20260710083841_4b610860-ac9b-477e-950e-80e424a67466.sql | insert |
| Policy `public.handover_pack.Only head_of_projects can initiate handover_pack` | Live database (no source match) | insert |
| Policy `public.amc_contracts.Finance and sales leadership can view amc_contracts` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `public.project_boq_items.Finance/planning/arch can view project_boq_items` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `public.project_tender_budget.Finance/planning/costing can view tender budgets` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `public.project_tender_budget_items.Finance/planning/costing can view tender budget items` | supabase/migrations/20260724074345_bb72d5c1-f224-4847-8bf5-011dfd7b3ee4.sql | view |
| Policy `storage.objects.Design roles can read design-files` | Live database (no source match) | view |
| Policy `public.tally_api_keys.Admins can read key metadata` | Live database (no source match) | view |
| Policy `public.client_portal_tokens.Leadership can view portal tokens` | supabase/migrations/20260803050458_7538d8c5-f513-48ed-9421-1175c7358a76.sql | view |
| Policy `storage.objects.Sales roles upload sale agreements` | supabase/migrations/20260803063339_6c9d5292-863e-4dfd-8ca9-212e3e972f7c.sql | insert |
| Policy `storage.objects.Sales roles update sale agreements` | supabase/migrations/20260803063339_6c9d5292-863e-4dfd-8ca9-212e3e972f7c.sql | update |
| Policy `public.project_scope_items.Scope editors can delete scope items` | supabase/migrations/20260803064610_9bbeb808-ba23-44f9-8991-93a2efbd1067.sql | delete |
| Policy `public.project_scope_exclusions.Scope editors can delete scope exclusions` | supabase/migrations/20260803064610_9bbeb808-ba23-44f9-8991-93a2efbd1067.sql | delete |
| Policy `storage.objects.Uploader or admin delete design stage files` | supabase/migrations/20260803120849_47fed311-6b20-4194-b378-8bffd6f3846e.sql | delete |
| Policy `public.purchase_orders.po_read_scoped` | supabase/migrations/20260804052853_d226217c-2b30-4503-9484-285501e1c891.sql | view |
| Policy `storage.objects.Project members can upload voice-notes` | supabase/migrations/20260805093424_0f19546f-91bf-4860-b314-9af9c1feddeb.sql | insert |
| Policy `public.project_grns.Finance procurement can view GRNs` | supabase/migrations/20260806124716_a041d37f-d466-4847-9969-72f2fbefa04f.sql | view |
| Policy `public.project_budget_manual_entries.Finance procurement can view manual budget entries` | supabase/migrations/20260806124716_a041d37f-d466-4847-9969-72f2fbefa04f.sql | view |
| Policy `public.client_work_orders.Finance and directors manage client work orders` | supabase/migrations/20260807071925_896890f1-a6b0-4c4d-9e24-22b475442481.sql | view / write |
| Policy `public.client_wo_payment_stages.Finance and directors manage wo payment stages` | supabase/migrations/20260807071925_896890f1-a6b0-4c4d-9e24-22b475442481.sql | view / write |
| Policy `public.project_scope_of_work.Architects/planning can update scope` | supabase/migrations/20260616114036_662b68b6-d9aa-4ea3-a2e6-659534b10a09.sql<br>supabase/migrations/20260810051229_30e9567d-42ae-4f47-8b4e-238185b7efbd.sql | update |
| Policy `public.project_billing_milestones.Finance and leadership can view billing milestones` | supabase/migrations/20260814072224_18445267-87eb-4bb6-815e-7acda7c1b7f6.sql | view |
| Policy `public.client_wo_dlp.Finance and project team view dlp` | supabase/migrations/20260814072600_762e74e0-ec78-4d7b-a93a-7ca72b347682.sql | view |
| Policy `public.client_wo_payment_stages.Finance and project team view wo payment stages` | supabase/migrations/20260814072600_762e74e0-ec78-4d7b-a93a-7ca72b347682.sql | view |
| Policy `public.sales_handover_checklists.Sales and ops view sales handover checklists` | supabase/migrations/20260814072600_762e74e0-ec78-4d7b-a93a-7ca72b347682.sql | view |
| Policy `public.site_readiness.Operations can update site readiness` | supabase/migrations/20260522114928_46361b6b-fc9f-4ce4-a1cf-2f3036c9fe79.sql<br>supabase/migrations/20260820182915_34dadd8b-a477-4955-84d8-ea9ed5efc9d3.sql | update |
| Policy `public.inventory_items.Stores and directors can insert inventory items` | supabase/migrations/20260317152729_d0597ab0-614a-4a0d-b04a-657f64a340fd.sql<br>supabase/migrations/20260821112616_34ce94fe-8137-47e3-bf5a-1b2622daa7ed.sql | insert |
| Policy `public.inventory_items.Stores and directors can update inventory items` | supabase/migrations/20260317152729_d0597ab0-614a-4a0d-b04a-657f64a340fd.sql<br>supabase/migrations/20260821112616_34ce94fe-8137-47e3-bf5a-1b2622daa7ed.sql | update |
| Policy `public.leave_requests.Users see own leave requests` | supabase/migrations/20260320202509_8a852d95-18f1-447f-88f8-2fad172246f4.sql<br>supabase/migrations/20260821113318_1bbddede-ab88-41c8-b486-b4f2ecefedea.sql | view |
| Policy `storage.objects.Operations can view dry-run-videos` | supabase/migrations/20260624065921_496a4d23-98af-4802-9225-e0387198211c.sql<br>supabase/migrations/20260824063043_d1e33ad9-c7af-4125-8f03-135df20e4e98.sql | view |
| Policy `storage.objects.Operations can upload dry-run-videos` | supabase/migrations/20260624065921_496a4d23-98af-4802-9225-e0387198211c.sql<br>supabase/migrations/20260824063043_d1e33ad9-c7af-4125-8f03-135df20e4e98.sql | insert |
| Policy `public.sales_pipeline_leads.Sales and leadership manage pipeline leads` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | insert |
| Policy `public.sales_pipeline_leads.Sales and leadership update pipeline leads` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | update |
| Policy `public.marketing_funnel_monthly.Marketing manages marketing funnel` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | view / write |
| Policy `public.call_funnel_monthly.Sales manages call funnel` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | view / write |
| Policy `public.board_period_plan.Finance manages period plan` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | view / write |
| Policy `public.board_reported_totals.Leadership manages reported totals` | supabase/migrations/20260821142916_041805df-6b56-496d-b9fc-9761da2a99fd.sql | view / write |
| Policy `public.projects.Allowed roles can delete projects` | supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | delete |
| Policy `public.drawings.Architects can insert drawings` | supabase/migrations/20260318143941_f9e7b2d1-75c5-469a-a16e-58d8745f1e0b.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | insert |
| Policy `public.hr_settings.HR can delete hr_settings` | supabase/migrations/20260522114348_e0d8db4f-f7e6-4012-8ad3-508aae7672a5.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | delete |
| Policy `public.drawings.Architects can update drawings` | supabase/migrations/20260318143941_f9e7b2d1-75c5-469a-a16e-58d8745f1e0b.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | update |
| Policy `public.client_wo_retention_entries.Finance manages retention entries` | supabase/migrations/20260807071925_896890f1-a6b0-4c4d-9e24-22b475442481.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | view / write |
| Policy `public.client_wo_dlp.Finance manages dlp` | supabase/migrations/20260807071925_896890f1-a6b0-4c4d-9e24-22b475442481.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | view / write |
| Policy `public.finance_audited_financials.Finance leadership can insert audited financials` | supabase/migrations/20260821184627_fffce385-6e90-42e7-88c0-e576b7ff36c0.sql | insert |
| Policy `public.finance_audited_financials.Finance leadership can update audited financials` | supabase/migrations/20260821184627_fffce385-6e90-42e7-88c0-e576b7ff36c0.sql | update |
| Policy `public.clients_master.Leadership can view clients_master` | supabase/migrations/20260825054418_ac846d65-09e9-4576-82c9-bc68e338a563.sql | view |
| Policy `public.special_material_requests.smr_insert_supervisor` | supabase/migrations/20260627175102_9f90b720-8aaa-49c0-8ac3-bb5ac56dadf4.sql<br>supabase/migrations/20260824062619_7a09839f-93ca-4ed8-b0e4-89b09bcd904d.sql<br>supabase/migrations/20260825124834_33e2a5e4-4fe3-4e84-8416-9d5e1a80e021.sql | insert |
| Policy `public.client_wo_retention_entries.Finance and leadership view retention entries` | supabase/migrations/20260826072048_f376fd34-6ce8-410a-9439-0b6357229cf3.sql | view |
| Policy `public.rm_tickets.Operations and finance view rm tickets` | supabase/migrations/20260826072048_f376fd34-6ce8-410a-9439-0b6357229cf3.sql | view |
| Policy `public.variation_orders.Finance ops and leadership view variation orders` | supabase/migrations/20260826072048_f376fd34-6ce8-410a-9439-0b6357229cf3.sql | view |
| Policy `public.project_design_files.Architects can update project_design_files` | supabase/migrations/20260318183855_ff008157-a709-4ca7-98dd-c91eb31778d4.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql<br>supabase/migrations/20260831100539_9a524186-7156-4ab6-b78b-85d414e3e672.sql | update |
| Policy `public.project_design_files.Architects can insert project_design_files` | supabase/migrations/20260318183855_ff008157-a709-4ca7-98dd-c91eb31778d4.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql<br>supabase/migrations/20260831100539_9a524186-7156-4ab6-b78b-85d414e3e672.sql | insert |
| Policy `public.user_roles.Role admins can manage user_roles` | supabase/migrations/20260901060214_6ad68585-862c-49b3-b947-b84e30dfe1a3.sql | view / write |
| Function `can_manage_labour_register(uuid)` | supabase/migrations/20260425104537_c1c54a8d-c1e6-4c60-a375-d0969a7faefc.sql<br>supabase/migrations/20260506190612_c06614b9-9d70-4637-90e9-ed2b545aa438.sql<br>supabase/migrations/20260514191638_dc2209f6-4382-47f7-8dec-d414fa2db28b.sql<br>supabase/migrations/20260810101318_a0a1d514-71bf-459f-929b-2f6b3b70d41b.sql | write / view |
| Function `can_upload_stage_files(uuid,text)` | supabase/migrations/20260803120849_47fed311-6b20-4194-b378-8bffd6f3846e.sql<br>supabase/migrations/20260814072127_e64169b0-a54e-4fe3-b6e0-74fc3c18c006.sql | view |
| Function `can_access_subcontractors(uuid)` | supabase/migrations/20260425104537_c1c54a8d-c1e6-4c60-a375-d0969a7faefc.sql<br>supabase/migrations/20260622060223_e5cee064-4a6b-40f6-a15c-17a4146417e6.sql<br>supabase/migrations/20260622103331_c1a6a876-a82d-43d8-8141-5de29c48762a.sql<br>supabase/migrations/20260623080330_efec82dd-d3b8-4f0d-8cd7-f0adcaa6ea9d.sql<br>supabase/migrations/20260813070123_66239265-bf05-4850-ab86-1d21ad4ab712.sql | write / view |
| Function `can_manage_subcontractors(uuid)` | supabase/migrations/20260425104537_c1c54a8d-c1e6-4c60-a375-d0969a7faefc.sql | write / view |
| Function `cancel_kickoff_meeting(uuid,text)` | supabase/migrations/20260817054842_e8f69187-5a36-4c80-9e78-7b3073dec447.sql | notify / write / view |
| Function `get_admin_profiles_full()` | supabase/migrations/20260622070852_ad22422a-7fe8-4c7b-b215-4a9e20ee1a77.sql<br>supabase/migrations/20260624110319_2770e8e2-9a98-453b-b247-d42cdb980d48.sql<br>supabase/migrations/20260624132940_4b621ca1-fc37-4f9d-89f0-cd965223defd.sql<br>supabase/migrations/20260730062251_e7fd11ab-5b8f-4661-8843-b9f3cf844338.sql<br>supabase/migrations/20260730062359_5bf4f9cd-1151-4ff4-9fb4-3aab81cfd41b.sql | write / view |
| Function `is_md(uuid)` | supabase/migrations/20260504135935_ccba3614-b6c8-4c0f-9ab5-00d1d826943f.sql<br>supabase/migrations/20260504143835_f811e501-1e3f-42f7-8df6-e3fe372e51b8.sql<br>supabase/migrations/20260504161739_3196b034-f83f-430a-baac-07f1d9452039.sql<br>supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql<br>supabase/migrations/20260514193649_e82267b5-bfd1-4e14-949e-8fe9d1dafb70.sql<br>supabase/migrations/20260514194547_b265762a-25f4-473d-aa07-c46cdd70b429.sql<br>supabase/migrations/20260514195800_c3ffef73-0942-4669-b343-ac5491ae9db7.sql<br>supabase/migrations/20260514202113_052b3a08-1733-40f4-ac58-74500bf8f885.sql<br>supabase/migrations/20260518060523_350ad57d-402a-4b82-b825-d85cdb612adf.sql<br>supabase/migrations/20260606171907_e3e73603-2f8e-4ae0-b0d9-2c4bca463b05.sql<br>supabase/migrations/20260623101021_060e939e-4a7e-4c1e-8df8-4f27bce27211.sql<br>supabase/migrations/20260627170711_9d1cb98f-1f6a-4cfc-b0bf-0c64c06732de.sql<br>supabase/migrations/20260627173530_ad04fac5-3fe2-494e-ba2f-56b5ae6141ad.sql<br>supabase/migrations/20260627174031_cb732fd3-33fa-494e-938b-df6740996b31.sql<br>supabase/migrations/20260627181014_a1b73414-23e9-4622-8151-d327ba849ef9.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql<br>supabase/migrations/20260824052646_e65873ce-9460-42da-9d31-cadf7d817de8.sql<br>supabase/migrations/20260824121427_f2b64ea9-ade1-467f-bdc3-88647c92545f.sql | view |
| Function `can_costing_approve_wo(uuid)` | supabase/migrations/20260428055425_e4013c96-3174-4516-99e4-a1ff19f2fa4f.sql | approve / view |
| Function `is_full_admin(uuid)` | supabase/migrations/20260317132020_5ea3c417-5387-4847-bc42-3a57e8e8f10e.sql<br>supabase/migrations/20260320202509_8a852d95-18f1-447f-88f8-2fad172246f4.sql<br>supabase/migrations/20260325175554_1c05bc99-5825-498c-a962-b7816328ce7e.sql<br>supabase/migrations/20260329072256_8867f2ea-3c3c-4039-af5e-de30d46d33be.sql<br>supabase/migrations/20260330104746_c8181226-fba9-4a9f-abad-0bdab7cb1be0.sql<br>supabase/migrations/20260330160322_f445b03b-69bf-45c1-8d2c-28c55807f144.sql<br>supabase/migrations/20260408174042_5e122390-18a6-4bf5-8883-ff1b4b8aa37b.sql<br>supabase/migrations/20260408174924_cb2a6636-8729-4909-bf94-a35cb3789e23.sql<br>supabase/migrations/20260408181737_e9d02bed-d6fa-4302-af4f-2a8b557f5252.sql<br>supabase/migrations/20260408182204_05da5a85-8afc-478d-a84d-6711a617a277.sql<br>supabase/migrations/20260408182953_f7dcaab6-f8c3-41a8-b4c1-d38be97752b4.sql<br>supabase/migrations/20260408183629_5cc6a88e-f6aa-43a9-be87-d05594ba2194.sql<br>supabase/migrations/20260409175030_5fd58667-3e22-4183-aa8f-99c29cdeea0b.sql<br>supabase/migrations/20260409175742_683f6d46-7f4e-4e42-b86e-c10e1e3b2f15.sql<br>supabase/migrations/20260409181413_d713c16c-2591-487e-81e7-9006973e8219.sql<br>supabase/migrations/20260417192148_cc9ee231-f29f-43ba-8e4e-285ad4bc540a.sql<br>supabase/migrations/20260417192550_e87bd156-c9e6-476b-86ba-8e18315e20d3.sql<br>supabase/migrations/20260420180157_41f764aa-1529-4872-8f16-913d6df10862.sql<br>supabase/migrations/20260508194732_56800ca4-75db-44f3-8921-e5cd1279bd54.sql<br>supabase/migrations/20260522110057_4ad6bedb-1be2-4463-8885-e2579df8e67e.sql<br>supabase/migrations/20260522114555_e8e9432f-0c1a-44c5-a5dc-1215b960e9bc.sql<br>supabase/migrations/20260617111603_1fdcda3c-cd50-464f-80b3-56ace8afd911.sql<br>supabase/migrations/20260623074551_708b164e-717d-4c3d-9067-46b2b4754762.sql<br>supabase/migrations/20260627174735_f4085aa6-297d-482f-b976-b571d51acb00.sql<br>supabase/migrations/20260709145150_b70edcf7-4969-4838-b2bc-0895370f4ea0.sql<br>supabase/migrations/20260714063355_747f409f-3035-4caf-958e-b98a71ccef3d.sql<br>supabase/migrations/20260714092642_eee7c42b-c6d5-4785-ac70-f072f5db5e94.sql<br>supabase/migrations/20260803114331_4ddc33cb-ae38-48ba-94bb-601fae8e06c9.sql<br>supabase/migrations/20260805093424_0f19546f-91bf-4860-b314-9af9c1feddeb.sql<br>supabase/migrations/20260805100726_9968dd97-6406-4a8e-8cd4-d3361863a6dc.sql<br>supabase/migrations/20260807010907_c82a5d88-217d-4cdb-a2f8-bb58fba1d28d.sql<br>supabase/migrations/20260809190826_334f919d-fb80-4932-819c-6b2a8bb30475.sql<br>supabase/migrations/20260810095004_7a720afe-ca3b-406f-8737-a38ca476b85a.sql<br>supabase/migrations/20260811100633_607b6781-54c4-40db-8e32-088ff42025a8.sql<br>supabase/migrations/20260813070123_66239265-bf05-4850-ab86-1d21ad4ab712.sql<br>supabase/migrations/20260814072600_762e74e0-ec78-4d7b-a93a-7ca72b347682.sql<br>supabase/migrations/20260818095220_bfd04edc-8176-48b8-8721-7283dddab1de.sql<br>supabase/migrations/20260820092243_bb37cfcd-174e-42a7-9f9f-6098c26c12f3.sql<br>supabase/migrations/20260820101322_e01f1911-dc7b-4a25-9ea5-9a0a688ae734.sql<br>supabase/migrations/20260821112616_34ce94fe-8137-47e3-bf5a-1b2622daa7ed.sql<br>supabase/migrations/20260824052646_e65873ce-9460-42da-9d31-cadf7d817de8.sql<br>supabase/migrations/20260824121427_f2b64ea9-ade1-467f-bdc3-88647c92545f.sql<br>supabase/migrations/20260903035557_8593441a-245f-4083-b40d-9e3db1c79230.sql<br>supabase/migrations/20260903062208_c2e92c14-45c2-408f-bbed-0de3c6fd4448.sql | view |
| Function `can_action_quality_flag(uuid)` | supabase/migrations/20260428211451_f77136e2-cc4d-4282-bd30-3570b9a2b14a.sql<br>supabase/migrations/20260703060055_90aa2557-270b-467f-b9d5-c5d0b5471c4e.sql | view |
| Function `can_approve_labour_claims(uuid)` | supabase/migrations/20260428211451_f77136e2-cc4d-4282-bd30-3570b9a2b14a.sql | approve / view |
| Function `can_view_profile_pii(uuid)` | supabase/migrations/20260618074045_f782179a-20c9-42c7-b149-6f21f2828acb.sql<br>supabase/migrations/20260624113401_27fa8a48-b271-4e8d-97bd-c4e5b31384ee.sql<br>supabase/migrations/20260723054421_bb2a8c0f-508d-47c7-95aa-a02fc48c4299.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | view |
| Function `can_view_driver_contact(uuid)` | supabase/migrations/20260820101322_e01f1911-dc7b-4a25-9ea5-9a0a688ae734.sql | write / view |
| Function `get_scheduled_job_status()` | drizzle/migrations/0001_add_scheduled_job_status_reader.sql | approve / write / view |
| Function `can_approve_labour_invoice(uuid)` | supabase/migrations/20260821112858_448bf9d0-b514-4691-933f-e2453b1f75e9.sql | approve / write / view |
| Function `get_storage_usage_by_bucket()` | supabase/migrations/20260724082429_feb67f96-23a6-4f64-abe0-83f998ce37e9.sql | view |
| Function `set_feature_flag(text,boolean)` | drizzle/migrations/0002_audit_feature_flag_changes.sql | write / view |
| Function `commit_project_setup_upload(uuid,jsonb,jsonb,jsonb)` | drizzle/migrations/0004_project_setup_excel_upload.sql<br>drizzle/migrations/0006_project_setup_upload_validation.sql<br>drizzle/migrations/0007_project_setup_atomic_excel_commit.sql<br>drizzle/migrations/0008_project_setup_restrict_rpc_entrypoints.sql<br>drizzle/migrations/0018_p4_daily_site_report.sql | write / view |
| Function `notify_call_funnel_anomaly()` | supabase/migrations/20260821143630_231a1994-084a-41db-8776-933487b303a9.sql<br>supabase/migrations/20260821143822_68375784-d9e4-4a46-bc78-0303a10010c0.sql | notify / write / view |
| Function `is_approver_tier(uuid)` | supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | approve / view |
| Function `is_hr_admin_tier(uuid)` | supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | view |
| Function `get_project_setup_status(uuid)` | drizzle/migrations/0005_project_setup_status_reader.sql | write / view |
| Function `is_win_sync_approver(uuid)` | supabase/migrations/20260821170238_b7089bd9-8a56-470d-ba80-341c850848ca.sql | approve / view |
| Function `commit_project_setup_upload_validated(uuid,jsonb,jsonb,jsonb)` | drizzle/migrations/0006_project_setup_upload_validation.sql<br>drizzle/migrations/0007_project_setup_atomic_excel_commit.sql<br>drizzle/migrations/0008_project_setup_restrict_rpc_entrypoints.sql | write / view |
| Function `can_log_fixed_asset_service(uuid)` | supabase/migrations/20260512174539_f4012d0c-dd42-4ed1-b9c4-b7d834dac27b.sql | view |
| Function `list_open_reminders()` | drizzle/migrations/0024_p7_shadow_reminders.sql | view |
| Function `can_submit_factory_measurement(uuid)` | supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql | write / view |
| Function `can_read_measurements(uuid)` | supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql<br>supabase/migrations/20260804052853_d226217c-2b30-4503-9484-285501e1c891.sql | write / view |
| Function `can_manage_boq(uuid)` | supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql | write / view |
| Function `approve_handover_and_close(uuid)` | supabase/migrations/20260627175705_2fb66fbe-7917-48dc-a171-530850ec1bd0.sql<br>supabase/migrations/20260627175848_c3f9a251-730a-4452-9d11-4241a17ffef7.sql<br>supabase/migrations/20260825125252_62938f22-745e-4886-ac02-fd941dfb2ffd.sql | notify / approve / write / view |
| Function `can_unlock_measurement(uuid,text)` | supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql | view |
| Function `can_submit_site_measurement(uuid)` | supabase/migrations/20260514191126_248ea0a1-8efd-4b6d-9c4d-c35aa4c46c9f.sql | write / view |
| Function `run_reminders(boolean,timestamp with time zone)` | drizzle/migrations/0024_p7_shadow_reminders.sql<br>drizzle/migrations/0025_p7b_reminder_safety.sql<br>drizzle/migrations/0026_p7c_md_dated_previews.sql | notify / write / view |
| Function `can_edit_fixed_assets(uuid)` | supabase/migrations/20260512174539_f4012d0c-dd42-4ed1-b9c4-b7d834dac27b.sql<br>supabase/migrations/20260514193649_e82267b5-bfd1-4e14-949e-8fe9d1dafb70.sql<br>supabase/migrations/20260824064124_236b941e-e144-4805-9f38-f7e739b5eb16.sql | write / view |
| Function `can_submit_manpower(uuid,text)` | supabase/migrations/20260514195330_ea1142a8-4f28-4554-9ff0-d99a6f7374a0.sql | write / view |
| Function `can_raise_work_order(uuid)` | supabase/migrations/20260428055425_e4013c96-3174-4516-99e4-a1ff19f2fa4f.sql<br>supabase/migrations/20260821112858_448bf9d0-b514-4691-933f-e2453b1f75e9.sql | view |
| Function `can_issue_work_order(uuid)` | supabase/migrations/20260428055425_e4013c96-3174-4516-99e4-a1ff19f2fa4f.sql | write / view |
| Function `can_manage_quotations(uuid)` | supabase/migrations/20260627174031_cb732fd3-33fa-494e-938b-df6740996b31.sql | write / view |
| Function `can_manage_floor_plan(uuid)` | supabase/migrations/20260514195800_c3ffef73-0942-4669-b343-ac5491ae9db7.sql<br>supabase/migrations/20260514202926_7f79f5e8-dce7-4752-b90a-891966e50154.sql | write / view |
| Function `can_capture_site_photo(uuid)` | supabase/migrations/20260514195800_c3ffef73-0942-4669-b343-ac5491ae9db7.sql | view |
| Function `can_approve_quotations(uuid)` | supabase/migrations/20260627174031_cb732fd3-33fa-494e-938b-df6740996b31.sql<br>supabase/migrations/20260821153140_747b9de0-581d-4a88-b30b-9785bbfd455e.sql | approve / view |
| Function `can_edit_with_reason(uuid,text,uuid)` | supabase/migrations/20260807012342_5a9fbd4d-f88d-4ea7-b954-9a51339d5d4e.sql<br>supabase/migrations/20260807012705_40a9d8a4-2cd4-4d25-97f1-ab6df3366798.sql<br>supabase/migrations/20260821143630_231a1994-084a-41db-8776-933487b303a9.sql | write / view |
| Function `cv_alert_overdue_commitments()` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260806063915_b88cd459-8224-423c-b29b-4fe4ba6bb359.sql | notify / write / view |
| Function `cv_notify_logged()` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260806063915_b88cd459-8224-423c-b29b-4fe4ba6bb359.sql | notify / write / view |
| Function `qr_notify_status()` | supabase/migrations/20260627174031_cb732fd3-33fa-494e-938b-df6740996b31.sql<br>supabase/migrations/20260714110447_92a3b683-c9b7-408f-83ac-e2044da81bda.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql | notify / approve / write / view |
| Function `is_role_admin_tier(uuid)` | supabase/migrations/20260901060214_6ad68585-862c-49b3-b947-b84e30dfe1a3.sql | view |
| Function `get_labour_attendance_warnings(uuid,date,jsonb)` | drizzle/migrations/0012_secure_labour_attendance_actions.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql | view |
| Function `save_labour_attendance(uuid,date,jsonb,text)` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0012_secure_labour_attendance_actions.sql<br>drizzle/migrations/0013_fix_labour_master_security_and_audit.sql<br>drizzle/migrations/0014_protect_labour_worker_identity_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql<br>drizzle/migrations/0016_scope_labour_directory_and_edit_reasons.sql<br>drizzle/migrations/0017_labour_codes_and_attendance_audit.sql | write / view |
| Function `submit_external_combined_contract(uuid,uuid,text,text,date,text,text,numeric)` | supabase/migrations/20260807023300_c7eb8884-f876-413e-84c8-34f84b5e44bf.sql | write / view |
| Function `commit_labour_master_upload(jsonb)` | drizzle/migrations/0011_labour_master_and_attendance.sql<br>drizzle/migrations/0012_secure_labour_attendance_actions.sql<br>drizzle/migrations/0013_fix_labour_master_security_and_audit.sql<br>drizzle/migrations/0014_protect_labour_worker_identity_and_attendance.sql<br>drizzle/migrations/0015_labour_directory_views_and_attendance_permissions.sql<br>drizzle/migrations/0017_labour_codes_and_attendance_audit.sql | write / view |
| Function `trg_scope_signoff_finalize()` | Live database (no source match) | notify / write / view |
| Function `smr_notify()` | supabase/migrations/20260627175102_9f90b720-8aaa-49c0-8ac3-bb5ac56dadf4.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260825124834_33e2a5e4-4fe3-4e84-8416-9d5e1a80e021.sql | notify / approve / write / view |
| Function `trg_project_closure_create_archive()` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql<br>supabase/migrations/20260813065407_da59bf1a-8217-4bf0-9714-4c0050019ab0.sql | notify / write / view |
| Function `fire_billing_milestone_event(uuid,text,text)` | supabase/migrations/20260627180035_64fe22a6-5d7f-461d-aefb-fec6208e5712.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260806063915_b88cd459-8224-423c-b29b-4fe4ba6bb359.sql | notify / write / view |
| Function `can_write_site_report(uuid,uuid)` | drizzle/migrations/0018_p4_daily_site_report.sql<br>drizzle/migrations/0020_p4c_elevations_trade_fix.sql | view |
| Function `trg_archive_task_completed()` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql<br>supabase/migrations/20260808055352_1591f04a-f8c2-4e78-859b-0f7739c16b1c.sql | notify / write / view |
| Function `confirm_kickoff_meeting(uuid,date,time without time zone,text,text)` | supabase/migrations/20260627180634_73220044-b12f-444b-8a88-d20fe1b2c998.sql<br>supabase/migrations/20260806063915_b88cd459-8224-423c-b29b-4fe4ba6bb359.sql<br>supabase/migrations/20260810091700_31ac15d9-8480-4178-a52e-407e847b39dc.sql | notify / write / view |
| Function `can_manage_project_elevations(uuid,uuid)` | drizzle/migrations/0020_p4c_elevations_trade_fix.sql | write / view |
| Function `notify_costing_on_measurement_submit()` | drizzle/migrations/0022_p4e_skip_site_report_measurement_notifications.sql<br>supabase/migrations/20260627173530_ad04fac5-3fe2-494e-ba2f-56b5ae6141ad.sql<br>supabase/migrations/20260627173745_9584e9cf-a05e-4c41-895a-ee67d5c6af0d.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql | notify / write / view |
| Function `amc_followup_daily_reminders()` | supabase/migrations/20260627180418_71f58920-59b3-4021-b426-b0b4b672a513.sql | notify / write / view |
| Function `can_access_labour_compensation(uuid)` | supabase/migrations/20260721131715_065032a7-cd10-4c9d-b486-cd56047fb0c7.sql<br>supabase/migrations/20260810101318_a0a1d514-71bf-459f-929b-2f6b3b70d41b.sql | write / view |
| Function `is_tally_ingest_viewer(uuid)` | supabase/migrations/20260721101108_929c5fc0-e1ab-4467-be99-e05d294c641f.sql<br>supabase/migrations/20260810101318_a0a1d514-71bf-459f-929b-2f6b3b70d41b.sql | write / view |
| Function `is_tally_ingest_admin(uuid)` | supabase/migrations/20260721101108_929c5fc0-e1ab-4467-be99-e05d294c641f.sql | view |
| Trigger `daily_measurements.trg_notify_measurement_submit` → `notify_costing_on_measurement_submit` | drizzle/migrations/0022_p4e_skip_site_report_measurement_notifications.sql<br>supabase/migrations/20260627173530_ad04fac5-3fe2-494e-ba2f-56b5ae6141ad.sql<br>supabase/migrations/20260627173745_9584e9cf-a05e-4c41-895a-ee67d5c6af0d.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql | notify / write / view |
| Trigger `quotation_requests.trg_qr_notify_status` → `qr_notify_status` | supabase/migrations/20260627174031_cb732fd3-33fa-494e-938b-df6740996b31.sql<br>supabase/migrations/20260714110447_92a3b683-c9b7-408f-83ac-e2044da81bda.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql | notify / approve / write / view |
| Trigger `special_material_requests.trg_smr_notify` → `smr_notify` | supabase/migrations/20260627175102_9f90b720-8aaa-49c0-8ac3-bb5ac56dadf4.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260825124834_33e2a5e4-4fe3-4e84-8416-9d5e1a80e021.sql | notify / approve / write / view |
| Trigger `client_visits.trg_cv_notify_logged` → `cv_notify_logged` | supabase/migrations/20260627175408_4e1b1bf8-8dd6-47e2-8471-17fea61a26ef.sql<br>supabase/migrations/20260803050333_244e334d-561f-418b-9e33-54ffe602d0d2.sql<br>supabase/migrations/20260806063915_b88cd459-8224-423c-b29b-4fe4ba6bb359.sql | notify / write / view |
| Trigger `projects.trg_project_closure_create_archive` → `trg_project_closure_create_archive` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql<br>supabase/migrations/20260813065407_da59bf1a-8217-4bf0-9714-4c0050019ab0.sql | notify / write / view |
| Trigger `project_tasks.trg_archive_task_completed` → `trg_archive_task_completed` | supabase/migrations/20260627181337_ea73344d-5d55-4167-b032-10f1473400b4.sql<br>supabase/migrations/20260808055352_1591f04a-f8c2-4e78-859b-0f7739c16b1c.sql | notify / write / view |
| Trigger `project_scope_of_work.trg_scope_signoff_finalize` → `trg_scope_signoff_finalize` | Live database (no source match) | notify / write / view |
| Trigger `call_funnel_monthly.trg_notify_call_funnel_anomaly` → `notify_call_funnel_anomaly` | supabase/migrations/20260821143630_231a1994-084a-41db-8776-933487b303a9.sql<br>supabase/migrations/20260821143822_68375784-d9e4-4a46-bc78-0303a10010c0.sql | notify / write / view |

## Frontend inventory
| File:line | MD-only or incomplete director check | Gates |
|---|---|---|
| `src/App.tsx:117` | <Route path="/settings" element={<ModuleGuard featureFlag="user_admin" requireRoles={["super_admin", "managing_director"]}><AppSettings /></ModuleGuard>} /> | approve / write / view |
| `src/components/AppSidebar.tsx:31` | const CAPACITY_ROLES = ["super_admin", "managing_director", "head_operations", "planning_head", "production_head"]; | approve / write / view |
| `src/components/AppSidebar.tsx:32` | const SETTINGS_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/components/AppSidebar.tsx:33` | const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/components/ManagementRouteGuard.tsx:7` | "super_admin", "managing_director", "finance_director", | write / view |
| `src/components/MobileNav.tsx:32` | const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/components/MobileNav.tsx:33` | const SETTINGS_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/components/RoleSwitcher.tsx:31` | const currentRole = role ?? actualRole ?? "managing_director"; | view |
| `src/components/StorageManagementSection.tsx:41` | setAllowed(["managing_director", "super_admin", "head_of_projects"].includes(role)); | write / view |
| `src/hooks/usePendingApprovalsCount.ts:6` | const APPROVER_ROLES = ["managing_director", "super_admin", "sales_director", "architecture_director"]; | approve / view |
| `src/hooks/usePermissions.ts:18` | *   canAdmin()    → super_admin / managing_director / head_of_projects | write / view |
| `src/hooks/usePermissions.ts:38` | appRole === ("managing_director" as AppRole); | write / view |
| `src/hooks/useProjectArchitect.ts:20` | "managing_director", | write / view |
| `src/hooks/useRoleHolders.ts:6` | const OVERSIGHT_ROLES = ["super_admin", "managing_director"]; | view |
| `src/hooks/useRolePermissions.ts:42` | if (role === "managing_director" // role === "super_admin") return "full"; | view |
| `src/hooks/useUserRole.ts:8` | const MD_ROLES = ["managing_director", "super_admin"]; | view |
| `src/lib/design-schedule.ts:14` | "super_admin", "managing_director", "finance_director", "sales_director", | write / view |
| `src/lib/hstack-users.ts:25` | { name: "Gaurav Chouraria", role: "managing_director" as AppRole, group: "Directors & MD" }, | write / view |
| `src/lib/kpi-helpers.ts:5` | "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", | write / view |
| `src/lib/kpi-helpers.ts:14` | "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", | write / view |
| `src/lib/labour-invoices.ts:13` | "super_admin", "managing_director", "production_head", "site_installation_mgr", | approve / write / view |
| `src/lib/labour-invoices.ts:18` | "super_admin", "managing_director", "finance_director", "finance_manager", | approve / write / view |
| `src/lib/labour-rules.ts:8` | "managing_director", | write / view |
| `src/lib/labour-rules.ts:14` | "managing_director", | write / view |
| `src/lib/labour-rules.ts:24` | "managing_director", | write / view |
| `src/lib/labour-rules.ts:31` | "managing_director", | write / view |
| `src/lib/notifications.ts:25` | "managing_director", "super_admin", "director", | notify / approve / write / view |
| `src/lib/rbac-matrix.ts:59` | managing_director: FULL_ALL, | approve / write / view |
| `src/lib/rbac-matrix.ts:168` | "managing_director" as AppRole, | approve / write / view |
| `src/lib/rbac-matrix.ts:179` | "managing_director" as AppRole, | approve / write / view |
| `src/lib/role-nav.ts:8` | const FULL_ACCESS: AppRole[] = ["super_admin", "managing_director"]; | approve / write / view |
| `src/lib/roles.ts:8` | managing_director: "Managing Director", | write / view |
| `src/lib/roles.ts:48` | "Tier 1 — Directors & MD": ["chairman", "managing_director", "finance_director", "sales_director", "architecture_director"] as AppRole[], | write / view |
| `src/lib/sales-tasks.ts:26` | const PORTAL_TOKEN_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "planning_head"]; | approve / write / view |
| `src/lib/sales-tasks.ts:29` | const SALES_APPROVER_ROLES = ["sales_director", "managing_director", "super_admin"]; | approve / write / view |
| `src/lib/site-readiness-permissions.ts:14` | "managing_director", | write / view |
| `src/lib/super-admin.ts:12` | "managing_director","finance_director","sales_director","architecture_director", | notify / write / view |
| `src/lib/unlock-authority.ts:12` | "managing_director", | write / view |
| `src/pages/AMC.tsx:20` | const CAN_CREATE = ["super_admin", "managing_director", "sales_director"]; | write / view |
| `src/pages/Admin.tsx:14` | const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/pages/AdminHR.tsx:70` | const LEAVE_ORG_WIDE_ROLES = ["super_admin", "managing_director", "hr_executive"]; | approve / write / view |
| `src/pages/AdvanceRequest.tsx:188` | ? ["managing_director" as const] | notify / approve / write / view |
| `src/pages/Announcements.tsx:16` | "super_admin", "managing_director", "finance_director", | write / view |
| `src/pages/AppSettings.tsx:14` | const ADMIN_ROLES = ["super_admin", "managing_director"]; | write / view |
| `src/pages/Approvals.tsx:19` | const APPROVER_ROLES = ["managing_director", "super_admin", "sales_director", "architecture_director"]; | approve / write / view |
| `src/pages/CapacityPlanning.tsx:57` | "production_head", "head_operations", "managing_director", "super_admin", | approve / write / view |
| `src/pages/CapacityPlanning.tsx:62` | "production_head", "head_operations", "managing_director", "super_admin", | approve / write / view |
| `src/pages/DeliveryChecklist.tsx:72` | const canEditModules = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/pages/DeliveryChecklist.tsx:73` | const canEditTools = ["stores_executive", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/pages/DeliveryChecklist.tsx:74` | const canEditAdditional = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/pages/DesignPortal.tsx:169` | const isPrincipal = ["principal_architect", "senior_architect", "head_operations", "project_architect", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/pages/DesignPortal.tsx:170` | const canUpload = ["principal_architect", "senior_architect", "project_architect", "structural_architect", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/pages/DesignPortal.tsx:171` | const isArchitect = ["principal_architect", "senior_architect", "project_architect", "structural_architect", "operations_architect", "head_operations", "super_admin", "managing_director", "architecture_director", "finance_director", "sales_ | notify / approve / write / view |
| `src/pages/DispatchDelivery.tsx:14` | "super_admin", "managing_director", | view |
| `src/pages/Drawings.tsx:67` | const canUpload = ["principal_architect", "project_architect", "structural_architect", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / write / view |
| `src/pages/EmployeeManagement.tsx:26` | { key: "t1", label: "Tier 1 — Directors & MD", roles: ["chairman", "managing_director", "finance_director", "sales_director", "architecture_director", "principal_architect"] as AppRole[] }, | write / view |
| `src/pages/EmployeeManagement.tsx:75` | const allowed = role === "super_admin" // role === "managing_director"; | write / view |
| `src/pages/EmployeeManagement.tsx:700` | "managing director": "managing_director" as AppRole, | write / view |
| `src/pages/FactoryFloorMap.tsx:54` | const CAN_ASSIGN_ROLES = ["production_head", "factory_floor_supervisor", "super_admin", "managing_director"]; | write / view |
| `src/pages/MaterialRequests.tsx:29` | "super_admin", "managing_director", | approve / write / view |
| `src/pages/MaterialRequests.tsx:35` | "super_admin", "managing_director", "finance_director", | approve / write / view |
| `src/pages/MaterialRequests.tsx:188` | {r.status === "pending_budget" && (userRole === "costing_engineer" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/pages/MaterialRequests.tsx:195` | {r.status === "pending_director_approval" && (userRole === "managing_director" // userRole === "finance_director" // userRole === "super_admin") && ( | approve / write / view |
| `src/pages/MaterialRequests.tsx:201` | {r.status === "pending_po" && (userRole === "procurement" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/pages/MaterialRequests.tsx:204` | {r.status === "po_raised" && (userRole === "stores_executive" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/pages/Onboarding.tsx:18` | managing_director: [ | notify / approve / write / view |
| `src/pages/Onboarding.tsx:197` | .in("role", ["production_head", "head_operations", "managing_director", "super_admin"]) | notify / approve / write / view |
| `src/pages/Procurement.tsx:41` | const STOCK_CREATOR_ROLES = ["stores_executive", "managing_director", "super_admin", "production_head"]; | approve / write / view |
| `src/pages/Procurement.tsx:42` | const PLANNER_ROLES = ["planning_engineer", "super_admin", "managing_director"]; | approve / write / view |
| `src/pages/Procurement.tsx:44` | "super_admin", "managing_director", "site_installation_mgr", "site_engineer", | approve / write / view |
| `src/pages/Procurement.tsx:48` | "super_admin", "managing_director", "finance_director", "costing_engineer", | approve / write / view |
| `src/pages/Procurement.tsx:409` | {r.status === "pending_budget" && ["costing_engineer", "super_admin", "managing_director"].includes(userRole ?? "") && ( | approve / write / view |
| `src/pages/Procurement.tsx:415` | {r.status === "pending_director_approval" && ["managing_director", "finance_director", "super_admin"].includes(userRole ?? "") && ( | approve / write / view |
| `src/pages/Procurement.tsx:418` | {r.status === "pending_po" && ["stores_executive", "super_admin", "managing_director"].includes(userRole ?? "") && ( | approve / write / view |
| `src/pages/ProductionDashboard.tsx:13` | const AZAD_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"]; | view |
| `src/pages/ProjectDetail.tsx:42` | const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"]; | approve / write / view |
| `src/pages/ProjectDetail.tsx:43` | const STAGE_ADVANCE_ROLES = ["planning_engineer", "production_head", "super_admin", "managing_director"]; | approve / write / view |
| `src/pages/ProjectDetail.tsx:44` | const ARCHIVE_REQUEST_ROLES = ["managing_director", "super_admin", "finance_director", "sales_director", "architecture_director"]; | approve / write / view |
| `src/pages/ProjectDetail.tsx:45` | const PL_VIEW_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "head_operations", "finance_manager", "accounts_executive"]; | approve / write / view |
| `src/pages/Projects.tsx:11` | const NEW_PROJECT_ROLES = ["planning_head", "planning_engineer", "managing_director", "super_admin"]; | approve / write / view |
| `src/pages/QualityControl.tsx:125` | const canInspect = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/pages/RM.tsx:136` | const CAN_RAISE = ["super_admin", "managing_director", "site_installation_mgr", "site_engineer", "delivery_rm_lead", "head_operations", "production_head", "sales_director"]; | write / view |
| `src/pages/RM.tsx:137` | const CAN_ESTIMATE = ["costing_engineer", "super_admin", "managing_director"]; | write / view |
| `src/pages/RM.tsx:138` | const CAN_SCHEDULE = ["planning_engineer", "super_admin", "managing_director"]; | write / view |
| `src/pages/RM.tsx:139` | const CAN_COMPLETE = ["delivery_rm_lead", "super_admin", "managing_director"]; | write / view |
| `src/pages/SOPs.tsx:31` | "super_admin","managing_director","finance_director","sales_director","architecture_director","head_operations", | approve / write / view |
| `src/pages/SiteHub.tsx:191` | const canCreateDispatchPack = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(userRole ?? ""); | approve / write / view |
| `src/pages/SiteHub.tsx:192` | const canRequestAdvance = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? ""); | approve / write / view |
| `src/pages/SuperAdmin.tsx:18` | const MD_ROLES = ["managing_director", "super_admin"]; | approve / write / view |
| `src/pages/UserManagement.tsx:28` | "managing_director","super_admin","finance_director","sales_director", | notify / approve / write / view |
| `src/pages/UserManagement.tsx:31` | const MD_ROLES = ["managing_director","super_admin"]; | notify / approve / write / view |
| `src/pages/UserManagement.tsx:32` | const PROJECT_APPROVER_ROLES = ["managing_director","super_admin","sales_director","architecture_director"]; | notify / approve / write / view |
| `src/pages/UserManagement.tsx:162` | .from("profiles").select("auth_user_id").eq("role", "managing_director" as any).eq("is_active", true); | notify / approve / write / view |
| `src/pages/WorkOrders.tsx:12` | "super_admin", "managing_director", "chairman", "finance_director", | write / view |
| `src/integrations/supabase/types.ts:17358` | / "managing_director" | notify / approve / write / view |
| `src/integrations/supabase/types.ts:17552` | "managing_director", | notify / approve / write / view |
| `src/components/dashboard/DailyReadinessBrief.tsx:35` | "super_admin", "managing_director", | approve / write / view |
| `src/components/dashboard/DailyReadinessBrief.tsx:322` | if (role === "managing_director") return await buildDirectorBrief(); | approve / write / view |
| `src/components/dashboard/HomeTaskList.tsx:32` | const siteRoles = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"]; | write / view |
| `src/components/dashboard/HomeTaskList.tsx:49` | if (flags.isEnabled("project_setup") && userRole && ["planning_engineer", "planning_head", "super_admin", "managing_director"].includes(userRole)) { | write / view |
| `src/components/dashboard/OrderBookTab.tsx:15` | const EDIT_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","planning_head"]; | write / view |
| `src/components/dashboard/SharedDashboardBottom.tsx:14` | const CAN_POST: AppRole[] = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"]; | write / view |
| `src/components/design/BOQManager.tsx:22` | "super_admin", "managing_director", "architecture_director", | write / view |
| `src/components/design/GFCStatusCard.tsx:110` | const baseRoles = ["production_head", "head_operations", "managing_director", "planning_engineer"]; | notify / approve / write / view |
| `src/components/design/GFCStatusCard.tsx:111` | const h3Roles = ["site_installation_mgr", "site_engineer", "head_operations", "managing_director"]; | notify / approve / write / view |
| `src/components/design/MasterQCChecklist.tsx:164` | .select("auth_user_id").in("role", ["production_head", "head_operations", "managing_director"] as any[]).eq("is_active", true); | notify / write / view |
| `src/components/dispatch/DeliveryChecklistV2.tsx:44` | const isRakesh = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/components/dispatch/DeliveryChecklistV2.tsx:45` | const isSandeep = ["stores_executive", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/components/dispatch/DeliveryChecklistV2.tsx:46` | const isAwaiz = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/components/dispatch/DispatchPackFormV2.tsx:26` | const CREATE_ROLES = ["super_admin", "managing_director", "production_head", "factory_floor_supervisor", "head_operations"]; | notify / write / view |
| `src/components/dispatch/InstallationSequenceV2.tsx:43` | const isAwaiz = ["site_installation_mgr", "super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/components/dispatch/InstallationSequenceV2.tsx:44` | const isMD = ["super_admin", "managing_director"].includes(role ?? ""); | notify / write / view |
| `src/components/dispatch/InstallationSequenceV2.tsx:187` | .in("role", ["managing_director", "super_admin"] as any).eq("is_active", true); | notify / write / view |
| `src/components/expenses/ExpensesTab.tsx:90` | const isHR = role === "hr_admin" // role === "super_admin" // role === "managing_director"; | notify / approve / write / view |
| `src/components/expenses/ExpensesTab.tsx:92` | const isFinanceApprover = role === "finance_director" // role === "managing_director" // role === "super_admin"; | notify / approve / write / view |
| `src/components/expenses/ExpensesTab.tsx:151` | await notifyByRole(["finance_director", "managing_director"], { | notify / approve / write / view |
| `src/components/expenses/HRSettingsTab.tsx:28` | const isHR = role === "hr_executive" // role === "super_admin" // role === "managing_director"; | approve / write / view |
| `src/components/expenses/HRSettingsTab.tsx:29` | const canApprove = ["finance_director", "managing_director", "super_admin"].includes(role // ""); | approve / write / view |
| `src/components/finance/AdvanceApprovalsTab.tsx:34` | const APPROVER_ROLES = ["managing_director", "super_admin", "finance_director"]; | notify / approve / write / view |
| `src/components/finance/AuditedFinancialsTab.tsx:34` | const CONFIRM_ROLES = ["finance_director", "managing_director", "super_admin"]; | write / view |
| `src/components/finance/BillingTrackerTab.tsx:33` | const ACCESS_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","head_operations"]; | write / view |
| `src/components/finance/BillingTrackerTab.tsx:34` | const EDIT_ROLES = ["super_admin","managing_director","finance_director","finance_manager"]; | write / view |
| `src/components/finance/InvoicesTab.tsx:67` | "super_admin", "managing_director", "finance_director", "finance_manager", | approve / write / view |
| `src/components/finance/PaymentApprovalSection.tsx:45` | .in("role", ["finance_director", "managing_director", "super_admin"] as any) | notify / approve / write / view |
| `src/components/finance/PaymentApprovalSection.tsx:69` | .in("role", ["finance_director", "managing_director", "super_admin"] as any) | notify / approve / write / view |
| `src/components/finance/PaymentsTab.tsx:106` | const canUpload = ["finance_manager", "finance_director", "managing_director", "super_admin"].includes(role // ""); | approve / write / view |
| `src/components/finance/ProjectPLTab.tsx:30` | "finance_director", "managing_director", "super_admin", "finance_manager", | write / view |
| `src/components/finance/ReceivablesTab.tsx:29` | const ACCESS_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","head_operations"]; | write / view |
| `src/components/finance/ReceivablesTab.tsx:30` | const EDIT_ROLES = ["super_admin","managing_director","finance_director","finance_manager"]; | write / view |
| `src/components/finance/RetentionSection.tsx:31` | "super_admin", "managing_director", "finance_director", "finance_manager", | write / view |
| `src/components/finance/RevenueMarginTab.tsx:18` | "super_admin", "managing_director", "finance_director", "finance_manager", | write / view |
| `src/components/finance/RevenueMarginTab.tsx:22` | "super_admin", "managing_director", "finance_director", "finance_manager", | write / view |
| `src/components/finance/TallyIncomingSyncLogTab.tsx:9` | const ALLOWED = ["super_admin", "managing_director", "finance_manager"]; | write / view |
| `src/components/finance/WIPStatement.tsx:25` | "super_admin", "managing_director", "finance_director", "finance_manager", | write / view |
| `src/components/hr/LabourClaimsTab.tsx:19` | const APPROVER_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"]; | notify / approve / write / view |
| `src/components/hr/LabourClaimsTab.tsx:20` | const ESCALATION_ROLES = ["super_admin", "managing_director", "head_operations", "production_head"]; // Azad-equivalent | notify / approve / write / view |
| `src/components/hr/LabourRegisterTab.tsx:24` | const MANAGE_ROLES = ["super_admin","managing_director","finance_director","production_head","site_installation_mgr","finance_manager"]; | write / view |
| `src/components/kpi/MdNotePanel.tsx:15` | const isMd = role === "managing_director" // role === "super_admin"; | write / view |
| `src/components/labour/DailyLabourLog.tsx:68` | "managing_director", | write / view |
| `src/components/labour/ManpowerWeeklyExcel.tsx:31` | if (["super_admin", "managing_director", "planning_head", "head_operations"].includes(role)) return true; | notify / write / view |
| `src/components/labour/ManpowerWeeklyExcel.tsx:281` | .select("auth_user_id").in("role", ["managing_director", "super_admin", "head_operations", "planning_head"]) | notify / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:27` | "super_admin", "managing_director", | approve / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:33` | "super_admin", "managing_director", "finance_director", | approve / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:173` | {r.status === "pending_budget" && (userRole === "costing_engineer" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:180` | {r.status === "pending_director_approval" && (userRole === "managing_director" // userRole === "finance_director" // userRole === "super_admin") && ( | approve / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:186` | {r.status === "pending_po" && (userRole === "procurement" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/components/materials/MaterialRequestsPanel.tsx:189` | {r.status === "po_raised" && (userRole === "stores_executive" // userRole === "super_admin" // userRole === "managing_director") && ( | approve / write / view |
| `src/components/procurement/AssetRegisterTab.tsx:56` | const EDITOR_ROLES = ["stores_executive", "procurement", "super_admin", "managing_director"]; | write / view |
| `src/components/procurement/ContractsRegisterTab.tsx:18` | const EDIT_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","head_operations","procurement","planning_head"]; | write / view |
| `src/components/procurement/DeliveryTrackerTab.tsx:23` | const EDIT_ROLES = ["super_admin","managing_director","procurement","stores_executive","planning_engineer","planning_head","head_operations"]; | write / view |
| `src/components/procurement/FixedAssetsTab.tsx:19` | const EDIT_ROLES = ["super_admin", "managing_director", "procurement", "stores_executive", "production_head"]; | approve / write / view |
| `src/components/procurement/FixedAssetsTab.tsx:20` | const SERVICE_ROLES = ["super_admin", "managing_director", "procurement", "production_head"]; | approve / write / view |
| `src/components/procurement/FixedAssetsTab.tsx:21` | const MD_ROLES = ["super_admin", "managing_director"]; | approve / write / view |
| `src/components/procurement/MaterialPlanTab.tsx:107` | const inUploadRoles = ["procurement", "stores_executive", "super_admin", "managing_director", "planning_engineer"].includes(userRole ?? ""); | write / view |
| `src/components/procurement/MaterialPlanTab.tsx:109` | const canEdit = ["procurement", "stores_executive", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/procurement/ProcurementDashboardStrip.tsx:9` | const PROCUREMENT_ROLES = ["procurement", "stores_executive", "super_admin", "managing_director"]; | approve / view |
| `src/components/procurement/QuotationsTab.tsx:47` | const MANAGE_ROLES = ["procurement", "purchase_assistant", "managing_director", "super_admin"]; | approve / write / view |
| `src/components/procurement/QuotationsTab.tsx:48` | const APPROVE_ROLES = ["costing_engineer", "managing_director", "super_admin"]; | approve / write / view |
| `src/components/procurement/QuotationsTab.tsx:52` | "managing_director", "super_admin", "finance_director", "head_operations", | approve / write / view |
| `src/components/procurement/SubcontractorsTab.tsx:24` | const VIEW_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","finance_manager","accounts_executive","production_head","site_installation_mgr","procurement","stores_executive","planning_en | write / view |
| `src/components/procurement/SubcontractorsTab.tsx:25` | const MANAGE_ROLES = ["super_admin","managing_director","finance_director","production_head","site_installation_mgr","procurement"]; | write / view |
| `src/components/procurement/TallyPOUploadTab.tsx:19` | const UPLOAD_ROLES = ["procurement", "production_head", "super_admin", "managing_director"]; | approve / write / view |
| `src/components/production/AICapacityAnalysisCard.tsx:22` | const AI_ALLOWED = ["production_head", "planning_head", "managing_director", "super_admin"]; | view |
| `src/components/production/DryAssemblyCheck.tsx:69` | const isSuperUser = ["super_admin", "managing_director", "head_operations"].includes(userRole ?? ""); | notify / write / view |
| `src/components/production/FactoryCapacityCard.tsx:32` | const ALLOWED = ["production_head", "head_operations", "managing_director", "super_admin", | write / view |
| `src/components/production/FactoryMeasurementSheet.tsx:42` | const SUPERVISOR_ROLES = ["factory_floor_supervisor", "production_head", "head_operations", "super_admin", "managing_director"]; | notify / write / view |
| `src/components/production/FactoryMeasurementSheet.tsx:43` | const COSTING_ROLES = ["costing_engineer", "finance_manager", "finance_director", "head_of_projects", "managing_director", "super_admin", "head_operations", "production_head"]; | notify / write / view |
| `src/components/production/GanttChart.tsx:41` | const ALLOWED_ROLES = ["planning_engineer", "production_head", "managing_director", "super_admin", | view |
| `src/components/production/LabourTeamsManager.tsx:33` | const MANAGE_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"]; | write / view |
| `src/components/production/ModuleTeamAssignment.tsx:11` | const ASSIGN_ROLES = ["super_admin", "managing_director", "head_operations", "production_head", "factory_floor_supervisor", "fabrication_foreman"]; | write / view |
| `src/components/production/ReworkLogSection.tsx:56` | const canLog = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/production/ScheduleConflictBanner.tsx:104` | const canAct = ["production_head", "managing_director", "super_admin", "head_operations"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/components/production/SpecialMaterialRequests.tsx:59` | const canCreate = userRole === "factory_floor_supervisor" // userRole === "production_head" // userRole === "super_admin" // userRole === "managing_director"; | approve / write / view |
| `src/components/production/SpecialMaterialRequests.tsx:60` | const canApprove = ["production_head", "head_operations", "managing_director", "super_admin"].includes(userRole ?? ""); | approve / write / view |
| `src/components/production/SpecialMaterialRequests.tsx:61` | const canIssue = ["stores_executive", "managing_director", "super_admin"].includes(userRole ?? ""); | approve / write / view |
| `src/components/production/StageChecklistDrawer.tsx:50` | "super_admin", "managing_director", | notify / write / view |
| `src/components/production/StageVelocityMonitor.tsx:36` | const ALLOWED = ["production_head", "head_operations", "managing_director", "super_admin", | notify / approve / write / view |
| `src/components/production/SupervisorDailyLog.tsx:52` | const isSupervisor = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director", "head_operations"].includes(userRole ?? ""); | approve / write / view |
| `src/components/production/SupervisorDailyLog.tsx:53` | const isReviewer = ["production_head", "super_admin", "managing_director", "head_operations"].includes(userRole ?? ""); | approve / write / view |
| `src/components/production/WeeklyManpowerPlanner.tsx:69` | const canAccess = ["production_head", "site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/projects/ArchiveProjectDialog.tsx:46` | .select("auth_user_id").in("role", ["managing_director", "super_admin"] as any).eq("is_active", true); | notify / approve / write / view |
| `src/components/projects/BillingMilestonesSection.tsx:93` | const canEdit = ["super_admin", "managing_director", "finance_director", "finance_manager"].includes(userRole // ""); | approve / write / view |
| `src/components/projects/BillingMilestonesSection.tsx:94` | const canEditAutoTrigger = ["super_admin", "managing_director", "planning_engineer", "finance_manager"].includes(userRole // ""); | approve / write / view |
| `src/components/projects/BillingMilestonesSection.tsx:95` | const canUnlock = ["super_admin", "managing_director"].includes(userRole // ""); | approve / write / view |
| `src/components/projects/BudgetTrackingTab.tsx:80` | const canEdit = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "procurement"].includes(userRole ?? ""); | approve / write / view |
| `src/components/projects/BudgetTrackingTab.tsx:81` | const isMd = ["super_admin", "managing_director"].includes(userRole ?? ""); | approve / write / view |
| `src/components/projects/ClientPortalManager.tsx:17` | "super_admin", "managing_director", "finance_director", | write / view |
| `src/components/projects/ClientPortalManager.tsx:32` | const canRevoke = ["super_admin", "managing_director", "finance_director", "sales_director", "planning_head"].includes(userRole ?? ""); | write / view |
| `src/components/projects/HistoricalBackfillCard.tsx:39` | const allowed = actualRole === "managing_director" // actualRole === "super_admin"; | notify / approve / write / view |
| `src/components/projects/KickoffMeetingCard.tsx:39` | const canAct = userRole === "operations_architect" // userRole === "managing_director" | approve / view |
| `src/components/projects/MicroScheduleTab.tsx:73` | const UPLOAD_ROLES = ["planning_engineer", "super_admin", "managing_director"]; | write / view |
| `src/components/projects/MicroScheduleTab.tsx:74` | const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"]; | write / view |
| `src/components/projects/MicroScheduleTab.tsx:80` | "super_admin", "managing_director", "chairman", "director", | write / view |
| `src/components/projects/MicroScheduleTab.tsx:116` | const canOverride = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? "") && !isProductionView; | write / view |
| `src/components/projects/NewProjectDialog.tsx:40` | const ALLOWED_RAISERS = ["planning_head", "managing_director", "super_admin"]; | notify / approve / write / view |
| `src/components/projects/NewProjectDialog.tsx:45` | const requiresApproval = !!role && !["managing_director", "super_admin"].includes(role); | notify / approve / write / view |
| `src/components/projects/PreProductionChecklist.tsx:118` | const LEADERSHIP_ROLES = ["super_admin", "managing_director"]; | write / view |
| `src/components/projects/ProductionStageTracker.tsx:17` | const OVERRIDE_ROLES = ["planning_engineer", "production_head", "head_operations", "super_admin", "managing_director"]; | approve / write / view |
| `src/components/projects/ProductionStageTracker.tsx:100` | const canStartInspection = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | approve / write / view |
| `src/components/projects/ProjectElevationsCard.tsx:9` | export const ELEVATION_MANAGER_ROLES = ["planning_head", "managing_director", "super_admin", "head_of_projects"]; | write / view |
| `src/components/projects/ProjectPLSubTab.tsx:16` | const EDIT_ROLES = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "costing_engineer"]; | write / view |
| `src/components/projects/ProjectSetupApprovalSection.tsx:30` | const ADMIN_ROLES = new Set(["super_admin", "managing_director"]); | notify / approve / write / view |
| `src/components/projects/ProjectSetupUpload.tsx:27` | const ALLOWED = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "costing_engineer", "principal_architect", "architecture_director", "head_operations"]; | write / view |
| `src/components/projects/ProjectSetupWorkbook.tsx:15` | const UPLOAD_ROLES = ["planning_head", "managing_director", "super_admin"]; | write / view |
| `src/components/projects/SaleAgreementCard.tsx:15` | const EDIT_ROLES = ["super_admin", "managing_director", "sales_director", "architecture_director", "planning_head", "finance_director", "sales_executive", "sales_associate"]; | notify / write / view |
| `src/components/projects/SaleAgreementCard.tsx:17` | const EXTERNAL_ROLES = ["super_admin", "managing_director", "chairman", "sales_director"]; | notify / write / view |
| `src/components/projects/ScopeOfWorkTab.tsx:46` | const DRAFT_EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director", "sales_director", "architecture_director", "sales_executive", "sales_associate"]; | notify / approve / write / view |
| `src/components/projects/ScopeOfWorkTab.tsx:47` | const SALES_DIRECTOR_ROLES = ["sales_director", "managing_director", "super_admin"]; | notify / approve / write / view |
| `src/components/projects/SiteScheduleSection.tsx:35` | const UPLOAD_ROLES = new Set(["planning_engineer", "planning_head", "head_operations", "super_admin", "managing_director"]); | notify / approve / write / view |
| `src/components/projects/SiteScheduleSection.tsx:37` | const ADMIN_ROLES = new Set(["super_admin", "managing_director"]); | notify / approve / write / view |
| `src/components/projects/VariationsTab.tsx:37` | const CREATE_ROLES = ["planning_engineer", "costing_engineer", "super_admin", "managing_director"]; | notify / approve / write / view |
| `src/components/projects/VariationsTab.tsx:38` | const SCOPE_APPROVE_ROLES = ["sales_director", "super_admin", "managing_director"]; | notify / approve / write / view |
| `src/components/projects/VariationsTab.tsx:39` | const FINANCE_APPROVE_ROLES = ["finance_director", "finance_manager", "super_admin", "managing_director"]; | notify / approve / write / view |
| `src/components/projects/VariationsTab.tsx:40` | const MD_APPROVE_ROLES = ["managing_director", "super_admin"]; | notify / approve / write / view |
| `src/components/projects/VariationsTab.tsx:41` | const DELETE_ROLES = ["managing_director", "super_admin", "finance_director", "sales_director", "architecture_director"]; | notify / approve / write / view |
| `src/components/quality/QualityFlagButton.tsx:12` | const QC_ROLES = ["qc_inspector", "production_head", "managing_director", "super_admin"]; // Tagore = qc_inspector | notify / write / view |
| `src/components/quality/QualityFlagsTab.tsx:14` | const ACTION_ROLES = ["qc_inspector", "production_head", "managing_director", "super_admin", "head_operations"]; | write / view |
| `src/components/safety/SafetyIncidentsTab.tsx:27` | const MANAGE_ROLES = ["super_admin", "managing_director", "head_operations", "production_head", "site_installation_mgr", "hr_executive"]; | notify / write / view |
| `src/components/safety/SafetyIncidentsTab.tsx:28` | const URGENT_NOTIFY_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"]; | notify / write / view |
| `src/components/sales/DealDrawer.tsx:533` | const canApproveDiscount = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"].includes(userRole ?? ""); | approve / write / view |
| `src/components/sales/FunnelEntryTab.tsx:18` | "managing_director", | write / view |
| `src/components/sales/WinConfirmDialog.tsx:11` | const APPROVER_ROLES = ["sales_director", "managing_director", "super_admin"]; | approve / write / view |
| `src/components/settings/FeatureModulesPanel.tsx:12` | const ADMIN_ROLES = ["super_admin", "managing_director"]; | write / view |
| `src/components/settings/RemindersPanel.tsx:19` | const READ_ROLES = ["super_admin", "managing_director", "head_of_projects", "planning_head"]; | write / view |
| `src/components/settings/RemindersPanel.tsx:79` | const admin = role === "super_admin" // role === "managing_director"; | write / view |
| `src/components/site/ClientVisitsTab.tsx:47` | const canEdit = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/site/DispatchLogForm.tsx:39` | const canDispatch = ["delivery_rm_lead", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/site/DispatchPacksTab.tsx:12` | const CREATE_ROLES = ["super_admin", "managing_director", "production_head", "factory_floor_supervisor", "head_operations"]; | write / view |
| `src/components/site/FloorPlanPositionsTab.tsx:22` | "managing_director", | write / view |
| `src/components/site/HandoverPack.tsx:66` | const canApprove = ["managing_director", "super_admin"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/components/site/HandoverPack.tsx:140` | const { data: mdRoles } = await supabase.from("user_roles").select("user_id").eq("role", "managing_director" as any); | notify / approve / write / view |
| `src/components/site/HandoverPack.tsx:206` | {isPending && <ResponsiblePerson roles={["managing_director"]} />} | notify / approve / write / view |
| `src/components/site/InstallationChecklist.tsx:33` | const canManage = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/site/InstallationSequenceDoc.tsx:40` | const canUploadRole = ["site_installation_mgr", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/components/site/PunchListModule.tsx:57` | const canManage = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/site/SiteDiary.tsx:74` | const canAdd = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? ""); | approve / write / view |
| `src/components/site/SiteFactoryFeedback.tsx:55` | const canRaise = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / write / view |
| `src/components/site/SiteFactoryFeedback.tsx:56` | const canRespond = ["production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / write / view |
| `src/components/site/SiteFactoryFeedback.tsx:107` | .in("role", ["production_head", "head_operations", "managing_director"] as any).eq("is_active", true); | notify / write / view |
| `src/components/site/SiteInventoryTab.tsx:41` | const USAGE_ROLES = ["site_installation_mgr", "super_admin", "managing_director", "production_head"]; | write / view |
| `src/components/site/SiteReceiptChecklist.tsx:37` | const canManage = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / write / view |
| `src/components/site/SiteReceiptChecklist.tsx:119` | .in("role", ["head_operations", "managing_director"] as any) | notify / write / view |
| `src/components/site/SiteScheduleTab.tsx:22` | "super_admin", "managing_director", "head_operations", | notify / write / view |
| `src/components/site/SiteStageChecklistDrawer.tsx:16` | "super_admin", "managing_director", "head_operations", | write / view |
| `src/components/site/SubcontractorManagement.tsx:38` | const canManage = ["site_installation_mgr", "head_operations", "super_admin", "managing_director", "production_head"].includes(userRole ?? ""); | notify / write / view |
| `src/components/site/SubcontractorSchedule.tsx:27` | const canManage = ["site_installation_mgr", "head_operations", "super_admin", "managing_director"].includes(userRole ?? ""); | notify / approve / write / view |
| `src/components/site/SubcontractorSchedule.tsx:81` | .eq("role", "managing_director" as any) | notify / approve / write / view |
| `src/components/super-admin/CreateAccountsTab.tsx:21` | { full_name: "Gaurav Chouraria", role: "managing_director", department: "Leadership" }, | write / view |
| `src/components/super-admin/RolePermissionsTab.tsx:26` | const isMD = currentRole === "managing_director" // currentRole === "super_admin"; | write / view |
| `src/components/super-admin/TallyIngestionKeySection.tsx:13` | const ADMIN_ROLES = ["super_admin", "managing_director"]; | write / view |
| `src/components/tasks/MyTasksSection.tsx:25` | managing_director: "__all__", | write / view |
| `src/components/tasks/MyTasksSection.tsx:145` | const canEdit = ["planning_engineer", "production_head", "factory_supervisor", "site_installation_manager", "site_manager", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/tasks/MyTasksSection.tsx:146` | const canAddSubtasks = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? ""); | write / view |
| `src/components/tasks/MyTasksSummaryStrip.tsx:17` | managing_director: "__all__", | write / view |
| `src/components/work-orders/ClientWorkOrderSummary.tsx:14` | const FINANCE_RELEASE_ROLES = ["finance_manager", "finance_director", "managing_director", "chairman", "super_admin"]; | write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:49` | const SUBMIT_ROLES = ["super_admin","managing_director","production_head","planning_head","site_installation_mgr"]; | notify / approve / write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:72` | const canRaise = ["super_admin","managing_director","production_head","site_installation_mgr"].includes(role ?? ""); | notify / approve / write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:73` | const canCostingApprove = ["super_admin","managing_director","planning_engineer","costing_engineer"].includes(role ?? ""); | notify / approve / write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:74` | const canDirectorApprove = ["super_admin","managing_director","finance_director","sales_director","architecture_director"].includes(role ?? ""); | notify / approve / write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:75` | const canIssue = ["super_admin","managing_director","finance_director","finance_manager","accounts_executive"].includes(role ?? ""); | notify / approve / write / view |
| `src/components/work-orders/WorkOrdersTab.tsx:649` | if (aboveLimit) await notify(["managing_director","finance_director","sales_director","architecture_director"], "WO needs Director approval", ${wo.wo_number} — ${fmtINR(newValue)}); | notify / approve / write / view |

Frontend literal-reference locations: 261. Includes complete arrays for review because multiline arrays and shared helpers require contextual inspection.

## Biggest gaps
- Project/production/procurement: extensive MD-specific write, approval and storage checks in legacy objects.
- HR/finance: legacy admin and financial helpers differ; Wave 1 expense read/update already include all directors.
- Wave 1 setup/labour/site/reminders: MD-only module/editor/preview gates and project-bound reminder escalation recipients.

## Scope boundary
Global legacy helpers (including has_role, is_full_admin, user_can_access_project) are not rewritten. Wave 1 wrappers/policies use the new tier helper; legacy approval and notification functions stay in this audit for review.

## Applied Wave 1 follow-up (0027)
- New is_tier1 / is_tier1_or_super and internal reminder_recipient_ids helpers.
- Elevation/site-write helpers, reminder edits/read/acknowledgement/dated preview, setup imports/rate visibility, labour master/attendance RPCs, feature-flag RPC and cron-status reader updated.
- Reminder, setup-log and labour-attendance/history policies updated; legacy global helpers and unrelated policies unchanged.
- Shared frontend module/page/nav guards grant equal access including Admin Panel. Wave 1 expense stage permissions and role-based fan-out expanded; approval compare-and-set avoids overwriting decided expense steps.

## Explicit limitations
- Full legacy approval atomicity, legacy SQL/Edge notification fan-out, employee administration backend privileges and labour-rate-view parity remain review items: changing global helpers would affect objects outside Wave 1.
- A 17 November preview cannot include level 3 for 16 November gaps: 72 hours have not elapsed. Existing 0/24/72-hour thresholds remain unchanged. The three-day lookback also prevents project subjects reaching 72 hours in the current runner; changing that conflicts with the retained P7b safety cap and requires a separate decision.
- Four active Tier 1 escalation recipients were verified directly without writing reminder_events.
- 112 targeted tests passed; signed-in MD preview and 360px Settings checked, no page errors or overflow. Approval actions and live notifications not exercised.
- The three active unrelated security findings were not changed; their intended access remains unverified.
