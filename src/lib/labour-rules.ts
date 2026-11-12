import { format, parseISO, subDays } from "date-fns";

export const LABOUR_ATTENDANCE_ROLES = [
  "site_engineer",
  "site_installation_mgr",
  "head_of_projects",
  "planning_head",
  "managing_director",
  "super_admin",
] as const;

export const LABOUR_MASTER_UPLOAD_ROLES = [
  "planning_head",
  "managing_director",
  "super_admin",
  "head_of_projects",
] as const;

export const LABOUR_RATE_VIEW_ROLES = [
  "site_engineer",
  "site_installation_mgr",
  "head_of_projects",
  "planning_head",
  "managing_director",
  "super_admin",
  "finance_manager",
] as const;

export const LABOUR_DIRECTORY_VIEW_ROLES = [
  "super_admin",
  "managing_director",
  "finance_director",
  "sales_director",
  "architecture_director",
  "finance_manager",
  "production_head",
  "site_installation_mgr",
  "hr_executive",
  "head_operations",
  "factory_floor_supervisor",
  "fabrication_foreman",
  "site_engineer",
  "head_of_projects",
  "planning_head",
] as const;

export function isValidLabourHours(hours: number): boolean {
  return Number.isFinite(hours) && hours >= 0 && hours <= 16;
}

export function requiresLabourAttendanceReason(workDate: string, today: Date): boolean {
  const todayISO = format(today, "yyyy-MM-dd");
  const oldestAllowedWithoutReason = format(subDays(parseISO(todayISO), 2), "yyyy-MM-dd");
  return workDate < oldestAllowedWithoutReason;
}

export function requiresReasonForSavedAttendanceEdit(savedHours: number | null, nextHours: number): boolean {
  return savedHours !== null && savedHours !== nextHours;
}

export function labourEditReasonForSave(
  savedHours: number | null,
  nextHours: number,
  reason: string,
): string {
  return requiresReasonForSavedAttendanceEdit(savedHours, nextHours) ? reason.trim() : "";
}

export function parseLabourDateInput(value: string): string | null {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function attendanceWarningLabels(warning: {
  has_other_project: boolean;
  total_hours: number;
  is_deactivated: boolean;
}): string[] {
  const labels: string[] = [];
  if (warning.has_other_project) labels.push("also recorded on another project this day");
  if (warning.total_hours > 12) labels.push(`daily total is ${warning.total_hours} hours`);
  if (warning.is_deactivated) labels.push("worker is deactivated");
  return labels;
}