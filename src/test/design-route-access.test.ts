import { describe, it, expect } from "vitest";
import { getAccessLevel } from "@/lib/rbac-matrix";
import type { AppRole } from "@/lib/roles";

describe("Design module access via RBAC matrix", () => {
  const designRoles: AppRole[] = [
    "senior_architect",
    "head_operations",
    "quantity_surveyor",
  ];

  it.each(designRoles)("grants FULL design access to %s", (role) => {
    expect(getAccessLevel(role, "design")).toBe("FULL");
  });

  it("redirects roles with NONE design access", () => {
    expect(getAccessLevel("marketing", "design")).toBe("NONE");
    expect(getAccessLevel("sales_executive", "design")).toBe("NONE");
  });
});
