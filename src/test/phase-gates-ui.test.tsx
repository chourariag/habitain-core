import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({ enforced: false, from: vi.fn(), rpc: vi.fn(), chain: {} as Record<string, any> }));
vi.mock("@/lib/phase-flags", () => ({ get PREPROD_GATES_ENFORCED() { return mocks.enforced; }, SCHEDULE_LEGACY_UPLOAD_VISIBLE: false, BOQ_LEGACY_UPLOAD_VISIBLE: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: "managing_director", userId: "director" }) }));
vi.mock("@/hooks/useProjectArchitect", () => ({ useProjectArchitect: () => ({ architect: null }), ARCHITECT_OWNED_GATES: [] }));
import { ProjectSetupUpload } from "@/components/projects/ProjectSetupUpload";
import { ProjectSetupWorkbook } from "@/components/projects/ProjectSetupWorkbook";
import { PreProductionChecklist } from "@/components/projects/PreProductionChecklist";
import { ProjectSetupApprovalSection } from "@/components/projects/ProjectSetupApprovalSection";
import { FactoryFloorPreProdBanner } from "@/components/production/FactoryFloorPreProdBanner";
import GfcSetupDeadlineBanner from "@/components/projects/GfcSetupDeadlineBanner";

beforeEach(() => {
  mocks.enforced = false;
  mocks.from.mockReset(); mocks.rpc.mockReset();
  const chain: Record<string, any> = {};
  for (const name of ["select", "eq", "in", "order", "limit", "maybeSingle"]) chain[name] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  mocks.chain = chain;
  mocks.from.mockReturnValue(chain);
  mocks.rpc.mockResolvedValue({ data: {}, error: null });
});
afterEach(cleanup);

describe("Phase gate-only reads", () => {
  it("off does not fetch checklist, approval, factory warning or deadline data", () => {
    render(<MemoryRouter>
      <PreProductionChecklist projectId="project" />
      <ProjectSetupApprovalSection projectId="project" userRole="managing_director" />
      <FactoryFloorPreProdBanner />
      <GfcSetupDeadlineBanner projectId="project" />
    </MemoryRouter>);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("on restores checklist and approval readers", async () => {
    mocks.enforced = true;
    render(<MemoryRouter><PreProductionChecklist projectId="project" />
      <ProjectSetupApprovalSection projectId="project" userRole="managing_director" />
    </MemoryRouter>);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("get_preprod_gate_flags", { _project_id: "project" }));
    expect(mocks.from).toHaveBeenCalledWith("project_setup_approvals");
    expect(mocks.chain.select).toHaveBeenCalledWith("project_setup_approved,project_setup_approved_at,project_setup_status");
  });
  for (const enforced of [false, true]) {
    for (const type of ["habitainer", "ads"]) {
      it(`${enforced ? "on" : "off"}: legacy director upload ${type} with zero gates`, async () => {
        mocks.enforced = enforced;
        render(<MemoryRouter><ProjectSetupUpload projectId="project" userRole="managing_director" projectType={type} /></MemoryRouter>);
        const upload = screen.getByRole("button", { name: "Upload Project Setup" });
        await waitFor(() => {
          if (enforced && type === "habitainer") expect(upload).toBeDisabled();
          else expect(upload).not.toBeDisabled();
        });
        if (!enforced) expect(mocks.rpc).not.toHaveBeenCalled();
      });
    }
    for (const role of ["planning_head", "managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"]) {
      it(`${enforced ? "on" : "off"}: current workbook accepts file selection for ${role} without gate approval`, async () => {
        mocks.enforced = enforced;
        render(<ProjectSetupWorkbook projectId="project" userRole={role} />);
        await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("get_project_setup_status", { p_project_id: "project" }));
        fireEvent.change(screen.getByLabelText("Choose project setup workbook"), { target: { files: [new File(["workbook"], "Setup.xlsx")] } });
        expect(screen.getByRole("button", { name: "Validate Workbook" })).not.toBeDisabled();
        expect(mocks.rpc.mock.calls.some(([name]) => name === "commit_project_setup_excel_upload")).toBe(false);
      });
    }
  }
});