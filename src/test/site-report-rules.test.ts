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
  it("photos and site-clean are optional; a task or no-work reason remains required", () => {
    const ok = { elevations: [{ id: "a", name: "North" }, { id: "b", name: "South" }], photoElevationIds: ["a", "b"], siteClean: true, siteCleanPhoto: true, tasksWithProgress: 1, notes: "" };
    expect(submitBlockers(ok)).toEqual([]);
    expect(submitBlockers({ ...ok, photoElevationIds: [] })).toEqual([]);
    expect(submitBlockers({ ...ok, elevations: [], photoElevationIds: [], siteClean: false, siteCleanPhoto: false })).toEqual([]);
    expect(submitBlockers({ ...ok, siteCleanPhoto: false })).toEqual([]);
    expect(submitBlockers({ ...ok, tasksWithProgress: 0 })).toHaveLength(1);
    expect(submitBlockers({ ...ok, tasksWithProgress: 0, notes: "Rain all day" })).toEqual([]);
  });
  it("unconfirmed attendance hours still block submit", () => {
    expect(submitBlockers({ tasksWithProgress: 1, notes: "", unconfirmedWorkers: 2 })).toEqual(["Confirm hours for 2 workers in People."]);
  });
});

describe("site report rules — extended edge cases", () => {
  describe("allowedReportDates", () => {
    it("returns exactly 3 dates, newest first", () => {
      const result = allowedReportDates("2024-03-10");
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("2024-03-10");
      expect(result[1]).toBe("2024-03-09");
      expect(result[2]).toBe("2024-03-08");
    });
  });

  describe("parsePct", () => {
    it("blank string → null", () => expect(parsePct("")).toBeNull());
    it("-1 → null (below range)", () => expect(parsePct("-1")).toBeNull());
    it("101 → null (above range)", () => expect(parsePct("101")).toBeNull());
    it("55.5 → 55.5 (decimal accepted)", () => expect(parsePct("55.5")).toBe(55.5));
  });

  describe("labourBalance", () => {
    it("under: unallocated positive, over zero", () => {
      expect(labourBalance(8, [3])).toEqual({ allocated: 3, unallocated: 5, over: 0 });
    });
    it("equal: both unallocated and over are zero", () => {
      expect(labourBalance(8, [5, 3])).toEqual({ allocated: 8, unallocated: 0, over: 0 });
    });
    it("over: over positive, unallocated zero", () => {
      expect(labourBalance(8, [5, 5])).toEqual({ allocated: 10, unallocated: 0, over: 2 });
    });
  });

  describe("exceedsBoq", () => {
    it("boqQty 0 → false regardless of qty entered", () => {
      expect(exceedsBoq(0, 0, 999)).toBe(false);
    });
    it("cumulative + today exactly equals boqQty → false (not exceeded)", () => {
      expect(exceedsBoq(100, 60, 40)).toBe(false);
    });
    it("cumulative + today one more than boqQty → true", () => {
      expect(exceedsBoq(100, 60, 41)).toBe(true);
    });
  });

  describe("submitBlockers — each blocker in isolation", () => {
    const base = {
      elevationKinds: ["elevation_front", "elevation_rear", "elevation_left", "elevation_right"] as string[],
      siteClean: true,
      siteCleanPhoto: true,
      tasksWithProgress: 1,
      notes: "",
    };
    it("missing one elevation is the only blocker and names the direction", () => {
      const b = submitBlockers({ ...base, elevationKinds: base.elevationKinds.filter((k) => k !== "elevation_rear") });
      expect(b).toHaveLength(1);
      expect(b[0]).toContain("Rear");
    });
    it("siteClean false is the only blocker", () => {
      expect(submitBlockers({ ...base, siteClean: false })).toEqual(["Tick site clean"]);
    });
    it("siteCleanPhoto false is the only blocker", () => {
      expect(submitBlockers({ ...base, siteCleanPhoto: false })).toEqual(["Add the site clean photo"]);
    });
    it("no progress and notes too short is the only blocker", () => {
      const b = submitBlockers({ ...base, tasksWithProgress: 0, notes: "ok" });
      expect(b).toHaveLength(1);
      expect(b[0]).toContain("progress");
    });
  });
});
