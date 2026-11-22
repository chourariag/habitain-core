import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
const s = vi.hoisted(() => ({ role: "managing_director", allowed: true, writes: vi.fn(), rpc: vi.fn(), user: { id: "creator" } }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: s.role, userId: s.user.id }) }));
vi.mock("@/hooks/useProjectArchitect", () => ({ fetchArchitectCandidates: async () => [{ id: "architect", display_name: "Assigned architect" }] }));
vi.mock("@/components/ui/select", () => ({ Select: ({ value, onValueChange, children }: any) => <select value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>, SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: any) => <>{children}</>, SelectItem: ({ value, children }: any) => <option value={value}>{children}</option> }));
vi.mock("@/components/ui/calendar", () => ({ Calendar: ({ onSelect }: any) => <button type="button" onClick={() => onSelect(new Date(2026, 10, 22))}>Choose date</button> }));
vi.mock("@/lib/notifications", () => ({ insertNotifications: async () => undefined }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: s.rpc, from: (table: string) => {
  const b: any = { select: () => b, eq: () => b, insert: (rows: unknown) => { s.writes(table, rows); return b; }, single: async () => ({ data: { id: table === "projects" ? "project" : "panel-parent" }, error: null }), then: (resolve: any) => Promise.resolve({ data: table === "modules" ? [{ id: "module-1" }, { id: "module-2" }] : [], error: null }).then(resolve) }; return b;
} } }));
vi.mock("@/lib/auth-client", async () => ({ getAuthedClient: async () => ({ client: (await import("@/integrations/supabase/client")).supabase, session: { user: s.user } }) }));
beforeEach(() => { s.writes.mockReset(); s.rpc.mockReset(); s.allowed = true; s.rpc.mockImplementation(async (name: string) => ({ data: name === "can_create_project" ? s.allowed : "project", error: null })); s.role = "managing_director"; });
afterEach(cleanup);
async function fill() {
  render(<NewProjectDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(await screen.findByLabelText("Project Name *"), { target: { value: "Validation project" } });
  fireEvent.change(screen.getByLabelText("Client Name *"), { target: { value: "Validation client" } });
  await waitFor(() => expect(screen.getByRole("option", { name: "Assigned architect" })).toBeInTheDocument());
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "architect" } });
  fireEvent.change(screen.getAllByRole("combobox")[2], { target: { value: "hybrid" } });
  fireEvent.change(screen.getByLabelText("Number of Modules"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Number of Panels"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Contract Value (₹) *"), { target: { value: "100000" } });
  fireEvent.click(screen.getAllByRole("button", { name: /Pick date/ })[0]); fireEvent.click(await screen.findByRole("button", { name: "Choose date" }));
  fireEvent.click(screen.getAllByRole("button", { name: /Pick date/ })[0]); fireEvent.click(await screen.findByRole("button", { name: "Choose date" }));
  fireEvent.change(screen.getByLabelText("Site address *"), { target: { value: "Bengaluru" } });
  fireEvent.change(screen.getByLabelText("Latitude *"), { target: { value: "12.9716" } });
  fireEvent.change(screen.getByLabelText("Longitude *"), { target: { value: "77.5946" } });
  fireEvent.change(screen.getByLabelText("Client phone *"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText("Client email *"), { target: { value: "private@example.invalid" } });
}
it("MD creation sends two modules, three panels and private contact through the atomic project writer", async () => {
  await fill(); fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
  await waitFor(() => expect(s.rpc).toHaveBeenCalledWith("create_project", expect.objectContaining({ p_phone: "+919876543210", p_email: "private@example.invalid", p_payload: expect.objectContaining({ module_count: 2, panel_count: 3, site_radius: 300 }) })));
  expect(s.writes).not.toHaveBeenCalled();
});
it("a granted Planning Head creates directly without putting contact in the project payload or an approval request", async () => {
  s.role = "planning_head"; await fill(); fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
  await waitFor(() => expect(s.rpc).toHaveBeenCalledWith("create_project", expect.objectContaining({ p_phone: "+919876543210", p_email: "private@example.invalid" })));
  const payload = s.rpc.mock.calls.find(([name]) => name === "create_project")?.[1].p_payload;
  expect(payload).not.toHaveProperty("client_phone"); expect(payload).not.toHaveProperty("client_email");
  expect(JSON.stringify(payload)).not.toContain("9876543210"); expect(JSON.stringify(payload)).not.toContain("private@example.invalid");
  expect(s.writes.mock.calls.filter(([table]) => table === "projects")).toHaveLength(0);
  expect(s.rpc.mock.calls.some(([name]) => name === "raise_project_request")).toBe(false);
});
it("a denied person cannot open the project dialog even with a director-looking screen role", async () => {
  s.allowed = false;
  render(<NewProjectDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
  await waitFor(() => expect(s.rpc).toHaveBeenCalledWith("can_create_project", { _uid: "creator" }));
  expect(screen.queryByRole("button", { name: "Create Project" })).not.toBeInTheDocument();
});