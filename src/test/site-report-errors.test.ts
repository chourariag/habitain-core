import { describe, expect, it } from "vitest";
import { siteReportErrorMessage, SITE_REPORT_SAVE_FAILURE } from "@/lib/site-report-errors";

describe("Daily Report rule errors", () => {
  it.each([
    "One photo is required for every elevation",
    "Site clean tick and photo are required",
    "Enter progress on at least one task, or explain in notes why no work happened",
    "Only the person who submitted this report can edit it",
    "Only the last 3 days can be reported",
  ])("preserves %s", (message) => {
    expect(siteReportErrorMessage({ message })).toBe(message);
  });
  it("hides foreign-key and other technical errors", () => {
    expect(siteReportErrorMessage({ message: 'insert violates foreign key constraint "measurement_line_items_boq_item_id_fkey"' })).toBe(SITE_REPORT_SAVE_FAILURE);
    expect(siteReportErrorMessage({})).toBe(SITE_REPORT_SAVE_FAILURE);
  });
});