import Papa from "papaparse";

export const BOQ_ENTRY_FIELDS = ["sno", "item_description", "unit", "boq_qty", "boq_rate", "category", "scope", "work_location"] as const;
export const BOQ_ENTRY_LABELS = ["Item no", "Description", "Unit", "Quantity", "Rate", "Category", "Scope", "Work location"];
export type EntryField = typeof BOQ_ENTRY_FIELDS[number];
export type BoqEntryRow = Record<EntryField, string> & { id?: string; remove?: boolean };
export interface BoqWarning { key: string; kind: string; message: string; median_rate?: number; project_count?: number; acknowledged?: boolean }
export interface BoqLine extends Omit<BoqEntryRow, "boq_qty" | "boq_rate" | "sno"> { id: string; sno: number; boq_qty: number; boq_rate: number; total_amount: number; warnings: BoqWarning[] }
export interface BoqHeader { id: string; entry_mode: "legacy" | "fresh"; status: "draft" | "final"; control_total: number | null; source_note: string | null; final_at: string | null; entry_version: number }
export interface BoqPreview { row: number; id?: string; values?: BoqEntryRow; errors: string[]; warnings: BoqWarning[] }
export interface BoqState { header: BoqHeader | null; lines: BoqLine[]; sum: number; difference: number | null; line_count: number; can_write: boolean; can_finalise: boolean; units: string[]; categories: string[]; scopes: string[]; audit: { id: string; action: string; reason: string | null; created_at: string; created_by: string }[]; save_results?: BoqPreview[] }
export const emptyBoqRow = (): BoqEntryRow => ({ sno: "", item_description: "", unit: "", boq_qty: "", boq_rate: "", category: "", scope: "Factory", work_location: "factory" });
export function entryFromLine(line: BoqLine): BoqEntryRow {
  return { id: line.id, sno: String(line.sno), item_description: line.item_description, unit: line.unit, boq_qty: String(line.boq_qty), boq_rate: String(line.boq_rate), category: line.category, scope: line.scope, work_location: line.work_location };
}
export function parseBoqPaste(text: string): string[][] {
  if (text.length > 2_000_000) throw new Error("Paste is too large. Use batches of up to 500 rows.");
  const parsed = Papa.parse<string[]>(text, { delimiter: "\t", dynamicTyping: false, skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  if (parsed.data.length > 501) throw new Error("Paste up to 500 rows, plus an optional heading row.");
  return parsed.data;
}
export function mapBoqPaste(grid: string[][], mapping: number[], hasHeader: boolean): { rows: BoqEntryRow[]; issues: string[] } {
  if (mapping.length !== BOQ_ENTRY_FIELDS.length || mapping.some(i => !Number.isInteger(i) || i < 0)) throw new Error("Choose a column for each field.");
  const source = hasHeader ? grid.slice(1) : grid;
  if (source.length > 500) throw new Error("Paste up to 500 rows at a time.");
  const issues: string[] = [];
  const rows = source.map((cells, index) => {
    if (mapping.some(i => i >= cells.length)) issues.push(`Row ${index + (hasHeader ? 2 : 1)}: a mapped column is missing.`);
    const row = emptyBoqRow();
    BOQ_ENTRY_FIELDS.forEach((field, i) => { row[field] = cells[mapping[i]] ?? ""; });
    return row;
  });
  return { rows, issues };
}
// Presentation only. All arithmetic, validation, dates and totals are supplied by the database.
export const boqCurrency = (value: number | null | undefined) => value == null || !Number.isFinite(Number(value)) ? "—" : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function boqTimestamp(value: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (name: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === name)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")} (IST)`;
}