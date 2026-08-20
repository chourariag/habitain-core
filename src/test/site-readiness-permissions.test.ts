import { describe, it, expect } from "vitest";
import {
  canSubmitSiteReadiness,
  SITE_READINESS_SUBMIT_ROLES,
} from "@/lib/site-readiness-permissions";

describe("Site Readiness submit permissions", () => {
  it("allows delivery_rm_lead to submit (regression: Bala / Pebble Beach House)", () => {
    expect(canSubmitSiteReadiness("delivery_rm_lead")).toBe(true);
  });

  it.each(SITE_READINESS_SUBMIT_ROLES)("allows %s", (role) => {
    expect(canSubmitSiteReadiness(role)).toBe(true);
  });

  it.each([
    "finance_manager",
    "procurement",
    "costing_engineer",
    "qc_inspector",
    "hr_executive",
    "sales_executive",
    "project_architect",
    "stores_executive",
  ])("blocks %s", (role) => {
    expect(canSubmitSiteReadiness(role)).toBe(false);
  });

  it("blocks unknown, null and empty roles", () => {
    expect(canSubmitSiteReadiness(null)).toBe(false);
    expect(canSubmitSiteReadiness(undefined)).toBe(false);
    expect(canSubmitSiteReadiness("")).toBe(false);
    expect(canSubmitSiteReadiness("not_a_role")).toBe(false);
  });
});
