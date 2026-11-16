import { describe, expect, it } from "vitest";
import ev from "./b1b-attendance-evidence.json";
import { siteReportErrorMessage } from "@/lib/site-report-errors";

describe("B1b attendance photo gate (rolled-back SQL evidence)", () => {
  it("blocks attendance, back-dated photos and clock drift", () => {
    expect(ev.NO_PHOTO_TODAY).toBe("Take the toolbox talk photo first.");
    expect(ev.BACKDATED_PHOTO).toMatch(/only be added for today/);
    expect(ev.CLOCK_OFF).toMatch(/10 minutes/);
  });
  it("exception path only for the three allowed role groups", () => {
    expect(ev.EXCEPTION_SAVED.sort()).toEqual(["head_of_projects", "managing_director", "super_admin"]);
    expect(ev.EXCEPTION_BLOCKED).toContain("site_engineer");
    expect(ev.READ_STORES_EXECUTIVE).toBe(0);
    expect(ev.REMINDER_EVENTS).toBe(0);
  });
  it("shows the hours-confirm message on the report", () => {
    expect(siteReportErrorMessage({ message: "Confirm hours for 3 workers in People." })).toBe("Confirm hours for 3 workers in People.");
  });
});
