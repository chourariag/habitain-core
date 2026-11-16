import { TIER1_ROLES } from "@/lib/roles";
import { format, parseISO } from "date-fns";

export const RUNNING_BILL_ROLES = [...TIER1_ROLES, "super_admin", "finance_manager", "head_of_projects", "planning_head", "quantity_surveyor", "costing_engineer"] as const;
export const canViewRunningBill = (role: string | null | undefined) => !!role && (RUNNING_BILL_ROLES as readonly string[]).includes(role);

export type WorkRow = { sno: number | string | null; item_description: string | null; unit: string | null; boq_qty: number; qty: number; own_qty: number; sub_qty: number; pct_done: number | null; boq_rate: number; value: number };
export type DayRow = { work_date: string; workers: number; hours: number; amount: number; cumulative: number };
export type ConRow = { contractor: string; workers: number; hours: number; amount: number };
export type TaskRow = { code: string; task: string; task_hours: number; amount: number };
export type SubRow = { contractor: string; boq_code: string; item: string | null; unit: string | null; rate_type: string | null; qty: number; rate_used: number | null; amount: number; lump_sum: number | null; package_qty: number | null; pct_consumed: number | null };
export type RunningBill = { as_of: string; reports: number; work: WorkRow[]; labour_by_day: DayRow[]; labour_by_contractor: ConRow[]; labour_by_task: TaskRow[]; subcontract: SubRow[]; totals: { value_earned: number; own_labour_cost: number; subcontract_accrued: number } };

const sum = <T,>(rows: T[], f: (r: T) => number) => Math.round(rows.reduce((s, r) => s + Number(f(r) || 0), 0) * 100) / 100;
export const totalsOf = (b: RunningBill) => ({
  value: sum(b.work, (r) => r.value),
  labour: sum(b.labour_by_day, (r) => r.amount),
  sub: sum(b.subcontract, (r) => r.amount),
});
const d = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const n = (v: unknown) => (v == null || v === "" ? "" : Number(v));

/** One sheet per section; dates DD/MM/YYYY, amounts as plain numbers. */
export function runningBillSheets(b: RunningBill): Record<string, (string | number)[][]> {
  const t = totalsOf(b);
  return {
    "A Work done": [["BOQ code", "Description", "Unit", "BOQ qty", "Qty to date", "Own labour qty", "Subcontract qty", "% done", "BOQ rate (INR)", "Value earned (INR)"],
      ...b.work.map((r) => [String(r.sno ?? ""), r.item_description ?? "", r.unit ?? "", n(r.boq_qty), n(r.qty), n(r.own_qty), n(r.sub_qty), n(r.pct_done), n(r.boq_rate), n(r.value)] as (string | number)[]),
      ["Total", "", "", "", "", "", "", "", "", t.value]],
    "B Own labour by day": [["Date", "Workers", "Hours", "Amount (INR)", "Cumulative (INR)"],
      ...b.labour_by_day.map((r) => [d(r.work_date), n(r.workers), n(r.hours), n(r.amount), n(r.cumulative)] as (string | number)[]), ["Total", "", "", t.labour, ""]],
    "B By contractor": [["Labour contractor", "Workers", "Hours", "Amount (INR)"], ...b.labour_by_contractor.map((r) => [r.contractor, n(r.workers), n(r.hours), n(r.amount)] as (string | number)[])],
    "B Approx by task": [["Approximate cost by task", "", "", ""], ["Task code", "Task", "Task hours", "Approx amount (INR)"], ...b.labour_by_task.map((r) => [r.code, r.task, n(r.task_hours), n(r.amount)] as (string | number)[])],
    "C Subcontract": [["Contractor", "BOQ code", "Item / package", "Unit", "Rate type", "Qty to date", "Rate used (INR)", "Amount accrued (INR)", "Lump sum (INR)", "Package qty", "% consumed"],
      ...b.subcontract.map((r) => [r.contractor, r.boq_code, r.item ?? "", r.unit ?? "", r.rate_type === "lump_sum" ? "Lump Sum" : "Per Unit", n(r.qty), n(r.rate_used), n(r.amount), n(r.lump_sum), n(r.package_qty), n(r.pct_consumed)] as (string | number)[]),
      ["Total", "", "", "", "", "", "", t.sub, "", "", ""]],
    Totals: [["As of", d(b.as_of)], ["Value earned (A) INR", t.value], ["Own labour cost (B) INR", t.labour], ["Subcontract cost accrued (C) INR", t.sub]],
  };
}
