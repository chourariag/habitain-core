import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export const SUPER_ADMIN_FEATURES = [
  "Dashboard","Projects","Factory Floor","Floor Map","Capacity Planning","Site Hub",
  "QC & NCR","Design Portal","Sales Pipeline","Finance — View","Finance — Edit",
  "Procurement","Inventory","HR & Attendance","Labour Register","Work Orders",
  "R&M","AMC","SOPs","Admin","Super Admin","Reports","Client Portal","Notifications",
];

export const SUPER_ADMIN_ROLES = [
  "managing_director","finance_director","sales_director","architecture_director",
  "head_operations","planning_engineer","production_head","site_installation_mgr",
  "factory_floor_supervisor","procurement","finance_manager","qc_inspector",
  "principal_architect","project_architect","structural_architect",
  "stores_executive","costing_engineer","site_engineer","electrical_installer",
  "elec_plumbing_installer","delivery_rm_lead","fabrication_foreman",
  "accounts_executive","quantity_surveyor","hr_executive","super_admin",
];

export async function logAudit(opts: {
  section: string; action: string; entity?: string;
  previous_value?: unknown; new_value?: unknown; summary?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("super_admin_audit_log" as never).insert({
    changed_by: user?.id ?? null,
    section: opts.section,
    action: opts.action,
    entity: opts.entity ?? null,
    previous_value: (opts.previous_value as never) ?? null,
    new_value: (opts.new_value as never) ?? null,
    summary: opts.summary ?? null,
  } as never);
}

export function downloadXlsx(rows: Record<string, unknown>[], filename: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export async function readXlsx(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}
