// BOQ-3b: optional unit split for a site BOQ quantity. The server (site_set_quantity_units) is authoritative;
// these helpers only shape the form and mirror its messages for immediate feedback.
export interface UnitRef { unit_kind: string; unit_label: string }
export interface SplitRow extends UnitRef { qty: number }
export interface AllocatedUnit extends UnitRef { qty: number }
export interface QuantityUnits {
  quantity_id: string; boq_item_id: string; contractor_id: string | null; today_qty: number; work_location: string;
  split: SplitRow[]; allocated: AllocatedUnit[]; split_total: number; unassigned: number; stale: boolean;
}
export const unitKey = (u: UnitRef) => `${u.unit_kind}\u0000${u.unit_label}`;

export const findQuantityUnits = (list: QuantityUnits[], boqItemId: string | null, contractorId: string | null) =>
  boqItemId ? list.find(q => q.boq_item_id === boqItemId && (q.contractor_id ?? null) === (contractorId ?? null)) : undefined;

/** Converts the typed boxes into the payload; blank boxes are left out. Returns an error message instead when invalid. */
export function buildSplit(allocated: AllocatedUnit[], inputs: Record<string, string>, quantity: number): { split: SplitRow[] } | { error: string } {
  const split: SplitRow[] = [];
  for (const a of allocated) {
    const raw = (inputs[unitKey(a)] ?? "").trim();
    if (!raw) continue;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty <= 0) return { error: `Quantity for unit ${a.unit_label} must be more than 0` };
    split.push({ unit_kind: a.unit_kind, unit_label: a.unit_label, qty });
  }
  const total = split.reduce((n, s) => n + s.qty, 0);
  if (total > quantity + 1e-9) return { error: `Unit split (${total}) is more than the quantity reported today (${quantity})` };
  return { split };
}

export const splitTotal = (split: SplitRow[]) => split.reduce((n, s) => n + Number(s.qty), 0);
/** The saved split no longer fits the quantity now typed in the report. */
export const splitMismatch = (split: SplitRow[], quantity: number) => split.length > 0 && splitTotal(split) > quantity + 1e-9;
