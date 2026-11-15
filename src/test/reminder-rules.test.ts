import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURE_FLAG_DEFINITIONS } from "@/lib/feature-flags";

const sql = readFileSync("drizzle/migrations/0024_p7_shadow_reminders.sql", "utf8");
describe("P7 reminder rules", () => {
  it("keeps reminders disabled by default and exits before writes when disabled", () => {
    expect(FEATURE_FLAG_DEFINITIONS.find(r => r.key === "reminders")?.enabled).toBe(false);
    expect(sql.indexOf("key='reminders' AND enabled")).toBeLessThan(sql.indexOf("UPDATE public.reminder_events"));
    expect(sql).toContain("THEN RETURN '[]'::jsonb; END IF;");
  });
  it("checks construction completion strictly between zero and 100 or planned dates covering the day", () => {
    expect(sql).toContain("t.work_category='construction'");
    expect(sql).toContain("t.completion_percentage>0 AND t.completion_percentage<100");
    expect(sql).toContain("t.planned_start_date<=p_date AND t.planned_finish_date>=p_date");
    expect(sql).toContain("a.work_date=p_date");
  });
  it("requires a submitted non-archived daily site report for the same date", () => {
    expect(sql).toContain("m.measurement_date=d.report_day AND m.trade='daily_site_report' AND m.report_status='submitted' AND NOT m.is_archived");
  });
  it("counts attendance missing only when no row exists on that project and day", () => {
    expect(sql).toContain("NOT EXISTS(SELECT 1 FROM public.labour_attendance a WHERE a.project_id=d.id AND a.work_date=d.report_day)");
  });
  it("requires both receipt fields to be empty and 48 hours elapsed without rejected status", () => {
    expect(sql).toContain("nullif(btrim(e.receipt_path),'') IS NULL AND nullif(btrim(e.receipt_url),'') IS NULL AND e.status<>'rejected' AND e.created_at+interval '48 hours'<=p_now");
  });
  it("deduplicates subject levels and summarizes new live events once per recipient", () => {
    expect(sql).toContain("UNIQUE(rule_key,subject_ref,level)");
    expect(sql).toContain("FOR recipient IN SELECT DISTINCT unnest(e.recipient_ids)");
    expect(sql).toContain("item->>'delivery'='sent'");
    expect(sql.match(/INSERT INTO public.notifications/g)).toHaveLength(1);
  });
  it("dry runs never resolve, insert events, or insert notifications", () => {
    expect(sql).toContain("IF NOT p_dry THEN\nPERFORM pg_advisory_xact_lock");
    expect(sql).toContain("IF NOT p_dry THEN\nINSERT INTO public.reminder_events");
    expect(sql).toContain("IF NOT p_dry THEN\nFOR recipient");
  });
  it("only super admin edits rules and only addressed recipients acknowledge", () => {
    expect(sql.match(/IF NOT public.has_role\(auth.uid\(\),'super_admin'\)/g)).toHaveLength(2);
    expect(sql).toContain("WHERE id=p_id AND auth.uid()=ANY(recipient_ids) FOR UPDATE");
    expect(sql).not.toMatch(/FOR (INSERT|UPDATE|ALL) TO authenticated/);
  });
  it("role assignment uses active project membership rather than person names", () => {
    expect(sql).toContain("tm.project_id=s.project_id AND tm.is_active");
    expect(sql).toContain("tm.role IN ('site_engineer','site_installation_mgr')");
    expect(sql).toContain("' (unassigned)'");
  });
});