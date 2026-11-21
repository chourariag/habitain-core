import { TIER1_ROLES } from "@/lib/roles";
import { format, parseISO } from "date-fns";

export const RUNNING_BILL_ROLES = [...TIER1_ROLES, "super_admin", "finance_manager", "head_of_projects", "planning_head", "quantity_surveyor", "costing_engineer"] as const;
export const canViewRunningBill = (role: string | null | undefined) => !!role && (RUNNING_BILL_ROLES as readonly string[]).includes(role);

export type WorkRow = { sno: number | string | null; item_description: string | null; unit: string | null; boq_qty: number; qty: number; own_qty: number; sub_qty: number; factory_qty?:number; pct_done: number | null; boq_rate: number; billable_qty: number; excess_qty: number; excess_value: number; value: number };
export type DayRow = { work_date: string; workers: number; hours: number; amount: number; cumulative: number };
export type ConRow = { contractor: string; workers: number; hours: number; amount: number };
export type TaskRow = { code: string; task: string; task_hours: number; amount: number; allocation?: "Exact" | "Approximate" };
export type SubRow = { contractor: string; boq_code: string; item: string | null; unit: string | null; rate_type: string | null; qty: number; rate_used: number | null; amount: number; lump_sum: number | null; package_qty: number | null; pct_consumed: number | null; location?:string };
export type RunningBill = { as_of: string; reports: number; work: WorkRow[]; labour_by_day: DayRow[]; labour_by_contractor: ConRow[]; labour_by_task: TaskRow[]; factory_labour?:{module_id:string;module_code:string|null;name:string;hours:number;amount:number}[]; subcontract: SubRow[]; totals: { value_earned: number; excess_value: number; own_labour_cost: number; factory_labour_cost?:number; subcontract_accrued: number } };

export const approximateAllocationNote = "Approximate: that day's attendance cost is spread over the hours reported on tasks, because those reports pre-date worker selection.";
export const taskAllocationLabel = (row: TaskRow) => row.task === "Unallocated" && !row.code ? "-" : row.allocation ?? "Approximate";
export function cappedWorkValue(qty: number, boqQty: number | null, rate: number) {
  const billable_qty = boqQty != null && boqQty > 0 ? Math.min(qty, boqQty) : qty;
  const excess_qty = boqQty != null && boqQty > 0 ? Math.max(qty - boqQty, 0) : 0;
  return { billable_qty, excess_qty, value: Math.round(billable_qty * rate * 100) / 100, excess_value: Math.round(excess_qty * rate * 100) / 100 };
}

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
    "A Work done": [["BOQ code", "Description", "Unit", "BOQ qty", "Qty to date", "Billable qty", "Excess", "Own labour qty", "Subcontract qty", "Of which factory", "% done", "BOQ rate (INR)", "Value earned (INR)"],
      ...b.work.map((r) => [String(r.sno ?? ""), r.item_description ?? "", r.unit ?? "", n(r.boq_qty), n(r.qty), n(r.billable_qty), n(r.excess_qty), n(r.own_qty), n(r.sub_qty), n(r.factory_qty||0), n(r.pct_done), n(r.boq_rate), n(r.value)] as (string | number)[]),
      ["Total", "", "", "", "", "", "", "", "", "", "", "", t.value],
      ...(b.totals.excess_value > 0 ? [["Excess over BOQ (needs a variation) INR", b.totals.excess_value]] : [])],
    "B Own labour by day": [["Date", "Workers", "Hours", "Amount (INR)", "Cumulative (INR)"],
      ...b.labour_by_day.map((r) => [d(r.work_date), n(r.workers), n(r.hours), n(r.amount), n(r.cumulative)] as (string | number)[]), ["Total", "", "", t.labour, ""]],
    "B By contractor": [["Labour contractor", "Workers", "Hours", "Amount (INR)"], ...b.labour_by_contractor.map((r) => [r.contractor, n(r.workers), n(r.hours), n(r.amount)] as (string | number)[])],
    "B Approx by task": [["Cost by task", "", "", "", ""], ["Task code", "Task", "Task hours", "Amount (INR)", "Allocation"], ...b.labour_by_task.map((r) => [r.code, r.task, n(r.task_hours), n(r.amount), taskAllocationLabel(r)] as (string | number)[]), ...(b.labour_by_task.some(r => taskAllocationLabel(r) === "Approximate") ? [[approximateAllocationNote]] : [])],
    "C Subcontract": [["Contractor", "BOQ code", "Item / package", "Unit", "Rate type", "Qty to date", "Rate used (INR)", "Amount accrued (INR)", "Lump sum (INR)", "Package qty", "% consumed", "Location"],
      ...b.subcontract.map((r) => [r.contractor, r.boq_code, r.item ?? "", r.unit ?? "", r.rate_type === "lump_sum" ? "Lump Sum" : "Per Unit", n(r.qty), n(r.rate_used), n(r.amount), n(r.lump_sum), n(r.package_qty), n(r.pct_consumed),r.location||"Site"] as (string | number)[]),
      ["Total", "", "", "", "", "", "", t.sub, "", "", "", ""]],
    "B2 Factory labour": [["Module","Name","Hours","Labour cost INR"],...(b.factory_labour||[]).map(m=>[m.module_code||"",m.name,m.hours,m.amount]),["Total","","",b.totals.factory_labour_cost||0]],
    Totals: [["As of", d(b.as_of)], ["Value earned (A) INR", t.value], ["Own labour cost (B) INR", t.labour], ["Factory labour allocated (B2) INR", b.totals.factory_labour_cost||0], ["Subcontract cost accrued (C) INR", t.sub], ...(b.totals.excess_value > 0 ? [["Excess over BOQ (needs a variation) INR", b.totals.excess_value]] : [])],
  };
}
