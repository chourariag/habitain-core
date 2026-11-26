import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
import { BoqTaskReport } from "@/components/projects/BoqTaskReport";

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const report = {
  status: "ok", link_set_version: 1,
  units: [{ unit_kind: "module", unit_label: "M1", mapped: true, module_name: "Module 1", unmapped_reason: null, modules_found: [], budget: 200000, earned: 150000, actual: 160000, variance: -10000, overrun: true },
    { unit_kind: "module", unit_label: "M9", mapped: false, module_name: null, unmapped_reason: "No module matches this unit label", modules_found: ["Module 1"], budget: 1000, earned: 0, actual: 0, variance: 0, overrun: false }],
  tasks: [{ unit_kind: "module", unit_label: "M1", task_id: "t1", code: "M1-01", task_name: "Frame", budget: 200000, earned: 150000, actual: 160000, variance: -10000, overrun: true, broken: false, links: 1 },
    { unit_kind: "module", unit_label: "M9", task_id: "t9", code: "M9-01", task_name: "Board", budget: 1000, earned: 0, actual: 0, variance: 0, overrun: false, broken: false, links: 1 }],
  site_lines: [{ boq_item_id: "s", sno: 4, description: "Site plaster", uom: "sqm", budget: 5000, note: "Waiting for unit on site reports" }],
  totals: { factory_budget: 201000, earned: 150000, actual: 160000, variance: -10000, site_budget: 5000, unmapped_units: 1, overrun_links: 1, broken_links: 0 },
};

describe("BOQ-3a task report section", () => {
  it("stays hidden until links are locked", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "no_locked_links" }, error: null });
    const { container } = wrap(<BoqTaskReport projectId="p" />);
    await new Promise(r => setTimeout(r, 20));
    expect(container.textContent).toBe("");
  });
  it("shows server values in Indian grouping with overrun and unmapped badges", async () => {
    rpc.mockResolvedValueOnce({ data: report, error: null });
    wrap(<BoqTaskReport projectId="p" />);
    expect(await screen.findByText("Budget vs earned vs actual (linked BOQ)")).toBeInTheDocument();
    expect(screen.getAllByText("₹2,01,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overrun").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unmapped").length).toBeGreaterThan(0);
    expect(screen.getByText(/Modules found: Module 1/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for unit on site reports/)).toBeInTheDocument();
  });
});
