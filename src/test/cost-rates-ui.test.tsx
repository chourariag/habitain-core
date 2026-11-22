import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as XLSX from "xlsx";
import { ProjectCostRates } from "@/components/projects/ProjectCostRates";
import { costRatesWorkbook, type CostRateItem } from "@/lib/cost-rates";
import { RUNNING_BILL_ROLES } from "@/lib/running-bill";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const item: CostRateItem = { id: "item", sno: 7, description: "Frame", unit: "kg", work_location: "factory", boq_rate: 50, material_rate: 20, missing_material_rate: false, subcontracts: [] };
const fixture = { boq_id: "latest", items: [item], contractors: [] };
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: fixture, error: null }); });
afterEach(cleanup);

describe("Rates UI access", () => {
  for (const role of RUNNING_BILL_ROLES) it(`loads rates for ${role}`, async () => {
    render(<ProjectCostRates projectId="project" role={role} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_cost_rates", { p_project_id: "project" }));
  });
  for (const role of ["site_engineer", "factory_floor_supervisor", "senior_factory_supervisor", "head_operations", "production_head", "site_installation_mgr", null]) it(`does not fetch commercial data for ${role ?? "anonymous"}`, () => {
    render(<ProjectCostRates projectId="project" role={role} />); expect(rpc).not.toHaveBeenCalled();
  });
});

describe("Rates edits and upload confirmation", () => {
  it("sends material edits and reads back the saved value", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_cost_rates" ? fixture : null, error: null }));
    render(<ProjectCostRates projectId="project" role="finance_manager" />);
    const field = await screen.findByRole("spinbutton", { name: "Material rate 7" });
    fireEvent.change(field, { target: { value: "25" } }); fireEvent.blur(field);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("set_material_rate", { p_project_id: "project", p_boq_item_id: "item", p_rate: 25 }));
    await waitFor(() => expect(rpc.mock.calls.filter(([name]) => name === "get_cost_rates")).toHaveLength(2));
  });
  it("rejects negative material edits without a write", async () => {
    render(<ProjectCostRates projectId="project" role="finance_manager" />);
    const field = await screen.findByRole("spinbutton", { name: "Material rate 7" });
    fireEvent.change(field, { target: { value: "-1" } }); fireEvent.blur(field);
    expect(rpc.mock.calls.filter(([name]) => name === "set_material_rate")).toHaveLength(0);
  });
  const file = () => {
    const value = new File(["rates"], "Rates.xlsx");
    Object.defineProperty(value, "arrayBuffer", { value: async () => XLSX.write(costRatesWorkbook([item]), { type: "array", bookType: "xlsx" }) });
    return value;
  };
  it("runs dry run without applying, then applies only on Confirm", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_cost_rates" ? fixture : name === "validate_cost_rates_upload" ? { boq_id: "latest", errors: [], row_count: 1 } : { applied: 1 }, error: null }));
    render(<ProjectCostRates projectId="project" role="finance_manager" />);
    await screen.findByRole("spinbutton", { name: "Material rate 7" });
    fireEvent.change(screen.getByLabelText("Upload rates file"), { target: { files: [file()] } });
    await waitFor(() => expect(rpc.mock.calls.filter(([name]) => name === "validate_cost_rates_upload")).toHaveLength(1));
    expect(rpc.mock.calls.filter(([name]) => name === "apply_cost_rates_upload")).toHaveLength(0);
    const confirm = await screen.findByRole("button", { name: "Confirm" });
    await waitFor(() => expect(confirm).not.toBeDisabled()); fireEvent.click(confirm);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("apply_cost_rates_upload", expect.objectContaining({ p_project_id: "project", p_boq_id: "latest", p_rows: [expect.objectContaining({ sno: "7", material_rate: "20" })] })));
  });
  it("rejected dry-run rows cannot be confirmed", async () => {
    rpc.mockImplementation(async (name: string) => ({ data: name === "get_cost_rates" ? fixture : { boq_id: "latest", errors: [{ row: 2, reason: "Bad rate" }], row_count: 1 }, error: null }));
    render(<ProjectCostRates projectId="project" role="finance_manager" />);
    await screen.findByRole("spinbutton", { name: "Material rate 7" });
    fireEvent.change(screen.getByLabelText("Upload rates file"), { target: { files: [file()] } });
    const confirm = await screen.findByRole("button", { name: "Confirm" });
    await waitFor(() => expect(confirm).toBeDisabled()); fireEvent.click(confirm);
    expect(rpc.mock.calls.filter(([name]) => name === "apply_cost_rates_upload")).toHaveLength(0);
  });
});