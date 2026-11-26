import { describe, expect, it } from "vitest";
import { BOQ_WRITER_ROLES, canShowBoqEntry } from "@/lib/boq-writers";

describe("BOQ-1b writer controls", () => {
  it.each(["costing_engineer", "quantity_surveyor", "head_operations"])("shows %s controls when server project access passes", role => {
    expect(canShowBoqEntry(true, role, true)).toBe(true);
    expect(canShowBoqEntry(false, role, true)).toBe(false);
  });
  it("retains every existing BOQ-1 writer", () => {
    for (const role of ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "architecture_director", "project_architect", "principal_architect", "sales_director", "planning_head"]) expect(BOQ_WRITER_ROLES).toContain(role);
  });
  it("hides controls for non-writer View As roles", () => {
    expect(canShowBoqEntry(true, "site_engineer", true)).toBe(false);
    expect(canShowBoqEntry(true, "production_head", true)).toBe(false);
  });
  it("does not replace caller-bound multi-role server permission with a profile role", () => {
    expect(canShowBoqEntry(true, "site_engineer", false)).toBe(true);
    expect(canShowBoqEntry(false, "managing_director", false)).toBe(false);
  });
});