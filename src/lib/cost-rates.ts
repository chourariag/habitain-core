import * as XLSX from "@/lib/safe-xlsx";

export const COST_RATE_COLUMNS = ["sno", "description", "unit", "work_location", "material_rate", "contractor", "rate_type", "rate", "lump_sum", "package_qty", "includes_material"] as const;
export const ALTREE_RATE_MESSAGE = "ALTREE labour is costed through attendance, not piece rates.";
export type CostSubcontract = { id?: string; contractor_id: string; contractor: string; rate_type: "per_unit" | "lump_sum"; rate: number | null; lump_sum: number | null; package_qty: number | null; includes_material: boolean; active: boolean; effective_rate?: number };
export type CostRateItem = { id: string; sno: number; description: string; unit: string; work_location: string; boq_rate: number; material_rate: number | null; missing_material_rate: boolean; subcontracts: CostSubcontract[] };
export type CostRates = { boq_id: string | null; items: CostRateItem[]; contractors: { id: string; name: string }[] };
export type CostUploadRow = Record<(typeof COST_RATE_COLUMNS)[number], string> & { excel_row: number };
export type CostDryRun = { boq_id: string | null; errors: { row: number | string; reason: string }[]; row_count: number };

export function subcontractRateProblem(contractor: string, unit: string, type: string, rate: number | null, lump: number | null, packageQty: number | null): string | null {
  if (contractor.trim().toUpperCase() === "ALTREE") return ALTREE_RATE_MESSAGE;
  if (type !== "per_unit" && type !== "lump_sum") return "Rate type must be per_unit or lump_sum";
  if ([rate, lump, packageQty].some(v => v != null && !Number.isFinite(v))) return "Rates must be finite numbers";
  if (type === "per_unit" && !(rate != null && rate > 0)) return "Per unit needs a rate greater than 0";
  if (type === "lump_sum" && !(lump != null && lump > 0 && packageQty != null && packageQty > 0)) return "Lump sum and package quantity must be greater than 0";
  if (type === "lump_sum" && unit.trim() === "%" && packageQty !== 100) return "Unit % requires package quantity 100";
  return null;
}

export function costRatesWorkbook(items: CostRateItem[]) {
  const rows = items.flatMap(item => {
    const subs: (CostSubcontract | undefined)[] = item.subcontracts.length ? item.subcontracts : [undefined];
    return subs.map(s => [item.sno, item.description, item.unit, item.work_location, item.material_rate ?? "", s?.contractor ?? "", s?.rate_type ?? "", s?.rate ?? "", s?.lump_sum ?? "", s?.package_qty ?? "", s?.includes_material ?? false]);
  });
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([[...COST_RATE_COLUMNS], ...rows]);
  sheet["!cols"] = COST_RATE_COLUMNS.map(c => ({ wch: c === "description" ? 50 : 20 }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Rates");
  return workbook;
}

export function readCostRatesWorkbook(workbook: XLSX.WorkBook): CostUploadRow[] {
  const sheet = workbook.Sheets["Rates"] ?? workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("No rates sheet found");
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  const header = rows[0]?.map(v => String(v).trim().toLowerCase()) ?? [];
  const missing = COST_RATE_COLUMNS.filter(c => !header.includes(c));
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
  return rows.slice(1).flatMap((row, index) => {
    if (row.every(v => String(v).trim() === "")) return [];
    const values = Object.fromEntries(COST_RATE_COLUMNS.map(c => [c, String(row[header.indexOf(c)] ?? "").trim()]));
    return [{ ...values, excel_row: index + 2 } as CostUploadRow];
  });
}

export const canConfirmCostUpload = (dryRun: CostDryRun | null, busy: boolean) => !busy && !!dryRun?.boq_id && dryRun.row_count > 0 && dryRun.errors.length === 0;