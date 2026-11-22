import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectCostReport } from "@/components/projects/ProjectCostReport";
import { RUNNING_BILL_ROLES } from "@/lib/running-bill";
import { costMonthToDate, costReportSheets, costReportWorkbook, type CostReport } from "@/lib/cost-report";
import * as XLSX from "xlsx";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
export const costFixture: CostReport = {
  project_id: "project", from: "2026-11-01", to: "2026-11-22", can_view_person_cost: false,
  days: [{ work_date: "2026-11-20", own_labour: 800, factory_labour: 300, subcontract: 120, material: 370, consumables: 300, expenses: 75, consumables_expenses: 375, total: 1965, cumulative: 1965 }],
  groups: [{ location: "Site", group_id: "task", code: "S1", name: "Frame", hours: 6, labour_cost: 600, allocation: "Exact", subcontract: 60, material: 250, consumables: 0, expenses: 0, consumables_expenses: 0, total: 910, workers: [{ worker_id: "w", name: "Fixture worker", hours: 6, allocation: "Exact", amount: 600 }] }],
  totals: { own_labour: 800, factory_labour: 300, subcontract: 120, material: 370, consumables: 300, expenses: 75, consumables_expenses: 375, total: 1965, value_earned: 151000, value_earned_period: 5000, value_earned_cumulative: 151000, excess_value: 19500, value_minus_cost: 3035 },
  material_status: { missing_count: 1, missing_boq_value: 400, not_captured_count: 1, correction_count: 0, correction_difference: 0, site_correction_count: 0, site_correction_difference: 0, factory_correction_count: 0, factory_correction_difference: 0 },
};
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: costFixture, error: null }); });
afterEach(cleanup);
describe("Cost report permissions", () => {
  for (const role of RUNNING_BILL_ROLES) it(`reads for ${role}`, async () => {
    render(<ProjectCostReport projectId="project" role={role} onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_cost_report", expect.objectContaining({ p_project_id: "project" })));
  });
  for (const role of ["site_engineer", "site_installation_mgr", "factory_floor_supervisor", "senior_factory_supervisor", "head_operations", "production_head", "chairman", null]) it(`never reads for ${role}`, () => {
    render(<ProjectCostReport projectId="project" role={role} onOpenRates={() => {}} />); expect(rpc).not.toHaveBeenCalled();
  });
  it("clears authorized results when access is lost", async () => {
    const view = render(<ProjectCostReport projectId="project" role="finance_manager" onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    view.rerender(<ProjectCostReport projectId="project" role="site_engineer" onOpenRates={() => {}} />);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
describe("Cost date requests", () => {
  it("uses month to date in IST across a UTC month boundary", () => {
    expect(costMonthToDate(new Date("2026-10-31T20:00:00Z"))).toEqual({ from: "2026-11-01", to: "2026-11-01" });
  });
  it("applies the selected range", async () => {
    render(<ProjectCostReport projectId="project" role="finance_manager" onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "01/10/2026" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "10/10/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith("get_cost_report", { p_project_id: "project", p_from: "2026-10-01", p_to: "2026-10-10" }));
  });
  it("rejects an inverted range without loading it", async () => {
    render(<ProjectCostReport projectId="project" role="finance_manager" onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "22/11/2026" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "01/11/2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" })); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("loads a changed project rather than reusing its costs", async () => {
    const view = render(<ProjectCostReport projectId="project" role="finance_manager" onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    view.rerender(<ProjectCostReport projectId="other" role="finance_manager" onOpenRates={() => {}} />);
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith("get_cost_report", expect.objectContaining({ p_project_id: "other" })));
  });
});
describe("Local Excel visibility and values", () => {
  it("exports period earned value rather than cumulative for the selected costs", () => {
    const rows = costReportSheets(costFixture).Summary;
    expect(rows.find(r => r[0] === "Value earned for period INR")?.[1]).toBe(5000);
    expect(rows.find(r => r[0] === "Cumulative value earned to 22/11/2026 INR")?.[1]).toBe(151000);
    expect(rows.find(r => r[0] === "Value earned minus cost INR")?.[1]).toBe(3035);
    expect(rows.find(r => r[0] === "Excess over BOQ INR")?.[1]).toBe(19500);
  });

  it("omits a worker amount even if an unexpected response contains it", () => {
    const rows = costReportSheets(costFixture)["Who worked"];
    expect(rows[1]).toEqual(["Site", "S1", "Frame", "Fixture worker", 6, "Exact"]);
    expect(rows[1]).not.toContain(600);
  });
  it("includes authorized worker amounts", () => {
    expect(costReportSheets({ ...costFixture, can_view_person_cost: true })["Who worked"][1]).toEqual(["Site", "S1", "Frame", "Fixture worker", 6, "Exact", 600]);
  });
  it("exports stored frozen amounts and day cumulative exactly", () => {
    expect(costReportSheets(costFixture)["Day by day"][1]).toEqual(["20/11/2026", 800, 300, 120, 370, 300, 75, 1965, 1965]);
  });
  it("does not invent a factory unallocated amount without permission", () => {
    expect(costReportSheets(costFixture).Summary.some(row => String(row[0]).includes("unallocated"))).toBe(false);
  });
  it("keeps permitted factory unallocated separate from project cost", () => {
    const sheets = costReportSheets({ ...costFixture, factory_unallocated: { cost: 100, hours: 2 } });
    expect(sheets.Summary.find(row => String(row[0]).includes("unallocated"))?.[1]).toBe(100);
    expect(sheets["Day by day"][1][7]).toBe(1965);
  });
  it("serializes and reads back the workbook without leaking worker amounts", () => {
    const bytes = XLSX.write(costReportWorkbook(costFixture), { type: "array", bookType: "xlsx" });
    const book = XLSX.read(bytes);
    expect(XLSX.utils.sheet_to_json(book.Sheets["Who worked"], { header: 1 })[1]).toEqual(["Site", "S1", "Frame", "Fixture worker", 6, "Exact"]);
  });
});