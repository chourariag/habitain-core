import { beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEDULED_JOB_SNAPSHOT } from "@/lib/scheduled-jobs";
const mock = vi.hoisted(() => ({ session: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mock.session }, functions: { invoke: mock.invoke } } }));
import { refreshKpiForRole } from "@/lib/kpi-recompute";
beforeEach(() => { vi.clearAllMocks(); mock.session.mockResolvedValue({ data: { session: { access_token: "fixture-user-token" } } }); mock.invoke.mockResolvedValue({ data: {}, error: null }); });
describe("KPI background caller uses only Tier 1 or Super", () => {
  for (const role of ["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"]) {
    it(`${role} refreshes with the session bearer`, async () => {
      await refreshKpiForRole(role);
      expect(mock.invoke).toHaveBeenCalledExactlyOnceWith("kpi-recompute", { body: null, headers: { Authorization: "Bearer fixture-user-token" } });
    });
  }
  for (const role of [null, "chairman", "finance_manager", "planning_engineer", "quantity_surveyor", "site_engineer", "factory_floor_supervisor"]) {
    it(`${role ?? "signed out"} never triggers recompute`, async () => {
      await refreshKpiForRole(role); expect(mock.session).not.toHaveBeenCalled(); expect(mock.invoke).not.toHaveBeenCalled();
    });
  }
  it("no authenticated session means no call even for Tier 1", async () => {
    mock.session.mockResolvedValue({ data: { session: null } }); await refreshKpiForRole("managing_director"); expect(mock.invoke).not.toHaveBeenCalled();
  });
});
const slots = [
  ["auto-submit-draft-expenses-5-20", "5 0 5,20 * *"],
  ["daily-checkin-nudge-1300-ist", "30 7 * * *"],
  ["daily-checkin-nudge-1700-ist", "30 11 * * *"],
  ["approval-rejection-dm-5min", "*/5 * * * *"],
  ["error-attribution-dm-5min", "*/5 * * * *"],
];
for (const [name, schedule] of slots) {
  it(`${name}: retained disabled and exactly one active replacement for this slot`, () => {
    const rows = SCHEDULED_JOB_SNAPSHOT.filter(j => j.name === name || j.name === `${name}-managed`);
    expect(rows).toHaveLength(2);
    expect(rows.find(j => j.name === name)).toEqual({ name, schedule, active: false });
    expect(rows.find(j => j.name === `${name}-managed`)).toEqual({ name: `${name}-managed`, schedule, active: true });
    expect(rows.filter(j => j.active)).toHaveLength(1);
  });
}
it("one daily KPI intention uses precisely 18:35 UTC and no weekly activation", () => {
  expect(SCHEDULED_JOB_SNAPSHOT.filter(j => j.name === "kpi-recompute-daily")).toEqual([{ name: "kpi-recompute-daily", schedule: "35 18 * * *", active: true }]);
  expect(SCHEDULED_JOB_SNAPSHOT.find(j => j.name === "kpi-recompute-weekly")?.active).toBe(false);
});
