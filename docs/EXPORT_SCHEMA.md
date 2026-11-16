# Export Schema

Schema version: **1**. UTF-8 CSV, header row, CRLF records, null = empty cell, numeric values unformatted, dates YYYY-MM-DD, timestamps ISO 8601 UTC. Arrays and JSON are serialized as JSON strings.

Files are stored at `YYYY-MM-DD/<source>_v1.csv` (IST run date) and `latest/<source>_v1.csv`. Column additions, removals, renames or type changes require a new version/file name; never silently change v1.

Source rows include archived/draft rows. `daily_measurements` contains only `trade=daily_site_report`. Photo files contain metadata only. No image/receipt bytes are read. `labour_worker_rates` is exported through a service-only projection, not its role-filtered view. `labour_attendance.amount = hours × effective_hourly_rate`; rates are current effective rates (not historical snapshots). Effective rates preserve the existing hourly-rate fallback; monthly salary itself is never exported.

Excluded: auth, employee salary/payroll tables, monthly_salary, client_portal_token, receipt_url, client phone/email, bank/PAN/Aadhaar fields. Explicit projections freeze the schema; no SELECT *. Nested sensitive JSON keys are removed. The token grants all 23 latest files, including wages and GPS metadata; only Tier 1/Super Admin can issue or revoke it. Links expire after 300 seconds; revocation cannot invalidate already issued links before expiry.

Snapshots page each source in deterministic key order; separate tables are not one cross-table transaction. Dated retention is 60 days; latest is never pruned.

## attendance_records_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `date` | date |
| `check_in_time` | timestamp with time zone |
| `check_out_time` | timestamp with time zone |
| `location_type` | text |
| `project_id` | uuid |
| `gps_lat` | numeric |
| `gps_lng` | numeric |
| `gps_verified` | boolean |
| `remote_reason` | text |
| `hours_worked` | numeric |
| `is_manual_override` | boolean |
| `override_reason` | text |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `offline_captured` | boolean |
| `synced_at` | timestamp with time zone |
| `location_note` | text |

## daily_measurements_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `module_id` | uuid |
| `stage` | text |
| `measurement_date` | date |
| `location` | text |
| `trade` | text |
| `team_label` | text |
| `notes` | text |
| `is_locked` | boolean |
| `unlock_reason` | text |
| `unlocked_by` | uuid |
| `unlocked_at` | timestamp with time zone |
| `anomaly_flags` | jsonb |
| `submitted_by` | uuid |
| `is_archived` | boolean |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `total_wip_today` | numeric |
| `submitted_at` | timestamp with time zone |
| `reviewed_by` | uuid |
| `wip_needs_review` | boolean |
| `wip_review_reason` | text |
| `report_status` | text |
| `site_clean` | boolean |
| `site_clean_photo_path` | text |

## expense_entries_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `submitted_by` | uuid |
| `entry_date` | date |
| `expense_type` | text |
| `category` | text |
| `amount` | numeric |
| `project_id` | uuid |
| `description` | text |
| `vehicle_type` | text |
| `from_location` | text |
| `to_location` | text |
| `distance_km` | numeric |
| `rate_per_km` | numeric |
| `status` | text |
| `hr_reviewed_by` | uuid |
| `hr_reviewed_at` | timestamp with time zone |
| `hr_flag_note` | text |
| `hr_flag_response` | text |
| `hod_approved_by` | uuid |
| `hod_approved_at` | timestamp with time zone |
| `finance_paid_by` | uuid |
| `finance_paid_at` | timestamp with time zone |
| `rejection_reason` | text |
| `budget_flag` | boolean |
| `report_period` | text |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `submission_method` | text |
| `uploaded_on_behalf_of` | uuid |
| `rate_used` | numeric |
| `vendor` | text |
| `bill_no` | text |
| `receipt_path` | text |
| `receipt_exif_at` | timestamp with time zone |
| `receipt_flags` | ARRAY |
| `policy_warnings` | jsonb |
| `warning_reason` | text |

## labour_attendance_v2.csv

v2 adds `hours_confirmed` (evening confirmation; all rows before B1b backfilled true) and `no_photo_exception` (recorded without a toolbox talk photo through the logged exception path).

| Column | Type |
|---|---|
| `id` | uuid |
| `work_date` | date |
| `worker_id` | uuid |
| `project_id` | uuid |
| `hours` | numeric |
| `recorded_by` | uuid |
| `recorded_at` | timestamp with time zone |
| `hours_confirmed` | boolean |
| `no_photo_exception` | boolean |
| `effective_hourly_rate` | numeric |
| `amount` | numeric |

## labour_worker_rates_v1.csv

| Column | Type |
|---|---|
| `worker_id` | uuid |
| `worker_code` | text |
| `name` | text |
| `contractor` | text |
| `skill_type` | text |
| `status` | text |
| `hourly_rate` | numeric |
| `effective_hourly_rate` | numeric |

## labour_workers_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `contractor_id` | uuid |
| `name` | text |
| `skill_type` | text |
| `department` | text |
| `status` | text |
| `date_joined` | date |
| `on_leave_return_date` | date |
| `notes` | text |
| `deactivated_reason` | text |
| `deactivated_at` | timestamp with time zone |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `worker_code` | text |

## project_boq_items_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `boq_id` | uuid |
| `sno` | integer |
| `category` | text |
| `item_description` | text |
| `unit` | text |
| `actual_qty` | numeric |
| `wastage_pct` | numeric |
| `boq_qty` | numeric |
| `material_rate` | numeric |
| `labour_rate` | numeric |
| `oh_rate` | numeric |
| `boq_rate` | numeric |
| `total_amount` | numeric |
| `margin_pct` | numeric |
| `scope` | text |
| `procured_qty` | numeric |
| `created_at` | timestamp with time zone |
| `tender_qty` | numeric |
| `tender_amount` | numeric |
| `gfc_amount` | numeric |
| `schedule_task_id` | uuid |

## project_elevations_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `name` | text |
| `drawing_ref` | text |
| `sort_order` | integer |
| `is_active` | boolean |
| `created_by` | uuid |
| `created_at` | timestamp with time zone |

## project_material_plan_items_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `plan_id` | uuid |
| `item_id` | text |
| `section` | text |
| `material_description` | text |
| `qty_variation_note` | text |
| `tender_qty` | numeric |
| `unit` | text |
| `gfc_qty` | numeric |
| `indent_qty` | numeric |
| `indent_unit` | text |
| `indent_received` | text |
| `material_qty_ordered` | numeric |
| `planned_po_release_date` | date |
| `planned_procurement_date` | date |
| `planned_delivery_date` | date |
| `actual_po_release_date` | date |
| `actual_procurement_date` | date |
| `supplier_committed_date` | date |
| `actual_delivery_date` | date |
| `material_qty_received` | numeric |
| `delay_days` | integer |
| `reason_for_delay` | text |
| `status` | text |
| `notes` | text |
| `updated_at` | timestamp with time zone |
| `created_at` | timestamp with time zone |
| `schedule_task_id` | uuid |

## project_tasks_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `task_id_in_schedule` | text |
| `task_name` | text |
| `phase` | text |
| `planned_start_date` | date |
| `planned_finish_date` | date |
| `actual_start_date` | date |
| `actual_finish_date` | date |
| `duration_days` | integer |
| `predecessor_ids` | ARRAY |
| `responsible_role` | text |
| `status` | text |
| `completion_percentage` | integer |
| `delay_days` | integer |
| `remarks` | text |
| `is_locked` | boolean |
| `lock_override_by` | uuid |
| `lock_override_reason` | text |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `delay_cause` | text |
| `delay_resolution` | text |
| `parent_task_id` | uuid |
| `task_type` | USER-DEFINED |
| `is_qc_gate` | boolean |
| `display_order` | integer |
| `stage_number` | text |
| `parent_stage_number` | text |
| `input_required` | text |
| `output_deliverable` | text |
| `hstack_action` | text |
| `lock_override_at` | timestamp with time zone |
| `stage_name` | text |
| `escalation_role` | text |
| `is_payment_milestone` | boolean |
| `escalated_at` | timestamp with time zone |
| `qc_requested_at` | timestamp with time zone |
| `qc_request_notified_user` | uuid |
| `special_note` | text |
| `completion_type` | USER-DEFINED |
| `backfilled_by` | uuid |
| `backfilled_at` | timestamp with time zone |
| `backfill_note` | text |
| `work_category` | text |

## projects_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `name` | text |
| `client_name` | text |
| `location` | text |
| `type` | text |
| `status` | text |
| `start_date` | date |
| `est_completion` | date |
| `created_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |
| `updated_by` | uuid |
| `is_archived` | boolean |
| `construction_type` | text |
| `site_lat` | numeric |
| `site_lng` | numeric |
| `site_radius` | integer |
| `division` | text |
| `is_design_only` | boolean |
| `site_ready_confirmed` | boolean |
| `wip_start_date` | timestamp with time zone |
| `wip_close_date` | timestamp with time zone |
| `wip_status` | text |
| `gfc_budget` | numeric |
| `planned_labour_cost` | numeric |
| `client_portal_enabled` | boolean |
| `client_portal_expires_at` | timestamp with time zone |
| `client_portal_status_message` | text |
| `milestones_locked` | boolean |
| `production_system` | text |
| `archived_at` | timestamp with time zone |
| `archive_reason` | text |
| `contract_value` | numeric |
| `gfc_budget_total` | numeric |
| `actually_spent` | numeric |
| `site_schedule_unlocked_at` | timestamp with time zone |
| `site_schedule_notified_at` | timestamp with time zone |
| `site_schedule_escalated_at` | timestamp with time zone |
| `setup_uploaded_at` | timestamp with time zone |
| `setup_uploaded_by_name` | text |
| `module_count` | integer |
| `panel_count` | integer |
| `project_type` | text |
| `project_size` | text |
| `project_setup_approved` | boolean |
| `project_setup_approved_at` | timestamp with time zone |
| `gfc_budget_approved_at` | timestamp with time zone |
| `project_setup_status` | text |
| `closed_at` | timestamp with time zone |
| `closed_by` | uuid |
| `storage_cleaned` | boolean |
| `storage_cleaned_at` | timestamp with time zone |
| `storage_cleaned_by` | uuid |
| `client_work_order_id` | uuid |
| `wo_line_item_ref` | text |
| `actual_completion_date` | date |
| `project_architect_id` | uuid |

## reminder_events_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `rule_key` | text |
| `subject_ref` | text |
| `subject_date` | date |
| `project_id` | uuid |
| `raised_at` | timestamp with time zone |
| `level` | integer |
| `notified_user` | uuid |
| `notified_role` | text |
| `delivery` | text |
| `acknowledged_at` | timestamp with time zone |
| `resolved_at` | timestamp with time zone |
| `resolved_by` | text |
| `recipient_ids` | ARRAY |
| `acknowledgements` | jsonb |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

Site readiness files (added with the Site Readiness redesign): `photo_paths` is JSON photo metadata (storage path, EXIF date, GPS, gallery flag), never image bytes. `site_readiness_crane_cost_v1.csv` carries crane amounts in ₹ and is visible in the app to every Site Readiness reader plus Tier 1/Super Admin, finance_manager, head_of_projects and planning_head.

## site_readiness_checks_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `section` | text |
| `item_key` | text |
| `status` | text |
| `value_numeric` | numeric |
| `value_text` | text |
| `comment` | text |
| `photo_paths` | jsonb |
| `checked_by` | uuid |
| `checked_at` | timestamp with time zone |
| `created_by` | uuid |
| `created_at` | timestamp with time zone |

## site_readiness_crane_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `vendor_name` | text |
| `vendor_contact_phone` | text |
| `operator_name` | text |
| `operator_phone` | text |
| `capacity_tonnes` | numeric |
| `booked_for_date` | date |
| `slot_hours` | numeric |
| `operator_site_visit_done` | boolean |
| `operator_visit_date` | date |
| `comment` | text |
| `photo_paths` | jsonb |
| `created_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_by` | uuid |
| `updated_at` | timestamp with time zone |

## site_readiness_crane_cost_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `rate_inr` | numeric |
| `rate_basis` | text |
| `total_cost_inr` | numeric |
| `advance_paid_inr` | numeric |
| `created_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_by` | uuid |
| `updated_at` | timestamp with time zone |

## site_readiness_tolerances_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `allowed_level_diff_mm` | numeric |
| `allowed_diagonal_diff_mm` | numeric |
| `allowed_spacing_dev_mm` | numeric |
| `set_by` | uuid |
| `set_at` | timestamp with time zone |

## site_report_edit_log_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `edited_by` | uuid |
| `edited_at` | timestamp with time zone |
| `field` | text |
| `old_value` | text |
| `new_value` | text |

## site_report_labour_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `task_id` | uuid |
| `hours` | numeric |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

## site_report_photos_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `kind` | text |
| `storage_path` | text |
| `exif_taken_at` | timestamp with time zone |
| `gps_lat` | double precision |
| `gps_lng` | double precision |
| `gps_source` | text |
| `from_gallery` | boolean |
| `flags` | ARRAY |
| `is_archived` | boolean |
| `uploaded_at` | timestamp with time zone |
| `uploaded_by` | uuid |
| `elevation_id` | uuid |

## site_report_quantities_v2.csv

v2 (B1) replaces v1: adds who did the work and subcontract amounts. `contractor_id` empty = own labour; `boq_item_id` empty = other work (see `extra_work_description`). `rate_used` and `amount_inr` are snapshots taken at submission. v1 is no longer written.

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `boq_item_id` | uuid |
| `today_qty` | numeric |
| `remarks` | text |
| `contractor_id` | uuid |
| `rate_id` | uuid |
| `extra_work_description` | text |
| `unit` | text |
| `rate_used` | numeric |
| `amount_inr` | numeric |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

## site_report_task_progress_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `task_id` | uuid |
| `completion_percentage_after` | numeric |
| `remarks` | text |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

## site_report_subcontractor_headcount_v1.csv

| Column | Type |
|---|---|
| `id` | uuid |
| `report_id` | uuid |
| `project_id` | uuid |
| `contractor_id` | uuid |
| `headcount` | integer |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

## subcontract_rates_v1.csv

Subcontract rates per project (B1). `rate_type` is `per_unit` or `lump_sum`; effective rate = `rate_inr`, or `lump_sum_inr / package_qty`. Inactive rows are kept (`is_active=false`). Payments, TDS and retention stay in Tally and are not exported here.

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `contractor_id` | uuid |
| `rate_type` | text |
| `boq_item_id` | uuid |
| `work_description` | text |
| `unit` | text |
| `rate_inr` | numeric |
| `lump_sum_inr` | numeric |
| `package_qty` | numeric |
| `is_active` | boolean |
| `created_by` | uuid |
| `updated_by` | uuid |
| `created_at` | timestamp with time zone |
| `updated_at` | timestamp with time zone |

## labour_attendance_photos_v1.csv

Metadata only; image files are never exported.

| Column | Type |
|---|---|
| `id` | uuid |
| `project_id` | uuid |
| `work_date` | date |
| `storage_path` | text |
| `captured_at` | timestamp with time zone |
| `received_at` | timestamp with time zone |
| `gps_lat` | numeric |
| `gps_lng` | numeric |
| `gps_accuracy_m` | numeric |
| `flags` | jsonb |
| `uploaded_by` | uuid |
