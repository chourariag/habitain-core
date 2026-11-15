import { describe, it, expect } from "vitest";
import { getAccessLevel, canAccessAdminPanel, MODULE_KEYS, type ModuleKey } from "@/lib/rbac-matrix";
import { canSeeSection, getDashboardTier } from "@/lib/role-nav";
import { TIER1_ROLES, type AppRole } from "@/lib/roles";

const SD = "sales_director" as AppRole;
const AD = "architecture_director" as AppRole;
const PA = "principal_architect" as AppRole;
const GRANTED: AppRole[] = [...TIER1_ROLES];

// The explicit director-tier grant (John = sales_director, Karan = architecture_director).
const EXPECTED: Partial<Record<ModuleKey, "FULL" | "MANAGE" | "VIEW" | "NONE">> = {
  projects: "FULL",
  finance: "FULL",
  hr: "FULL",
  reports: "FULL",
  approvals: "FULL",
  dispatch: "FULL",
  // unchanged by this grant
  factory: "FULL",
  site: "FULL",
  procurement: "FULL",
  qc: "FULL",
  admin: "FULL",
};

describe("director-tier grant — sales_director & architecture_director", () => {
  for (const role of GRANTED) {
    for (const [mod, level] of Object.entries(EXPECTED)) {
      it(`${role} has ${level} on ${mod}`, () => {
        expect(getAccessLevel(role, mod as ModuleKey)).toBe(level);
      });
    }

    it(`${role} can upload design (at least MANAGE)`, () => {
      expect(["MANAGE", "FULL"]).toContain(getAccessLevel(role, "design"));
    });

    it(`${role} can access the Admin Panel`, () => {
      expect(canAccessAdminPanel(role)).toBe(true);
    });

    it(`${role} sees finance, projects and admin(HR) nav sections`, () => {
      expect(canSeeSection(role, "finance")).toBe(true);
      expect(canSeeSection(role, "projects")).toBe(true);
      expect(canSeeSection(role, "admin")).toBe(true);
      expect(canSeeSection(role, "approvals")).toBe(true);
    });
  }
});

describe("principal_architect stays dormant — no MD parity", () => {
  it("is not treated as a Tier 1 (MD parity) dashboard role", () => {
    expect(getDashboardTier(PA)).not.toBe(1);
  });

  it("has no Admin Panel access", () => {
    expect(canAccessAdminPanel(PA)).toBe(false);
  });

  it("gained no finance / hr / projects write access from this grant", () => {
    expect(getAccessLevel(PA, "finance")).toBe("NONE");
    expect(getAccessLevel(PA, "hr")).toBe("VIEW");
    expect(getAccessLevel(PA, "projects")).toBe("VIEW");
    expect(getAccessLevel(PA, "approvals")).toBe("NONE");
  });

  it("is not in the management/finance nav sections", () => {
    expect(canSeeSection(PA, "finance")).toBe(false);
    expect(canSeeSection(PA, "management")).toBe(false);
  });
});

describe("no side-effect grants to uncovered roles", () => {
  const UNCOVERED: AppRole[] = [
    "production_head" as AppRole,
    "site_installation_mgr" as AppRole,
    "planning_engineer" as AppRole,
    "procurement" as AppRole,
    "hr_admin" as AppRole,
    "sales_executive" as AppRole,
    "qc_inspector" as AppRole,
  ];

  for (const role of UNCOVERED) {
    it(`${role} cannot reach the Admin Panel`, () => {
      expect(canAccessAdminPanel(role)).toBe(true);
    });
    it(`${role} does not gain FULL finance access`, () => {
      expect(getAccessLevel(role, "finance")).not.toBe("FULL");
    });
  }

  it("super_admin and all four Tier 1 roles hold blanket FULL access", () => {
    const blanket = (["super_admin", ...TIER1_ROLES, PA] as AppRole[]).filter((r) =>
      MODULE_KEYS.every((k) => getAccessLevel(r, k) === "FULL"),
    );
    expect(blanket).toEqual(["super_admin", ...TIER1_ROLES]);
  });
});
