import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createHash, timingSafeEqual } from "node:crypto";

const LOCKED = ["auto-submit-draft-expenses", "daily-checkin-nudge", "approval-rejection-dm", "error-attribution-dm"];
function fixture(name: string) {
  let handler: (req: Request) => Promise<Response> = async () => new Response("not loaded", { status: 500 });
  const effects = { serviceReads: 0, clients: 0, writes: 0, sends: 0, logs: 0 };
  const env: Record<string, string> = { LOVABLE_CRON_SECRET: "fixture-managed-secret", SUPABASE_URL: "https://example.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-service", SLACK_BOT_TOKEN: "fixture-slack" };
  function createClient() {
    effects.clients++;
    return {
      auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
      from() {
        const q: any = { then: (fn: (v: unknown) => unknown) => fn({ data: [], error: null }) };
        for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"]) q[method] = () => q;
        for (const method of ["insert", "update", "upsert"]) q[method] = () => { effects.writes++; return q; };
        return q;
      },
    };
  }
  const cache = new Map<string, any>();
  const evaluate = (path: string): any => {
    if (cache.has(path)) return cache.get(path);
    const exports = {}; cache.set(path, exports);
    const js = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    class FixtureDate extends Date { constructor(value?: string | number) { super(value ?? "2026-11-05T11:00:00Z"); } static now() { return Date.parse("2026-11-05T11:00:00Z"); } }
    vm.runInNewContext(js, {
      exports, module: { exports }, Request, Response, URL, Date: FixtureDate,
      console: { log() {}, error() {} },
      Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: (key: string) => { if (key === "SUPABASE_SERVICE_ROLE_KEY") effects.serviceReads++; return env[key]; } } },
      require: (spec: string) => {
        if (spec === "node:crypto") return { createHash, timingSafeEqual };
        if (spec.endsWith("/cors")) return { corsHeaders: {} };
        if (spec.includes("supabase-js")) return { createClient };
        if (spec.endsWith("error-log.ts")) return { logTechnicalError: async () => { effects.logs++; } };
        if (spec.startsWith(".")) return evaluate(resolve(dirname(path), spec));
        throw new Error(`Unexpected dependency: ${spec}`);
      },
      fetch: async () => { effects.sends++; return new Response(JSON.stringify({ ok: true })); },
    });
    return exports;
  };
  evaluate(resolve("supabase/functions", name, "index.ts"));
  return {
    effects,
    async call(token?: string) {
      const req = new Request(`https://example.invalid/${name}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: '{"trigger":"scheduled"}' });
      for (const method of ["json", "text", "formData", "arrayBuffer", "blob"]) Object.defineProperty(req, method, { value: () => { throw new Error("Incoming body must remain unread"); } });
      Object.defineProperty(req, "body", { get: () => { throw new Error("Incoming body must remain unread"); } });
      return handler(req);
    },
  };
}
for (const name of LOCKED) {
  describe(`${name}: migrated cron-only handler`, () => {
    for (const token of [undefined, "wrong-bearer", "valid-user"]) {
      it(`${token ?? "no credential"}: 401 before service access or effects`, async () => {
        const f = fixture(name); const response = await f.call(token);
        expect(response.status).toBe(401);
        expect(f.effects).toEqual({ serviceReads: 0, clients: 0, writes: 0, sends: 0, logs: 0 });
      });
    }
    it("managed bearer reaches the original handler with the incoming body unread", async () => {
      const f = fixture(name); const response = await f.call("fixture-managed-secret");
      expect(response.status).toBe(200);
      expect(f.effects.clients).toBe(1);
      expect(f.effects.serviceReads).toBe(1);
      if (name === "auto-submit-draft-expenses") expect(f.effects.writes).toBe(1);
      if (name === "daily-checkin-nudge") expect(f.effects.sends).toBe(1); // mock rollup only, no network
    });
  });
}
it("KPI bare managed target really performs daily computation, not 400", async () => {
  const f = fixture("kpi-recompute");
  const response = await f.call("fixture-managed-secret");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ mode: "daily", count: 0 });
  expect(f.effects.sends).toBe(0);
});
