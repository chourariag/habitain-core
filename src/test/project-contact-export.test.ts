import { describe, expect, it } from "vitest";
import { withoutProjectClientContact } from "../../supabase/functions/_shared/project-contact-privacy";
import { EXPORT_SCHEMA } from "../../supabase/functions/_shared/export-schema";
import { PROJECT_PUBLIC_SELECT } from "@/lib/project-location";
describe("project contact never enters public data or exports", () => {
  it("strips both contact values and portal credentials from the archive", () => {
    expect(withoutProjectClientContact({ id: "project", name: "Project", client_phone: "+919876543210", client_email: "private@example.invalid", client_portal_token: "private-token" })).toEqual({ id: "project", name: "Project" });
  });
  it("does not expose private contact in nightly project columns", () => {
    const columns = EXPORT_SCHEMA.find(table => table.table === "projects")?.columns.map(c => c.name);
    expect(columns).toContain("id"); expect(columns).not.toContain("client_phone"); expect(columns).not.toContain("client_email");
  });
  it("does not select contact into project list data", () => {
    expect(PROJECT_PUBLIC_SELECT.split(",")).toContain("site_lat");
    expect(PROJECT_PUBLIC_SELECT.split(",")).not.toContain("client_phone"); expect(PROJECT_PUBLIC_SELECT.split(",")).not.toContain("client_email");
  });
});