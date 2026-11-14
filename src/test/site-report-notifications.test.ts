import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "drizzle/migrations/0022_p4e_skip_site_report_measurement_notifications.sql",
  "utf8",
);

describe("Daily Site Report notification exclusion", () => {
  it("returns before any notification work for daily_site_report", () => {
    expect(migration).toMatch(/BEGIN\s+IF NEW\.trade = 'daily_site_report' THEN\s+RETURN NEW;\s+END IF;/);
    expect(migration.indexOf("IF NEW.trade")).toBeLessThan(migration.indexOf("SELECT name INTO pname"));
    expect(migration.indexOf("IF NEW.trade")).toBeLessThan(migration.indexOf("INSERT INTO public.notifications"));
  });

  it("retains the exact legacy submission notification logic", () => {
    const legacy = `  IF NEW.submitted_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.submitted_at IS DISTINCT FROM NEW.submitted_at) THEN
    SELECT name INTO pname FROM public.projects WHERE id = NEW.project_id;
    msg := 'Daily measurement submitted for ' || COALESCE(pname,'project') || '. Review WIP.';
    FOR recip IN
      SELECT auth_user_id FROM public.profiles
      WHERE is_active = true AND role IN ('costing_engineer','production_head','head_operations','managing_director')
    LOOP
      INSERT INTO public.notifications(recipient_id, type, category, title, body, content, navigate_to, priority)
      VALUES (recip.auth_user_id, 'info', 'measurement',
              'Daily measurement submitted',
              msg, msg,
              '/production?project=' || NEW.project_id || '&tab=measurement',
              'normal');
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;`;
    expect(migration.slice(migration.indexOf("  IF NEW.submitted_at"))).toBe(legacy);
  });
});