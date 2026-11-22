import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ role: "managing_director", invoke: vi.fn(), builder: () => ({ eq: async () => ({ data: [] }) }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: state.role, userId: "fixture-user", loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: state.builder }), functions: { invoke: state.invoke } } }));
vi.mock("@/components/kpi/KpiOverviewGrid", () => ({ KpiOverviewGrid: ({ onSelect }: { onSelect: (id: string, role: string) => void }) => <button onClick={() => onSelect("fixture-user", "planning_engineer")}>Fixture select</button> }));
vi.mock("@/components/kpi/KPIScorecard", () => ({ KPIScorecard: () => null }));
vi.mock("@/components/kpi/MdNotePanel", () => ({ MdNotePanel: () => null }));
import KPI from "@/pages/KPI";
describe("KPI page does not trigger the redundant recompute", () => {
  for (const role of ["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"]) {
    it(`${role}: selecting a scorecard performs no function call`, async () => {
      state.role = role; state.invoke.mockClear();
      const view = render(<KPI />);
      const select = await view.findByRole("button", { name: "Fixture select" });
      fireEvent.click(select);
      await waitFor(() => expect(view.queryByRole("button", { name: "Fixture select" })).toBeNull());
      expect(state.invoke).not.toHaveBeenCalled();
      view.unmount();
    });
  }
});
