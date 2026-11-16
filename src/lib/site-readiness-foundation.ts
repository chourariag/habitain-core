/** Site Readiness — Foundation items, tolerance auto-flag and completeness rules. Mirrors site_readiness_validate_check(). */
export type CheckStatus = "ok" | "not_ok" | "na";
export type ToleranceKind = "level" | "diagonal" | "spacing";
export type ValueKind = "none" | "text" | "numeric_mm" | "numeric_m" | "count_vs_expected";

export interface FoundationItem {
  key: string; label: string; photo: boolean; value: ValueKind; valueLabel?: string; tolerance?: ToleranceKind;
}
export interface FoundationGroup { key: string; title: string; items: FoundationItem[] }

export const FOUNDATION_GROUPS: FoundationGroup[] = [
  { key: "A", title: "A. Setting out and geometry", items: [
    { key: "A1", label: "Latest GFC foundation drawing and revision used for the check", photo: false, value: "text", valueLabel: "Drawing no. and revision" },
    { key: "A2", label: "Centre lines and axes marked and verified against the drawing", photo: true, value: "none" },
    { key: "A3", label: "Pedestal count matches the drawing", photo: true, value: "count_vs_expected" },
    { key: "A4", label: "Spacing between pedestals checked in both directions against module support points", photo: false, value: "numeric_mm", valueLabel: "Largest deviation (mm)", tolerance: "spacing" },
    { key: "A5", label: "Both diagonals of each module footprint measured", photo: true, value: "numeric_mm", valueLabel: "Largest difference (mm)", tolerance: "diagonal" },
    { key: "A6", label: "Overall length and width against the drawing", photo: false, value: "numeric_mm", valueLabel: "Largest deviation (mm)", tolerance: "diagonal" },
    { key: "A7", label: "Module numbers and corner or edge lines marked on the foundation for the crane and rigging crew", photo: true, value: "none" },
    { key: "A8", label: "Entry side and orientation marked as per the drawing and install sequence", photo: false, value: "none" },
  ]},
  { key: "B", title: "B. Levels", items: [
    { key: "B1", label: "Pedestal top levels checked", photo: true, value: "numeric_mm", valueLabel: "Largest difference between any two pedestals (mm)", tolerance: "level" },
    { key: "B2", label: "Benchmark or datum fixed, protected and recorded", photo: false, value: "text", valueLabel: "RL" },
    { key: "B3", label: "Pedestal height above ground matches the drawing, giving the clearance needed below the module", photo: false, value: "none" },
  ]},
  { key: "C", title: "C. Pedestals, anchors and module interface", items: [
    { key: "C1", label: "Base plates and embed plates: size, position, orientation correct, firmly fixed, clean, no rust, no movement", photo: true, value: "none" },
    { key: "C2", label: "Anchor bolts and holdfasts: positions, projection and threads match the module base frame", photo: false, value: "numeric_mm", valueLabel: "Largest position deviation (mm)", tolerance: "spacing" },
    { key: "C3", label: "Levelling packers and shim plates on site in the required thicknesses and quantity", photo: false, value: "text", valueLabel: "Quantity" },
    { key: "C4", label: "Bitumen paint applied to pedestals and foundation, dry before delivery", photo: true, value: "none" },
    { key: "C5", label: "Grout or epoxy material on site if the drawing specifies it", photo: false, value: "none" },
  ]},
  { key: "D", title: "D. Condition of the foundation", items: [
    { key: "D1", label: "Concrete curing completed and cube test report available", photo: false, value: "text", valueLabel: "Curing days or report ref" },
    { key: "D2", label: "No cracks, honeycombing, spalling or exposed reinforcement at the pedestals", photo: true, value: "none" },
    { key: "D3", label: "DPC, waterproofing and anti-termite treatment done where specified", photo: false, value: "none" },
    { key: "D4", label: "Services stubs and sleeves (plumbing and electrical) positioned as per the drawing, capped and protected", photo: false, value: "none" },
  ]},
  { key: "E", title: "E. Surroundings at delivery", items: [
    { key: "E1", label: "Working clearance around the foundation for the crane and rigging, with no walls, columns, trees or stacked material in the way", photo: true, value: "numeric_m", valueLabel: "Smallest clear distance (m)" },
    { key: "E2", label: "Ground around the foundation, crane standing position and trailer path compacted, firm and level, no fresh backfill that can sink under outriggers or wheels", photo: false, value: "none" },
    { key: "E3", label: "Open trenches, pits and sumps near the foundation are filled, covered or barricaded", photo: false, value: "none" },
    { key: "E4", label: "No standing water, and the ground slopes away from the foundation", photo: false, value: "none" },
    { key: "E5", label: "No overhead lines, cables or obstructions in the lift path from the crane position to the foundation", photo: true, value: "none" },
  ]},
];

export const FOUNDATION_ITEMS = FOUNDATION_GROUPS.flatMap((g) => g.items);
export const FOUNDATION_SECTION_COMMENT_KEY = "FOUNDATION_COMMENTS";

export interface Tolerances { allowed_level_diff_mm: number; allowed_diagonal_diff_mm: number; allowed_spacing_dev_mm: number }
export interface CheckRow {
  item_key: string; status: CheckStatus; value_numeric: number | null; value_text: string | null;
  comment: string | null; photo_paths: unknown[]; checked_at?: string | null;
}

export function toleranceLimit(kind: ToleranceKind, t: Tolerances): number {
  return kind === "level" ? Number(t.allowed_level_diff_mm) : kind === "diagonal" ? Number(t.allowed_diagonal_diff_mm) : Number(t.allowed_spacing_dev_mm);
}

/** True when a measured value breaks its tolerance (or the pedestal count differs from expected). */
export function isOutOfTolerance(item: FoundationItem, valueNumeric: number | null, valueText: string | null, t: Tolerances | null): boolean {
  if (valueNumeric == null || Number.isNaN(valueNumeric)) return false;
  if (item.value === "count_vs_expected") {
    const exp = valueText != null && /^\s*\d+(\.\d+)?\s*$/.test(valueText) ? Number(valueText) : null;
    return exp != null && exp !== valueNumeric;
  }
  if (!item.tolerance || !t) return false;
  return Math.abs(valueNumeric) > toleranceLimit(item.tolerance, t);
}

/** Status after the auto-flag: an out-of-tolerance value is always Not ok. */
export function effectiveStatus(item: FoundationItem, status: CheckStatus, valueNumeric: number | null, valueText: string | null, t: Tolerances | null): CheckStatus {
  return isOutOfTolerance(item, valueNumeric, valueText, t) ? "not_ok" : status;
}

export function itemComplete(item: FoundationItem, row: CheckRow | undefined): boolean {
  if (!row) return false;
  if (row.status === "not_ok") return false;
  if (row.status === "na") return true;
  return !item.photo || (row.photo_paths?.length ?? 0) > 0;
}

export function foundationComplete(rows: Record<string, CheckRow>, t: Tolerances | null): boolean {
  if (!t) return false;
  return FOUNDATION_ITEMS.every((it) => itemComplete(it, rows[it.key]));
}

export interface CraneState {
  vendor_name: string; vendor_contact_phone: string; booked_for_date: string; capacity_tonnes: string;
  operator_site_visit_done: boolean; operator_visit_date: string;
}
export interface CraneCostState { rate_inr: string; total_cost_inr: string }

export function craneComplete(c: CraneState | null, cost: CraneCostState | null): boolean {
  if (!c) return false;
  const filled = (v: string | null | undefined) => !!v && String(v).trim() !== "";
  return filled(c.vendor_name) && filled(c.vendor_contact_phone) && filled(c.booked_for_date) && Number(c.capacity_tonnes) > 0
    && c.operator_site_visit_done && filled(c.operator_visit_date)
    && !!cost && (filled(cost.rate_inr) || filled(cost.total_cost_inr));
}

/** Section 1 (3 groups) + Section 2 (1) + Section 3 (5) = 9 units. */
export const READINESS_TOTAL = 9;

export function daysAgo(iso: string, now = new Date()): number {
  const d = new Date(iso); return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}
