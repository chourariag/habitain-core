import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import ts from "typescript";
import vm from "node:vm";
import { generatePassword, passwordPolicyError, roleGrantError } from "../../supabase/functions/_shared/password-policy";

// Execute the real Edge handler with isolated in-memory Auth/Data clients.
// No existing account, password, role, email or activation is mutated.
let callerRoles: string[], roles: string[], profile: Record<string, unknown>, created: Record<string, unknown> | null;
let handler: (request: Request) => Promise<Response>;
let failRole = false;
let targetRole = "site_engineer";
let lastSuper = false;
const authAdmin = {
  createUser: vi.fn(async (input: Record<string, unknown>) => { created = input; return { data: { user: { id: "new-user" } }, error: null }; }),
  updateUserById: vi.fn(async () => ({ error: null })),
};

beforeEach(() => {
  callerRoles = ["super_admin"]; roles = ["site_engineer", "planning_engineer"];
  profile = { role: "super_admin", is_active: true, must_change_password: false };
  created = null; failRole = false; targetRole = "site_engineer"; lastSuper = false;
  const admin = {
    auth: { admin: authAdmin },
    from(table: string) {
      let target = "";
      const builder = {
        select: () => builder, eq: (key: string, value: string) => { if (key === "user_id" || key === "auth_user_id") target = value; return builder; },
        upsert: (value: Record<string, unknown>) => { if (table === "profiles") profile = { ...profile, ...value }; return builder; },
        insert: () => builder,
        update: (value: Record<string, unknown>) => { if (table === "profiles") profile = { ...profile, ...value }; return builder; },
        single: async () => ({ data: target === "caller" ? profile : { role: targetRole, id: "target-profile" }, error: null }),
        maybeSingle: async () => ({ data: profile, error: null }),
        then(resolve: (data: unknown) => void) { resolve({ data: table === "user_roles" ? (target === "caller" ? callerRoles : roles).map(role => ({ role })) : null, error: null }); },
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, string>) {
      if (name !== "admin_set_account_access") return { data: [], error: null };
      const denied = roleGrantError(callerRoles, args._caller, args._target, args._role, targetRole === "super_admin" ? [targetRole] : roles, lastSuper);
      if (denied || failRole) return { error: { code: "42501", message: denied || "Denied" } };
      roles = [args._role]; targetRole = args._role;
      return { error: null };
    },
  };
  const userClient = { auth: {
    getClaims: async () => ({ data: { claims: { sub: "caller" } }, error: null }),
    getUser: async () => ({ data: { user: { id: "caller" } }, error: null }),
    updateUser: async () => ({ error: null }),
  } };
  const source = readFileSync("supabase/functions/admin-users/index.ts", "utf8").replace(/^import .*;\s*$/gm, "");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  vm.runInNewContext(js, {
    Deno: { env: { get: (key: string) => key === "SUPABASE_SERVICE_ROLE_KEY" ? "test-service" : "test-public" }, serve: (fn: typeof handler) => { handler = fn; } },
    createClient: (_url: string, key: string) => key === "test-service" ? admin : userClient,
    corsHeaders: {}, crypto: webcrypto, Request, Response, TextEncoder,
    fetch: async () => new Response(JSON.stringify({ id: "caller" }), { status: 200 }),
    TIER1_ROLES: ["managing_director", "finance_director", "sales_director", "architecture_director"],
    isTier1: (r: string) => ["managing_director", "finance_director", "sales_director", "architecture_director"].includes(r),
    generatePassword, passwordPolicyError, roleGrantError,
  });
  vi.stubGlobal("crypto", webcrypto);
});

const call = (payload: Record<string, unknown>) => handler(new Request("https://local.invalid", { method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
describe("Account Edge authorization", () => {
  it("Super Admin grants Super Admin with exactly one resulting role row", async () => {
    const result = await call({ action: "update_role", user_id: "target", role: "super_admin" });
    expect(result.status).toBe(200); expect(roles).toEqual(["super_admin"]);
  });
  it("MD gets HTTP 403 granting Super Admin", async () => {
    callerRoles = ["managing_director"]; profile.role = "managing_director";
    expect((await call({ action: "update_role", user_id: "target", role: "super_admin" })).status).toBe(403);
  });
  it("MD grants site engineer and replaces the previous roles", async () => {
    callerRoles = ["managing_director"]; profile.role = "managing_director";
    expect((await call({ action: "update_role", user_id: "target", role: "site_engineer" })).status).toBe(200);
    expect(roles).toEqual(["site_engineer"]);
  });
  it("refuses self role changes with HTTP 403", async () => {
    expect((await call({ action: "update_role", user_id: "caller", role: "site_engineer" })).status).toBe(403);
  });
  it("refuses demotion of the last Super Admin with HTTP 403", async () => {
    targetRole = "super_admin"; lastSuper = true;
    expect((await call({ action: "update_role", user_id: "target", role: "site_engineer" })).status).toBe(403);
  });
  for (const action of ["create_user", "create_user_with_password", "create_employee"]) {
    it(`MD cannot grant Super Admin through ${action}`, async () => {
      callerRoles = ["managing_director"]; profile.role = "managing_director";
      expect((await call({ action, email: "fixture@example.invalid", full_name: "Fixture", role: "super_admin" })).status).toBe(403);
      expect(created === null).toBe(true);
    });
  }
  for (const action of ["create_user_with_password", "create_employee"]) {
    it(`${action} generates a password once and sets the mandatory-change flag`, async () => {
      const response = await call({ action, email: "fixture@example.invalid", full_name: "Fixture", role: "site_engineer" });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.temp_password === "string" && body.temp_password.length >= 16).toBe(true);
      expect(profile.must_change_password).toBe(true);
      // Compare secrets as booleans so failures never print credentials.
      expect(created?.password === body.temp_password).toBe(true);
    });
  }
  it("reset generates a password and locks the account", async () => {
    const response = await call({ action: "reset_password", user_id: "target" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(typeof body.temp_password === "string" && body.temp_password.length >= 16).toBe(true);
    expect(profile.must_change_password).toBe(true);
  });
  it("short explicit passwords are rejected by the server", async () => {
    expect((await call({ action: "create_employee", email: "fixture@example.invalid", full_name: "Fixture", role: "site_engineer", temp_password: "short" })).status).toBe(400);
    expect(created === null).toBe(true);
  });
  it("mandatory change blocks director account management", async () => {
    profile.must_change_password = true;
    expect((await call({ action: "update_role", user_id: "target", role: "site_engineer" })).status).toBe(403);
  });
  it("non-directors can complete their own password change", async () => {
    profile.must_change_password = true; callerRoles = ["site_engineer"];
    const response = await call({ action: "change_password", password: "ChangedTestOnly2", current_password: "CurrentTestOnly1" });
    expect(response.status).toBe(200); expect(profile.must_change_password).toBe(false);
  });
  it("migration replaces all role rows atomically and audits old/new/actor", () => {
    const sql = readFileSync("drizzle/migrations/0046_retired_password_account_role_security.sql", "utf8");
    expect(sql.indexOf("DELETE FROM public.user_roles WHERE user_id=_target;")).toBeLessThan(sql.indexOf("INSERT INTO public.user_roles(user_id,role)"));
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("public.get_sole_role_holders()");
    expect(sql).toContain("UPDATE public.profiles SET role=_role");
    expect(sql).toContain("admin_audit_log(action,performed_by,entity_type,entity_id,old_value,new_value)");
  });
});