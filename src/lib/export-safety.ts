import type { WorkBook } from "xlsx";
import { neutralizeCell } from "../../supabase/functions/_shared/export-safety";
export { neutralizeCell, safeCsvCell, escapeHtml } from "../../supabase/functions/_shared/export-safety";

/** Only exported string values change; numeric cells, formulas, styles and columns are preserved. */
export function safeWorkbook(workbook: WorkBook): WorkBook {
  for (const sheet of Object.values(workbook.Sheets)) {
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!") || !cell || typeof cell !== "object") continue;
      if (cell.t === "s" && typeof cell.v === "string") {
        const safe = neutralizeCell(cell.v);
        if (safe !== cell.v) { cell.v = safe; delete cell.w; delete cell.h; delete cell.r; }
      }
    }
  }
  return workbook;
}