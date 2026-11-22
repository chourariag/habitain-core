import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canOpenSiteOverview, overviewToday, overviewCostTotal, OVERVIEW_POLL_MS, FACTORY_REST_ISO_DAY, type SiteOverviewData } from "@/lib/site-overview";
import { useSiteOverview } from "@/hooks/useSiteOverview";
import { SiteTodayOverview } from "@/components/site/SiteTodayOverview";
import { featureFlagForSiteTab } from "@/lib/feature-flags";
import { ModuleGuard } from "@/components/ModuleGuard";
import { MemoryRouter } from "react-router-dom";

const mock = vi.hoisted(() => ({ rpc: vi.fn(), role: "finance_manager", enabled: true }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mock.rpc } }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ loading: false, role: mock.role, canView: () => false }) }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ isLoading: false, isError: false, isEnabled: () => mock.enabled }) }));
const fixture = (costs = true): SiteOverviewData => {
  const row = { kind: "site" as const, project_id: "project", name: "Test", report_id: "report", status: "Submitted" as const, who: "Fixture submitter", last_update: "2026-11-22T10:00:00Z", activities: 1, people: 1, hours: 8,
    ...(costs ? { cost: { attendance: 800, subcontract: 250, consumables: 200, expenses: 50 } } : {}),
    report: { notes: "Fixture note", activities: [{ code: "T1", name: "Frame", stage: null, progress: 50, status: "ongoing", remarks: null, hours: 8 }], workers: [{ name: "Fixture worker", hours: 8 }], quantities: [{ item: "Frame", qty: 10, unit: "sqm" }], expenses: [{ kind: "expense", description: "Transport", ...(costs ? { amount: 50 } : {}) }] } };
  return { date: "2026-11-22", kpis: { sites_expected: 1, sites_submitted: 1, sites_draft: 0, factory_status: null, activities: 1, people_working: 1, labour_hours: 8, ...(costs ? { cost: { site: 1300 } } : {}) }, sites: [row], factory: null, rows: [row], feed: [] };
};
beforeEach(() => { mock.role = "finance_manager"; mock.enabled = true; mock.rpc.mockResolvedValue({ data: fixture(), error: null }); Object.defineProperty(document, "hidden", { configurable: true, value: false }); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); });
afterEach(() => { cleanup(); mock.rpc.mockReset(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Today role matrix", () => {
  for (const role of ["site_installation_mgr", "head_operations", "production_head", "head_of_projects", "planning_head", "finance_manager", "quantity_surveyor", "costing_engineer", "managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"]) {
    it(`${role} can open Today even without legacy site menu access`, () => {
      mock.role = role;
      expect(canOpenSiteOverview(role)).toBe(true);
      render(<MemoryRouter initialEntries={["/site-hub?tab=today"]}><ModuleGuard module="site"><span>Authorized content</span></ModuleGuard></MemoryRouter>);
      expect(screen.getByText("Authorized content")).toBeInTheDocument();
    });
  }
  for (const role of ["site_engineer", "factory_floor_supervisor", "senior_factory_supervisor", "chairman"]) {
    it(`${role} is denied the Today route`, () => {
      mock.role = role;
      expect(canOpenSiteOverview(role)).toBe(false);
      render(<MemoryRouter initialEntries={["/site-hub?tab=today"]}><ModuleGuard module="site"><span>Authorized content</span></ModuleGuard></MemoryRouter>);
      expect(screen.queryByText("Authorized content")).not.toBeInTheDocument();
    });
  }
  it("uses the existing site_report flag and denies disabled URL entry", () => {
    expect(featureFlagForSiteTab("today")).toBe("site_report"); mock.enabled = false;
    render(<MemoryRouter initialEntries={["/site-hub?tab=today"]}><ModuleGuard module="site"><span>Authorized content</span></ModuleGuard></MemoryRouter>);
    expect(screen.queryByText("Authorized content")).not.toBeInTheDocument();
  });
});

function Harness({ date }: { date: string }) { const state = useSiteOverview(date); return <span>{state.data?.date ?? "Loading"}</span>; }
describe("Daily read behavior", () => {
  it("uses the IST calendar day across midnight", () => { expect(overviewToday(new Date("2026-11-21T19:00:00Z"))).toBe("2026-11-22"); });
  it("polls every 60 seconds", async () => {
    vi.useFakeTimers(); render(<Harness date="2026-11-22" />);
    await act(async () => {}); expect(mock.rpc).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(59_999); }); expect(mock.rpc).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1); }); expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(OVERVIEW_POLL_MS).toBe(60_000);
  });
  it("pauses polling when hidden and refreshes when visible", async () => {
    vi.useFakeTimers(); render(<Harness date="2026-11-22" />); await act(async () => {});
    Object.defineProperty(document, "hidden", { value: true }); fireEvent(document, new Event("visibilitychange"));
    await act(async () => { vi.advanceTimersByTime(180_000); }); expect(mock.rpc).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "hidden", { value: false }); fireEvent(document, new Event("visibilitychange"));
    await act(async () => {}); expect(mock.rpc).toHaveBeenCalledTimes(2);
  });
  it("date changes request exactly the new day and drop stale responses", async () => {
    let resolveOld: (v: unknown) => void = () => {};
    mock.rpc.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    mock.rpc.mockResolvedValue({ data: { ...fixture(), date: "2026-11-21" }, error: null });
    const view = render(<Harness date="2026-11-22" />); view.rerender(<Harness date="2026-11-21" />);
    await screen.findByText("2026-11-21");
    await act(async () => { resolveOld({ data: fixture(), error: null }); });
    expect(screen.queryByText("2026-11-22")).not.toBeInTheDocument();
    expect(mock.rpc).toHaveBeenLastCalledWith("get_site_overview", { p_date: "2026-11-21" });
  });
  it("uses Sunday as the factory rest day", () => { expect(FACTORY_REST_ISO_DAY).toBe(7); });
  it("reconciles attendance, subcontract, consumables and expenses", () => { expect(overviewCostTotal({ attendance: 800, subcontract: 250, consumables: 200, expenses: 50 })).toBe(1300); });
  it("opens a read-only report with no write requests", async () => {
    render(<SiteTodayOverview />); fireEvent.click((await screen.findAllByRole("button", { name: "Test" }))[0]);
    await screen.findByRole("dialog"); expect(screen.getByText("Fixture note")).toBeInTheDocument();
    expect(screen.getByRole("dialog").querySelector("input,textarea,select,[contenteditable=true]")).toBeNull();
    expect(mock.rpc.mock.calls.every(([name]) => name === "get_site_overview")).toBe(true);
  });
  it("renders no cost amounts when the server omits cost keys", async () => {
    mock.rpc.mockResolvedValue({ data: fixture(false), error: null }); render(<SiteTodayOverview />);
    await screen.findAllByRole("button", { name: "Test" });
    expect(document.body.textContent).not.toContain("₹");
    fireEvent.click(screen.getAllByRole("button", { name: "Test" })[0]);
    await screen.findByRole("dialog"); expect(document.body.textContent).not.toContain("₹");
  });
});