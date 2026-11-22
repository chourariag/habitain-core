import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ enforced: false, setup: false, gfc: false, qc: "completed", from: vi.fn(), dialog: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/phase-flags", () => ({ get PREPROD_GATES_ENFORCED() { return mocks.enforced; } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));
vi.mock("@/components/production/StageWastageDialog", () => ({ StageWastageDialog: (props: unknown) => { mocks.dialog(props); return null; } }));
import { ProductionKanban } from "@/components/production/ProductionKanban";
import type { Tables } from "@/integrations/supabase/types";

const modules = [{ id: "module", name: "Test module", module_code: "M-1", project_id: "project", current_stage: "Main Frame", projects: { name: "Test project" } } as Tables<"modules"> & { projects: { name: string } }];
beforeEach(() => {
  mocks.enforced = false; mocks.setup = false; mocks.gfc = false; mocks.qc = "completed";
  mocks.from.mockReset(); mocks.dialog.mockReset(); mocks.error.mockReset();
  mocks.from.mockImplementation((table: string) => {
    const chain: Record<string, any> = {};
    for (const method of ["select", "eq", "in", "order"]) chain[method] = () => chain;
    const data = table === "production_stages" ? [
      { id: "previous", module_id: "module", stage_name: "Main Frame", stage_order: 1, status: mocks.qc, created_at: null },
      { id: "target", module_id: "module", stage_name: "Sub-Frame", stage_order: 2, status: "pending", created_at: null },
    ]
      : table === "projects" ? [{ id: "project", project_setup_approved: mocks.setup }]
      : table === "gfc_records" && mocks.gfc ? [{ project_id: "project", gfc_stage: "advance_h1" }] : [];
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data }).then(resolve);
    return chain;
  });
});
afterEach(cleanup);
async function drop(stage: string) {
  render(<ProductionKanban modules={modules} onRefresh={() => {}} productionSystem="modular" />);
  await waitFor(() => expect(mocks.from).toHaveBeenCalledWith("production_stages"));
  await new Promise(resolve => setTimeout(resolve, 0));
  const card = screen.getByText("M-1").closest('[draggable="true"]');
  const column = screen.getByText(stage).closest("div.w-56");
  if (!card || !column) throw new Error("Missing module or destination stage");
  fireEvent.dragStart(card); fireEvent.drop(column);
}
const opened = () => mocks.dialog.mock.calls.some(([props]) => props.open === true && props.stageName === "Main Frame");

describe("Kanban transition checks without database writes", () => {
  it("off opens the normal stage-close flow without Setup approval or H1", async () => {
    await drop("Sub-Frame");
    expect(opened()).toBe(true);
    expect(mocks.from).not.toHaveBeenCalledWith("projects");
    expect(mocks.from).not.toHaveBeenCalledWith("gfc_records");
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it("on keeps Setup approval blocking", async () => {
    mocks.enforced = true;
    await drop("Sub-Frame");
    expect(opened()).toBe(false); expect(mocks.error).toHaveBeenCalled();
  });
  it("on keeps H1 blocking after Setup is approved", async () => {
    mocks.enforced = true; mocks.setup = true;
    await drop("Sub-Frame");
    expect(opened()).toBe(false); expect(mocks.error).toHaveBeenCalled();
  });
  it("on restores stage-close flow when Setup, H1 and previous QC pass", async () => {
    mocks.enforced = true; mocks.setup = true; mocks.gfc = true;
    await drop("Sub-Frame");
    expect(opened()).toBe(true); expect(mocks.error).not.toHaveBeenCalled();
  });
  for (const enforced of [false, true]) {
    it(`${enforced ? "on" : "off"} keeps incomplete previous QC blocking`, async () => {
      mocks.enforced = enforced; mocks.setup = true; mocks.gfc = true; mocks.qc = "pending";
      await drop("Sub-Frame");
      expect(opened()).toBe(false); expect(mocks.error).toHaveBeenCalled();
    });
    it(`${enforced ? "on" : "off"} keeps immediate-next-stage-only movement`, async () => {
      mocks.enforced = enforced; mocks.setup = true; mocks.gfc = true;
      await drop("MEP Rough-In");
      expect(opened()).toBe(false); expect(mocks.error).toHaveBeenCalled();
    });
  }
});