const audit = [{name:"is_archived",type:"boolean"},{name:"created_by",type:"uuid"},{name:"updated_by",type:"uuid"},{name:"created_at",type:"timestamp with time zone"},{name:"updated_at",type:"timestamp with time zone"}] as const;
const entry=(table:string,fields:readonly (readonly [string,string])[])=>({table,version:1,columns:[{name:"id",type:"uuid"},...fields.map(([name,type])=>({name,type})),...audit]});
// Frozen factory projections exclude hourly/unit rates and rate identifiers.
export const FACTORY_EXPORT_SCHEMA = [
 entry("factory_daily_reports",[["report_date","date"],["status","text"],["notes","text"],["submitted_by","uuid"],["submitted_at","timestamp with time zone"]]),
 entry("factory_labour_attendance",[["work_date","date"],["worker_id","uuid"],["hours","numeric"],["hours_confirmed","boolean"],["no_photo_exception","boolean"]]),
 entry("factory_attendance_photos",[["work_date","date"],["storage_path","text"],["captured_at","timestamp with time zone"],["received_at","timestamp with time zone"],["gps_lat","numeric"],["gps_lng","numeric"],["gps_accuracy_m","numeric"],["flags","jsonb"]]),
 entry("factory_report_blocks",[["report_id","uuid"],["module_id","uuid"],["stage","text"],["stage_status","text"],["progress_pct","numeric"],["remarks","text"]]),
 entry("factory_report_task_workers",[["report_id","uuid"],["module_id","uuid"],["stage","text"],["worker_id","uuid"],["hours","numeric"]]),
 entry("factory_report_quantities",[["report_id","uuid"],["module_id","uuid"],["stage","text"],["boq_item_id","uuid"],["contractor_id","uuid"],["unit","text"],["today_qty","numeric"],["amount_inr","numeric"],["remarks","text"]]),
 entry("factory_report_expenses",[["report_id","uuid"],["module_id","uuid"],["kind","text"],["description","text"],["amount_inr","numeric"]]),
 entry("factory_report_photos",[["report_id","uuid"],["storage_path","text"]]),
 entry("factory_report_edit_log",[["report_id","uuid"],["work_date","date"],["field","text"],["old_value","jsonb"],["new_value","jsonb"],["reason","text"]]),
 entry("boq_work_location_log",[["boq_item_id","uuid"],["old_location","text"],["new_location","text"]]),
] as const;