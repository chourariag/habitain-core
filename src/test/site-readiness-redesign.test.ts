import { describe, it, expect } from "vitest";
import evidence from "./site-readiness-redesign-evidence.json";
import {
  FOUNDATION_ITEMS, READINESS_TOTAL, craneComplete, effectiveStatus, foundationComplete, isOutOfTolerance, type CheckRow,
} from "@/lib/site-readiness-foundation";

const tol = { allowed_level_diff_mm: 5, allowed_diagonal_diff_mm: 10, allowed_spacing_dev_mm: 8 };
const item = (k: string) => FOUNDATION_ITEMS.find((i) => i.key === k)!;

describe("Foundation tolerance auto-flag", () => {
  it("level above allowed_level_diff_mm is Not ok, at the limit is Ok", () => {
    expect(effectiveStatus(item("B1"), "ok", 6, null, tol)).toBe("not_ok");
    expect(effectiveStatus(item("B1"), "ok", 5, null, tol)).toBe("ok");
  });
  it("diagonal and overall size use allowed_diagonal_diff_mm", () => {
    expect(isOutOfTolerance(item("A5"), 11, null, tol)).toBe(true);
    expect(isOutOfTolerance(item("A6"), 10, null, tol)).toBe(false);
  });
  it("spacing and anchor positions use allowed_spacing_dev_mm", () => {
    expect(isOutOfTolerance(item("A4"), 9, null, tol)).toBe(true);
    expect(isOutOfTolerance(item("C2"), 8, null, tol)).toBe(false);
  });
  it("pedestal count different from expected is Not ok", () => {
    expect(effectiveStatus(item("A3"), "ok", 11, "12", tol)).toBe("not_ok");
    expect(effectiveStatus(item("A3"), "ok", 12, "12", tol)).toBe("ok");
  });
});

describe("Readiness completeness", () => {
  it("counts 9 units: 3 Section 1 groups + Dry Run + 5 Logistics (Team Briefed and Safety Equipment removed)", () => {
    expect(READINESS_TOTAL).toBe(9);
  });
  it("Foundation needs tolerances, every item Ok/N/A, photos on * items, no Not ok", () => {
    const rows: Record<string, CheckRow> = {};
    for (const it of FOUNDATION_ITEMS) rows[it.key] = { item_key: it.key, status: "ok", value_numeric: null, value_text: null, comment: null, photo_paths: it.photo ? [{ path: "p" }] : [] };
    expect(foundationComplete(rows, null)).toBe(false);
    expect(foundationComplete(rows, tol)).toBe(true);
    expect(foundationComplete({ ...rows, A2: { ...rows.A2, photo_paths: [] } }, tol)).toBe(false);
    expect(foundationComplete({ ...rows, A2: { ...rows.A2, status: "na", photo_paths: [] } }, tol)).toBe(true);
    expect(foundationComplete({ ...rows, B3: { ...rows.B3, status: "not_ok" } }, tol)).toBe(false);
  });
  it("Crane booking needs vendor, contact, date, capacity, operator visit with date and cost", () => {
    const c = { vendor_name: "V", vendor_contact_phone: "9", booked_for_date: "2026-11-20", capacity_tonnes: "50", operator_site_visit_done: true, operator_visit_date: "2026-11-15" };
    expect(craneComplete(c, true)).toBe(true);
    expect(craneComplete(c, false)).toBe(false);
    expect(craneComplete({ ...c, operator_visit_date: "" }, true)).toBe(false);
  });
});

describe("Rolled-back SQL role checks (recorded evidence)", () => {
  it.each(["delivery_rm_lead", "site_engineer", "site_installation_mgr"])("%s can insert and update all four tables", (role) => {
    expect((evidence.write as Record<string, boolean>)[role]).toBe(true);
  });
  it.each(["stores_executive", "hr_executive"])("%s outside the group cannot write", (role) => {
    expect((evidence.write as Record<string, boolean>)[role]).toBe(false);
  });
  it("crane cost readable only by Tier 1, finance_manager, head_of_projects, planning_head and the person who entered it", () => {
    const rows = evidence.cost_rows as Record<string, number>;
    for (const r of ["managing_director", "finance_manager", "head_of_projects", "planning_head", "site_engineer(owner)"]) expect(rows[r]).toBe(1);
    for (const r of ["site_engineer(other)", "delivery_rm_lead", "site_installation_mgr", "stores_executive", "hr_executive"]) expect(rows[r]).toBe(0);
  });
  it("server enforces tolerance rules", () => {
    expect(evidence.rules.blocked_without_tolerance).toBe(true);
    expect(evidence.rules.over_tolerance_needs_comment).toBe(true);
    expect(evidence.rules.B1_7mm_vs_5mm).toBe("not_ok");
    expect(evidence.rules.A5_10mm_vs_10mm).toBe("ok");
  });
});
