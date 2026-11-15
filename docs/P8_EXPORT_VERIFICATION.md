# P8 Export Verification

## Delivered

- Private exports bucket: no storage policies for anon/authenticated; service-role writes and signed URL reads only.
- Migration 0031; export-nightly, export-latest, export-admin deployed.
- Nightly job 37: 0 20 * * * UTC = 01:30 IST, managed authenticated HTTP callback. All previous seven jobs unchanged.
- 17 unique files (the initial generated manifest duplicated the wage file; corrected without changing any column schema).
- Export Now ran once as the requesting MD. Additional authenticated scheduler callback checks ran twice; both succeeded. First test script had an output-only status-property error after the callback succeeded.
- Latest file headers and parsed CSV row counts verified by downloading all 17 actual CSVs.
- Full suite: 197 passed, 5 existing live-RLS tests skipped; automatic TypeScript/app build OK.
- Signed-in Settings history, row counts, storage readout and 360px viewport verified, no document overflow.

## Requested manual export_log row

```json
{
  "id": "13d773bf-f585-406d-8ccd-eb5b52668c1f",
  "run_at": "2026-11-15T02:23:31.861854Z",
  "trigger": "manual",
  "status": "success",
  "created_by": "99b67080-a6eb-4feb-bd8e-92a287b430aa",
  "error": null,
  "row_counts": {
    "attendance_records": 238,
    "daily_measurements": 3,
    "expense_entries": 10,
    "labour_attendance": 7,
    "labour_worker_rates": 49,
    "labour_workers": 49,
    "project_boq_items": 315,
    "project_elevations": 3,
    "project_material_plan_items": 320,
    "project_tasks": 924,
    "projects": 6,
    "reminder_events": 0,
    "site_report_edit_log": 42,
    "site_report_labour": 3,
    "site_report_photos": 13,
    "site_report_quantities": 3,
    "site_report_task_progress": 3
  }
}
```

## File list and row counts

| CSV (both dated 2026-11-15/ and latest/) | Rows |
|---|---|
| `attendance_records_v1.csv` | 238 |
| `daily_measurements_v1.csv` | 3 |
| `expense_entries_v1.csv` | 10 |
| `labour_attendance_v1.csv` | 7 |
| `labour_worker_rates_v1.csv` | 49 |
| `labour_workers_v1.csv` | 49 |
| `project_boq_items_v1.csv` | 315 |
| `project_elevations_v1.csv` | 3 |
| `project_material_plan_items_v1.csv` | 320 |
| `project_tasks_v1.csv` | 924 |
| `projects_v1.csv` | 6 |
| `reminder_events_v1.csv` | 0 |
| `site_report_edit_log_v1.csv` | 42 |
| `site_report_labour_v1.csv` | 3 |
| `site_report_photos_v1.csv` | 13 |
| `site_report_quantities_v1.csv` | 3 |
| `site_report_task_progress_v1.csv` | 3 |

## First three lines of downloaded CSVs

### latest/labour_attendance_v1.csv

```csv
id,work_date,worker_id,project_id,hours,recorded_by,recorded_at,effective_hourly_rate,amount
12fb210c-5324-46d1-8286-1dd1da3ad849,2026-11-11,c250c406-8466-4813-bcd9-4e632574e7df,e4f51cd6-fb25-475e-980a-5e46070d678f,6,99b67080-a6eb-4feb-bd8e-92a287b430aa,2026-11-12T20:16:22.704988+00:00,110.58,663.48
3c179551-b364-4edc-853c-95e9d55d8041,2026-11-12,c250c406-8466-4813-bcd9-4e632574e7df,e4f51cd6-fb25-475e-980a-5e46070d678f,12,99b67080-a6eb-4feb-bd8e-92a287b430aa,2026-11-12T21:22:46.037483+00:00,110.58,1326.96
```

### latest/site_report_photos_v1.csv

```csv
id,report_id,project_id,kind,storage_path,exif_taken_at,gps_lat,gps_lng,gps_source,from_gallery,flags,is_archived,uploaded_at,uploaded_by,elevation_id
01a6135b-0d47-48c4-aad1-31970aa4dfb5,9f412630-66d1-41c7-b402-74fcc42445a1,e4f51cd6-fb25-475e-980a-5e46070d678f,elevation,e4f51cd6-fb25-475e-980a-5e46070d678f/9f412630-66d1-41c7-b402-74fcc42445a1/elevation-d43a6148-2120-4cdb-9b7e-286f0615a43d-1794654279818.jpg,,12.956627136091,77.5959896882388,device,true,"[""no_exif"",""gallery""]",false,2026-11-14T11:04:40.366431+00:00,99b67080-a6eb-4feb-bd8e-92a287b430aa,d43a6148-2120-4cdb-9b7e-286f0615a43d
114db5dd-f95b-4b37-ab16-e1940afab50d,4392a224-5f0f-4596-9f85-4dc4e80fd0d5,e4f51cd6-fb25-475e-980a-5e46070d678f,site_clean,e4f51cd6-fb25-475e-980a-5e46070d678f/4392a224-5f0f-4596-9f85-4dc4e80fd0d5/site_clean-1794700411930.jpg,,12.9565036566308,77.5961662915086,device,true,"[""no_exif"",""gallery""]",false,2026-11-14T23:53:31.615469+00:00,99b67080-a6eb-4feb-bd8e-92a287b430aa,
```

## Every actual file header — forbidden column count: 0

### attendance_records_v1.csv

```text
id,user_id,date,check_in_time,check_out_time,location_type,project_id,gps_lat,gps_lng,gps_verified,remote_reason,hours_worked,is_manual_override,override_reason,created_at,updated_at,offline_captured,synced_at,location_note
```

### daily_measurements_v1.csv

```text
id,project_id,module_id,stage,measurement_date,location,trade,team_label,notes,is_locked,unlock_reason,unlocked_by,unlocked_at,anomaly_flags,submitted_by,is_archived,created_by,updated_by,created_at,updated_at,total_wip_today,submitted_at,reviewed_by,wip_needs_review,wip_review_reason,report_status,site_clean,site_clean_photo_path
```

### expense_entries_v1.csv

```text
id,submitted_by,entry_date,expense_type,category,amount,project_id,description,vehicle_type,from_location,to_location,distance_km,rate_per_km,status,hr_reviewed_by,hr_reviewed_at,hr_flag_note,hr_flag_response,hod_approved_by,hod_approved_at,finance_paid_by,finance_paid_at,rejection_reason,budget_flag,report_period,created_at,updated_at,submission_method,uploaded_on_behalf_of,rate_used,vendor,bill_no,receipt_path,receipt_exif_at,receipt_flags,policy_warnings,warning_reason
```

### labour_attendance_v1.csv

```text
id,work_date,worker_id,project_id,hours,recorded_by,recorded_at,effective_hourly_rate,amount
```

### labour_worker_rates_v1.csv

```text
worker_id,worker_code,name,contractor,skill_type,status,hourly_rate,effective_hourly_rate
```

### labour_workers_v1.csv

```text
id,contractor_id,name,skill_type,department,status,date_joined,on_leave_return_date,notes,deactivated_reason,deactivated_at,created_at,updated_at,worker_code
```

### project_boq_items_v1.csv

```text
id,boq_id,sno,category,item_description,unit,actual_qty,wastage_pct,boq_qty,material_rate,labour_rate,oh_rate,boq_rate,total_amount,margin_pct,scope,procured_qty,created_at,tender_qty,tender_amount,gfc_amount,schedule_task_id
```

### project_elevations_v1.csv

```text
id,project_id,name,drawing_ref,sort_order,is_active,created_by,created_at
```

### project_material_plan_items_v1.csv

```text
id,plan_id,item_id,section,material_description,qty_variation_note,tender_qty,unit,gfc_qty,indent_qty,indent_unit,indent_received,material_qty_ordered,planned_po_release_date,planned_procurement_date,planned_delivery_date,actual_po_release_date,actual_procurement_date,supplier_committed_date,actual_delivery_date,material_qty_received,delay_days,reason_for_delay,status,notes,updated_at,created_at,schedule_task_id
```

### project_tasks_v1.csv

```text
id,project_id,task_id_in_schedule,task_name,phase,planned_start_date,planned_finish_date,actual_start_date,actual_finish_date,duration_days,predecessor_ids,responsible_role,status,completion_percentage,delay_days,remarks,is_locked,lock_override_by,lock_override_reason,created_at,updated_at,delay_cause,delay_resolution,parent_task_id,task_type,is_qc_gate,display_order,stage_number,parent_stage_number,input_required,output_deliverable,hstack_action,lock_override_at,stage_name,escalation_role,is_payment_milestone,escalated_at,qc_requested_at,qc_request_notified_user,special_note,completion_type,backfilled_by,backfilled_at,backfill_note,work_category
```

### projects_v1.csv

```text
id,name,client_name,location,type,status,start_date,est_completion,created_by,created_at,updated_at,updated_by,is_archived,construction_type,site_lat,site_lng,site_radius,division,is_design_only,site_ready_confirmed,wip_start_date,wip_close_date,wip_status,gfc_budget,planned_labour_cost,client_portal_enabled,client_portal_expires_at,client_portal_status_message,milestones_locked,production_system,archived_at,archive_reason,contract_value,gfc_budget_total,actually_spent,site_schedule_unlocked_at,site_schedule_notified_at,site_schedule_escalated_at,setup_uploaded_at,setup_uploaded_by_name,module_count,panel_count,project_type,project_size,project_setup_approved,project_setup_approved_at,gfc_budget_approved_at,project_setup_status,closed_at,closed_by,storage_cleaned,storage_cleaned_at,storage_cleaned_by,client_work_order_id,wo_line_item_ref,actual_completion_date,project_architect_id
```

### reminder_events_v1.csv

```text
id,rule_key,subject_ref,subject_date,project_id,raised_at,level,notified_user,notified_role,delivery,acknowledged_at,resolved_at,resolved_by,recipient_ids,acknowledgements,created_by,updated_by,created_at,updated_at
```

### site_report_edit_log_v1.csv

```text
id,report_id,project_id,edited_by,edited_at,field,old_value,new_value
```

### site_report_labour_v1.csv

```text
id,report_id,project_id,task_id,hours,created_by,updated_by,created_at,updated_at
```

### site_report_photos_v1.csv

```text
id,report_id,project_id,kind,storage_path,exif_taken_at,gps_lat,gps_lng,gps_source,from_gallery,flags,is_archived,uploaded_at,uploaded_by,elevation_id
```

### site_report_quantities_v1.csv

```text
id,report_id,project_id,boq_item_id,today_qty,remarks,created_by,updated_by,created_at,updated_at
```

### site_report_task_progress_v1.csv

```text
id,report_id,project_id,task_id,completion_percentage_after,remarks,created_by,updated_by,created_at,updated_at
```

## Token lifecycle

- Token ID a756040c-5b33-4f74-b1cf-7620f2e45fec; label P8 verification (revoked). Token value was never logged or saved.
- Create 201; export-latest use 200; two CSV downloads 200; revoke 200; reuse after revoke 401.
- last_used_at 2026-11-15T02:24:02.857Z; revoked_at 2026-11-15T02:24:06.128Z. Create/revoke audit records identify requesting MD and timestamp.

## Unchanged state and limitations

- reminder_events = 0; reminders OFF; exports already ON before work and unchanged; no flags enabled.
- Existing photo and receipt bucket counts/bytes unchanged; project-storage-cleanup untouched. Exports has 34 objects (17 dated + 17 latest), 1,145,268 bytes.
- 60-day pruning tested at boundary in Vitest; no expired production folders existed to prune.
- Nightly time has not elapsed; same scheduled authentication/function path exercised manually and returned 200.
- Cross-table snapshots are paginated, not one database transaction. Rates use current effective hourly rate, matching the existing fallback, not historical rate snapshots.
- Already issued signed URLs remain valid for at most five minutes after token revocation.
- Three unrelated access security findings remain active at user request (Keep access pending review); no policies or finding states changed.
