import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

export type CostParts = { own_labour: number; factory_labour: number; subcontract: number; material: number; consumables: number; expenses: number; consumables_expenses: number; total: number };
export type CostDay = CostParts & { work_date: string; cumulative: number };
export type CostWorker = { worker_id: string; name: string; hours: number; allocation: "Exact" | "Approximate"; amount?: number };
export type CostGroup = { location: "Site" | "Factory"; group_id: string | null; code: string; name: string; hours: number; labour_cost: number; allocation: "Exact" | "Approximate"; subcontract: number; material: number; consumables: number; expenses: number; consumables_expenses: number; total: number; workers: CostWorker[] };
export type CostReport = {
  project_id: string; from: string; to: string; can_view_person_cost: boolean;
  days: CostDay[]; groups: CostGroup[];
  totals: CostParts & { value_earned: number; value_earned_period: number; value_earned_cumulative: number; excess_value: number; value_minus_cost: number };
  material_status: { missing_count: number; missing_boq_value: number; not_captured_count: number; correction_count: number; correction_difference: number; site_correction_count: number; site_correction_difference: number; factory_correction_count: number; factory_correction_difference: number };
  factory_unallocated?: { hours: number | null; cost: number | null };
};

export const costMoney = (value: number | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value ?? 0));
export const costNumber = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(value);
export const costDate = (value: string) => format(parseISO(value), "dd/MM/yyyy");
export function costMonthToDate(now = new Date()) {
  const to = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return { from: `${to.slice(0, 7)}-01`, to };
}

/** Local, user-requested workbook only; the nightly export manifest is unchanged. */
export function costReportSheets(report: CostReport): Record<string, (string | number)[][]> {
  const groupRows = (location: CostGroup["location"]) => [[location === "Site" ? "Task code" : "Module code", "Name", "Hours", "Labour INR", "Allocation", "Subcontract INR", "Material frozen INR", "Consumables INR", "Expenses INR", "Total INR"],
    ...report.groups.filter(g => g.location === location).map(g => [g.code, g.name, g.hours, g.labour_cost, g.allocation, g.subcontract, g.material, g.consumables, g.expenses, g.total])];
  const sheets: Record<string, (string | number)[][]> = {
    "Day by day": [["Date", "Own labour site INR", "Factory labour INR", "Subcontract INR", "Material frozen INR", "Consumables INR", "Expenses INR", "Total INR", "Cumulative INR"], ...report.days.map(d => [costDate(d.work_date), d.own_labour, d.factory_labour, d.subcontract, d.material, d.consumables, d.expenses, d.total, d.cumulative])],
    "Site tasks": groupRows("Site"), "Factory modules": groupRows("Factory"),
    "Who worked": [["Location", "Code", "Task or module", "Worker", "Hours", "Allocation", ...(report.can_view_person_cost ? ["Worker amount INR"] : [])], ...report.groups.flatMap(g => g.workers.map(w => [g.location, g.code, g.name, w.name, w.hours, w.allocation, ...(report.can_view_person_cost ? [w.amount ?? ""] : [])]))],
    "Summary": [["From", costDate(report.from)], ["To", costDate(report.to)], ["Indicative: same period, excludes overheads and unrated material"], ["Total cost INR", report.totals.total], ["Value earned for period INR", report.totals.value_earned_period], [`Cumulative value earned to ${costDate(report.to)} INR`, report.totals.value_earned_cumulative], ["Value earned minus cost INR", report.totals.value_minus_cost], ["Excess over BOQ INR", report.totals.excess_value], ["No material rate rows", report.material_status.missing_count], ["No material rate value at BOQ INR", report.material_status.missing_boq_value], ["Material not captured rows", report.material_status.not_captured_count], ["Site corrected rows", report.material_status.site_correction_count], ["Site correction difference INR", report.material_status.site_correction_difference], ["Factory corrected rows", report.material_status.factory_correction_count], ["Factory correction difference INR", report.material_status.factory_correction_difference], ...(report.factory_unallocated ? [["Factory-level unallocated INR (not charged to project)", report.factory_unallocated.cost ?? 0]] : [])],
  };
  return sheets;
}
export function costReportWorkbook(report: CostReport) {
  const book = XLSX.utils.book_new();
  Object.entries(costReportSheets(report)).forEach(([name, rows]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = rows[0].map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  });
  return book;
}