import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { canAccessAdminPanel, canAccessEmployeeManagement } from "@/lib/rbac-matrix";
import type { AppRole } from "@/lib/roles";

const SD = "sales_director" as AppRole;
const AD = "architecture_director" as AppRole;
const PA = "principal_architect" as AppRole;
const MD = "managing_director" as AppRole;

const read = (p: string) => readFileSync(p, "utf8");

describe("Employee Management access (HR FULL, not Admin Panel)", () => {
  it("grants SD and AD access to Employee Management", () => {
    for (const r of [SD, AD, MD, "super_admin" as AppRole]) {
      expect(canAccessEmployeeManagement(r)).toBe(true);
    }
  });

  it("never grants Admin Panel or impersonation tier to SD/AD", () => {
    expect(canAccessAdminPanel(SD)).toBe(false);
    expect(canAccessAdminPanel(AD)).toBe(false);
  });

  it("keeps principal_architect and unrelated roles out", () => {
    for (const r of [PA, "site_engineer" as AppRole, "hr_executive" as AppRole, "finance_manager" as AppRole]) {
      expect(canAccessEmployeeManagement(r)).toBe(false);
      expect(canAccessAdminPanel(r)).toBe(false);
    }
  });

  it("routes /admin/employees through the employee-management guard", () => {
    expect(read("src/App.tsx")).toContain(
      '<Route path="/admin/employees" element={<ModuleGuard requireEmployeeManagement>'
    );
  });
});

describe("approver lists point at architecture_director, not principal_architect", () => {
  const files = [
    "src/pages/Approvals.tsx",
    "src/hooks/usePendingApprovalsCount.ts",
    "src/pages/UserManagement.tsx",
    "src/components/procurement/WorkOrdersTab.tsx",
    "src/components/finance/RetentionSection.tsx",
  ];

  it("includes both director roles in each approver list", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).toContain("architecture_director");
      expect(src, f).toContain("sales_director");
    }
  });

  it("drops principal_architect from those approver lists", () => {
    for (const f of files) {
      expect(read(f), f).not.toContain("principal_architect");
    }
  });
});

describe("seed data uses Karan's live role", () => {
  it("seeds architecture_director, never principal_architect", () => {
    for (const f of ["src/lib/hstack-users.ts", "src/components/super-admin/CreateAccountsTab.tsx"]) {
      const src = read(f);
      expect(src, f).not.toContain("principal_architect");
    }
  });
});
