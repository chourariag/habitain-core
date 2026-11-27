import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SiteQuantityUnits } from "@/components/site/SiteQuantityUnits";
import { BoqTaskReportView } from "@/components/projects/BoqTaskReport";
import { buildSplit, splitMismatch, type QuantityUnits } from "@/lib/site-quantity-units";
import type { TaskReport } from "@/lib/boq-task-report";

const units = (over: Partial<QuantityUnits> = {}): QuantityUnits => ({
  quantity_id: "q1", boq_item_id: "b1", contractor_id: null, today_qty: 3, work_location: "site",
  split: [], allocated: [{ unit_kind: "module", unit_label: "M1", qty: 4 }, { unit_kind: "module", unit_label: "M2", qty: 6 }],
  split_total: 0, unassigned: 3, stale: false, ...over,
});

describe("BOQ-3b unit split rules", () => {
  it("accepts a split up to the quantity and leaves blanks out", () => {
    expect(buildSplit(units().allocated, { "module\u0000M1": "2", "module\u0000M2": "" }, 3)).toEqual({ split: [{ unit_kind: "module", unit_label: "M1", qty: 2 }] });
  });
  it("rejects a split above the quantity", () => {
    expect(buildSplit(units().allocated, { "module\u0000M1": "2", "module\u0000M2": "2" }, 3)).toEqual({ error: "Unit split (4) is more than the quantity reported today (3)" });
  });
  it("rejects zero and negative quantities", () => {
    expect("error" in buildSplit(units().allocated, { "module\u0000M1": "0" }, 3)).toBe(true);
    expect("error" in buildSplit(units().allocated, { "module\u0000M1": "-1" }, 3)).toBe(true);
  });
  it("flags a saved split larger than the current quantity", () => {
    expect(splitMismatch([{ unit_kind: "module", unit_label: "M1", qty: 2 }], 1)).toBe(true);
    expect(splitMismatch([{ unit_kind: "module", unit_label: "M1", qty: 2 }], 3)).toBe(false);
  });
});

describe("Which unit? control", () => {
  it("shows nothing when the line has no allocated units or is not a site line", () => {
    const { container, rerender } = render(<SiteQuantityUnits units={units({ allocated: [] })} quantity={3} uom="sqm" readOnly={false} qtyChanged={false} onSave={vi.fn()} />);
    expect(container.textContent).toBe("");
    rerender(<SiteQuantityUnits units={units({ work_location: "factory" })} quantity={3} uom="sqm" readOnly={false} qtyChanged={false} onSave={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
  it("is collapsed with a hint, lists allocated units with Unassigned, and saves the split", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<SiteQuantityUnits units={units()} quantity={3} uom="sqm" readOnly={false} qtyChanged={false} onSave={onSave} />);
    expect(screen.getByText("Unit not stated")).toBeInTheDocument();
    expect(screen.queryByLabelText(/M1/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Which unit\?/ }));
    fireEvent.change(screen.getByLabelText(/M1/), { target: { value: "2" } });
    expect(screen.getByText("Unassigned: 1 sqm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save units" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith([{ unit_kind: "module", unit_label: "M1", qty: 2 }]));
  });
  it("warns when the quantity changed after a split exists", () => {
    const split = [{ unit_kind: "module", unit_label: "M1", qty: 2 }];
    const { rerender } = render(<SiteQuantityUnits units={units({ split, split_total: 2 })} quantity={3} uom="sqm" readOnly={false} qtyChanged={true} onSave={vi.fn()} />);
    expect(screen.getByText("Unit split no longer matches the quantity")).toBeInTheDocument();
    rerender(<SiteQuantityUnits units={units({ split, split_total: 2 })} quantity={1} uom="sqm" readOnly={false} qtyChanged={false} onSave={vi.fn()} />);
    expect(screen.getByText("Unit split no longer matches the quantity")).toBeInTheDocument();
    rerender(<SiteQuantityUnits units={units({ split, split_total: 2 })} quantity={3} uom="sqm" readOnly={false} qtyChanged={false} onSave={vi.fn()} />);
    expect(screen.queryByText("Unit split no longer matches the quantity")).toBeNull();
  });
});

describe("Cost section site units", () => {
  it("shows site unit tables and the unit-not-stated note", () => {
    const report: TaskReport = {
      status: "ok", link_set_version: 1, units: [], tasks: [],
      site_lines: [{ boq_item_id: "b1", sno: 1, description: "Site plaster", uom: "sqm", budget: 1000, note: "Waiting for unit on site reports", earned: 200, actual: 200, site_unassigned_qty: 1, problem: null }],
      site_units: [{ unit_kind: "module", unit_label: "M1", budget: 400, earned: 200, actual: 200, variance: 0, overrun: false }],
      site_tasks: [{ unit_kind: "module", unit_label: "M1", task_id: "t1", code: "B3-M1", task_name: "Plaster", budget: 400, earned: 200, actual: 200, variance: 0, overrun: false, broken: false, links: 1 }],
      totals: { factory_budget: 0, earned: 0, actual: 0, variance: 0, site_budget: 1000, unmapped_units: 0, overrun_links: 0, broken_links: 0, site_earned: 200, site_actual: 200, site_unassigned_lines: 1 },
    };
    render(<BoqTaskReportView report={report} />);
    expect(screen.queryByText(/Waiting for unit on site reports/)).toBeNull();
    expect(screen.getAllByText("B3-M1 · Plaster").length).toBeGreaterThan(0);
    expect(screen.getByText("Unit not stated: 1 sqm")).toBeInTheDocument();
    expect(screen.getAllByText("₹200.00").length).toBeGreaterThan(0);
  });
});
