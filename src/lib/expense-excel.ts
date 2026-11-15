import * as XLSX from "xlsx";
import { format, parse, isValid, isFuture, startOfMonth, subMonths } from "date-fns";

/** Single source of truth for the expense Excel template AND reader. */
export const EXPENSE_COLUMNS = [
  { key: "date", header: "Date (DD/MM/YYYY)", required: true, example: "" /* filled with today */ },
  { key: "category", header: "Category", required: true, example: "Site Expenses" },
  { key: "description", header: "Description", required: true, example: "Site consumables for daily work" },
  { key: "distanceKm", header: "Distance km", required: false, example: "" },
  { key: "amount", header: "Amount", required: false, example: 500 },
  { key: "receipt", header: "Receipt (Yes/No)", required: false, example: "No" },
  { key: "vendor", header: "Vendor", required: false, example: "Local Hardware" },
  { key: "billNo", header: "Bill No", required: false, example: "B-101" },
  { key: "projectCode", header: "Project Code", required: false, example: "" },
  { key: "notes", header: "Notes", required: false, example: "" },
] as const;

export type ExpenseColKey = (typeof EXPENSE_COLUMNS)[number]["key"];
export const EXPENSE_HEADERS = EXPENSE_COLUMNS.map((c) => c.header);
export const DATE_HEADER = EXPENSE_COLUMNS[0].header;

export const VALID_CATEGORIES = [
  "Travel by Car", "Travel by Bike", "Auto/Cab", "Meals and Entertainment", "Stationery and Supplies",
  "Site Expenses", "Client Meeting", "Medical", "Other",
];
export const TRAVEL_CATEGORIES = ["Travel by Car", "Travel by Bike"];
export const EXPENSE_TEMPLATE_FILENAME = "Expense_Report_Template.xlsx";

export function expenseSampleRow(today: Date = new Date()): (string | number)[] {
  return EXPENSE_COLUMNS.map((c) => (c.key === "date" ? format(today, "dd/MM/yyyy") : c.example));
}

export function buildExpenseTemplateWorkbook(today: Date = new Date(), rates = { car: 9.5, bike: 3.5 }): XLSX.WorkBook {
  const aoa: (string | number)[][] = [
    ["HStack — Expense Report"],
    ["Fill one expense per row from row 4. Required: Date, Category, Description, and Distance km (travel) or Amount (others)."],
    [...EXPENSE_HEADERS],
    expenseSampleRow(today),
    [],
    ["REFERENCE — CATEGORIES"],
    ...VALID_CATEGORIES.map((c) => [c]),
    [],
    ["CONVEYANCE RATES (₹/km)"],
    ["Travel by Car", rates.car],
    ["Travel by Bike", rates.bike],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = EXPENSE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expenses");
  return wb;
}

export function downloadExpenseTemplate(rates?: { car: number; bike: number }) {
  XLSX.writeFile(buildExpenseTemplateWorkbook(new Date(), rates), EXPENSE_TEMPLATE_FILENAME);
}

export function sheetRowsFromWorkbook(wb: XLSX.WorkBook): any[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
}

export interface ParsedExpenseRow {
  rowNum: number; date: string; parsedDate: Date | null; category: string; description: string;
  distanceKm: number | null; amount: number | null; receiptAvailable: boolean; notes: string;
  vendor: string; billNo: string; projectCode: string; projectId: string | null;
  fatal: boolean; errors: string[]; calculatedAmount: number;
}

export interface ParseResult { rows: ParsedExpenseRow[]; headerFound: boolean; rejected: boolean }

/** Find the header row by the "Date (DD/MM/YYYY)" cell, then read data rows using column positions from EXPENSE_COLUMNS. */
export function parseExpenseRows(
  rows: any[][],
  ctx: { carRate: number; bikeRate: number; matchProject: (code: string) => { id: string } | null; now?: Date },
): ParseResult {
  const norm = (v: any) => String(v ?? "").trim().toLowerCase();
  const headerIdx = rows.findIndex((r) => (r ?? []).some((c) => norm(c) === DATE_HEADER.toLowerCase()));
  if (headerIdx < 0) return { rows: [], headerFound: false, rejected: true };
  const hdr = rows[headerIdx].map(norm);
  const pos = {} as Record<ExpenseColKey, number>;
  EXPENSE_COLUMNS.forEach((c, i) => { const f = hdr.indexOf(c.header.toLowerCase()); pos[c.key] = f >= 0 ? f : i; });
  const cell = (r: any[], k: ExpenseColKey) => String(r[pos[k]] ?? "").trim();

  const now = ctx.now ?? new Date();
  const earliest = startOfMonth(subMonths(now, 1));
  const out: ParsedExpenseRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every((c: any) => String(c ?? "").trim() === "")) continue;
    const first = String(r[0] ?? "").toUpperCase();
    if (first.includes("CONVEYANCE RATES") || first.startsWith("REFERENCE")) break;

    const errors: string[] = []; let fatal = false;
    const dateStr = cell(r, "date");
    let parsedDate: Date | null = null;
    if (dateStr) {
      const strict = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr);
      parsedDate = strict ? parse(dateStr, "d/M/yyyy", now) : null;
      if (!parsedDate || !isValid(parsedDate)) { errors.push("Invalid date format — use DD/MM/YYYY"); fatal = true; parsedDate = null; }
      else if (isFuture(parsedDate)) errors.push("Date cannot be in the future");
      else if (parsedDate < earliest) errors.push("Date must be within current or last month");
    } else { errors.push("Date is required"); fatal = true; }

    const category = cell(r, "category");
    if (!category) errors.push("Category is required");
    else if (!VALID_CATEGORIES.includes(category)) errors.push(`Invalid category "${category}"`);
    const description = cell(r, "description");
    if (description.length < 5) errors.push("Description required (min 5 chars)");

    const dRaw = cell(r, "distanceKm"); const aRaw = cell(r, "amount").replace(/[₹,\s]/g, "");
    const distanceKm = dRaw ? Number(dRaw) : null; const amount = aRaw ? Number(aRaw) : null;
    const isTravel = TRAVEL_CATEGORIES.includes(category);
    if (isTravel && !(distanceKm && distanceKm > 0)) errors.push("Distance (km) required for travel category");
    if (!isTravel && !(amount && amount > 0)) errors.push("Amount required for non-travel category");
    let calculatedAmount = 0;
    if (isTravel && distanceKm && distanceKm > 0) calculatedAmount = distanceKm * (category === "Travel by Car" ? ctx.carRate : ctx.bikeRate);
    else if (amount && amount > 0) calculatedAmount = amount;

    const receiptStr = cell(r, "receipt").toLowerCase();
    if (receiptStr && receiptStr !== "yes" && receiptStr !== "no") errors.push("Receipt must be Yes or No");

    const projectCode = cell(r, "projectCode");
    let projectId: string | null = null;
    if (projectCode) {
      const p = ctx.matchProject(projectCode);
      if (!p) { errors.push(`Unknown project code "${projectCode}"`); fatal = true; } else projectId = p.id;
    }
    out.push({
      rowNum: i + 1, date: dateStr, parsedDate, category, description, distanceKm, amount,
      receiptAvailable: receiptStr === "yes", notes: cell(r, "notes"),
      vendor: cell(r, "vendor"), billNo: cell(r, "billNo"), projectCode, projectId, fatal, errors, calculatedAmount,
    });
  }
  return { rows: out, headerFound: true, rejected: out.some((x) => x.fatal) };
}
