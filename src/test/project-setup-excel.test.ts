import { describe, expect, it } from "vitest";
import { parseDDMMYYYY, validateProjectSetupRows, type ProjectSetupWorkbookRows } from "@/lib/project-setup-excel";

const emptyRows = (): ProjectSetupWorkbookRows => ({ schedule: [], boq: [], materials: [] });

describe("project setup Excel validation", () => {
  it("rejects every BOQ task code not present in the upload schedule or existing project", () => {
    const rows = emptyRows();
    rows.boq = [
      { rowNumber: 2, values: { sno: 1, item_description: "Steel", unit: "kg", boq_qty: 5, boq_rate: 2, task_code: "MISSING-A" } },
      { rowNumber: 4, values: { sno: 2, item_description: "Panel", unit: "ea", boq_qty: 3, boq_rate: 10, task_code: "MISSING-B" } },
    ];
    const result = validateProjectSetupRows(rows, []);
    expect(result.errors.filter((error) => error.includes("not in this file’s Schedule"))).toHaveLength(2);
    expect(result.errors.join(" ")).toContain("BOQ row 2");
    expect(result.errors.join(" ")).toContain("BOQ row 4");
  });

  it("accepts a BOQ row linked to an existing project task", () => {
    const rows = emptyRows();
    rows.boq = [{ rowNumber: 2, values: { sno: 1, item_description: "Steel", unit: "kg", boq_qty: "5", boq_rate: "2.5", task_code: "T-1" } }];
    const result = validateProjectSetupRows(rows, ["T-1"]);
    expect(result.errors).toEqual([]);
    expect(result.prepared.boq[0]?.boq_rate).toBe(2.5);
  });

  it("rejects duplicate schedule task codes and BOQ serial numbers", () => {
    const rows = emptyRows();
    rows.schedule = [
      { rowNumber: 2, values: { task_code: "T-1", task_name: "One" } },
      { rowNumber: 3, values: { task_code: "t-1", task_name: "Duplicate" } },
    ];
    rows.boq = [
      { rowNumber: 2, values: { sno: 1, item_description: "Steel", unit: "kg", boq_qty: 5, boq_rate: 2, task_code: "T-1" } },
      { rowNumber: 3, values: { sno: 1, item_description: "Panel", unit: "ea", boq_qty: 3, boq_rate: 10, task_code: "T-1" } },
    ];
    const result = validateProjectSetupRows(rows, []);
    expect(result.errors.some((error) => error.includes("duplicate task_code"))).toBe(true);
    expect(result.errors.some((error) => error.includes("duplicate sno 1"))).toBe(true);
  });

  it("accepts only real DD/MM/YYYY dates and rejects reversed dates", () => {
    expect(parseDDMMYYYY("31/04/2026")).toBeNull();
    expect(parseDDMMYYYY("09/11/2026")).toBe("2026-11-09");
    const rows = emptyRows();
    rows.schedule = [{ rowNumber: 2, values: { task_code: "T-1", task_name: "Task", planned_start: "10/11/2026", planned_end: "09/11/2026" } }];
    expect(validateProjectSetupRows(rows, []).errors.some((error) => error.includes("cannot be before"))).toBe(true);
  });

  it("rejects an unedited template example row instead of importing sample content", () => {
    const rows = emptyRows();
    rows.schedule = [{ rowNumber: 2, values: { task_code: "__TEMPLATE_EXAMPLE__", task_name: "Example row — replace or remove" } }];
    expect(validateProjectSetupRows(rows, []).errors).toContain("Schedule row 2: remove the example row before upload.");
  });
});