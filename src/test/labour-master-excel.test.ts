import { describe, expect, it } from "vitest";
import { rowsFromLabourMasterSheet, validateLabourMasterRows } from "@/lib/labour-master-excel";

const headers = ["worker_code", "name", "contractor", "skill_type", "hourly_rate", "monthly_salary", "status"];

describe("labour master Excel validation", () => {
  it("accepts valid rows and allows the database to assign a blank new worker code", () => {
    const rows = rowsFromLabourMasterSheet([
      headers,
      ["LW-001", "Worker One", "Site Crew", "Welder", "125.5", "26000", "active"],
      ["", "Worker Two", "", "Helper", "", "", ""],
    ]);
    const result = validateLabourMasterRows(rows, [{ worker_code: "LW-001", name: "Worker One" }], ["Site Crew"]);

    expect(result.errors).toEqual([]);
    expect(result.prepared).toHaveLength(2);
    expect(result.prepared[1]?.worker_code).toBe("");
  });

  it("rejects duplicate codes, missing fields, unknown contractors, invalid values, and renames", () => {
    const rows = rowsFromLabourMasterSheet([
      headers,
      ["LW-001", "Changed Name", "Unknown", "Welder", "-1", "abc", "gone"],
      ["lw-001", "Worker One", "", "Helper", "", "", "active"],
    ]);
    const result = validateLabourMasterRows(rows, [{ worker_code: "LW-001", name: "Worker One" }], []);

    expect(result.errors).toEqual(expect.arrayContaining([
      "Row 2: contractor “Unknown” was not found in the contractor list.",
      "Row 2: status must be active, on_leave, or inactive.",
      "Row 2: worker name cannot be changed for code “LW-001”.",
      "Row 2: hourly_rate cannot be negative.",
      "Row 2: monthly_salary must be numeric.",
      "Row 3: duplicate worker_code “lw-001”.",
    ]));
  });

  it("rejects the template example row", () => {
    const rows = rowsFromLabourMasterSheet([
      headers,
      ["__TEMPLATE_EXAMPLE__", "Example worker — replace or remove", "", "Skill", "", "", "active"],
    ]);
    expect(validateLabourMasterRows(rows, [], []).errors).toContain("Row 2: remove the example row before upload.");
  });
});