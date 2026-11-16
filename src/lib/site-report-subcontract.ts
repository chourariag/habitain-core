// Daily Report subcontract rules shared by the UI and its unit tests.
// The database (save_site_report_draft / submit_site_report) stays authoritative.

export const NO_RATE_MSG = "No rate for this contractor on this item. Ask Planning to add it in Setup.";

export type SubRate = {
  id: string;
  contractor_id: string;
  boq_item_id: string | null;
  work_description: string | null;
  unit: string;
  rate_type: "per_unit" | "lump_sum";
  effective_rate: number;
  package_qty: number | null;
  lump_sum_inr: number | null;
  used_qty: number;
};

export type QtyRow = {
  key: string;
  boq_item_id: string | null;
  contractor_id: string | null;
  extra_work_description: string;
  unit: string;
  today_qty: string;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const qtyOf = (r: QtyRow) => Math.max(Number(r.today_qty) || 0, 0);

/** Effective rate: rate per unit, or lump sum ÷ package quantity. */
export function effectiveRate(rate: { rate_type: string; rate_inr?: number | null; lump_sum_inr?: number | null; package_qty?: number | null }) {
  if (rate.rate_type === "per_unit") return Number(rate.rate_inr) || 0;
  const pkg = Number(rate.package_qty) || 0;
  return pkg > 0 ? (Number(rate.lump_sum_inr) || 0) / pkg : 0;
}

export function findRate(row: Pick<QtyRow, "boq_item_id" | "contractor_id" | "extra_work_description">, rates: SubRate[]) {
  if (!row.contractor_id) return undefined;
  return rates.find((r) => r.contractor_id === row.contractor_id &&
    (row.boq_item_id ? r.boq_item_id === row.boq_item_id : !r.boq_item_id && norm(r.work_description) === norm(row.extra_work_description)));
}

/** ₹ accrued for a subcontract row; null for own labour. */
export function rowAmount(row: QtyRow, rates: SubRate[]) {
  const rate = findRate(row, rates);
  if (!row.contractor_id || !rate) return null;
  return Math.round(qtyOf(row) * Number(rate.effective_rate) * 100) / 100;
}

/** True when cumulative quantity on a lump-sum package would pass its package quantity. */
export function lumpSumOver(row: QtyRow, rates: SubRate[]) {
  const rate = findRate(row, rates);
  if (!rate || rate.rate_type !== "lump_sum") return false;
  return Number(rate.used_qty) + qtyOf(row) > Number(rate.package_qty);
}

export function rowProblem(row: QtyRow, rates: SubRate[]): string | null {
  if (!row.contractor_id || qtyOf(row) === 0) return null;
  if (!findRate(row, rates)) return NO_RATE_MSG;
  if (lumpSumOver(row, rates)) return "This would take the lump-sum package past its total.";
  return null;
}

/** Rows with a blocking problem are saved with 0 so the draft still saves; submit stays blocked in the UI and the database. */
export function quantityPayload(rows: QtyRow[], rates: SubRate[]) {
  return rows
    .filter((r) => r.boq_item_id || (r.extra_work_description.trim() && (r.contractor_id || r.unit.trim() || qtyOf(r) === 0)))
    .map((r) => ({
      boq_item_id: r.boq_item_id,
      contractor_id: r.contractor_id,
      extra_work_description: r.boq_item_id ? null : r.extra_work_description.trim(),
      unit: r.boq_item_id ? null : r.unit.trim() || null,
      today_qty: rowProblem(r, rates) ? 0 : qtyOf(r),
    }));
}

export function contractorsMissingHeadcount(rows: QtyRow[], headcount: Record<string, string>) {
  const ids = new Set(rows.filter((r) => r.contractor_id && qtyOf(r) > 0).map((r) => r.contractor_id as string));
  return [...ids].filter((id) => !(Number(headcount[id]) > 0));
}
