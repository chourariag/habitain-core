export type HomeTaskGroup = "overdue" | "in_progress" | "next7" | "later";
export const GROUP_ORDER: HomeTaskGroup[] = ["overdue", "in_progress", "next7", "later"];
export const GROUP_LABEL: Record<HomeTaskGroup, string> = {
  overdue: "Overdue", in_progress: "In progress", next7: "Due in the next 7 days", later: "Later",
};

interface G { planned_start_date: string | null; planned_finish_date: string | null; actual_start_date: string | null; completion_percentage: number | null }

/** Display grouping only (dates come from the server). today = "yyyy-MM-dd". */
export function groupFor(t: G, today: string): HomeTaskGroup {
  if (t.planned_finish_date && t.planned_finish_date < today) return "overdue";
  if ((t.completion_percentage ?? 0) > 0 || t.actual_start_date) return "in_progress";
  const d = new Date(today + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 7);
  const limit = d.toISOString().slice(0, 10);
  if ((t.planned_start_date && t.planned_start_date <= limit) || (t.planned_finish_date && t.planned_finish_date <= limit)) return "next7";
  return "later";
}

export function ddmmyyyy(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}
