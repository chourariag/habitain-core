import { describe, expect, it } from "vitest";
import { attendanceWarningLabels, isValidLabourHours, LABOUR_ATTENDANCE_ROLES, LABOUR_DIRECTORY_VIEW_ROLES, LABOUR_MASTER_UPLOAD_ROLES, LABOUR_RATE_VIEW_ROLES, labourEditReasonForSave, parseLabourDateInput, requiresLabourAttendanceReason, requiresReasonForSavedAttendanceEdit } from "@/lib/labour-rules";

const TODAY = new Date("2026-11-12T12:00:00");

describe("contract labour attendance rules", () => {
  it("matches the explicitly requested attendance, upload, and rate-view roles", () => {
    expect([...LABOUR_ATTENDANCE_ROLES]).toEqual([
      "site_engineer", "site_installation_mgr", "head_of_projects", "planning_head", "managing_director", "super_admin",
    ]);
    expect([...LABOUR_MASTER_UPLOAD_ROLES]).toEqual(["planning_head", "managing_director", "super_admin", "head_of_projects"]);
    expect([...LABOUR_RATE_VIEW_ROLES]).toEqual([
      "site_engineer", "site_installation_mgr", "head_of_projects", "planning_head", "managing_director", "super_admin", "finance_manager",
    ]);
    expect([...LABOUR_DIRECTORY_VIEW_ROLES]).toEqual([
      "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "finance_manager",
      "production_head", "site_installation_mgr", "hr_executive", "head_operations", "factory_floor_supervisor",
      "fabrication_foreman", "site_engineer", "head_of_projects", "planning_head",
    ]);
  });

  it("allows hours from zero through sixteen and rejects values outside the range", () => {
    expect(isValidLabourHours(0)).toBe(true);
    expect(isValidLabourHours(16)).toBe(true);
    expect(isValidLabourHours(-0.5)).toBe(false);
    expect(isValidLabourHours(16.5)).toBe(false);
  });

  it("requires a reason only for work dates earlier than two days ago", () => {
    expect(requiresLabourAttendanceReason("2026-11-10", TODAY)).toBe(false);
    expect(requiresLabourAttendanceReason("2026-11-09", TODAY)).toBe(true);
  });

  it("requires a reason whenever saved attendance changes, including same-day edits", () => {
    expect(requiresReasonForSavedAttendanceEdit(8, 7)).toBe(true);
    expect(requiresReasonForSavedAttendanceEdit(8, 8)).toBe(false);
    expect(requiresReasonForSavedAttendanceEdit(null, 8)).toBe(false);
  });

  it("sends the user reason only when saved hours are actually changed", () => {
    expect(labourEditReasonForSave(8, 7, "Correction approved")).toBe("Correction approved");
    expect(labourEditReasonForSave(8, 8, "Routine entry")).toBe("");
    expect(labourEditReasonForSave(null, 8, "Initial entry")).toBe("");
  });

  it("parses strict DD/MM/YYYY dates and rejects impossible calendar dates", () => {
    expect(parseLabourDateInput("12/11/2026")).toBe("2026-11-12");
    expect(parseLabourDateInput("31/02/2026")).toBeNull();
    expect(parseLabourDateInput("2026-11-12")).toBeNull();
  });

  it("keeps cross-project, over-twelve-hour, and deactivated-worker conditions as warnings", () => {
    expect(attendanceWarningLabels({ has_other_project: true, total_hours: 13, is_deactivated: true })).toEqual([
      "also recorded on another project this day",
      "daily total is 13 hours",
      "worker is deactivated",
    ]);
  });
});