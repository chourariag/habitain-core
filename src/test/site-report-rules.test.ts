import { describe, it, expect } from "vitest";
import { allowedReportDates, isAllowedReportDate, labourBalance, exceedsBoq, submitBlockers, parsePct } from "@/lib/site-report-rules";

describe("site report rules", () => {
  it("allows only the last 3 days and no future dates", () => {
    expect(allowedReportDates("2026-11-13")).toEqual(["2026-11-13", "2026-11-12", "2026-11-11"]);
    expect(isAllowedReportDate("2026-11-10", "2026-11-13")).toBe(false);
    expect(isAllowedReportDate("2026-11-14", "2026-11-13")).toBe(false);
  });
  it("progress must be 0-100", () => {
    expect(parsePct("101")).toBeNull();
    expect(parsePct("100")).toBe(100);
  });
  it("labour shows unallocated and over-allocated hours", () => {
    expect(labourBalance(16, [10])).toEqual({ allocated: 10, unallocated: 6, over: 0 });
    expect(labourBalance(16, [10, 9])).toEqual({ allocated: 19, unallocated: 0, over: 3 });
  });
  it("warns when cumulative exceeds BOQ qty", () => {
    expect(exceedsBoq(100, 95, 6)).toBe(true);
    expect(exceedsBoq(100, 95, 5)).toBe(false);
  });
  it("submit needs 4 elevations, site clean tick+photo, and progress or a notes reason", () => {
    const ok = { elevations: [{ id: "a", name: "North" }, { id: "b", name: "South" }], photoElevationIds: ["a", "b"], siteClean: true, siteCleanPhoto: true, tasksWithProgress: 1, notes: "" };
    expect(submitBlockers(ok)).toEqual([]);
    expect(submitBlockers({ ...ok, photoElevationIds: ["a"] })).toEqual(["Elevation photos missing: South"]);
    expect(submitBlockers({ ...ok, elevations: [], photoElevationIds: [] })).toEqual(["No elevations defined for this project"]);
    expect(submitBlockers({ ...ok, siteCleanPhoto: false })).toHaveLength(1);
    expect(submitBlockers({ ...ok, tasksWithProgress: 0 })).toHaveLength(1);
    expect(submitBlockers({ ...ok, tasksWithProgress: 0, notes: "Rain all day" })).toEqual([]);
  });
});
