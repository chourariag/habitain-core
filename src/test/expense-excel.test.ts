import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildExpenseTemplateWorkbook, sheetRowsFromWorkbook, parseExpenseRows, EXPENSE_HEADERS, expenseSampleRow } from "@/lib/expense-excel";

const projects = [{ id: "p1", name: "Test project - 1" }];
const ctx = { carRate: 9.5, bikeRate: 3.5, matchProject: (c: string) => projects.find((p) => p.name.toLowerCase() === c.toLowerCase()) ?? null };
const roundTrip = (wb: XLSX.WorkBook) => sheetRowsFromWorkbook(XLSX.read(XLSX.write(wb, { type: "array", bookType: "xlsx" }), { type: "array" }));

describe("expense excel template ↔ reader", () => {
  it("unchanged template parses with zero errors", () => {
    const res = parseExpenseRows(roundTrip(buildExpenseTemplateWorkbook()), ctx);
    expect(res.headerFound).toBe(true);
    expect(res.rows).toHaveLength(1);
    expect(res.rows.flatMap((r) => r.errors)).toEqual([]);
    expect(res.rejected).toBe(false);
  });

  it("bad date + unknown project code give exactly two row errors and reject the file", () => {
    const bad = expenseSampleRow(); bad[0] = "31/13/2026";
    const unk = expenseSampleRow(); unk[8] = "NOPE-99";
    // fewer title rows: header on row 1
    const ws = XLSX.utils.aoa_to_sheet([EXPENSE_HEADERS, expenseSampleRow(), bad, unk]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    const res = parseExpenseRows(roundTrip(wb), ctx);
    const errs = res.rows.flatMap((r) => r.errors);
    expect(errs).toEqual(["Invalid date format — use DD/MM/YYYY", 'Unknown project code "NOPE-99"']);
    expect(res.rejected).toBe(true);
  });
});

import { readFileSync } from "fs";
describe("receipt upload location", () => {
  it("uploadReceipt uses readExifDate and readExifDate never touches geolocation", () => {
    const pol = readFileSync("src/lib/expense-policy.ts", "utf8");
    expect(pol).toContain("readExifDate(file)");
    expect(pol).not.toContain("readPhotoMeta");
    const src = readFileSync("src/lib/site-report-photo.ts", "utf8");
    const fn = src.slice(src.indexOf("export async function readExifDate"), src.indexOf("function deviceLocation"));
    expect(fn).not.toMatch(/geolocation|deviceLocation/);
  });
});
