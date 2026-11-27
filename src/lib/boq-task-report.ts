// Presentation only: every budget, earned, actual, variance and flag comes from the database (boq3_task_report).
export interface TaskReportUnit { unit_kind: string; unit_label: string; mapped: boolean; mapped_by: "link" | "name" | null; module_name: string | null; unmapped_reason: string | null; modules_found: string[]; budget: number; earned: number; actual: number; variance: number; overrun: boolean }
export interface TaskReportTask { unit_kind: string; unit_label: string; task_id: string; code: string | null; task_name: string | null; budget: number; earned: number; actual: number; variance: number; overrun: boolean; broken: boolean; links: number }
export interface TaskReportSiteLine { boq_item_id: string; sno: number; description: string; uom: string; budget: number; note: string }
export interface TaskReport {
  status: "ok";
  link_set_version: number;
  tasks: TaskReportTask[];
  units: TaskReportUnit[];
  site_lines: TaskReportSiteLine[];
  totals: { factory_budget: number; earned: number; actual: number; variance: number; site_budget: number; unmapped_units: number; overrun_links: number; broken_links: number };
}
export type TaskReportResult = TaskReport | { status: "no_locked_links" };
export const boqTaskReportQueryKey = (projectId: string) => ["boq3_task_report", projectId] as const;
export const isTaskReport = (r: TaskReportResult | null | undefined): r is TaskReport => !!r && r.status === "ok";
