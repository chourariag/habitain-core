/**
 * Adds the "Billing Milestones" and "Scope of Work" worksheets to
 * public/templates/Project_Setup_Template.xlsx (in place), positioned right
 * after "Material Plan". Styling follows the existing sheets:
 * row 1 = green title, row 2 = amber info, row 3 = green legend, row 4 = header.
 *
 * Run: bun scripts/add-billing-scope-sheets.mjs
 */
import ExcelJS from "exceljs";

const FILE = "public/templates/Project_Setup_Template.xlsx";
const thin = { style: "thin", color: { argb: "00CCCCCC" } };
const border = { left: thin, right: thin, top: thin, bottom: thin };

function safeMerge(ws, range) {
  try { ws.unMergeCells(range); } catch { /* not merged */ }
  try { ws.mergeCells(range); } catch { /* already merged */ }
}

function colLetter(n) { return String.fromCharCode(64 + n); }

function buildSheet(wb, name, title, info, legend, headers, widths, blankRows) {
  const existing = wb.getWorksheet(name);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
  const last = colLetter(headers.length);

  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Row 1 — title
  ws.getCell("A1").value = title;
  safeMerge(ws, `A1:${last}1`);
  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getCell(1, c);
    cell.font = { name: "Arial", bold: true, size: 13, color: { argb: "00FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00006039" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      left: { style: "medium", color: { argb: "00006039" } },
      right: { style: "medium", color: { argb: "00006039" } },
      top: { style: "medium", color: { argb: "00006039" } },
      bottom: { style: "medium", color: { argb: "00006039" } },
    };
  }
  ws.getRow(1).height = 24;

  // Row 2 — info
  ws.getCell("A2").value = info;
  safeMerge(ws, `A2:${last}2`);
  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getCell(2, c);
    cell.font = { name: "Arial", italic: true, size: 8, color: { argb: "00D4860A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00FFF3CD" } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
    cell.border = border;
  }
  ws.getRow(2).height = 20;

  // Row 3 — legend
  ws.getCell("A3").value = legend;
  safeMerge(ws, `A3:${last}3`);
  for (let c = 1; c <= headers.length; c++) {
    const cell = ws.getCell(3, c);
    cell.font = { name: "Arial", italic: true, size: 8, color: { argb: "00006039" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "00E8F2ED" } };
    cell.alignment = { horizontal: "left", vertical: "middle" };
  }
  ws.getRow(3).height = 18;

  // Row 4 — header
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 9, color: { argb: "00FFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "004A4A4A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = border;
  });
  ws.getRow(4).height = 28;

  // Blank example rows
  for (let r = 5; r < 5 + blankRows.length; r++) {
    const vals = blankRows[r - 5];
    for (let c = 1; c <= headers.length; c++) {
      const cell = ws.getCell(r, c);
      if (vals[c - 1] !== undefined && vals[c - 1] !== null) cell.value = vals[c - 1];
      cell.font = { name: "Arial", size: 9 };
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
  }
  return ws;
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

buildSheet(
  wb,
  "Billing Milestones",
  "BILLING MILESTONES  |  Payment Schedule for this Project",
  "ℹ  Fill one row per payment milestone. % must total 100. GST Applicable = Y or N. Trigger Event describes what unlocks the invoice (e.g. Work Order Signed, Dispatch, Handover). Amounts are computed by HStack from the contract value after upload.",
  "  🟦 White cells = Fill in     Valid GST Applicable values: Y / N     Leave # blank to auto-number",
  ["#", "Milestone Description", "%", "GST Applicable (Y/N)", "Trigger Event"],
  [6, 48, 10, 20, 32],
  [
    [1, "", "", "Y", ""],
    [2, "", "", "Y", ""],
    [3, "", "", "Y", ""],
    [4, "", "", "Y", ""],
  ],
);

buildSheet(
  wb,
  "Scope of Work",
  "SCOPE OF WORK  |  Area-wise Responsibility Split",
  "ℹ  One row per scope item. Area groups items (e.g. Shell and Core, Interiors, External Works). Scope decides who delivers the item.",
  "  Valid Scope values: Habitainer / External Contractor / TBD     (TBD or anything else = Not in Scope)",
  ["Area", "Item", "Scope"],
  [28, 52, 24],
  [
    ["", "", "Habitainer"],
    ["", "", "External Contractor"],
    ["", "", "TBD"],
    ["", "", ""],
    ["", "", ""],
  ],
);

// Position the two new sheets immediately after "Material Plan"
const order = ["Project Details", "BOQ + Margin", "Project Schedule", "Material Plan", "Billing Milestones", "Scope of Work"];
const known = order.filter((n) => wb.getWorksheet(n));
wb.worksheets
  .slice()
  .sort((a, b) => {
    const ai = known.indexOf(a.name), bi = known.indexOf(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  })
  .forEach((ws, i) => { ws.orderNo = i + 1; });

await wb.xlsx.writeFile(FILE);
console.log("Sheets:", wb.worksheets.map((w) => w.name).join(" | "));
