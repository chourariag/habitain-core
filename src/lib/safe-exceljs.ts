import type { Workbook } from "exceljs";
import { neutralizeCell } from "./export-safety";

export function safeExcelJsWorkbook(workbook: Workbook): Workbook {
  workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
    if (typeof cell.value === "string") cell.value = neutralizeCell(cell.value);
    else if (cell.value && typeof cell.value === "object" && "richText" in cell.value) {
      const parts = cell.value.richText;
      const text = parts.map(part => part.text).join("");
      if (neutralizeCell(text) !== text && parts[0]) parts[0].text = `'${parts[0].text}`;
    }
  })));
  return workbook;
}