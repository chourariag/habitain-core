import { describe, expect, it } from "vitest";
import { escalationHoursError } from "@/lib/reminder-validation";

describe("project reminder escalation window", () => {
  it.each(["daily_site_report", "labour_attendance"])("caps %s at 48 hours", key => {
    expect(escalationHoursError(key, 48)).toBeNull();
    expect(escalationHoursError(key, 49)).not.toBeNull();
    expect(escalationHoursError(key, 72)).not.toBeNull();
    expect(escalationHoursError(key, 24)).toBeNull();
    expect(escalationHoursError(key, 0)).toBeNull();
  });
  it("keeps expense receipt level 3 at 72 hours allowed", () => {
    expect(escalationHoursError("expense_receipt", 72)).toBeNull();
  });
});