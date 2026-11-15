import { describe, it, expect } from "vitest";
import evidence from "./security2-access-evidence.json";
import groups from "./security2-reader-groups.json";
// Recorded live SQL results; run security2-access.sql separately for a fresh live check.
const tier = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];
describe("SECURITY-2 verified reader rules", () => {
  for (const [name, group] of Object.entries(groups)) {
    const tables = group[0] as string[];
    const roles = group[1] as string[];
    it(`preserves every ${name} reader's row counts`, () => {
      const rows = evidence.counts.filter(row => tables.includes(row.table) && [...roles, ...tier].includes(row.role));
      expect(rows.length).toBe(tables.length * (roles.length + tier.length));
      for (const row of rows) expect(row.after_count).toBe(row.before_count);
    });
  }
  it("prevents control-role gains across all 30 tables", () => {
    const rows = evidence.counts.filter(row => row.role === "hr_executive");
    expect(rows).toHaveLength(30);
    for (const row of rows) expect(row.after_count).toBeLessThanOrEqual(row.before_count);
  });
  it("records 93 live dispatch predicate checks", () => {
    expect(evidence.dispatch_gate_checks).toBe(93);
  });
  it("records passing delivery_rm_lead readiness INSERT and UPDATE gates", () => {
    expect(evidence.site_readiness_insert_update).toBe("passed");
    const row = evidence.counts.find(row => row.role === "delivery_rm_lead" && row.table === "site_readiness");
    expect(row?.before_count).toBe(3);
    expect(row?.after_count).toBe(3);
  });
});
