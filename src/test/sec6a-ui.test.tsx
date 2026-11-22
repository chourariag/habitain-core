import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ClientPortal from "@/pages/ClientPortal";
import { ClientPortalManager } from "@/components/projects/ClientPortalManager";
import { AdvanceApprovalsTab } from "@/components/finance/AdvanceApprovalsTab";
import { DeliveryTrackerTab } from "@/components/procurement/DeliveryTrackerTab";

const state = vi.hoisted(() => ({ role: "managing_director", valid: true, owner: "requester", rpc: vi.fn(), update: vi.fn(), error: vi.fn(), success: vi.fn(), notifications: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: state.success } }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: state.role, roles: state.role === "architecture_director" ? ["architecture_director", "principal_architect"] : [state.role] }) }));
vi.mock("@/lib/notifications", () => ({ insertNotifications: state.notifications }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: state.rpc, auth: { getUser: async () => ({ data: { user: { id: "requester" } } }) },
  from: (table: string) => {
    const data = () => table === "advance_requests" ? [{ id: "advance", employee_id: state.owner, amount: 100, status: "pending", employee_name: "Employee", purpose: "Travel", created_at: "2026-11-22" }] : table === "material_delivery_tracker" ? [
      { id: "1", project_id: "project", material_category: "+cmd", planned_delivery_date: null, actual_delivery_date: null, delay_days: -2, status: "On Track", risk_level: "Low", mitigation_note: "-2+3" },
      { id: "2", project_id: "project", material_category: "@A1", planned_delivery_date: null, actual_delivery_date: null, delay_days: 0, status: "On Track", risk_level: "Low", mitigation_note: "=SUM(1+1)" },
    ] : [];
    const builder: any = { select: () => builder, eq: () => builder, order: () => builder, in: () => builder, limit: () => builder, insert: () => builder, update: (patch: any) => { state.update(patch); return builder; }, maybeSingle: async () => ({ data: null, error: null }), then: (resolve: any) => Promise.resolve({ data: data(), error: table === "advance_requests" && state.update.mock.calls.length && state.owner === "requester" ? { message: "You cannot approve, release or mark paid your own advance request." } : null }).then(resolve) };
    return builder;
  },
} }));
vi.mock("@/lib/auth-client", async () => ({ getAuthedClient: async () => ({ client: (await import("@/integrations/supabase/client")).supabase }) }));
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  state.role = "managing_director"; state.valid = true; state.owner = "requester";
  state.rpc.mockReset(); state.update.mockReset(); state.error.mockReset(); state.success.mockReset(); state.notifications.mockReset();
  state.rpc.mockImplementation((name: string) => {
    const response = { data: name === "get_project_by_any_portal_token" ? state.valid ? { id: "project", name: "Existing Project", client_name: "Client", status: "Active", division: "Habitainer", start_date: "2026-11-01" } : null : name === "get_project_client_portal_token" ? null : [], error: null };
    return { ...Promise.resolve(response), then: (resolve: any) => Promise.resolve(response).then(resolve), maybeSingle: async () => response };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const roles = ["site_engineer", "site_installation_mgr", "factory_floor_supervisor", "finance_manager", "head_of_projects", "planning_head", "quantity_surveyor", "costing_engineer", "managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"];
describe.each(roles)("SEC6a portal unchanged for %s", role => {
  it("loads a valid link with only the projected project fields", async () => {
    state.role = role;
    render(<MemoryRouter initialEntries={["/client/valid"]}><Routes><Route path="/client/:projectToken" element={<ClientPortal />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Existing Project" })).toBeInTheDocument();
    expect(state.rpc).toHaveBeenCalledWith("get_project_by_any_portal_token", { _token: "valid" });
  });
  it.each(["expired", "revoked"])("refuses a %s link before loading project children", async token => {
    state.role = role; state.valid = false;
    render(<MemoryRouter initialEntries={[`/client/${token}`]}><Routes><Route path="/client/:projectToken" element={<ClientPortal />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: /This link is no longer valid/ })).toBeInTheDocument();
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
});
describe.each(["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"])("unchanged approval screen %s", role => {
  it("surfaces server self-approval rejection without sending a notification", async () => {
    state.role = role; render(<AdvanceApprovalsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" }).at(-1) as HTMLElement);
    await waitFor(() => expect(state.error).toHaveBeenCalledWith("You cannot approve, release or mark paid your own advance request."));
    expect(state.notifications).not.toHaveBeenCalled();
  });
  it("still approves a different request with the existing visible action", async () => {
    state.role = role; state.owner = "other"; render(<AdvanceApprovalsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Approve" }).at(-1) as HTMLElement);
    await waitFor(() => expect(state.success).toHaveBeenCalledWith("Advance approved"));
    expect(state.notifications).toHaveBeenCalledTimes(1);
  });
});
it("the link manager defaults to a configurable 90-day lifetime", async () => {
  render(<ClientPortalManager projectId="project" userRole="managing_director" />);
  const days = screen.getByLabelText("Link validity (days)") as HTMLInputElement;
  expect(days.value).toBe("90");
  fireEvent.change(days, { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate Magic Link" }));
  await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("manage_project_portal_link", { p_project_id: "project", p_action: "generate", p_days: 7 }));
});
it("a real delivery Export download neutralizes all four requested strings and retains numeric delay", async () => {
  let exported: Blob | undefined;
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL(blob: Blob) { exported = blob; return "blob:export"; }
    static revokeObjectURL() {}
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<DeliveryTrackerTab userRole="managing_director" projects={[{ id: "project", name: "Existing Project" }]} />);
  await screen.findByText("+cmd");
  fireEvent.click(screen.getByRole("button", { name: "Export" }));
  if (!exported) throw new Error("Download missing");
  const csv = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(exported as Blob); });
  for (const text of ["=SUM(1+1)", "+cmd", "-2+3", "@A1"]) expect(csv).toContain(`"'${text}"`);
  expect(csv).toContain(',"-2",');
});