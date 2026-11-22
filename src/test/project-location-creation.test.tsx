import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
const s = vi.hoisted(() => ({ role: "managing_director", writes: vi.fn(), rpc: vi.fn(), user: { id: "creator" } }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ role: s.role }) }));
vi.mock("@/hooks/useProjectArchitect", () => ({ fetchArchitectCandidates: async () => [{ id: "architect", display_name: "Assigned architect" }] }));
vi.mock("@/components/ui/select", () => ({ Select: ({ value, onValueChange, children }: any) => <select value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>, SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: any) => <>{children}</>, SelectItem: ({ value, children }: any) => <option value={value}>{children}</option> }));
vi.mock("@/components/ui/calendar", () => ({ Calendar: ({ onSelect }: any) => <button type="button" onClick={() => onSelect(new Date(2026, 10, 22))}>Choose date</button> }));
vi.mock("@/lib/notifications", () => ({ insertNotifications: async () => undefined }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: s.rpc, from: (table: string) => {
  const b: any = { select: () => b, eq: () => b, insert: (rows: unknown) => { s.writes(table, rows); return b; }, single: async () => ({ data: { id: table === "projects" ? "project" : "panel-parent" }, error: null }), then: (resolve: any) => Promise.resolve({ data: table === "modules" ? [{ id: "module-1" }, { id: "module-2" }] : [], error: null }).then(resolve) }; return b;
} } }));
vi.mock("@/lib/auth-client", async () => ({ getAuthedClient: async () => ({ client: (await import("@/integrations/supabase/client")).supabase, session: { user: s.user } }) }));
beforeEach(() => { s.writes.mockReset(); s.rpc.mockReset(); s.rpc.mockResolvedValue({ data: "request", error: null }); s.role = "managing_director"; });
afterEach(cleanup);
async function fill() {
  render(<NewProjectDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Project Name *"), { target: { value: "Validation project" } });
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
it("MD creation still creates two modules and three panels and stores the contact only on projects", async () => {
  await fill(); fireEvent.click(screen.getByRole("button", { name: "Create Project" }));
  await waitFor(() => expect(s.writes.mock.calls.find(([table]) => table === "panels")?.[1]).toHaveLength(3));
  expect(s.writes.mock.calls.find(([table, rows]) => table === "modules" && Array.isArray(rows))?.[1]).toHaveLength(2);
  expect(s.writes.mock.calls.find(([table]) => table === "projects")?.[1]).toMatchObject({ client_phone: "+919876543210", client_email: "private@example.invalid", site_radius: 300 });
  expect(s.writes.mock.calls.find(([table]) => table === "production_stages")?.[1].length).toBeGreaterThan(0);
});
it("Planning Head sends contact separately from the approval payload and never inserts a project", async () => {
  s.role = "planning_head"; await fill(); fireEvent.click(screen.getByRole("button", { name: "Send for Approval" }));
  await waitFor(() => expect(s.rpc).toHaveBeenCalledWith("raise_project_request", expect.objectContaining({ p_phone: "+919876543210", p_email: "private@example.invalid" })));
  const payload = s.rpc.mock.calls[0][1].p_payload;
  expect(payload).not.toHaveProperty("client_phone"); expect(payload).not.toHaveProperty("client_email");
  expect(JSON.stringify(payload)).not.toContain("9876543210"); expect(JSON.stringify(payload)).not.toContain("private@example.invalid");
  expect(s.writes.mock.calls.filter(([table]) => table === "projects")).toHaveLength(0);
});