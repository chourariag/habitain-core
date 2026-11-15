import { describe, expect, it } from "vitest";
import { TIER1_ROLES, isTier1, expandTier1Recipients } from "@/lib/roles";
import { MODULE_KEYS, getAccessLevel, canAccessAdminPanel, canAccessEmployeeManagement } from "@/lib/rbac-matrix";
import { ALL_PAGE_KEYS, defaultPermission, LOCKED_ROLES } from "@/lib/role-permissions-catalog";
import { canSeeSection, getDashboardTier, canSeeProjectSelector } from "@/lib/role-nav";
import { LABOUR_ATTENDANCE_ROLES, LABOUR_MASTER_UPLOAD_ROLES, LABOUR_RATE_VIEW_ROLES } from "@/lib/labour-rules";

describe("one Tier 1 permission definition", () => {
  it("contains exactly the four business directors, excluding chairman and super admin", () => {
    expect(TIER1_ROLES).toEqual(["managing_director", "finance_director", "sales_director", "architecture_director"]);
    expect(isTier1("chairman")).toBe(false);
    expect(isTier1("super_admin")).toBe(false);
  });
  for (const role of TIER1_ROLES) {
    it(`${role} matches MD in every module and page permission`, () => {
      for (const module of MODULE_KEYS) expect(getAccessLevel(role, module)).toBe(getAccessLevel("managing_director", module));
      for (const page of ALL_PAGE_KEYS) expect(defaultPermission(role, page)).toBe(defaultPermission("managing_director", page));
      expect(canAccessAdminPanel(role)).toBe(true);
      expect(canAccessEmployeeManagement(role)).toBe(true);
      expect(LOCKED_ROLES.includes(role)).toBe(true);
    });
    it(`${role} matches MD in navigation and Wave 1 labour maps`, () => {
      for (const section of ["management", "projects", "production", "procurement", "design", "admin", "approvals", "site", "finance", "sales"])
        expect(canSeeSection(role, section)).toBe(canSeeSection("managing_director", section));
      expect(getDashboardTier(role)).toBe(1);
      expect(canSeeProjectSelector(role)).toBe(true);
      for (const list of [LABOUR_ATTENDANCE_ROLES, LABOUR_MASTER_UPLOAD_ROLES, LABOUR_RATE_VIEW_ROLES]) expect(list.some(r => r === role)).toBe(true);
    });
  }
  it("expands role-addressed MD notifications without expanding named recipients", () => {
    expect(expandTier1Recipients(["managing_director", "finance_director"])).toEqual([...TIER1_ROLES]);
    expect(expandTier1Recipients(["site_engineer"])).toEqual(["site_engineer"]);
  });
});