import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { webcrypto, createHash, timingSafeEqual } from "node:crypto";

const MACHINE = ["dispatch-14-day-trigger", "fixed-asset-service-reminders", "kpi-recompute", "labour-claim-sla-escalation", "measurement-submission-checks", "salary-review-notifier", "site-schedule-trigger", "weekly-report-reminders", "work-order-escalation"];
const USER = ["generate-project-archive", "site-photo-analyze", "floor-plan-analyze", "capacity-ai-analysis", "send-calendar-invite", "send-email"];
const PROJECT = "11111111-1111-4111-8111-111111111111";
const RECORD = "22222222-2222-4222-8222-222222222222";
const RECIPIENT = "33333333-3333-4333-8333-333333333333";
let role: string, projectAccess: boolean, floorManage: boolean, locked: boolean, ownPhoto: boolean, notificationOwner: string;
let writes: number, deliveries: Array<Record<string, any>>, rpcArgs: Array<{ name: string; args: any }>;
beforeEach(() => { role = "managing_director"; projectAccess = true; floorManage = true; locked = false; ownPhoto = false; notificationOwner = "caller"; writes = 0; deliveries = []; rpcArgs = []; });

function client(_url: string, key: string, options?: any) {
  const token = options?.global?.headers?.Authorization || "";
  const admin = key === "test-service";
  return {
    auth: { getUser: async () => ({ data: { user: token === "Bearer valid-user" ? { id: "caller" } : null }, error: null }) },
    from(table: string) {
      let single = false, column = "";
      const data = () => {
        if (table === "user_roles") return [{ role }];
        if (table === "profiles") return single ? { is_active: true } : [{ auth_user_id: RECIPIENT, email: "fixture@example.invalid", is_active: true, role }];
        if (table === "site_position_photos") return single ? { id: RECORD, project_id: PROJECT, position_id: RECORD, photo_date: "2026-11-21", file_url: "https://example.invalid/photo" } : [];
        if (table === "floor_plans") return { id: RECORD, project_id: PROJECT, is_locked: locked, uploaded_by: ownPhoto ? "caller" : "other", file_url: "https://example.invalid/plan" };
        if (table === "notifications") return single ? { recipient_id: notificationOwner } : [];
        if (table === "projects" && single) return { id: PROJECT, name: "Fixture" };
        return single ? null : [];
      };
      const builder: any = {
        select: (value: string) => { column = value; return builder; },
        update: () => { writes++; return builder; }, insert: () => { writes++; return builder; }, upsert: () => { writes++; return builder; },
        eq: () => builder, neq: () => builder, in: () => builder, not: () => builder, is: () => builder, lt: () => builder, lte: () => builder, gte: () => builder, gt: () => builder, order: () => builder, limit: () => builder, or: () => builder, ilike: () => builder,
        single: async () => { single = true; return { data: data(), error: null, count: 0 }; },
        maybeSingle: async () => { single = true; return { data: data(), error: null, count: 0 }; },
        then: (fn: (value: any) => void) => fn({ data: data(), error: null, count: 0 }),
      };
      return builder;
    },
    async rpc(name: string, args: any) {
      rpcArgs.push({ name, args });
      return { data: name === "user_can_access_project" ? projectAccess : name === "can_manage_floor_plan" ? floorManage : name === "is_md" ? role === "managing_director" : [], error: null };
    },
    storage: { from: () => ({ upload: async () => { writes++; return { error: null }; }, createSignedUrl: async () => ({ data: { signedUrl: "https://example.invalid/mock" } }) }) },
  };
}
function loadHandler(name: string) {
  let handler: (req: Request) => Promise<Response> = async () => new Response("Missing", { status: 500 });
  const env: Record<string, string> = { SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "test-public", SUPABASE_SERVICE_ROLE_KEY: "test-service", LOVABLE_CRON_SECRET: "test-cron", LOVABLE_API_KEY: "test-ai", RESEND_API_KEY: "test-mail" };
  const cache = new Map<string, any>();
  const evaluate = (path: string): any => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(output, {
      exports, module: { exports }, Response, Request, URL, TextEncoder, crypto: webcrypto,
      Deno: { env: { get: (key: string) => env[key] }, serve: (fn: typeof handler) => { handler = fn; } },
      console: { log() {}, error() {} }, btoa: (s: string) => Buffer.from(s).toString("base64"),
      require: (specifier: string) => {
        if (specifier === "node:crypto") return { createHash, timingSafeEqual };
        if (specifier.includes("supabase-js") && specifier.endsWith("/cors")) return { corsHeaders: {} };
        if (specifier.includes("supabase-js")) return { createClient: client };
        if (specifier.includes("jszip")) return { __esModule: true, default: class { file() { return this; } folder() { return this; } async generateAsync() { return new Uint8Array([1]); } } };
        if (specifier.endsWith("error-log.ts")) return { logTechnicalError: async () => {} };
        if (specifier.startsWith(".")) return evaluate(resolve(dirname(path), specifier));
        throw new Error("Unexpected test dependency");
      },
      fetch: async (url: string, options: any) => {
        if (url.includes("resend")) { deliveries.push(JSON.parse(options.body)); return new Response(JSON.stringify({ id: "mock-delivery" })); }
        return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ positions: [], flags: [], summary: "Mock", capacity_weeks: [] }) } }] } }] }));
      },
    });
    return exports;
  };
  evaluate(resolve("supabase/functions", name, "index.ts"));
  return (token?: string, body: any = {}) => handler(new Request(`https://example.invalid/${name}?mode=daily`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
}
function bodyFor(name: string) {
  if (name === "generate-project-archive") return { project_id: PROJECT };
  if (name === "site-photo-analyze") return { photo_id: RECORD, project_id: "ignored-body-project" };
  if (name === "floor-plan-analyze") return { floor_plan_id: RECORD, project_id: "ignored-body-project" };
  if (name === "send-calendar-invite") return { project_id: PROJECT, attendee_emails: ["fixture@example.invalid"], title: "Fixture", date: "2026-11-21", time: "10:00" };
  if (name === "send-email") return { to: ["fixture@example.invalid"], subject: "Fixture", html: "Fixture" };
  return {};
}

describe("Scoped Edge caller checks — no live effects", () => {
  for (const name of [...MACHINE, ...USER]) {
    it(`${name}: no credential is 401 before effects`, async () => {
      const response = await loadHandler(name)(undefined, bodyFor(name));
      expect(response.status).toBe(401); await response.text(); expect(writes).toBe(0); expect(deliveries.length).toBe(0);
    });
    it(`${name}: wrong cron secret is 401 before effects`, async () => {
      const response = await loadHandler(name)("wrong-cron", bodyFor(name));
      expect(response.status).toBe(401); await response.text(); expect(writes).toBe(0); expect(deliveries.length).toBe(0);
    });
    it(`${name}: unprivileged user is 403 before effects`, async () => {
      role = "electrical_installer"; projectAccess = false; floorManage = false;
      const response = await loadHandler(name)("valid-user", bodyFor(name));
      expect(response.status).toBe(403); await response.text(); expect(writes).toBe(0); expect(deliveries.length).toBe(0);
    });
    it(`${name}: allowed credential succeeds using mocks only`, async () => {
      const response = await loadHandler(name)(MACHINE.includes(name) ? "test-cron" : "valid-user", bodyFor(name));
      expect(response.status).toBe(200); await response.text();
    });
  }
  for (const name of MACHINE) {
    it(`${name}: Tier 1 manual fallback succeeds`, async () => {
      const response = await loadHandler(name)("valid-user"); expect(response.status).toBe(200); await response.text();
    });
  }
  for (const name of ["site-photo-analyze", "floor-plan-analyze"]) {
    it(`${name}: project is resolved from the stored record, never from body`, async () => {
      const response = await loadHandler(name)("valid-user", bodyFor(name)); await response.text();
      expect(rpcArgs.find(r => r.name === "user_can_access_project")?.args._project_id).toBe(PROJECT);
    });
  }
  it("floor-plan-analyze applies the locked-row RLS update rule", async () => {
    role = "operations_architect"; locked = true;
    const response = await loadHandler("floor-plan-analyze")("valid-user", bodyFor("floor-plan-analyze"));
    expect(response.status).toBe(403); await response.text(); expect(writes).toBe(0);
  });
  it("calendar rejects more than 20 attendees", async () => {
    const response = await loadHandler("send-calendar-invite")("valid-user", { ...bodyFor("send-calendar-invite"), attendee_emails: Array.from({ length: 21 }, (_, i) => `fixture${i}@example.invalid`) });
    expect(response.status).toBe(400); await response.text(); expect(deliveries.length).toBe(0);
  });
  it("calendar rejects a non-http(s) link", async () => {
    const response = await loadHandler("send-calendar-invite")("valid-user", { ...bodyFor("send-calendar-invite"), meeting_link: "javascript:alert(1)" });
    expect(response.status).toBe(400); await response.text(); expect(deliveries.length).toBe(0);
  });
  it("calendar escapes title, notes and link attributes", async () => {
    const response = await loadHandler("send-calendar-invite")("valid-user", { ...bodyFor("send-calendar-invite"), title: "<script>x</script>", notes: '<img onerror="x">', meeting_link: 'https://example.invalid/?q="&x=1' }); await response.text();
    expect(deliveries[0]?.html).not.toContain("<script>"); expect(deliveries[0]?.html).not.toContain("<img onerror"); expect(deliveries[0]?.html).toContain("&quot;");
  });
  it("email denies an unregistered recipient", async () => {
    const response = await loadHandler("send-email")("valid-user", { ...bodyFor("send-email"), to: ["outsider@example.invalid"] });
    expect(response.status).toBe(403); await response.text(); expect(deliveries.length).toBe(0);
  });
  it("email denies another user's notification id", async () => {
    notificationOwner = "other";
    const response = await loadHandler("send-email")("valid-user", { ...bodyFor("send-email"), notification_id: RECORD });
    expect(response.status).toBe(403); await response.text(); expect(deliveries.length).toBe(0);
  });
  it("email escapes arbitrary user HTML", async () => {
    const response = await loadHandler("send-email")("valid-user", { ...bodyFor("send-email"), html: "<script>x</script>" }); await response.text();
    expect(deliveries[0]?.html).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
  });
  for (const credential of ["test-cron", "test-service"]) {
    it(`email accepts its ${credential === "test-cron" ? "cron" : "service"} internal credential and keeps internal markup`, async () => {
      const response = await loadHandler("send-email")(credential, { to: ["external@example.invalid"], subject: "Internal", html: "<b>Trusted template</b>" });
      expect(response.status).toBe(200); await response.text(); expect(deliveries[0]?.html).toBe("<b>Trusted template</b>");
    });
  }
  for (const permitted of ["production_head", "head_operations", "planning_engineer", "super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"]) {
    it(`capacity permits the screen's ${permitted} role`, async () => {
      role = permitted;
      const response = await loadHandler("capacity-ai-analysis")("valid-user");
      expect(response.status).toBe(200); await response.text();
    });
  }
  for (const rejected of ["finance_manager", "costing_engineer", "principal_architect"]) {
    it(`capacity denies the wider Setup-only ${rejected} role`, async () => {
      role = rejected;
      const response = await loadHandler("capacity-ai-analysis")("valid-user");
      expect(response.status).toBe(403); await response.text(); expect(writes).toBe(0);
    });
  }
  for (const permitted of ["operations_architect", "principal_architect", "head_operations"]) {
    it(`calendar permits the existing ${permitted} caller`, async () => {
      role = permitted;
      const response = await loadHandler("send-calendar-invite")("valid-user", bodyFor("send-calendar-invite"));
      expect(response.status).toBe(200); await response.text();
    });
  }
  it("archive permits an assigned Head of Projects", async () => {
    role = "head_of_projects";
    const response = await loadHandler("generate-project-archive")("valid-user", bodyFor("generate-project-archive"));
    expect(response.status).toBe(200); await response.text();
  });
  it("archive denies an unassigned Head of Projects", async () => {
    role = "head_of_projects"; projectAccess = false;
    const response = await loadHandler("generate-project-archive")("valid-user", bodyFor("generate-project-archive"));
    expect(response.status).toBe(403); await response.text(); expect(writes).toBe(0);
  });
});