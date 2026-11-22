import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CheckInButton } from "@/components/attendance/CheckInButton";
import { SITE_LOCATION_MISSING } from "@/lib/project-location";
const state = vi.hoisted(() => ({ user: { id: "user" }, pin: { site_lat: 12.9716 as number | null, site_lng: 77.5946 as number | null, site_radius: 300 }, position: { latitude: 12.9716, longitude: 77.5946, accuracy: 10 }, insert: vi.fn(), gps: vi.fn() }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/contexts/ProjectContext", () => ({ useProjectContext: () => ({ projects: [{ id: "project", name: "Site project" }] }) }));
vi.mock("@/components/OfflineProvider", () => ({ useConnectionStatus: () => "online" }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const builder: any = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: table === "projects" ? state.pin : null, error: null }), insert: async (row: unknown) => { state.insert(row); return { error: null }; } }; return builder;
} } }));
vi.mock("@/components/ui/select", () => ({ Select: ({ value, onValueChange, children }: any) => <select value={value} onChange={e => onValueChange(e.target.value)}>{children}</select>, SelectTrigger: () => null, SelectValue: () => null, SelectContent: ({ children }: any) => <>{children}</>, SelectItem: ({ value, children }: any) => <option value={value}>{children}</option> }));
beforeEach(() => {
  state.pin = { site_lat: 12.9716, site_lng: 77.5946, site_radius: 300 }; state.position = { latitude: 12.9716, longitude: 77.5946, accuracy: 10 }; state.insert.mockReset(); state.gps.mockReset();
  state.gps.mockImplementation((success: (position: unknown) => void) => success({ coords: state.position }));
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: state.gps } });
});
afterEach(cleanup);
async function verifySite() {
  render(<CheckInButton userRole="site_engineer" />);
  fireEvent.click(await screen.findByRole("button", { name: /Check In Now/ }));
  fireEvent.click(screen.getByRole("button", { name: /Site Project location/ }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "project" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify Location" }));
}
describe("site check-in rules", () => {
  it("blocks missing pins before obtaining GPS or inserting attendance", async () => {
    state.pin.site_lat = null; await verifySite();
    await screen.findByText(SITE_LOCATION_MISSING); expect(state.gps).not.toHaveBeenCalled(); expect(state.insert).not.toHaveBeenCalled();
  });
  it("retains a verified check-in inside the configured pin", async () => {
    await verifySite(); fireEvent.click(await screen.findByRole("button", { name: "Confirm Check In" }));
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ project_id: "project", gps_verified: true, gps_lat: 12.9716, gps_lng: 77.5946 })));
  });
  it("retains failed verification outside the radius and the existing note exception", async () => {
    state.position.latitude = 13.0716; await verifySite();
    const confirm = await screen.findByRole("button", { name: "Confirm Check In" });
    expect(confirm).toBeDisabled(); expect(state.insert).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText(/Client meeting at Whitefield/), { target: { value: "Off-site client meeting" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ gps_verified: false, location_note: "Off-site client meeting" })));
  });
});