// Presentation only: every split, share, budget, total and status comes from the database (boq2_get).
export type LinkLineStatus = "skipped" | "broken" | "not_started" | "split_incomplete" | "shares_incomplete" | "complete";
export interface UnitRef { unit_kind: string; unit_label: string }
export interface LinkAllocation extends UnitRef { quantity: number; unit_missing: boolean; share_total: number }
export interface TaskLink extends UnitRef { id: string; task_id: string; code: string | null; task_name: string | null; share_pct: number; budget: number; problem: string | null }
export interface LinkLine { id: string; sno: number; description: string; unit: string; qty: number; rate: number; value: number; linked: number; allocated: number; status: LinkLineStatus; legacy_task_hint: string | null; allocations: LinkAllocation[]; links: TaskLink[] }
export interface LinkTask extends UnitRef { id: string; code: string; task_name: string; library_task_id: string | null }
export interface LinkState {
  boq: { id: string; entry_mode: string; status: string; version_number: number } | null;
  blocked_reason: string | null;
  set: { id?: string; status: "draft" | "locked"; version: number; locked_at?: string | null; locked_by_name?: string | null };
  totals: { boq_total: number; linked: number; unlinked: number; lines_needed: number; lines_complete: number; lines_broken: number; lines_skipped: number };
  lines: LinkLine[];
  broken: { sno: number; description: string; unit_kind: string; unit_label: string; code: string | null; reason: string }[];
  task_budgets: (UnitRef & { task_id: string; code: string; task_name: string; budget: number; lines: number })[];
  unit_budgets: (UnitRef & { budget: number })[];
  units: UnitRef[];
  tasks: LinkTask[];
  audit: { id: string; action: string; reason: string | null; created_at: string; actor: string; boq_item_id: string | null }[];
  can_write: boolean; can_lock: boolean; lock_reason: string | null; revision_needed: boolean;
}
export const LINK_STATUS_LABEL: Record<LinkLineStatus, string> = {
  skipped: "Zero quantity · skipped", broken: "Broken link", not_started: "Not started",
  split_incomplete: "Quantity split incomplete", shares_incomplete: "Shares incomplete", complete: "Complete",
};
export const LINK_ACTION_LABEL: Record<string, string> = {
  split: "Quantity split saved", shares: "Task shares saved", lock: "Links locked", revision: "Revision saved",
  revision_split: "Revision · quantity split", revision_shares: "Revision · task shares",
};
export function boqLockedLinkNotice(state: Pick<LinkState, "set" | "revision_needed" | "lines">): string | null {
  if (state.set.status !== "locked") return null;
  if (!state.revision_needed) return "Links are already locked.";
  const count = state.lines.filter(line => line.status !== "complete" && line.status !== "skipped").length;
  return `Revision needed: ${count} line(s) have broken or incomplete links. Open each line below, fix it, then Submit revision.`;
}
export type LinkFilter = "all" | "needs_work" | "broken";
export function filterLinkLines(lines: LinkLine[], filter: LinkFilter): LinkLine[] {
  if (filter === "broken") return lines.filter(l => l.status === "broken");
  if (filter === "needs_work") return lines.filter(l => l.status !== "complete" && l.status !== "skipped");
  return lines;
}
export const unitKey = (u: UnitRef) => `${u.unit_kind}\u0000${u.unit_label}`;
export const unitName = (u: UnitRef) => `${u.unit_kind === "module" ? "Module" : u.unit_kind === "panel_set" ? "Panel set" : u.unit_kind === "site" ? "Site" : u.unit_kind} ${u.unit_label}`;
export const linkQty = (v: number | null | undefined) => v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: 4 });
