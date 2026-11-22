import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
const state = vi.hoisted(() => ({ role: "managing_director", allowed: false, rpc: vi.fn(), from: vi.fn(), grants: [] as any[] }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: state.role, userId: "caller" }) }));
vi.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlags: () => ({ isEnabled: () => false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc, from: state.from } }));
vi.mock("@/components/projects/NewProjectDialog", () => ({ NewProjectDialog: () => null }));
import { ProjectCreatorsTab } from "@/components/super-admin/ProjectCreatorsTab";
import Projects from "@/pages/Projects";
const candidate = { user_id: "candidate", name: "Active Site Engineer", roles: ["site_engineer"] };
const builtIn = { user_id: "director", name: "Director", roles: ["managing_director"], is_active: true, built_in: true };
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
beforeEach(() => {
  state.role = "managing_director"; state.allowed = false; state.grants = [];
  state.rpc.mockReset(); state.from.mockReset();
  state.rpc.mockImplementation(async (name: string) => {
    if (name === "can_create_project") return { data: state.allowed, error: null };
    if (name === "grant_project_creator") state.grants = [{ ...candidate, is_active: true, profile_active: true, note: "Named creator", granted_by_name: "Director", granted_at: "2026-11-22T12:00:00Z", revoked_at: null }];
    if (name === "revoke_project_creator") state.grants = state.grants.map(person => ({ ...person, is_active: false, revoked_at: "2026-11-22T12:01:00Z" }));
    return { data: name === "list_project_creators" ? { built_in_label: "Always allowed (Super Admin, MD, Directors)", built_in: [builtIn], grants: state.grants, candidates: state.grants.some(person => person.is_active) ? [] : [candidate] } : null, error: null };
  });
  state.from.mockImplementation(() => {
    const chain: Record<string, any> = {};
    for (const method of ["select", "eq", "in", "not", "order"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return chain;
  });
});
afterEach(cleanup);
const manage = () => render(<QueryClientProvider client={client()}><ProjectCreatorsTab /></QueryClientProvider>);
describe("project creator management", () => {
  for (const role of ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"]) it(`${role} loads creator management`, async () => {
    state.role = role; manage();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("list_project_creators"));
    expect(state.from).not.toHaveBeenCalled();
  });
  for (const role of ["head_operations", "planning_engineer", "finance_manager", "head_of_projects", "project_architect", "site_installation_mgr", "site_engineer", "sales_executive"]) it(`${role} cannot fetch creator management`, () => {
    state.role = role; manage(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("adds a searched active person, reads back their grant, then softly removes and reads back", async () => {
    manage();
    const addPerson = await screen.findByRole("button", { name: "Add person" });
    await waitFor(() => expect(addPerson).not.toBeDisabled());
    fireEvent.click(addPerson);
    fireEvent.change(screen.getByRole("textbox", { name: "Search active people by name or role" }), { target: { value: "site engineer" } });
    fireEvent.change(screen.getByLabelText("Note (optional)"), { target: { value: "Named creator" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Active Site Engineer" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("grant_project_creator", { p_user_id: "candidate", p_note: "Named creator" }));
    const remove = await screen.findByRole("button", { name: "Remove Active Site Engineer" });
    fireEvent.click(remove);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("revoke_project_creator", { p_user_id: "candidate" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove Active Site Engineer" })).not.toBeInTheDocument());
    expect(state.from).not.toHaveBeenCalled();
  });
  it("shows no mutation control for the built-in group", async () => {
    manage(); await screen.findByText("Director", { exact: true });
    expect(screen.queryByRole("button", { name: "Remove Director" })).not.toBeInTheDocument();
  });
});
describe("Projects button is controlled by server entitlement only", () => {
  for (const allowed of [false, true]) for (const role of ["managing_director", "site_engineer", "planning_engineer", "site_installation_mgr"]) it(`${role} button follows server ${allowed}`, async () => {
    state.allowed = allowed; state.role = role;
    render(<MemoryRouter><Projects /></MemoryRouter>);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("can_create_project", { _uid: "caller" }));
    if (allowed) await screen.findByRole("button", { name: "New Project" });
    else expect(screen.queryByRole("button", { name: "New Project" })).not.toBeInTheDocument();
  });
  it("fails closed when the permission reader errors", async () => {
    state.rpc.mockResolvedValue({ data: true, error: { message: "Unavailable" } });
    render(<MemoryRouter><Projects /></MemoryRouter>);
    await waitFor(() => expect(state.rpc).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "New Project" })).not.toBeInTheDocument();
  });
});