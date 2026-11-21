import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FactoryAttendance } from "@/components/labour/FactoryAttendance";
import { FactoryDailyReport } from "@/components/production/FactoryDailyReport";
import { FactoryCostCard } from "@/components/production/FactoryCostCard";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), submitted: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: fixture.rpc } }));
vi.mock("@/components/labour/ToolboxCamera", () => ({ ToolboxCamera: () => null }));

beforeEach(() => {
  fixture.submitted = false;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  fixture.rpc.mockImplementation(async (name: string) => {
    if (name === "get_factory_attendance") return { data: {
      standard_hours: 8, workers: [{ worker_id: "worker", name: "Fixture worker", skill_type: "Fabrication", worker_code: "LW-FIXTURE", contractor_name: "Fixture contractor" }],
      attendance: [{ worker_id: "worker", hours: 8, hours_confirmed: true, no_photo_exception: false }], photos: [],
    }, error: null };
    if (name === "get_factory_report") return { data: {
      report: { id: "report", status: fixture.submitted ? "submitted" : "draft", notes: "Fixture day", submitted_by: fixture.submitted ? "principal" : null },
      modules: [{ id: "module", project_id: "project", name: "Fixture module", module_code: "MOD-FIXTURE", project_name: "Fixture project", current_stage: "Main Frame", production_system: "modular", recent: true, last_logs: [] }],
      boq: [{ id: "boq", project_id: "project", sno: 1, item_description: "Fixture output", unit: "sqm", boq_qty: 100, so_far: 0 }],
      blocks: [{ module_id: "module", stage: "Main Frame", stage_status: "ongoing", progress_pct: 40, remarks: "" }],
      task_workers: [{ module_id: "module", stage: "Main Frame", worker_id: "worker", hours: 6 }],
      quantities: [{ module_id: "module", stage: "Main Frame", boq_item_id: "boq", contractor_id: null, today_qty: 40, unit: "sqm" }],
      expenses: [], photos: [], present_workers: [{ worker_id: "worker", name: "Fixture worker", skill_type: "Fabrication", contractor_name: "Fixture contractor", attendance_hours: 8 }],
      hours_unconfirmed: 0, contractors: [],
    }, error: null };
    if (name === "submit_factory_report") fixture.submitted = true;
    return { data: name === "save_factory_report_draft" ? "report" : 1, error: null };
  });
});
afterEach(() => { cleanup(); fixture.rpc.mockReset(); vi.unstubAllGlobals(); });

describe("Factory permission flows for roles without existing accounts", () => {
  for (const role of ["factory_floor_supervisor", "senior_factory_supervisor"]) {
    it(`${role} confirms attendance hours through the checked action`, async () => {
      render(<FactoryAttendance role={role} />);
      fireEvent.click(await screen.findByRole("button", { name: "Confirm hours", exact: true }));
      await waitFor(() => expect(fixture.rpc).toHaveBeenCalledWith("confirm_factory_hours", expect.objectContaining({ p_rows: [{ worker_id: "worker", hours: 8 }] })));
    });
    it(`${role} saves and submits exact worker allocations without requesting costs`, async () => {
      render(<><FactoryDailyReport role={role} userId="principal" /><FactoryCostCard role={role} /></>);
      fireEvent.click(await screen.findByRole("button", { name: "Submit factory report" }));
      await waitFor(() => expect(fixture.rpc).toHaveBeenCalledWith("submit_factory_report", { p_report_id: "report" }));
      expect(fixture.rpc).toHaveBeenCalledWith("save_factory_report_draft", expect.objectContaining({ p_payload: expect.objectContaining({ task_workers: [{ module_id: "module", stage: "Main Frame", worker_id: "worker", hours: 6 }] }) }));
      expect(fixture.rpc.mock.calls.some(([name]) => name === "get_factory_cost")).toBe(false);
    });
  }
  it("quantity_surveyor reads reports but cannot submit or mutate them", async () => {
    render(<FactoryDailyReport role="quantity_surveyor" userId="principal" />);
    await screen.findByRole("textbox", { name: "Search factory modules" });
    expect(screen.queryByRole("button", { name: "Submit factory report" })).not.toBeInTheDocument();
    expect(fixture.rpc.mock.calls.every(([name]) => name === "get_factory_report")).toBe(true);
  });
});