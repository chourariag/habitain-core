export { ROLE_LABELS } from "@/lib/roles";

export type UnitKind = "module" | "panel_set" | "site";

export interface ScheduleUnit {
  id: string;
  project_id: string;
  unit_kind: UnitKind;
  unit_label: string;
  day1: string | null;
  offset_note: string | null;
}

export interface ScheduleTask {
  id: string;
  project_id: string;
  task_id_in_schedule: string;
  task_name: string;
  phase: string;
  planned_start_date: string | null;
  planned_finish_date: string | null;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  duration_days: number | null;
  predecessor_ids: string[] | null;
  responsible_role: string | null;
  status: string;
  completion_percentage: number;
  display_order: number | null;
  library_task_id: string | null;
  start_day: number | null;
  unit_kind: UnitKind | null;
  unit_label: string | null;
  baseline_version: number | null;
  is_removed: boolean;
  removed_at: string | null;
  removed_by: string | null;
  removed_reason: string | null;
  work_category: "process" | "construction";
}

export interface LibraryActivity {
  id: string;
  code: string;
  name: string;
  phase: string;
  display_order: number;
}

export interface LibraryTask {
  id: string;
  activity_id: string;
  code: string;
  name: string;
  default_days: number;
  std_start_day: number | null;
  display_order: number;
}

export interface ScheduleHoliday {
  holiday_date: string;
  label: string;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string | null;
}

export interface ScheduleBaseline {
  id: string;
  project_id: string;
  version: number;
  kind: "baseline" | "revision";
  reason: string | null;
  published_by: string;
  published_at: string;
  snapshot: ScheduleSnapshotTask[];
}

export interface ScheduleSnapshotTask {
  id: string;
  task_id_in_schedule: string;
  task_name: string;
  duration_days: number | null;
  planned_start_date: string | null;
  planned_finish_date: string | null;
  predecessor_ids: string[] | null;
  phase: string;
  responsible_role: string | null;
  start_day: number | null;
  unit_kind: UnitKind | null;
  unit_label: string | null;
  is_removed: boolean;
  removed_reason: string | null;
}

export interface ScheduleComment {
  id: string;
  project_id: string;
  task_id: string;
  author_id: string;
  body: string;
  status: "open" | "seen" | "resolved";
  created_at: string;
  updated_at: string;
}

export type ProfileNameMap = Record<string, string>;

export function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const IST_PARTS = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Timestamps (published/created/revised) always shown in IST as DD/MM/YYYY HH:mm, whatever the device time zone. */
export function displayDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const part = (type: string) => IST_PARTS.formatToParts(date).find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

export interface MovedTask { code: string; name: string; old_start: string | null; old_finish: string | null; new_start: string | null; new_finish: string | null }
export interface NotMovedTask { code: string; name: string; reason: string }
export interface RevisionResult { task?: MovedTask; moved?: MovedTask[]; not_moved?: NotMovedTask[] }

export function unitLabel(kind: UnitKind | null) {
  if (kind === "panel_set") return "Panel set";
  if (kind === "site") return "Site";
  return "Module";
}

export interface SnapshotChange {
  taskId: string;
  code: string;
  name: string;
  kind: "added" | "removed" | "changed";
  changes: string[];
}

function snapshotValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "planned_start_date" || key === "planned_finish_date") return displayDate(String(value));
  if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
  return String(value);
}

/** Presentation-only snapshot comparison; it never calculates or changes a schedule. */
export function compareSnapshots(previous: ScheduleSnapshotTask[], current: ScheduleSnapshotTask[]): SnapshotChange[] {
  const before = new Map(previous.map((task) => [task.id, task]));
  const after = new Map(current.map((task) => [task.id, task]));
  const changes: SnapshotChange[] = [];
  for (const task of current) {
    const old = before.get(task.id);
    if (!old) {
      changes.push({ taskId: task.id, code: task.task_id_in_schedule, name: task.task_name, kind: "added", changes: ["Added in this version"] });
      continue;
    }
    if (!old.is_removed && task.is_removed) {
      changes.push({ taskId: task.id, code: task.task_id_in_schedule, name: task.task_name, kind: "removed", changes: [task.removed_reason || "Archived with a revision reason"] });
      continue;
    }
    const fields: Array<[keyof ScheduleSnapshotTask, string]> = [
      ["task_name", "Name"],
      ["start_day", "Start day"],
      ["duration_days", "Duration"],
      ["planned_start_date", "Start date"],
      ["planned_finish_date", "Finish date"],
      ["predecessor_ids", "Predecessors"],
      ["responsible_role", "Responsible role"],
      ["unit_label", "Unit"],
    ];
    const changed = fields.filter(([key]) => JSON.stringify(old[key] ?? null) !== JSON.stringify(task[key] ?? null))
      .map(([key, label]) => `${label}: ${snapshotValue(key, old[key])} → ${snapshotValue(key, task[key])}`);
    if (changed.length) changes.push({ taskId: task.id, code: task.task_id_in_schedule, name: task.task_name, kind: "changed", changes: changed });
  }
  for (const old of previous) {
    if (!after.has(old.id) && !old.is_removed) {
      changes.push({ taskId: old.id, code: old.task_id_in_schedule, name: old.task_name, kind: "removed", changes: ["No longer present in this snapshot"] });
    }
  }
  return changes;
}

/** Readable role name for display only (never a permission decision). */
export function roleName(role: string | null | undefined, labels: Record<string, string>) {
  if (!role) return "—";
  return labels[role] ?? role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

/** Library activities with no fixed day are shown to planners as "Unscheduled extras". */
export function isExtrasGroup(name: string | null | undefined) {
  const value = (name ?? "").trim().toLowerCase();
  return value === "other" || value.startsWith("extra works");
}

export function activityDisplayName(name: string | null | undefined) {
  if (!name) return "Other";
  return isExtrasGroup(name) ? "Unscheduled extras" : name;
}

/** Natural sort by task code so F00 comes before F01 and S07 before S08. */
export function compareCodes(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
