export const EXPORT_SCHEMA = [
  {
    "table": "attendance_records",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "user_id",
        "type": "uuid"
      },
      {
        "name": "date",
        "type": "date"
      },
      {
        "name": "check_in_time",
        "type": "timestamp with time zone"
      },
      {
        "name": "check_out_time",
        "type": "timestamp with time zone"
      },
      {
        "name": "location_type",
        "type": "text"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "gps_lat",
        "type": "numeric"
      },
      {
        "name": "gps_lng",
        "type": "numeric"
      },
      {
        "name": "gps_verified",
        "type": "boolean"
      },
      {
        "name": "remote_reason",
        "type": "text"
      },
      {
        "name": "hours_worked",
        "type": "numeric"
      },
      {
        "name": "is_manual_override",
        "type": "boolean"
      },
      {
        "name": "override_reason",
        "type": "text"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "offline_captured",
        "type": "boolean"
      },
      {
        "name": "synced_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "location_note",
        "type": "text"
      }
    ]
  },
  {
    "table": "daily_measurements",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "module_id",
        "type": "uuid"
      },
      {
        "name": "stage",
        "type": "text"
      },
      {
        "name": "measurement_date",
        "type": "date"
      },
      {
        "name": "location",
        "type": "text"
      },
      {
        "name": "trade",
        "type": "text"
      },
      {
        "name": "team_label",
        "type": "text"
      },
      {
        "name": "notes",
        "type": "text"
      },
      {
        "name": "is_locked",
        "type": "boolean"
      },
      {
        "name": "unlock_reason",
        "type": "text"
      },
      {
        "name": "unlocked_by",
        "type": "uuid"
      },
      {
        "name": "unlocked_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "anomaly_flags",
        "type": "jsonb"
      },
      {
        "name": "submitted_by",
        "type": "uuid"
      },
      {
        "name": "is_archived",
        "type": "boolean"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "total_wip_today",
        "type": "numeric"
      },
      {
        "name": "submitted_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "reviewed_by",
        "type": "uuid"
      },
      {
        "name": "wip_needs_review",
        "type": "boolean"
      },
      {
        "name": "wip_review_reason",
        "type": "text"
      },
      {
        "name": "report_status",
        "type": "text"
      },
      {
        "name": "site_clean",
        "type": "boolean"
      },
      {
        "name": "site_clean_photo_path",
        "type": "text"
      }
    ]
  },
  {
    "table": "expense_entries",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "submitted_by",
        "type": "uuid"
      },
      {
        "name": "entry_date",
        "type": "date"
      },
      {
        "name": "expense_type",
        "type": "text"
      },
      {
        "name": "category",
        "type": "text"
      },
      {
        "name": "amount",
        "type": "numeric"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "description",
        "type": "text"
      },
      {
        "name": "vehicle_type",
        "type": "text"
      },
      {
        "name": "from_location",
        "type": "text"
      },
      {
        "name": "to_location",
        "type": "text"
      },
      {
        "name": "distance_km",
        "type": "numeric"
      },
      {
        "name": "rate_per_km",
        "type": "numeric"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "hr_reviewed_by",
        "type": "uuid"
      },
      {
        "name": "hr_reviewed_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "hr_flag_note",
        "type": "text"
      },
      {
        "name": "hr_flag_response",
        "type": "text"
      },
      {
        "name": "hod_approved_by",
        "type": "uuid"
      },
      {
        "name": "hod_approved_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "finance_paid_by",
        "type": "uuid"
      },
      {
        "name": "finance_paid_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "rejection_reason",
        "type": "text"
      },
      {
        "name": "budget_flag",
        "type": "boolean"
      },
      {
        "name": "report_period",
        "type": "text"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "submission_method",
        "type": "text"
      },
      {
        "name": "uploaded_on_behalf_of",
        "type": "uuid"
      },
      {
        "name": "rate_used",
        "type": "numeric"
      },
      {
        "name": "vendor",
        "type": "text"
      },
      {
        "name": "bill_no",
        "type": "text"
      },
      {
        "name": "receipt_path",
        "type": "text"
      },
      {
        "name": "receipt_exif_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "receipt_flags",
        "type": "ARRAY"
      },
      {
        "name": "policy_warnings",
        "type": "jsonb"
      },
      {
        "name": "warning_reason",
        "type": "text"
      }
    ]
  },
  {
    "table": "labour_attendance",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "work_date",
        "type": "date"
      },
      {
        "name": "worker_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "hours",
        "type": "numeric"
      },
      {
        "name": "recorded_by",
        "type": "uuid"
      },
      {
        "name": "recorded_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "effective_hourly_rate",
        "type": "numeric"
      },
      {
        "name": "amount",
        "type": "numeric"
      }
    ]
  },
  {
    "table": "labour_worker_rates",
    "version": 1,
    "columns": [
      {
        "name": "worker_id",
        "type": "uuid"
      },
      {
        "name": "worker_code",
        "type": "text"
      },
      {
        "name": "name",
        "type": "text"
      },
      {
        "name": "contractor",
        "type": "text"
      },
      {
        "name": "skill_type",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "hourly_rate",
        "type": "numeric"
      },
      {
        "name": "effective_hourly_rate",
        "type": "numeric"
      }
    ]
  },
  {
    "table": "labour_worker_rates",
    "version": 1,
    "columns": [
      {
        "name": "worker_id",
        "type": "uuid"
      },
      {
        "name": "worker_code",
        "type": "text"
      },
      {
        "name": "name",
        "type": "text"
      },
      {
        "name": "contractor",
        "type": "text"
      },
      {
        "name": "skill_type",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "hourly_rate",
        "type": "numeric"
      },
      {
        "name": "effective_hourly_rate",
        "type": "numeric"
      }
    ]
  },
  {
    "table": "labour_workers",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "contractor_id",
        "type": "uuid"
      },
      {
        "name": "name",
        "type": "text"
      },
      {
        "name": "skill_type",
        "type": "text"
      },
      {
        "name": "department",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "date_joined",
        "type": "date"
      },
      {
        "name": "on_leave_return_date",
        "type": "date"
      },
      {
        "name": "notes",
        "type": "text"
      },
      {
        "name": "deactivated_reason",
        "type": "text"
      },
      {
        "name": "deactivated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "worker_code",
        "type": "text"
      }
    ]
  },
  {
    "table": "project_boq_items",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "boq_id",
        "type": "uuid"
      },
      {
        "name": "sno",
        "type": "integer"
      },
      {
        "name": "category",
        "type": "text"
      },
      {
        "name": "item_description",
        "type": "text"
      },
      {
        "name": "unit",
        "type": "text"
      },
      {
        "name": "actual_qty",
        "type": "numeric"
      },
      {
        "name": "wastage_pct",
        "type": "numeric"
      },
      {
        "name": "boq_qty",
        "type": "numeric"
      },
      {
        "name": "material_rate",
        "type": "numeric"
      },
      {
        "name": "labour_rate",
        "type": "numeric"
      },
      {
        "name": "oh_rate",
        "type": "numeric"
      },
      {
        "name": "boq_rate",
        "type": "numeric"
      },
      {
        "name": "total_amount",
        "type": "numeric"
      },
      {
        "name": "margin_pct",
        "type": "numeric"
      },
      {
        "name": "scope",
        "type": "text"
      },
      {
        "name": "procured_qty",
        "type": "numeric"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "tender_qty",
        "type": "numeric"
      },
      {
        "name": "tender_amount",
        "type": "numeric"
      },
      {
        "name": "gfc_amount",
        "type": "numeric"
      },
      {
        "name": "schedule_task_id",
        "type": "uuid"
      }
    ]
  },
  {
    "table": "project_elevations",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "name",
        "type": "text"
      },
      {
        "name": "drawing_ref",
        "type": "text"
      },
      {
        "name": "sort_order",
        "type": "integer"
      },
      {
        "name": "is_active",
        "type": "boolean"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      }
    ]
  },
  {
    "table": "project_material_plan_items",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "plan_id",
        "type": "uuid"
      },
      {
        "name": "item_id",
        "type": "text"
      },
      {
        "name": "section",
        "type": "text"
      },
      {
        "name": "material_description",
        "type": "text"
      },
      {
        "name": "qty_variation_note",
        "type": "text"
      },
      {
        "name": "tender_qty",
        "type": "numeric"
      },
      {
        "name": "unit",
        "type": "text"
      },
      {
        "name": "gfc_qty",
        "type": "numeric"
      },
      {
        "name": "indent_qty",
        "type": "numeric"
      },
      {
        "name": "indent_unit",
        "type": "text"
      },
      {
        "name": "indent_received",
        "type": "text"
      },
      {
        "name": "material_qty_ordered",
        "type": "numeric"
      },
      {
        "name": "planned_po_release_date",
        "type": "date"
      },
      {
        "name": "planned_procurement_date",
        "type": "date"
      },
      {
        "name": "planned_delivery_date",
        "type": "date"
      },
      {
        "name": "actual_po_release_date",
        "type": "date"
      },
      {
        "name": "actual_procurement_date",
        "type": "date"
      },
      {
        "name": "supplier_committed_date",
        "type": "date"
      },
      {
        "name": "actual_delivery_date",
        "type": "date"
      },
      {
        "name": "material_qty_received",
        "type": "numeric"
      },
      {
        "name": "delay_days",
        "type": "integer"
      },
      {
        "name": "reason_for_delay",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "notes",
        "type": "text"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "schedule_task_id",
        "type": "uuid"
      }
    ]
  },
  {
    "table": "project_tasks",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "task_id_in_schedule",
        "type": "text"
      },
      {
        "name": "task_name",
        "type": "text"
      },
      {
        "name": "phase",
        "type": "text"
      },
      {
        "name": "planned_start_date",
        "type": "date"
      },
      {
        "name": "planned_finish_date",
        "type": "date"
      },
      {
        "name": "actual_start_date",
        "type": "date"
      },
      {
        "name": "actual_finish_date",
        "type": "date"
      },
      {
        "name": "duration_days",
        "type": "integer"
      },
      {
        "name": "predecessor_ids",
        "type": "ARRAY"
      },
      {
        "name": "responsible_role",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "completion_percentage",
        "type": "integer"
      },
      {
        "name": "delay_days",
        "type": "integer"
      },
      {
        "name": "remarks",
        "type": "text"
      },
      {
        "name": "is_locked",
        "type": "boolean"
      },
      {
        "name": "lock_override_by",
        "type": "uuid"
      },
      {
        "name": "lock_override_reason",
        "type": "text"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "delay_cause",
        "type": "text"
      },
      {
        "name": "delay_resolution",
        "type": "text"
      },
      {
        "name": "parent_task_id",
        "type": "uuid"
      },
      {
        "name": "task_type",
        "type": "USER-DEFINED"
      },
      {
        "name": "is_qc_gate",
        "type": "boolean"
      },
      {
        "name": "display_order",
        "type": "integer"
      },
      {
        "name": "stage_number",
        "type": "text"
      },
      {
        "name": "parent_stage_number",
        "type": "text"
      },
      {
        "name": "input_required",
        "type": "text"
      },
      {
        "name": "output_deliverable",
        "type": "text"
      },
      {
        "name": "hstack_action",
        "type": "text"
      },
      {
        "name": "lock_override_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "stage_name",
        "type": "text"
      },
      {
        "name": "escalation_role",
        "type": "text"
      },
      {
        "name": "is_payment_milestone",
        "type": "boolean"
      },
      {
        "name": "escalated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "qc_requested_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "qc_request_notified_user",
        "type": "uuid"
      },
      {
        "name": "special_note",
        "type": "text"
      },
      {
        "name": "completion_type",
        "type": "USER-DEFINED"
      },
      {
        "name": "backfilled_by",
        "type": "uuid"
      },
      {
        "name": "backfilled_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "backfill_note",
        "type": "text"
      },
      {
        "name": "work_category",
        "type": "text"
      }
    ]
  },
  {
    "table": "projects",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "name",
        "type": "text"
      },
      {
        "name": "client_name",
        "type": "text"
      },
      {
        "name": "location",
        "type": "text"
      },
      {
        "name": "type",
        "type": "text"
      },
      {
        "name": "status",
        "type": "text"
      },
      {
        "name": "start_date",
        "type": "date"
      },
      {
        "name": "est_completion",
        "type": "date"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "is_archived",
        "type": "boolean"
      },
      {
        "name": "construction_type",
        "type": "text"
      },
      {
        "name": "site_lat",
        "type": "numeric"
      },
      {
        "name": "site_lng",
        "type": "numeric"
      },
      {
        "name": "site_radius",
        "type": "integer"
      },
      {
        "name": "division",
        "type": "text"
      },
      {
        "name": "is_design_only",
        "type": "boolean"
      },
      {
        "name": "site_ready_confirmed",
        "type": "boolean"
      },
      {
        "name": "wip_start_date",
        "type": "timestamp with time zone"
      },
      {
        "name": "wip_close_date",
        "type": "timestamp with time zone"
      },
      {
        "name": "wip_status",
        "type": "text"
      },
      {
        "name": "gfc_budget",
        "type": "numeric"
      },
      {
        "name": "planned_labour_cost",
        "type": "numeric"
      },
      {
        "name": "client_portal_enabled",
        "type": "boolean"
      },
      {
        "name": "client_portal_expires_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "client_portal_status_message",
        "type": "text"
      },
      {
        "name": "milestones_locked",
        "type": "boolean"
      },
      {
        "name": "production_system",
        "type": "text"
      },
      {
        "name": "archived_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "archive_reason",
        "type": "text"
      },
      {
        "name": "contract_value",
        "type": "numeric"
      },
      {
        "name": "gfc_budget_total",
        "type": "numeric"
      },
      {
        "name": "actually_spent",
        "type": "numeric"
      },
      {
        "name": "site_schedule_unlocked_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "site_schedule_notified_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "site_schedule_escalated_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "setup_uploaded_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "setup_uploaded_by_name",
        "type": "text"
      },
      {
        "name": "module_count",
        "type": "integer"
      },
      {
        "name": "panel_count",
        "type": "integer"
      },
      {
        "name": "project_type",
        "type": "text"
      },
      {
        "name": "project_size",
        "type": "text"
      },
      {
        "name": "project_setup_approved",
        "type": "boolean"
      },
      {
        "name": "project_setup_approved_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "gfc_budget_approved_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "project_setup_status",
        "type": "text"
      },
      {
        "name": "closed_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "closed_by",
        "type": "uuid"
      },
      {
        "name": "storage_cleaned",
        "type": "boolean"
      },
      {
        "name": "storage_cleaned_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "storage_cleaned_by",
        "type": "uuid"
      },
      {
        "name": "client_work_order_id",
        "type": "uuid"
      },
      {
        "name": "wo_line_item_ref",
        "type": "text"
      },
      {
        "name": "actual_completion_date",
        "type": "date"
      },
      {
        "name": "project_architect_id",
        "type": "uuid"
      }
    ]
  },
  {
    "table": "reminder_events",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "rule_key",
        "type": "text"
      },
      {
        "name": "subject_ref",
        "type": "text"
      },
      {
        "name": "subject_date",
        "type": "date"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "raised_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "level",
        "type": "integer"
      },
      {
        "name": "notified_user",
        "type": "uuid"
      },
      {
        "name": "notified_role",
        "type": "text"
      },
      {
        "name": "delivery",
        "type": "text"
      },
      {
        "name": "acknowledged_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "resolved_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "resolved_by",
        "type": "text"
      },
      {
        "name": "recipient_ids",
        "type": "ARRAY"
      },
      {
        "name": "acknowledgements",
        "type": "jsonb"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      }
    ]
  },
  {
    "table": "site_report_edit_log",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "report_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "edited_by",
        "type": "uuid"
      },
      {
        "name": "edited_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "field",
        "type": "text"
      },
      {
        "name": "old_value",
        "type": "text"
      },
      {
        "name": "new_value",
        "type": "text"
      }
    ]
  },
  {
    "table": "site_report_labour",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "report_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "task_id",
        "type": "uuid"
      },
      {
        "name": "hours",
        "type": "numeric"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      }
    ]
  },
  {
    "table": "site_report_photos",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "report_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "kind",
        "type": "text"
      },
      {
        "name": "storage_path",
        "type": "text"
      },
      {
        "name": "exif_taken_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "gps_lat",
        "type": "double precision"
      },
      {
        "name": "gps_lng",
        "type": "double precision"
      },
      {
        "name": "gps_source",
        "type": "text"
      },
      {
        "name": "from_gallery",
        "type": "boolean"
      },
      {
        "name": "flags",
        "type": "ARRAY"
      },
      {
        "name": "is_archived",
        "type": "boolean"
      },
      {
        "name": "uploaded_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "uploaded_by",
        "type": "uuid"
      },
      {
        "name": "elevation_id",
        "type": "uuid"
      }
    ]
  },
  {
    "table": "site_report_quantities",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "report_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "boq_item_id",
        "type": "uuid"
      },
      {
        "name": "today_qty",
        "type": "numeric"
      },
      {
        "name": "remarks",
        "type": "text"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      }
    ]
  },
  {
    "table": "site_report_task_progress",
    "version": 1,
    "columns": [
      {
        "name": "id",
        "type": "uuid"
      },
      {
        "name": "report_id",
        "type": "uuid"
      },
      {
        "name": "project_id",
        "type": "uuid"
      },
      {
        "name": "task_id",
        "type": "uuid"
      },
      {
        "name": "completion_percentage_after",
        "type": "numeric"
      },
      {
        "name": "remarks",
        "type": "text"
      },
      {
        "name": "created_by",
        "type": "uuid"
      },
      {
        "name": "updated_by",
        "type": "uuid"
      },
      {
        "name": "created_at",
        "type": "timestamp with time zone"
      },
      {
        "name": "updated_at",
        "type": "timestamp with time zone"
      }
    ]
  }
] as const;
