import { describe, expect, it, vi } from "vitest";
import { insertNotifications } from "@/lib/notifications";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(async (_name: string, _payload: unknown) => ({ data: {} })), select: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: "caller" } } } }) },
  functions: { invoke: mocks.invoke },
  from: (table: string) => table === "notifications" ? { insert: () => ({ select: async () => ({ error: null, data: [{ id: "own-notification" }, { id: "other-notification" }] }) }) } : {
    select: (columns: string) => { mocks.select(columns); return { in: async () => ({ data: [{ auth_user_id: "caller", role: "managing_director" }, { auth_user_id: "other", role: "managing_director" }] }) }; },
  },
} }));
describe("Client notification email ownership", () => {
  it("includes only the caller's notification id and resolves addresses on the server", async () => {
    await insertNotifications([{ recipient_id: "caller", title: "Fixture", body: "Fixture", category: "approval" }, { recipient_id: "other", title: "Fixture", body: "Fixture", category: "approval" }]);
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    const own = mocks.invoke.mock.calls[0]?.[1] as unknown as { body: Record<string, unknown> };
    const other = mocks.invoke.mock.calls[1]?.[1] as unknown as { body: Record<string, unknown> };
    expect(own.body.notification_id).toBe("own-notification");
    expect(other.body).not.toHaveProperty("notification_id");
    expect(other.body.recipient_ids).toEqual(["other"]);
    expect(other.body).not.toHaveProperty("html");
    expect(mocks.select).toHaveBeenCalledWith("auth_user_id, role");
  });
});