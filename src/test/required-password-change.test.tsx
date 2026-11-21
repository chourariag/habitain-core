import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { RequiredPasswordChange } from "@/components/RequiredPasswordChange";

const mock = vi.hoisted(() => ({ required: true, signedIn: true, change: vi.fn(), signOut: vi.fn(), update: vi.fn(), authCallback: null as null | ((event: string, session: unknown) => void) }));
vi.mock("@/lib/change-password", () => ({ changeAccountPassword: (...args: unknown[]) => mock.change(...args) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: async () => ({ data: { session: mock.signedIn ? { user: { id: "account" } } : null } }),
    onAuthStateChange: (cb: typeof mock.authCallback) => { mock.authCallback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: mock.signOut,
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_active: true, must_change_password: mock.required, onboarding_completed: true } }), single: async () => ({ data: { must_change_password: mock.required } }) }) }) }),
} }));
beforeEach(() => { cleanup(); mock.required = true; mock.signedIn = true; mock.change.mockReset(); mock.signOut.mockReset(); });

describe("Mandatory password-change screen", () => {
  for (const path of ["/dashboard", "/projects", "/admin/users", "/profile"]) {
    it(`blocks ${path} while the persisted flag is set`, async () => {
      render(<MemoryRouter initialEntries={[path]}><AuthProvider><div>Protected account content</div></AuthProvider></MemoryRouter>);
      await screen.findByRole("heading", { name: "Set a new password" });
      expect(screen.queryByText("Protected account content")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(mock.signOut).toHaveBeenCalledOnce();
    });
  }
  it("does not intercept the unauthenticated kiosk flow", async () => {
    mock.signedIn = false;
    render(<MemoryRouter initialEntries={["/login"]}><AuthProvider><div>Kiosk PIN form</div></AuthProvider></MemoryRouter>);
    await screen.findByText("Kiosk PIN form");
    expect(screen.queryByRole("heading", { name: "Set a new password" })).not.toBeInTheDocument();
  });
  it("rechecks the flag when a signed-in session refreshes", async () => {
    mock.required = false;
    render(<MemoryRouter initialEntries={["/dashboard"]}><AuthProvider><div>Protected account content</div></AuthProvider></MemoryRouter>);
    await screen.findByText("Protected account content");
    mock.required = true;
    mock.authCallback?.("TOKEN_REFRESHED", { user: { id: "account" } });
    await screen.findByRole("heading", { name: "Set a new password" });
    expect(screen.queryByText("Protected account content")).not.toBeInTheDocument();
  });
  it("only releases protected content after a successful change and flag readback", async () => {
    mock.change.mockImplementation(async () => { mock.required = false; });
    render(<MemoryRouter><AuthProvider><div>Protected account content</div></AuthProvider></MemoryRouter>);
    await screen.findByLabelText("Current password");
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentTestOnly1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "ChangedTestOnly2" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "ChangedTestOnly2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await screen.findByText("Protected account content");
    expect(mock.change).toHaveBeenCalledOnce();
  });
  it("failed password updates keep the user on the change screen", async () => {
    mock.change.mockRejectedValue(new Error("Password change rejected"));
    render(<RequiredPasswordChange signOut={mock.signOut} onSuccess={mock.update} />);
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentTestOnly1" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "ChangedTestOnly2" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "ChangedTestOnly2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Password change rejected"));
    expect(mock.update).not.toHaveBeenCalled();
  });
});