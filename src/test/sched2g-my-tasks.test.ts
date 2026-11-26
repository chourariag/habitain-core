import { describe, it, expect } from "vitest";
import { responsibleRolesFor } from "@/lib/my-tasks-roles";
import { groupFor, ddmmyyyy } from "@/lib/my-tasks-groups";

describe("SCHED-2g role map", () => {
  it("factory roles see factory library tasks", () => {
    expect(responsibleRolesFor("production_head")).toEqual(expect.arrayContaining(["production_head", "factory_supervisor"]));
    expect(responsibleRolesFor("factory_supervisor")).toContain("factory_supervisor");
    expect(responsibleRolesFor("factory_floor_supervisor")).toEqual(expect.arrayContaining(["factory_supervisor", "factory_floor_supervisor"]));
    expect(responsibleRolesFor("fabrication_foreman")).toContain("factory_supervisor");
  });
  it("site roles see site tasks, not factory", () => {
    expect(responsibleRolesFor("site_installation_mgr")).toContain("site_installation_mgr");
    expect(responsibleRolesFor("site_engineer")).toEqual(expect.arrayContaining(["site_installation_mgr", "site_engineer"]));
    expect(responsibleRolesFor("site_installation_mgr")).not.toContain("factory_supervisor");
  });
  it("planning, tier1 and unmapped", () => {
    expect(responsibleRolesFor("planning_engineer")).toEqual(["planning_engineer"]);
    expect(responsibleRolesFor("managing_director")).toBe("all");
    expect(responsibleRolesFor("super_admin")).toBe("all");
    expect(responsibleRolesFor("hr_executive")).toBeNull();
  });
});

describe("SCHED-2g grouping", () => {
  const t = (s: string | null, f: string | null, pct = 0, a: string | null = null) => ({ planned_start_date: s, planned_finish_date: f, completion_percentage: pct, actual_start_date: a });
  it("groups by server dates", () => {
    expect(groupFor(t("2026-11-20", "2026-11-26"), "2026-11-27")).toBe("overdue");
    expect(groupFor(t("2026-11-20", "2026-12-30", 40), "2026-11-27")).toBe("in_progress");
    expect(groupFor(t("2026-12-04", "2026-12-10"), "2026-11-27")).toBe("next7");
    expect(groupFor(t("2026-12-05", "2026-12-10"), "2026-11-27")).toBe("later");
    expect(ddmmyyyy("2026-12-05")).toBe("05/12/2026");
  });
});
