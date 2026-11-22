import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { ALTREE_RATE_MESSAGE, canConfirmCostUpload, costRatesWorkbook, readCostRatesWorkbook, subcontractRateProblem, type CostRateItem } from "@/lib/cost-rates";
import { canViewRunningBill, RUNNING_BILL_ROLES } from "@/lib/running-bill";

describe("Rates commercial role gate", () => {
  for (const role of RUNNING_BILL_ROLES) it(`allows ${role}`, () => expect(canViewRunningBill(role)).toBe(true));
  for (const role of ["site_engineer", "factory_floor_supervisor", "senior_factory_supervisor", "head_operations", "production_head", "site_installation_mgr", null]) it(`denies ${role ?? "anonymous"}`, () => expect(canViewRunningBill(role)).toBe(false));
});
describe("Subcontract rate rules", () => {
  it("rejects ALTREE", () => expect(subcontractRateProblem(" ALTREE ", "m2", "per_unit", 10, null, null)).toBe(ALTREE_RATE_MESSAGE));
  it("requires positive per-unit rate", () => expect(subcontractRateProblem("Other", "m2", "per_unit", 0, null, null)).not.toBeNull());
  it("accepts positive per-unit rate", () => expect(subcontractRateProblem("Other", "m2", "per_unit", 10, null, null)).toBeNull());
  it("requires positive lump sum", () => expect(subcontractRateProblem("Other", "m2", "lump_sum", null, 0, 100)).not.toBeNull());
  it("requires positive package", () => expect(subcontractRateProblem("Other", "m2", "lump_sum", null, 1000, 0)).not.toBeNull());
  it("requires package 100 for percent units", () => expect(subcontractRateProblem("Other", "%", "lump_sum", null, 1000, 99)).not.toBeNull());
  it("accepts package 100 for percent units", () => expect(subcontractRateProblem("Other", "%", "lump_sum", null, 1000, 100)).toBeNull());
  it("rejects nonfinite rates", () => expect(subcontractRateProblem("Other", "m2", "per_unit", Infinity, null, null)).not.toBeNull());
});
describe("Rates Excel dry run", () => {
  const item: CostRateItem = { id: "item", sno: 7, description: "Steel frame", unit: "kg", work_location: "factory", boq_rate: 50, material_rate: 20, missing_material_rate: false, subcontracts: [{ id: "sub", contractor_id: "contractor", contractor: "Other", rate_type: "lump_sum", rate: null, lump_sum: 1000, package_qty: 100, includes_material: true, active: true }] };
  it("round-trips the latest BOQ code and material inclusion", () => {
    const rows = readCostRatesWorkbook(costRatesWorkbook([item]));
    expect(rows).toHaveLength(1); expect(rows[0].sno).toBe("7"); expect(rows[0].work_location).toBe("factory"); expect(rows[0].material_rate).toBe("20"); expect(rows[0].includes_material.toLowerCase()).toBe("true");
  });
  it("rejects missing mandatory columns", () => {
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["sno"], [7]]), "Rates");
    expect(() => readCostRatesWorkbook(workbook)).toThrow("Missing columns");
  });
  it("does not allow apply before dry run", () => expect(canConfirmCostUpload(null, false)).toBe(false));
  it("does not allow rejected rows to apply", () => expect(canConfirmCostUpload({ boq_id: "latest", row_count: 1, errors: [{ row: 2, reason: "Bad rate" }] }, false)).toBe(false));
  it("does not allow empty uploads", () => expect(canConfirmCostUpload({ boq_id: "latest", row_count: 0, errors: [] }, false)).toBe(false));
  it("requires a BOQ version", () => expect(canConfirmCostUpload({ boq_id: null, row_count: 1, errors: [] }, false)).toBe(false));
  it("allows confirmation only after successful dry run", () => expect(canConfirmCostUpload({ boq_id: "latest", row_count: 1, errors: [] }, false)).toBe(true));
});