import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProjectLocationContact } from "@/components/projects/ProjectLocationContact";
import { isTier1OrSuper } from "@/lib/roles";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
const project = { id: "project", location: "Bengaluru", site_lat: 12.9716, site_lng: 77.5946, site_radius: 300 };
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: [{ client_phone: "+919876543210", client_email: "client@example.com" }], error: null }); });
afterEach(cleanup);
describe("unchanged director-only contact role matrix", () => {
  it.each(["managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"])("allows %s", role => expect(isTier1OrSuper(role)).toBe(true));
  it.each(["finance_manager", "head_of_projects", "principal_architect", "project_architect", "site_installation_mgr", "sales_executive", "sales_associate", "marketing", "accounts_executive", "head_operations", "site_engineer", null])("denies %s", role => expect(isTier1OrSuper(role)).toBe(false));
});
describe("checked project editors", () => {
  it("sends a location edit through the checked writer", async () => {
    const saved = vi.fn();
    render(<ProjectLocationContact project={project} role="head_of_projects" contact={null} onSaved={saved} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit site location" }));
    fireEvent.change(screen.getByLabelText("Site address *"), { target: { value: "New address" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("set_project_site_location", { p_project_id: "project", p_address: "New address", p_lat: 12.9716, p_lng: 77.5946, p_radius: 300 }));
    expect(saved).toHaveBeenCalledOnce();
  });
  it("does not send an invalid radius", () => {
    render(<ProjectLocationContact project={project} role="head_of_projects" contact={null} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit site location" }));
    fireEvent.change(screen.getByLabelText("Attendance radius (metres) *"), { target: { value: "49" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save changes" }).closest("form") as HTMLFormElement);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("normalises contact before the director-only writer", async () => {
    render(<ProjectLocationContact project={project} role="sales_director" contact={null} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit client contact" }));
    fireEvent.change(screen.getByLabelText("Client phone *"), { target: { value: "9876543210" } });
    fireEvent.change(screen.getByLabelText("Client email *"), { target: { value: "client@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("set_project_client_contact", { p_project_id: "project", p_phone: "+919876543210", p_email: "client@example.com" }));
  });
});