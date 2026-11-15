import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("drizzle/migrations/0025_p7b_reminder_safety.sql", "utf8");
describe("P7b reminder safety", () => {
  it("enumerates only today and the preceding two days, after first activity", () => {
    expect(sql).toContain("(VALUES (0),(1),(2))");
    expect(sql).toContain("c.today-offset_days>=f.first_day");
    expect(sql).not.toContain("generate_series");
  });
  it("closes unresolved project windows older than three days without deleting", () => {
    expect(sql).toContain("resolved_by=''window_closed''");
    expect(sql).toContain("subject_date<(now() AT TIME ZONE ''Asia/Kolkata'')::date-3");
    expect(sql).not.toMatch(/DELETE FROM/i);
  });
  it("defaults effective date to 16 November 2026 and gates every subject", () => {
    expect(sql).toContain("effective_from date NOT NULL DEFAULT '2026-11-16'");
    expect(sql).toContain("d.report_day>=r.effective_from");
    expect(sql).toContain("e.entry_date>=r.effective_from AND e.created_at>=r.effective_from::timestamp AT TIME ZONE 'Asia/Kolkata'");
  });
  it("includes only draft, pending_hr and flagged expenses", () => {
    expect(sql).toContain("e.status IN ('draft','pending_hr','flagged')");
    expect(sql).not.toContain("e.status<>'rejected'");
  });
  it("only gates non-dry runs by the flag and only accepts super-admin as-of previews", () => {
    expect(sql).toContain("IF NOT p_dry AND NOT EXISTS");
    expect(sql).toContain("IF p_dry AND p_asof IS NOT NULL AND public.has_role(auth.uid(),''super_admin'') THEN v_now:=p_asof");
    expect(sql).toContain("public.reminder_subjects(v_now)");
    expect(sql).toContain("AND v_now>=s.due_at");
  });
});