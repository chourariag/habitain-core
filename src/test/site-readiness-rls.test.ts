import { describe, it, expect } from "vitest";
import evidence from "./security1-access-evidence.json";

// Live checks are run without credentials using security1-access.sql through the
// database SQL tool. This fixture records that run; it is not a fresh live query.
describe("credential-free SQL access verification evidence", () => {
  it("records 54 successful site-readiness INSERT/UPDATE role checks", () => {
    expect(evidence.site_readiness_role_checks).toBe(54);
  });
  it.each(["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin", "finance_manager", "costing_engineer", "planning_head"])("preserves threshold reader %s", role => {
    const row = evidence.active_role_counts.find(row => row.role === role && row.table_name === "approval_thresholds");
    expect(row?.before_count).toBe(9);
    expect(row?.after_count).toBe(9);
  });
  it("removes stores access to populated thresholds, stages and scope", () => {
    for (const [table, before] of [["approval_thresholds", 9], ["production_stages", 55], ["project_scope_items", 82]] as const) {
      const row = evidence.active_role_counts.find(row => row.role === "stores_executive" && row.table_name === table);
      expect(row?.before_count).toBe(before);
      expect(row?.after_count).toBe(0);
    }
  });
});
