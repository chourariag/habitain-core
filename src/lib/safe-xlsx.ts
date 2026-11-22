/** Export-only hardening adapter. Readers and workbook structure remain unchanged. */
import * as XLSX from "xlsx";
import { safeWorkbook } from "./export-safety";
export * from "xlsx";

const safeSheet = (sheet: XLSX.WorkSheet): XLSX.WorkSheet => {
  safeWorkbook({ SheetNames: ["Sheet"], Sheets: { Sheet: sheet } });
  return sheet;
};
export const utils = {
  ...XLSX.utils,
  aoa_to_sheet: ((...args: Parameters<typeof XLSX.utils.aoa_to_sheet>) => safeSheet(XLSX.utils.aoa_to_sheet(...args))) as typeof XLSX.utils.aoa_to_sheet,
  json_to_sheet: ((...args: Parameters<typeof XLSX.utils.json_to_sheet>) => safeSheet(XLSX.utils.json_to_sheet(...args))) as typeof XLSX.utils.json_to_sheet,
};
export const write: typeof XLSX.write = (workbook, options) => XLSX.write(safeWorkbook(workbook), options);
export const writeFile: typeof XLSX.writeFile = (workbook, filename, options) => XLSX.writeFile(safeWorkbook(workbook), filename, options);