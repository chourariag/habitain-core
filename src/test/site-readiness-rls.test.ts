import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * Backend regression test for the site_readiness RLS contract.
 *
 * Calls the read-only `test_site_readiness_rls()` database function, which
 * inspects the live INSERT/UPDATE policies on public.site_readiness and
 * asserts that delivery_rm_lead (Bala's role) is permitted while unrelated
 * roles (finance, procurement, QC, HR, sales, architecture, stores) are not.
 *
 * Requires a signed-in session (SITE_RLS_TEST_EMAIL / SITE_RLS_TEST_PASSWORD);
 * skipped when credentials are not provided so local runs stay offline-safe.
 */

type CheckRow = { check_name: string; passed: boolean; detail: string };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const email = process.env.SITE_RLS_TEST_EMAIL;
const password = process.env.SITE_RLS_TEST_PASSWORD;

const canRun = Boolean(url && key && email && password);

describe.skipIf(!canRun)("site_readiness RLS policy contract", () => {
  let rows: CheckRow[] = [];

  beforeAll(async () => {
    const supabase = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email!,
      password: password!,
    });
    if (authError) throw authError;

    const { data, error } = await supabase.rpc("test_site_readiness_rls");
    if (error) throw error;
    rows = (data ?? []) as CheckRow[];
  }, 30_000);

  it("returns policy checks", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("has RLS enabled with INSERT and UPDATE policies", () => {
    for (const name of ["rls_enabled", "insert_policy_exists", "update_policy_exists"]) {
      expect(rows.find((r) => r.check_name === name)?.passed, name).toBe(true);
    }
  });

  it("allows delivery_rm_lead to insert and update (regression: Bala / Pebble Beach House)", () => {
    expect(rows.find((r) => r.check_name === "insert_allows_delivery_rm_lead")?.passed).toBe(true);
    expect(rows.find((r) => r.check_name === "update_allows_delivery_rm_lead")?.passed).toBe(true);
  });

  it("blocks unrelated roles on insert and update", () => {
    const failures = rows.filter((r) => r.check_name.includes("_blocks_") && !r.passed);
    expect(failures.map((f) => f.check_name)).toEqual([]);
  });

  it("passes every backend check", () => {
    expect(rows.filter((r) => !r.passed).map((r) => r.check_name)).toEqual([]);
  });
});
