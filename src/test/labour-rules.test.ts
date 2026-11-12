import { describe, expect, it } from "vitest";
import { attendanceWarningLabels, isValidLabourHours, requiresLabourAttendanceReason } from "@/lib/labour-rules";

const TODAY = new Date("2026-11-12T12:00:00");

describe("contract labour attendance rules", () => {
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

  it("keeps cross-project, over-twelve-hour, and deactivated-worker conditions as warnings", () => {
    expect(attendanceWarningLabels({ has_other_project: true, total_hours: 13, is_deactivated: true })).toEqual([
      "also recorded on another project this day",
      "daily total is 13 hours",
      "worker is deactivated",
    ]);
  });
});