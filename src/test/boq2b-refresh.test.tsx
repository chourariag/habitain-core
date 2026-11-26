import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { BoqEntry } from "@/components/projects/BoqEntry";
import { BoqLinks } from "@/components/projects/BoqLinks";
import type { BoqState } from "@/lib/boq-entry";
import type { LinkState } from "@/lib/boq-links";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: rpcMock } }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: "managing_director", isImpersonating: false }) }));

const entryLine = {
  id: "line-1", sno: 1, item_description: "Fresh roof panel", unit: "sqm", boq_qty: 1, boq_rate: 100,
  total_amount: 100, category: "Structure", scope: "Factory", work_location: "factory", warnings: [],
};
const entryDraft: BoqState = {
  header: { id: "boq-1", entry_mode: "fresh", status: "draft", control_total: 100, source_note: "Signed test BOQ", final_at: null, entry_version: 1 },
  lines: [entryLine], sum: 100, difference: 0, line_count: 1, can_write: true, can_finalise: true,
  units: ["sqm"], categories: ["Structure"], scopes: ["Both", "Factory", "Habitainer", "On-Site Civil"], audit: [],
};
const noBoqLinks: LinkState = {
  boq: null, blocked_reason: "This project has no BOQ yet.", set: { status: "draft", version: 0 },
  totals: { boq_total: 0, linked: 0, unlinked: 0, lines_needed: 0, lines_complete: 0, lines_broken: 0, lines_skipped: 0 },
  lines: [], broken: [], task_budgets: [], unit_budgets: [], units: [], tasks: [], audit: [], can_write: true,
  can_lock: false, lock_reason: "This project has no BOQ yet.", revision_needed: false,
};
const finalLinks: LinkState = {
  ...noBoqLinks,
  boq: { id: "boq-1", entry_mode: "fresh", status: "final", version_number: 1 }, blocked_reason: null,
  totals: { boq_total: 100, linked: 100, unlinked: 0, lines_needed: 1, lines_complete: 1, lines_broken: 0, lines_skipped: 0 },
  lines: [{ id: "line-1", sno: 1, description: "Fresh roof panel", unit: "sqm", qty: 1, rate: 100, value: 100, linked: 100,
    allocated: 1, status: "complete", legacy_task_hint: null,
    allocations: [{ unit_kind: "module", unit_label: "M1", quantity: 1, unit_missing: false, share_total: 100 }],
    links: [{ id: "link-1", task_id: "task-1", unit_kind: "module", unit_label: "M1", code: "M1-01", task_name: "Install", share_pct: 100, budget: 100, problem: null }] }],
  units: [{ unit_kind: "module", unit_label: "M1" }],
  tasks: [{ id: "task-1", unit_kind: "module", unit_label: "M1", code: "M1-01", task_name: "Install", library_task_id: null }],
  can_lock: true, lock_reason: null,
};

describe("BOQ entry and links refresh", () => {
  beforeEach(() => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({
      matches: query === "(min-width: 768px)", media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }));
  });
  afterEach(() => { cleanup(); rpcMock.mockReset(); vi.restoreAllMocks(); });

  it("shows links immediately after finalise and refreshes BOQ entry after a links mutation", async () => {
    let entry = entryDraft;
    let links = noBoqLinks;
    let entryReads = 0;
    let linkReads = 0;
    rpcMock.mockImplementation(async (name: string, args: { p_action?: string }) => {
      if (name === "boq1_get") { entryReads += 1; return { data: entry, error: null }; }
      if (name === "boq2_get") { linkReads += 1; return { data: links, error: null }; }
      if (name === "boq1_mutate" && args.p_action === "finalise") {
        entry = { ...entry, header: { ...entry.header!, status: "final", final_at: "2026-11-26T21:00:00Z", entry_version: 2 }, can_finalise: false };
        links = finalLinks;
        return { data: entry, error: null };
      }
      if (name === "boq2_mutate" && args.p_action === "lock") {
        links = { ...links, set: { status: "locked", version: 1, locked_at: "2026-11-26T21:01:00Z" }, can_lock: false, lock_reason: "Links are already locked." };
        return { data: links, error: null };
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><BoqEntry projectId="project-1" /><BoqLinks projectId="project-1" /></MemoryRouter></QueryClientProvider>);

    const linksPanel = () => screen.getByLabelText("BOQ links");
    expect(await within(linksPanel()).findByText("This project has no BOQ yet.")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Finalise BOQ" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finalise and lock" }));

    expect(await within(linksPanel()).findByText("Fresh roof panel")).toBeInTheDocument();
    expect(within(linksPanel()).queryByText("This project has no BOQ yet.")).not.toBeInTheDocument();
    expect(linkReads).toBe(2);
    expect(entryReads).toBe(1);

    fireEvent.click(within(linksPanel()).getByRole("button", { name: "Lock links" }));
    await within(linksPanel()).findByText("Links are already locked.");
    await waitFor(() => expect(entryReads).toBe(2));
    queryClient.clear();
  });
});
