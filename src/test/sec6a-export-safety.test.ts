import { describe, expect, it } from "vitest";
import * as XLSX from "@/lib/safe-xlsx";
import ExcelJS from "exceljs";
import { neutralizeCell, safeCsvCell, safeWorkbook } from "@/lib/export-safety";
import { safeExcelJsWorkbook } from "@/lib/safe-exceljs";
import { escapeHtmlValues } from "../../supabase/functions/_shared/export-safety";
import { toCsv } from "../../supabase/functions/_shared/export-utils";

const dangerous = ["=SUM(1+1)", "+cmd", "-2+3", "@A1", "\t=1+1", "\r=1+1"];
describe("SEC-6a shared spreadsheet protection", () => {
  it.each(dangerous)("neutralizes %j in CSV and Excel", value => {
    expect(neutralizeCell(value)).toBe(`'${value}`);
    expect(safeCsvCell(value, true)).toBe(`"'${value}"`);
    expect(toCsv(["text"], [{ text: value }])).toContain(`'${value}`);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[value, -2.3, 151000]]), "Export");
    const actual = XLSX.read(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), { type: "array" });
    expect(actual.Sheets.Export.A1.v).toBe(`'${value}`);
    expect(actual.Sheets.Export.A1.t).toBe("s");
    expect(actual.Sheets.Export.B1.v).toBe(-2.3);
    expect(actual.Sheets.Export.B1.t).toBe("n");
    expect(actual.Sheets.Export.C1.v).toBe(151000);
  });
  it("preserves numeric cells, ordinary strings and deliberate template formulas", () => {
    expect(neutralizeCell(-2.3)).toBe(-2.3);
    expect(safeCsvCell(-2.3)).toBe("-2.3");
    expect(neutralizeCell("Project A")).toBe("Project A");
    const sheet = XLSX.utils.aoa_to_sheet([["Project A", 6365.46]]);
    sheet.C1 = { t: "n", f: "SUM(B1)", v: 6365.46 };
    sheet["!ref"] = "A1:C1";
    const workbook = safeWorkbook({ SheetNames: ["Data"], Sheets: { Data: sheet } });
    expect(workbook.Sheets.Data.C1.f).toBe("SUM(B1)");
    expect(workbook.Sheets.Data.B1.v).toBe(6365.46);
  });
  it("quotes delimiters after neutralization, without losing cell boundaries", () => {
    expect(safeCsvCell('=SUM(1,2)"\n')).toBe('"\'=SUM(1,2)""\n"');
    expect(safeCsvCell('ordinary,"text')).toBe('"ordinary,""text"');
  });
  it.each(dangerous)("protects ExcelJS cells %j without converting numbers", async value => {
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Export");
    sheet.addRow([value, -2.3]);
    sheet.getCell("C1").value = { richText: [{ text: value.slice(0, 1) }, { text: value.slice(1) }] };
    safeExcelJsWorkbook(workbook);
    expect(sheet.getCell("A1").value).toBe(`'${value}`);
    expect(sheet.getCell("B1").value).toBe(-2.3);
    expect(sheet.getCell("C1").text).toBe(`'${value}`);
  });
  it("escapes printable text recursively while keeping quantities numeric", () => {
    const data = escapeHtmlValues({ sections: { project_portfolio: { projects: [{ name: '<img src=x onerror="alert(1)">', module_count: 2 }] } }, commentary: { risks: "<script>alert(1)</script>\nA & B" } });
    expect(data.sections.project_portfolio.projects[0].name).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(data.sections.project_portfolio.projects[0].module_count).toBe(2);
    expect(data.commentary.risks).toBe("&lt;script&gt;alert(1)&lt;/script&gt;\nA &amp; B");
  });
});