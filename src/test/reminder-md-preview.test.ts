import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync("drizzle/migrations/0026_p7c_md_dated_previews.sql", "utf8");
describe("MD dated reminder previews", () => {
  it("honours as-of only for dry previews by super admin or managing director", () => {
    expect(sql).toContain("IF p_dry AND p_asof IS NOT NULL AND (public.has_role(auth.uid(),''super_admin'') OR public.has_role(auth.uid(),''managing_director'')) THEN v_now:=p_asof; END IF;");
  });
  it("changes only the as-of guard, leaving delivery and scheduling untouched", () => {
    expect(sql).not.toMatch(/INSERT|UPDATE public|cron\.schedule|CREATE ROLE|GRANT/i);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.run_reminders");
  });
});