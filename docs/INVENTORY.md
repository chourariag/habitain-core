# HStack Inventory

**Snapshot:** 11 November 2026 (UTC).
**Method:** Read-only inspection of repository source and live Lovable Cloud database. No application or database changes were made.
**Timestamp convention:** UTC. `N/A` means no `created_at` column; `— (empty)` means zero rows.

## 1. Public tables

Exact `count(*)` values; RLS and policy totals from live PostgreSQL metadata.

| Table | Rows | Latest `created_at` | RLS enabled | Policies |
|---|---:|---|:---:|---:|
| `activity_dependencies` | 0 | — (empty) | Yes | 1 |
| `admin_audit_log` | 23 | N/A — no column | Yes | 2 |
| `advance_requests` | 0 | — (empty) | Yes | 5 |
| `amc_contracts` | 3 | 2026-08-07 03:17:26.967461Z | Yes | 4 |
| `announcements` | 0 | — (empty) | Yes | 3 |
| `app_settings` | 9 | N/A — no column | Yes | 3 |
| `approval_rejection_dm_log` | 1 | 2026-08-09 19:08:26.323309Z | Yes | 1 |
| `approval_requests` | 6 | 2026-08-28 03:44:53.479702Z | Yes | 3 |
| `approval_thresholds` | 9 | N/A — no column | Yes | 2 |
| `asset_register` | 0 | — (empty) | Yes | 3 |
| `attendance_exports` | 0 | — (empty) | Yes | 3 |
| `attendance_records` | 237 | 2026-09-30 03:34:37.160305Z | Yes | 7 |
| `bank_ledger_entries` | 0 | N/A — no column | Yes | 3 |
| `bay_assignments` | 0 | — (empty) | Yes | 3 |
| `billing_sales_tracker` | 0 | — (empty) | Yes | 4 |
| `board_papers` | 0 | — (empty) | Yes | 4 |
| `board_period_plan` | 0 | — (empty) | Yes | 2 |
| `board_reported_totals` | 3 | 2026-08-21 14:30:15.055661Z | Yes | 2 |
| `boq_items` | 0 | — (empty) | Yes | 4 |
| `call_funnel_monthly` | 2 | 2026-08-21 14:30:15.055661Z | Yes | 4 |
| `capacity_forecast_settings` | 1 | N/A — no column | Yes | 2 |
| `client_milestone_photos` | 0 | — (empty) | Yes | 2 |
| `client_portal_access_log` | 0 | — (empty) | Yes | 1 |
| `client_portal_documents` | 0 | — (empty) | Yes | 4 |
| `client_portal_tokens` | 5 | 2026-09-04 10:20:45.160098Z | Yes | 3 |
| `client_visits` | 0 | — (empty) | Yes | 3 |
| `client_wo_dlp` | 0 | — (empty) | Yes | 2 |
| `client_wo_payment_stages` | 0 | — (empty) | Yes | 2 |
| `client_wo_retention_entries` | 0 | — (empty) | Yes | 2 |
| `client_work_orders` | 0 | — (empty) | Yes | 1 |
| `clients_master` | 0 | — (empty) | Yes | 2 |
| `construction_journal` | 0 | — (empty) | Yes | 2 |
| `contracts_register` | 3 | 2026-08-25 09:10:16.274596Z | Yes | 5 |
| `creditor_ledger_entries` | 0 | N/A — no column | Yes | 3 |
| `daily_actuals` | 0 | — (empty) | Yes | 3 |
| `daily_labour_logs` | 3 | 2026-09-03 05:14:41.432624Z | Yes | 3 |
| `daily_measurements` | 0 | — (empty) | Yes | 4 |
| `daily_production_logs` | 2 | 2026-09-03 17:58:34.770811Z | Yes | 3 |
| `debtor_ledger_entries` | 0 | N/A — no column | Yes | 3 |
| `delivery_checklists` | 1 | 2026-09-03 05:17:56.347796Z | Yes | 3 |
| `depreciation_block_reference` | 9 | 2026-08-21 18:31:06.655285Z | Yes | 3 |
| `design_consultants` | 0 | — (empty) | Yes | 3 |
| `design_detail_library` | 200 | N/A — no column | Yes | 3 |
| `design_qc_checklist` | 321 | 2026-08-31 04:35:12.082193Z | Yes | 3 |
| `design_qc_section_signoffs` | 0 | N/A — no column | Yes | 2 |
| `design_queries` | 0 | — (empty) | Yes | 4 |
| `design_stage_definitions` | 60 | 2026-09-02 03:30:19.307748Z | Yes | 2 |
| `design_stage_history` | 0 | — (empty) | Yes | 2 |
| `design_stages` | 52 | 2026-08-31 04:35:00.117344Z | Yes | 0 |
| `dispatch_log` | 0 | — (empty) | Yes | 3 |
| `dispatch_material_log` | 0 | — (empty) | Yes | 2 |
| `dispatch_pack_driver_contact` | 1 | 2026-09-03 05:17:23.657616Z | Yes | 4 |
| `dispatch_packs` | 1 | 2026-09-03 05:17:23.088474Z | Yes | 3 |
| `dispatch_signoffs` | 0 | N/A — no column | Yes | 2 |
| `dispute_log` | 0 | N/A — no column | Yes | 3 |
| `document_unlock_audit` | 0 | — (empty) | Yes | 1 |
| `drawings` | 0 | — (empty) | Yes | 4 |
| `dry_assembly_checks` | 0 | — (empty) | Yes | 3 |
| `edit_history` | 0 | N/A — no column | Yes | 2 |
| `error_log` | 75 | 2026-08-28 14:40:02.149712Z | Yes | 1 |
| `escalation_rules` | 6 | N/A — no column | Yes | 2 |
| `expense_approvals` | 0 | — (empty) | Yes | 3 |
| `expense_entries` | 7 | 2026-09-17 09:51:58.894748Z | Yes | 5 |
| `expense_reports` | 0 | — (empty) | Yes | 4 |
| `experience_centre_visits` | 0 | — (empty) | Yes | 2 |
| `file_attachments` | 4 | 2026-08-07 03:17:54.019447Z | Yes | 3 |
| `finance_audited_financials` | 38 | 2026-08-21 18:47:52.2122Z | Yes | 3 |
| `finance_cashflow` | 0 | — (empty) | Yes | 2 |
| `finance_cashflow_balances` | 0 | N/A — no column | Yes | 2 |
| `finance_mis_uploads` | 2 | 2026-09-03 18:20:17.365264Z | Yes | 4 |
| `finance_payments` | 0 | — (empty) | Yes | 3 |
| `finance_pl_data` | 0 | — (empty) | Yes | 3 |
| `finance_project_budgets` | 0 | — (empty) | Yes | 4 |
| `finance_project_cashflow` | 0 | — (empty) | Yes | 2 |
| `finance_statutory` | 5 | 2026-10-15 10:46:31.338289Z | Yes | 2 |
| `fixed_asset_service_log` | 0 | — (empty) | Yes | 2 |
| `fixed_assets` | 6 | 2026-08-01 20:02:26.514324Z | Yes | 3 |
| `floor_plans` | 0 | — (empty) | Yes | 4 |
| `gfc_qc_checklist` | 0 | — (empty) | Yes | 2 |
| `gfc_records` | 0 | — (empty) | Yes | 4 |
| `handover_pack` | 0 | — (empty) | Yes | 3 |
| `hr_documents` | 0 | — (empty) | Yes | 2 |
| `hr_settings` | 2 | N/A — no column | Yes | 4 |
| `installation_checklist` | 0 | — (empty) | Yes | 4 |
| `installation_sequence_docs` | 0 | — (empty) | Yes | 3 |
| `inventory_items` | 0 | — (empty) | Yes | 4 |
| `invoice_payments` | 0 | — (empty) | Yes | 2 |
| `invoice_variations` | 0 | — (empty) | Yes | 2 |
| `kickoff_meetings` | 1 | 2026-07-15 07:21:09.253304Z | Yes | 4 |
| `kpi_definitions` | 69 | 2026-05-14 19:45:41.703434Z | Yes | 3 |
| `kpi_md_notes` | 0 | — (empty) | Yes | 2 |
| `kpi_snapshots` | 0 | — (empty) | Yes | 1 |
| `kpi_targets_history` | 0 | N/A — no column | Yes | 2 |
| `kpi_tracked_employees` | 0 | — (empty) | Yes | 2 |
| `labour_approvals` | 0 | N/A — no column | Yes | 3 |
| `labour_claims` | 0 | — (empty) | Yes | 4 |
| `labour_contractors` | 3 | 2026-08-25 11:23:01.624681Z | Yes | 2 |
| `labour_invoice_checklist_items` | 0 | — (empty) | Yes | 3 |
| `labour_invoices` | 0 | — (empty) | Yes | 3 |
| `labour_team_members` | 0 | — (empty) | Yes | 2 |
| `labour_teams` | 0 | — (empty) | Yes | 2 |
| `labour_worker_compensation` | 49 | 2026-08-25 11:40:24.343411Z | Yes | 2 |
| `labour_worker_rate_history` | 49 | 2026-08-25 11:40:24.343411Z | Yes | 2 |
| `labour_workers` | 49 | 2026-08-25 11:40:24.343411Z | Yes | 2 |
| `leave_balances` | 0 | — (empty) | Yes | 2 |
| `leave_requests` | 1 | N/A — no column | Yes | 5 |
| `ledger_mappings` | 214 | 2026-08-21 18:57:26.210298Z | Yes | 3 |
| `manpower_plan_entries` | 0 | — (empty) | Yes | 2 |
| `manpower_plans` | 0 | — (empty) | Yes | 2 |
| `manpower_subcontractor_plan` | 0 | — (empty) | Yes | 2 |
| `marketing_funnel_monthly` | 2 | 2026-08-21 14:30:15.055661Z | Yes | 4 |
| `master_data_uploads` | 0 | N/A — no column | Yes | 1 |
| `material_alerts` | 0 | — (empty) | Yes | 3 |
| `material_availability_confirmations` | 0 | — (empty) | Yes | 3 |
| `material_delivery_tracker` | 0 | — (empty) | Yes | 4 |
| `material_plan_items` | 0 | — (empty) | Yes | 4 |
| `material_rate_benchmarks` | 0 | N/A — no column | Yes | 2 |
| `material_requests` | 0 | — (empty) | Yes | 4 |
| `material_returns` | 0 | — (empty) | Yes | 3 |
| `material_transfers` | 0 | — (empty) | Yes | 3 |
| `measurement_line_items` | 0 | — (empty) | Yes | 4 |
| `module_schedule` | 0 | — (empty) | Yes | 3 |
| `module_team_assignments` | 0 | — (empty) | Yes | 3 |
| `modules` | 23 | 2026-06-24 15:21:25.962529Z | Yes | 4 |
| `ncr_register` | 0 | — (empty) | Yes | 4 |
| `notification_preferences` | 31 | 2026-07-20 10:41:54.537729Z | Yes | 3 |
| `notifications` | 4113 | 2026-11-11 14:30:05.30243Z | Yes | 6 |
| `offboarding_clearance_items` | 0 | — (empty) | Yes | 2 |
| `offboarding_impact_items` | 0 | — (empty) | Yes | 2 |
| `offboarding_records` | 0 | — (empty) | Yes | 3 |
| `order_book` | 0 | — (empty) | Yes | 4 |
| `panel_batches` | 0 | — (empty) | Yes | 4 |
| `panel_handovers` | 0 | — (empty) | Yes | 3 |
| `panels` | 0 | — (empty) | Yes | 4 |
| `payment_approvals` | 0 | — (empty) | Yes | 3 |
| `photo_positions` | 0 | — (empty) | Yes | 4 |
| `production_stages` | 0 | — (empty) | Yes | 4 |
| `production_task_templates` | 475 | 2026-05-08 20:05:43.471415Z | Yes | 4 |
| `profile_kiosk_pins` | 0 | N/A — no column | Yes | 1 |
| `profile_private_info` | 5 | N/A — no column | Yes | 4 |
| `profiles` | 32 | 2026-07-20 10:41:54.537729Z | Yes | 5 |
| `profit_loss_line_items` | 0 | — (empty) | Yes | 4 |
| `profit_loss_uploads` | 0 | — (empty) | Yes | 4 |
| `project_archives` | 1 | 2026-07-15 07:21:09.253304Z | Yes | 3 |
| `project_backfills` | 1 | 2026-08-07 03:17:26.967461Z | Yes | 1 |
| `project_billing_milestones` | 8 | 2026-08-07 03:17:26.967461Z | Yes | 4 |
| `project_boq` | 6 | 2026-09-04 10:44:50.637616Z | Yes | 4 |
| `project_boq_items` | 312 | 2026-09-04 10:44:50.845292Z | Yes | 4 |
| `project_budget_manual_entries` | 0 | — (empty) | Yes | 4 |
| `project_design_files` | 4 | 2026-08-31 04:34:55.659312Z | Yes | 4 |
| `project_design_stages` | 214 | 2026-09-02 03:33:41.529318Z | Yes | 4 |
| `project_grns` | 1 | 2026-09-03 18:23:37.203023Z | Yes | 4 |
| `project_invoices` | 0 | — (empty) | Yes | 2 |
| `project_material_plan_items` | 318 | 2026-09-04 10:44:51.556883Z | Yes | 3 |
| `project_material_plans` | 6 | 2026-09-04 10:44:51.184157Z | Yes | 2 |
| `project_messages` | 9 | 2026-09-03 11:14:30.894899Z | Yes | 3 |
| `project_progress_matrix` | 0 | — (empty) | Yes | 2 |
| `project_revenue_margin` | 0 | — (empty) | Yes | 4 |
| `project_scope_exclusions` | 14 | 2026-08-25 07:32:08.834285Z | Yes | 8 |
| `project_scope_items` | 82 | 2026-08-25 07:32:08.184Z | Yes | 8 |
| `project_scope_of_work` | 3 | 2026-08-25 07:32:07.221151Z | Yes | 6 |
| `project_setup_approvals` | 3 | 2026-08-14 16:30:41.323388Z | Yes | 4 |
| `project_stages` | 0 | — (empty) | Yes | 4 |
| `project_storage_cleanup_log` | 1 | 2026-07-15 07:21:09.253304Z | Yes | 2 |
| `project_subtasks` | 0 | — (empty) | Yes | 4 |
| `project_task_schedule_uploads` | 0 | N/A — no column | Yes | 2 |
| `project_tasks` | 737 | 2026-08-25 07:29:19.208161Z | Yes | 4 |
| `project_team_members` | 23 | 2026-09-03 03:55:57.752722Z | Yes | 4 |
| `project_tender_budget` | 0 | — (empty) | Yes | 3 |
| `project_tender_budget_items` | 0 | — (empty) | Yes | 2 |
| `project_variations` | 0 | — (empty) | Yes | 3 |
| `projects` | 5 | 2026-08-25 07:29:19.208161Z | Yes | 4 |
| `punch_list_items` | 0 | — (empty) | Yes | 3 |
| `purchase_orders` | 0 | — (empty) | Yes | 6 |
| `qc_checklist_definitions` | 336 | 2026-06-12 19:48:51.885313Z | Yes | 4 |
| `qc_checklist_items` | 0 | — (empty) | Yes | 4 |
| `qc_inspection_items` | 21 | 2026-08-22 11:47:51.233174Z | Yes | 4 |
| `qc_inspections` | 1 | 2026-08-22 11:47:50.281078Z | Yes | 4 |
| `quality_flags` | 0 | — (empty) | Yes | 3 |
| `quotation_approvals` | 0 | — (empty) | Yes | 3 |
| `quotation_requests` | 0 | — (empty) | Yes | 4 |
| `quotation_versions` | 0 | — (empty) | Yes | 3 |
| `quotations` | 0 | — (empty) | Yes | 2 |
| `rate_cards` | 0 | — (empty) | Yes | 4 |
| `receivables_tracker` | 0 | — (empty) | Yes | 4 |
| `red_flag_alerts` | 0 | — (empty) | Yes | 3 |
| `retention_records` | 0 | — (empty) | Yes | 1 |
| `rework_log_entries` | 0 | — (empty) | Yes | 2 |
| `rm_tickets` | 1 | 2026-08-07 03:17:26.967461Z | Yes | 4 |
| `role_feature_access` | 12 | N/A — no column | Yes | 2 |
| `role_permissions` | 0 | N/A — no column | Yes | 2 |
| `role_permissions_audit` | 0 | N/A — no column | Yes | 1 |
| `safety_incidents` | 1 | 2026-09-03 05:19:07.773987Z | Yes | 3 |
| `sales_amc_contacts` | 0 | — (empty) | Yes | 4 |
| `sales_deals` | 1606 | 2026-08-21 17:35:35.172024Z | Yes | 4 |
| `sales_handover_checklists` | 0 | — (empty) | Yes | 4 |
| `sales_pipeline_leads` | 806 | 2026-08-21 16:12:18.062753Z | Yes | 3 |
| `sales_stage_history` | 0 | N/A — no column | Yes | 3 |
| `sales_targets` | 0 | — (empty) | Yes | 2 |
| `sales_win_sync_log` | 0 | — (empty) | Yes | 1 |
| `schedule_conflicts` | 0 | — (empty) | Yes | 2 |
| `scope_signoff_tokens` | 4 | 2026-08-03 07:25:48.696054Z | Yes | 2 |
| `scope_unlock_audit` | 0 | N/A — no column | Yes | 2 |
| `site_diary` | 0 | — (empty) | Yes | 4 |
| `site_direct_receipts` | 0 | N/A — no column | Yes | 2 |
| `site_factory_feedback` | 0 | — (empty) | Yes | 3 |
| `site_inventory` | 0 | — (empty) | Yes | 3 |
| `site_position_photos` | 0 | — (empty) | Yes | 4 |
| `site_readiness` | 3 | 2026-08-28 16:07:16.344586Z | Yes | 4 |
| `site_receipt_checklist` | 0 | — (empty) | Yes | 3 |
| `site_schedules` | 0 | — (empty) | Yes | 4 |
| `sop_procedures` | 0 | — (empty) | Yes | 4 |
| `sop_versions` | 0 | — (empty) | Yes | 1 |
| `sop_view_log` | 0 | N/A — no column | Yes | 2 |
| `special_material_requests` | 1 | 2026-09-03 05:09:10.291149Z | Yes | 3 |
| `stage_wastage` | 0 | — (empty) | Yes | 3 |
| `statutory_calendar` | 13 | 2026-09-07 11:54:44.709473Z | Yes | 2 |
| `stores_inventory` | 0 | — (empty) | Yes | 2 |
| `subcontractor_assignments` | 0 | — (empty) | Yes | 3 |
| `subcontractor_schedules` | 0 | — (empty) | Yes | 3 |
| `subcontractors` | 5 | 2026-08-20 07:36:02.645576Z | Yes | 2 |
| `super_admin_audit_log` | 7 | N/A — no column | Yes | 2 |
| `tally_api_keys` | 1 | 2026-07-23 06:44:05.572537Z | Yes | 1 |
| `tally_bank_book` | 0 | N/A — no column | Yes | 1 |
| `tally_cash_book` | 0 | N/A — no column | Yes | 1 |
| `tally_cost_centre_data` | 0 | N/A — no column | Yes | 1 |
| `tally_customer_ledgers` | 0 | N/A — no column | Yes | 1 |
| `tally_grn` | 0 | N/A — no column | Yes | 1 |
| `tally_ingest_log` | 4 | N/A — no column | Yes | 1 |
| `tally_purchase_invoices` | 0 | N/A — no column | Yes | 1 |
| `tally_purchase_order_register` | 1 | N/A — no column | Yes | 1 |
| `tally_purchase_orders` | 0 | N/A — no column | Yes | 1 |
| `tally_sales_vouchers` | 0 | N/A — no column | Yes | 1 |
| `tally_trial_balance` | 4 | N/A — no column | Yes | 1 |
| `tally_vendor_ledgers` | 0 | N/A — no column | Yes | 1 |
| `task_benchmarks` | 0 | — (empty) | Yes | 2 |
| `task_lock_overrides` | 0 | — (empty) | Yes | 2 |
| `tool_issuance` | 0 | — (empty) | Yes | 2 |
| `tools_inventory` | 10 | 2026-08-01 20:02:26.7227Z | Yes | 3 |
| `user_roles` | 37 | N/A — no column | Yes | 2 |
| `variation_orders` | 0 | — (empty) | Yes | 4 |
| `variation_register` | 0 | — (empty) | Yes | 4 |
| `velocity_alerts` | 0 | — (empty) | Yes | 2 |
| `vendor_lead_time_summary` | 0 | N/A — no column | Yes | 2 |
| `vendor_quotes` | 0 | — (empty) | Yes | 4 |
| `weekly_digests` | 0 | — (empty) | Yes | 2 |
| `weekly_habit_tracking` | 0 | N/A — no column | Yes | 3 |
| `weekly_manpower_plans` | 0 | — (empty) | Yes | 3 |
| `weekly_report_configs` | 5 | 2026-04-28 20:55:48.976069Z | Yes | 2 |
| `weekly_report_submissions` | 1 | 2026-06-27 05:43:11.771459Z | Yes | 3 |
| `wo_requests` | 0 | — (empty) | Yes | 3 |
| `work_order_closure` | 0 | — (empty) | Yes | 3 |
| `work_order_register` | 0 | — (empty) | Yes | 3 |
| `work_order_sequences` | 2 | N/A — no column | Yes | 1 |
| `work_order_variations` | 0 | — (empty) | Yes | 3 |
| `work_orders` | 2 | 2026-08-20 07:29:02.221056Z | Yes | 3 |

## 2. Routes and role access

Route declarations are from `src/App.tsx`; authentication rules from app source; module-role grants from `src/lib/rbac-matrix.ts`. Any `VIEW`, `MANAGE`, or `FULL` grant passes the module route guard. Screen data can have additional row/project-level rules.

### Roles that pass each module gate

- **dashboard:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **projects:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `procurement`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `sales_executive`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `purchase_assistant`, `assistant_manager`
- **factory:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect`
- **site:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect`
- **procurement:** `finance_director`, `sales_director`, `architecture_director`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `site_installation_mgr`, `procurement`, `stores_executive`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `procurement_assistant`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **finance:** `finance_director`, `sales_director`, `architecture_director`, `finance_manager`, `costing_engineer`, `procurement`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `chairman`, `purchase_assistant`, `assistant_manager`
- **hr:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **sales:** `finance_director`, `sales_director`, `architecture_director`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `marketing`, `sales_executive`, `chairman`, `sales_associate`
- **design:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect`
- **qc:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect`
- **dispatch:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `procurement`, `stores_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **announcements:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **approvals:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `site_installation_mgr`, `site_engineer`, `procurement`, `stores_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager`
- **admin:** `managing_director`, `super_admin`, `chairman`
- **reports:** `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `site_installation_mgr`, `site_engineer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `hr_admin`, `chairman`, `purchase_assistant`, `assistant_manager`

| Route | Screen/access check | Roles allowed |
|---|---|---|
| `/login` | Public screen | No role gate |
| `/setup` | Public screen | No role gate |
| `/welcome` | Public screen | No role gate |
| `/auth/callback` | Public screen | No role gate |
| `/reset-password` | Public screen | No role gate |
| `/trust` | Public screen | No role gate |
| `/onboarding` | Public screen | No role gate |
| `/` | Redirect to `/dashboard` | Destination access applies |
| `/dashboard` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/projects` | projects module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `procurement`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `sales_executive`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `purchase_assistant`, `assistant_manager` |
| `/projects/:id` | projects module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `procurement`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `sales_executive`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `purchase_assistant`, `assistant_manager` |
| `/projects/:id/archive` | projects module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `procurement`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `sales_executive`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `purchase_assistant`, `assistant_manager` |
| `/management` | Reports module plus ManagementRouteGuard allowlist | `super_admin`, `managing_director`, `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `planning_head` |
| `/production` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/production/dashboard` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/production/delivery-checklist/:projectId` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/dispatch-delivery` | dispatch module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `procurement`, `stores_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/site-dashboard` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/site-hub` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/site-hub/dispatch-pack` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/dispatch-pack-form` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/site-hub/advance-request` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/design` | design module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/design/schedule` | design module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/drawings` | design module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/qc` | qc module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/procurement` | procurement module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `site_installation_mgr`, `procurement`, `stores_executive`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `procurement_assistant`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/inventory` | Redirect to `/procurement` | `finance_director`, `sales_director`, `architecture_director`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `site_installation_mgr`, `procurement`, `stores_executive`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `procurement_assistant`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/materials` | Redirect to `/procurement` | `finance_director`, `sales_director`, `architecture_director`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `site_installation_mgr`, `procurement`, `stores_executive`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `procurement_assistant`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/rm` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/amc` | site module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `logistics_manager`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/sales` | sales module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `marketing`, `sales_executive`, `chairman`, `sales_associate` |
| `/finance` | finance module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `finance_manager`, `costing_engineer`, `procurement`, `accounts_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `chairman`, `purchase_assistant`, `assistant_manager` |
| `/kpi` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/kpi/settings` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/admin` | Admin Panel allowlist | `super_admin`, `managing_director` |
| `/admin/users` | Admin Panel allowlist | `super_admin`, `managing_director` |
| `/admin/employees` | Employee Management allowlist | `super_admin`, `managing_director`, `sales_director`, `architecture_director` |
| `/settings` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/profile` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/attendance` | hr module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/alerts` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/factory/floor-map` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/capacity` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/sops` | Authenticated app shell; no route-level role gate | Any authenticated user (all enum roles) |
| `/super-admin` | Redirect to `/admin/super-admin` | `super_admin`, `managing_director` (destination screen check) |
| `/admin/super-admin` | SuperAdmin screen-level allowlist | `super_admin`, `managing_director` |
| `/admin/hr` | hr module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/safety` | factory module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `planning_engineer`, `site_installation_mgr`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `senior_architect` |
| `/approvals` | approvals module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `site_installation_mgr`, `site_engineer`, `procurement`, `stores_executive`, `managing_director`, `super_admin`, `planning_head`, `head_of_projects`, `chairman`, `factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/work-orders` | projects module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `procurement`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `sales_executive`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `purchase_assistant`, `assistant_manager` |
| `/announcements` | announcements module; any non-NONE access | `finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager` |
| `/client/:projectToken` | Token-authenticated screen | No app-role gate |
| `/scope-signoff/:token` | Token-authenticated screen | No app-role gate |
| `*` | NotFound catch-all | Any authenticated user (public/token exceptions handled separately) |

**Auth boundaries:** Public app paths are `/login`, `/setup`, `/welcome`, `/auth/callback`, `/reset-password`, `/trust`, and `/onboarding`. `/client/:projectToken` and `/scope-signoff/:token` use tokens without app-session gating. Other `AppLayout` screens require a signed-in session. The admin and management screens also have allowlists stated above.

## 3. Role identifiers

**Database enum:** `public.app_role` (42 exact values, in enum order):

`finance_director`, `sales_director`, `architecture_director`, `head_operations`, `production_head`, `finance_manager`, `planning_engineer`, `costing_engineer`, `quantity_surveyor`, `site_installation_mgr`, `delivery_rm_lead`, `site_engineer`, `qc_inspector`, `factory_floor_supervisor`, `fabrication_foreman`, `electrical_installer`, `elec_plumbing_installer`, `procurement`, `stores_executive`, `accounts_executive`, `hr_executive`, `project_architect`, `structural_architect`, `managing_director`, `super_admin`, `principal_architect`, `planning_head`, `head_of_projects`, `procurement_assistant`, `hr_admin`, `marketing`, `sales_executive`, `logistics_manager`, `director`, `operations_architect`, `chairman`, `factory_supervisor`, `senior_architect`, `sales_associate`, `senior_factory_supervisor`, `purchase_assistant`, `assistant_manager`

**Role table:** `public.user_roles` — 37 rows, RLS enabled, 2 policies. Related tables: `role_feature_access` (12 rows), `role_permissions` (0), `role_permissions_audit` (0).

## 4. Edge functions and schedules

Local function directories are listed below. Available read-only results do not expose an authoritative deployed-function inventory, so deployed status is **UNVERIFIED** for every function. Active PostgreSQL cron schedules are confirmed live; a cron record does not prove its endpoint is deployed. Cron expressions are UTC.

| Function directory | Deployed? | Active cron job(s) |
|---|---|---|
| `admin-users` | **UNVERIFIED** | No matching active cron endpoint found |
| `ai-agents` | **UNVERIFIED** | `ai-agent-cashflow-predictor` (`30 14 * * 0`); `ai-agent-client-approval-chaser` (`0 4 * * *`); `ai-agent-daily-readiness` (`0 2 * * 1-5`); `ai-agent-deal-stagnation` (`30 3 * * *`); `ai-agent-dispatch-risk` (`30 2 * * *`); `ai-agent-labour-cost` (`30 12 * * 5`); `ai-agent-long-leave-warning` (`30 13 * * 0`); `ai-agent-lost-deal-pattern` (`30 1 1,15 * *`); `ai-agent-po-anomaly` (`30 4 * * *`); `ai-agent-qc-pattern` (`30 1 * * 1`); `ai-agent-reorder-alert` (`30 1 * * 1`); `ai-agent-statutory-reminder` (`30 2 * * *`); `ai-agent-subcontractor-monitor` (`30 3 * * *`); `ai-agent-weekly-coaching` (`30 1 * * 1`) |
| `approval-rejection-dm` | **UNVERIFIED** | `approval-rejection-dm-5min` (`*/5 * * * *`) |
| `auto-submit-draft-expenses` | **UNVERIFIED** | `auto-submit-draft-expenses-5-20` (`5 0 5,20 * *`) |
| `board-paper-data` | **UNVERIFIED** | No matching active cron endpoint found |
| `bootstrap-admin` | **UNVERIFIED** | No matching active cron endpoint found |
| `capacity-ai-analysis` | **UNVERIFIED** | No matching active cron endpoint found |
| `daily-checkin-nudge` | **UNVERIFIED** | `daily-checkin-nudge-1300-ist` (`30 7 * * *`); `daily-checkin-nudge-1700-ist` (`30 11 * * *`) |
| `dispatch-14-day-trigger` | **UNVERIFIED** | `dispatch-14-day-trigger` (`15 2 * * *`) |
| `error-attribution-dm` | **UNVERIFIED** | `error-attribution-dm-5min` (`*/5 * * * *`) |
| `fixed-asset-service-reminders` | **UNVERIFIED** | `fixed-asset-service-reminders-daily` (`30 0 * * *`) |
| `floor-plan-analyze` | **UNVERIFIED** | No matching active cron endpoint found |
| `generate-board-paper` | **UNVERIFIED** | No matching active cron endpoint found |
| `generate-project-archive` | **UNVERIFIED** | No matching active cron endpoint found |
| `kiosk-login` | **UNVERIFIED** | No matching active cron endpoint found |
| `kpi-recompute` | **UNVERIFIED** | `kpi-recompute-daily` (`35 18 * * *`); `kpi-recompute-weekly` (`30 2 * * 1`) |
| `labour-claim-sla-escalation` | **UNVERIFIED** | `labour-claim-sla-escalation` (`*/15 * * * *`) |
| `measurement-submission-checks` | **UNVERIFIED** | `measurement-submission-checks-8pm-ist` (`30 14 * * *`) |
| `photo-check` | **UNVERIFIED** | No matching active cron endpoint found |
| `project-storage-cleanup` | **UNVERIFIED** | No matching active cron endpoint found |
| `qc-analysis` | **UNVERIFIED** | No matching active cron endpoint found |
| `rm-analysis` | **UNVERIFIED** | No matching active cron endpoint found |
| `salary-review-notifier` | **UNVERIFIED** | `salary-review-notifier-daily` (`0 3 * * *`) |
| `scan-invoice` | **UNVERIFIED** | No matching active cron endpoint found |
| `send-calendar-invite` | **UNVERIFIED** | No matching active cron endpoint found |
| `send-email` | **UNVERIFIED** | No matching active cron endpoint found |
| `site-photo-analyze` | **UNVERIFIED** | No matching active cron endpoint found |
| `site-schedule-trigger` | **UNVERIFIED** | No matching active cron endpoint found |
| `sop-generate` | **UNVERIFIED** | No matching active cron endpoint found |
| `super-admin-create-user` | **UNVERIFIED** | No matching active cron endpoint found |
| `tally-ingest` | **UNVERIFIED** | No matching active cron endpoint found |
| `tally-key-manage` | **UNVERIFIED** | No matching active cron endpoint found |
| `uptime-health-check` | **UNVERIFIED** | `uptime-health-check` (`*/10 * * * *`) |
| `usage-nudge-check` | **UNVERIFIED** | No matching active cron endpoint found; other scheduler **UNVERIFIED** |
| `weekly-report-reminders` | **UNVERIFIED** | `weekly-report-reminders` (`*/15 * * * *`) |
| `work-order-escalation` | **UNVERIFIED** | `work-order-escalation-daily` (`30 3 * * *`) |

**`usage-nudge-check`:** local source directory exists; no active cron job by that name or endpoint; deployed status and any non-cron schedule are **UNVERIFIED**.
**Cron/source mismatch:** active job `design-stage-overdue-sweep-daily` (`30 2 * * *`) targets `design-stage-overdue-sweep`; no matching local function directory was found. Deployment/source correspondence is **UNVERIFIED**.

### All active cron jobs

| Job | Target | UTC schedule |
|---|---|---|
| `ai-agent-cashflow-predictor` | `ai-agents` | `30 14 * * 0` |
| `ai-agent-client-approval-chaser` | `ai-agents` | `0 4 * * *` |
| `ai-agent-daily-readiness` | `ai-agents` | `0 2 * * 1-5` |
| `ai-agent-deal-stagnation` | `ai-agents` | `30 3 * * *` |
| `ai-agent-dispatch-risk` | `ai-agents` | `30 2 * * *` |
| `ai-agent-labour-cost` | `ai-agents` | `30 12 * * 5` |
| `ai-agent-long-leave-warning` | `ai-agents` | `30 13 * * 0` |
| `ai-agent-lost-deal-pattern` | `ai-agents` | `30 1 1,15 * *` |
| `ai-agent-po-anomaly` | `ai-agents` | `30 4 * * *` |
| `ai-agent-qc-pattern` | `ai-agents` | `30 1 * * 1` |
| `ai-agent-reorder-alert` | `ai-agents` | `30 1 * * 1` |
| `ai-agent-statutory-reminder` | `ai-agents` | `30 2 * * *` |
| `ai-agent-subcontractor-monitor` | `ai-agents` | `30 3 * * *` |
| `ai-agent-weekly-coaching` | `ai-agents` | `30 1 * * 1` |
| `amc-followup-daily` | `SQL scheduled job` | `0 9 * * *` |
| `approval-rejection-dm-5min` | `approval-rejection-dm` | `*/5 * * * *` |
| `auto-submit-draft-expenses-5-20` | `auto-submit-draft-expenses` | `5 0 5,20 * *` |
| `cv-alert-overdue-commitments-daily` | `SQL scheduled job` | `0 9 * * *` |
| `daily-checkin-nudge-1300-ist` | `daily-checkin-nudge` | `30 7 * * *` |
| `daily-checkin-nudge-1700-ist` | `daily-checkin-nudge` | `30 11 * * *` |
| `design-stage-overdue-sweep-daily` | `design-stage-overdue-sweep` | `30 2 * * *` |
| `dispatch-14-day-trigger` | `dispatch-14-day-trigger` | `15 2 * * *` |
| `error-attribution-dm-5min` | `error-attribution-dm` | `*/5 * * * *` |
| `fixed-asset-service-reminders-daily` | `fixed-asset-service-reminders` | `30 0 * * *` |
| `kickoff-meeting-daily` | `SQL scheduled job` | `0 9 * * *` |
| `kpi-recompute-daily` | `kpi-recompute` | `35 18 * * *` |
| `kpi-recompute-weekly` | `kpi-recompute` | `30 2 * * 1` |
| `labour-claim-sla-escalation` | `labour-claim-sla-escalation` | `*/15 * * * *` |
| `measurement-submission-checks-8pm-ist` | `measurement-submission-checks` | `30 14 * * *` |
| `project-archive-upload-reminders` | `SQL scheduled job` | `45 9 * * *` |
| `salary-review-notifier-daily` | `salary-review-notifier` | `0 3 * * *` |
| `site-schedule-dispatch-reminders-daily` | `SQL scheduled job` | `30 3 * * *` |
| `uptime-health-check` | `uptime-health-check` | `*/10 * * * *` |
| `weekly-report-reminders` | `weekly-report-reminders` | `*/15 * * * *` |
| `work-order-escalation-daily` | `work-order-escalation` | `30 3 * * *` |

## 5. Storage buckets

Live file counts and object-metadata size; all buckets are private (`public=false`).

| Bucket | Files | Bytes |
|---|---:|---:|
| `chat-media` | 0 | 0 |
| `design-files` | 7 | 23,805,835 |
| `drawings` | 10 | 261,887,766 |
| `dry-run-videos` | 5 | 35,151,941 |
| `floor-plans` | 0 | 0 |
| `hr-docs` | 0 | 0 |
| `production-photos` | 0 | 0 |
| `project-archives` | 0 | 0 |
| `qc-photos` | 0 | 0 |
| `rm-media` | 0 | 0 |
| `safety-photos` | 0 | 0 |
| `site-photos` | 35 | 59,079,284 |
| `vendor-quotes` | 0 | 0 |
| `voice-notes` | 0 | 0 |

**Total:** {sum(c for _,c,_ in buckets)} files; {sum(b for _,_,b in buckets):,} bytes.

## 6. Tally parser

- **File:** `src/lib/tally-pl-parser.ts`; parser entry point `parseTallyPL(file)`.
- **Accepted format:** Tally Profit & Loss `.xlsx` in a double-column P&L layout; it rejects a single-column Trial Balance shape.
- **Header checks:** scans up to the first 30 rows for `Particulars` in column A and another `Particulars` header from column C onward. It recognizes date ranges such as `1-Apr-25 to 31-Mar-26`.
- **Expected columns:** expense side A=particular/name, B=amount, C=subtotal; income side D=particular/name, E=amount, F=subtotal. It also consumes section headers and totals; balancing tolerance is ₹1.

## 7. Attendance/GPS, expenses, and projects

### Attendance / GPS

- Tables: `attendance_records` — 237 rows, RLS enabled, 7 policies; `attendance_exports` — 0 rows, RLS enabled, 3 policies.
- `attendance_records` includes `user_id`, `date`, check-in/out timestamps, `location_type`, `project_id`, GPS latitude/longitude/verification, remote reason, worked hours, manual-override fields, offline/sync fields, `location_note`, and timestamps.
- Screen: `/attendance` → **My HR**, with Attendance, Leave, Expenses, Payslips, Documents, and My KPIs tabs. Route is guarded by `hr` module access.
- Policy checks observed: own attendance read/insert; own update limited to current/recent date; reporting-manager team read/update; HR/MD/admin overrides; attendance-export read/write/delete role conditions.

### Expenses

- Tables: `expense_entries` — 7 rows, RLS enabled, 5 policies; `expense_reports` — 0 rows, RLS enabled, 4 policies; `expense_approvals` — 0 rows, RLS enabled, 3 policies.
- Screens: `/attendance` → Expenses (MyExpenses); `/finance` is the Finance screen.
- Policy checks observed: owner read/insert; submitter updates for draft/pending-HR/flagged entry states; finance/HR/director and HOD role conditions; own-draft and finance/director delete conditions; assigned-approver/finance approval visibility; architect-role exclusion for `expense_reports` inserts.

### `projects` table columns

Live `projects`: 5 rows; latest `created_at`: `2026-08-25T07:29:19.208161+00:00`. Exact column names, ordinal order (60):

`id`, `name`, `client_name`, `location`, `type`, `status`, `start_date`, `est_completion`, `created_by`, `created_at`, `updated_at`, `updated_by`, `is_archived`, `client_phone`, `client_email`, `construction_type`, `site_lat`, `site_lng`, `site_radius`, `division`, `is_design_only`, `site_ready_confirmed`, `wip_start_date`, `wip_close_date`, `wip_status`, `gfc_budget`, `planned_labour_cost`, `client_portal_token`, `client_portal_enabled`, `client_portal_expires_at`, `client_portal_status_message`, `milestones_locked`, `production_system`, `archived_at`, `archive_reason`, `contract_value`, `gfc_budget_total`, `actually_spent`, `site_schedule_unlocked_at`, `site_schedule_notified_at`, `site_schedule_escalated_at`, `setup_uploaded_at`, `setup_uploaded_by_name`, `module_count`, `panel_count`, `project_type`, `project_size`, `project_setup_approved`, `project_setup_approved_at`, `gfc_budget_approved_at`, `project_setup_status`, `closed_at`, `closed_by`, `storage_cleaned`, `storage_cleaned_at`, `storage_cleaned_by`, `client_work_order_id`, `wo_line_item_ref`, `actual_completion_date`, `project_architect_id`

## 8. Modules created within the last 60 days

`public.modules` contains 23 rows. Created in the 60 days before 11 November 2026 UTC: **0**. Modules with no creation in that period: **all 23**. All rows have `created_at = 2026-06-24T15:21:25.962529Z`; names are `Module 1` through `Module 23`.

## 9. Plan size and disk usage

- **Plan size:** **UNVERIFIED**. Project info reports an instance size of `Small`, not the billing plan tier.
- **Data disk:** 6% used. **Database size:** 232.5 MB in health metrics (233 MB rounded in the SQL result).
- Health snapshot: database and PgBouncer up; memory 35%; connections 7/90; pool clients 1/400; WAL 80.0 MB; no recent resource-exhaustion flag.

## Evidence and limits

- Live database schema, table counts, RLS, policies, role enum, storage files, module rows, cron jobs and health metrics were inspected on 11 November 2026 UTC.
- Routes and role access were read from `src/App.tsx`, `src/components/AuthProvider.tsx`, `src/components/ModuleGuard.tsx`, `src/components/ManagementRouteGuard.tsx`, `src/pages/SuperAdmin.tsx`, and `src/lib/rbac-matrix.ts`.
- Function deployment state, non-cron scheduler inventory, and billing plan tier were not exposed; those items are marked **UNVERIFIED**.
