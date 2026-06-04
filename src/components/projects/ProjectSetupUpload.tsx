import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { dispatchProjectImported } from "@/lib/use-project-import";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  projectId: string;
  userRole: string | null;
  productionSystem?: string | null;
  onImported?: () => void;
}

const ALLOWED = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "costing_engineer", "principal_architect", "architecture_director", "head_operations"];

interface SheetResult { name: string; ok: boolean; count: number; message: string; warnings?: string[]; }

const parseDate = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) return format(val, "yyyy-MM-dd");
  const s = String(val).trim();
  const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (parts) {
    const yr = parts[3].length === 2 ? "20" + parts[3] : parts[3];
    return `${yr}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
};

function safeMerge(ws: ExcelJS.Worksheet, range: string) {
  try { ws.unMergeCells(range); } catch { /* not merged */ }
  try { ws.mergeCells(range); } catch { /* already merged, skip */ }
}

/**
 * Append the On-Site Work section to the "Material Plan" sheet for the
 * Vaishnavi Life Mysore 238-244 project. Adds a main section header,
 * four sub-section headers, and their item rows after the existing list
 * (which ends at row 67, S.No 53). All on-site rows have Destination = "Site".
 */
function injectVaishnaviMaterialPlanOnSite(ws: ExcelJS.Worksheet) {
  const sections: Array<{ title: string; items: Array<[string, string]> }> = [
    {
      title: "I. Pre-Fabricated Pathway",
      items: [
        ["Structural Steel — Beams, Columns / Framed Structure", "Kg"],
        ["LGSF — Wall Framing", "Kg"],
        ["Inner Wall Rockwool Slab 48kg 75mm Thickness", "Sft"],
        ["External Wall — Shera Neu Wall Board 2440x1220x8mm", "Sft"],
        ["Internal Painting — Royal Emulsion", "Sft"],
        ["External Wall Shera Board with Paint", "Sft"],
        ["Vitrified Tiling", "Sft"],
        ["Toughened Glass", "Sft"],
        ["Aluminium Sliding Door", "Sft"],
        ["Aluminium Window", "Sft"],
        ["Internal Electrical Work", "Sft"],
      ],
    },
    {
      title: "II. Entry Deck",
      items: [
        ["Structural Steel — Beams, Columns / Framed Structure", "Kg"],
        ["Puff Panel Roof", "Sft"],
        ["PVC / Vox Ceiling", "Sft"],
        ["Vitrified Tiling", "Sft"],
        ["Internal Electrical Work", "Sft"],
      ],
    },
    {
      title: "III. Outdoor Deck",
      items: [
        ["Structural Steel — Beams, Columns / Framed Structure", "Kg"],
        ["Puff Panel Roof", "Sft"],
        ["PVC / Vox Ceiling", "Sft"],
        ["Vitrified Tiling", "Sft"],
        ["Internal Electrical Work", "Sft"],
      ],
    },
    {
      title: "C. Add-On",
      items: [
        ["AC Copper Piping", "m"],
        ["Transportation", "LS"],
      ],
    },
  ];

  // Find the last row containing data (existing list ends at row 67, item 53)
  let lastRow = 1;
  for (let i = ws.rowCount; i >= 1; i--) {
    const row = ws.getRow(i);
    let hasData = false;
    row.eachCell({ includeEmpty: false }, () => { hasData = true; });
    if (hasData) { lastRow = i; break; }
  }
  let r = lastRow + 1;
  let sno = 54;

  // Main section header — styled like SHELL AND CORE etc.
  ws.getCell(`A${r}`).value = "ON-SITE WORK";
  safeMerge(ws, `A${r}:J${r}`);
  ws.getRow(r).font = { bold: true, size: 12 };
  r++;

  for (const sec of sections) {
    // Sub-section header
    ws.getCell(`A${r}`).value = sec.title;
    safeMerge(ws, `A${r}:J${r}`);
    ws.getRow(r).font = { bold: true, italic: true };
    r++;

    for (const [desc, unit] of sec.items) {
      // 10-column layout: A=#, B=Section, C=Material, D=Unit, E=Tender Qty,
      // F=Ordered Qty, G=PO Release Date, H=Delivery Date Target, I=Destination, J=Notes
      ws.getCell(`A${r}`).value = sno++;
      ws.getCell(`B${r}`).value = "On-Site Work";
      ws.getCell(`C${r}`).value = desc;
      ws.getCell(`D${r}`).value = unit;
      ws.getCell(`I${r}`).value = "Site";
      r++;
    }
  }
}

/**
 * Append the complete ON-SITE WORK block to the "BOQ + Margin" sheet for the
 * Vaishnavi Life Mysore 238-244 project. 18-column layout (A..R) with full
 * borders, fills, sub-totals and grand total / GST rows. Hard-coded values
 * per project spec.
 */
function injectVaishnaviBoqOnSite(ws: ExcelJS.Worksheet, startRow?: number) {
  type Row = (string | number)[];

  const headers = [
    "Sl. No.", "Item Description", "Unit", "Tender Std Qty",
    "Tender Rate (₹)", "Tender Amount (₹)", "GFC Qty", "Add 10% Qty",
    "Add 15% Qty", "Total Qty (I+II+III)", "Materials Rate (₹)",
    "Labour Rate (₹)", "Basic Rate (₹) (K+L)", "Margin Rate (₹)",
    "Final Rate (₹) (M+N)", "Final Cost (₹) (J×M)",
    "Margin Amount (₹) (J×N)", "Final Amount (₹) (P+Q)",
  ];

  const pathway: Row[] = [
    [1, "Structural steel — Beams, Columns / Framed Structure", "Kg", 887, 150, 133050, 568, 0, 0, 568, 65, 40, 105, 42, 150, 59640, 23856, 133050],
    [2, "LGSF — Wall framing", "Kg", 0, 148, 0, 319, 0, 0, 319, 65, 40, 105, 42, 147, 33495, 13398, 0],
    [3, "Inner wall Rockwool Slab 48kg 75mm Thickness", "sft", 65, 70, 4551, 65, 0, 0, 65, 35, 15, 50, 20, 70, 3250, 1300, 4550],
    [4, "External wall — Shera Neu Wall Board 2440x1220x8mm", "sft", 224, 77, 17249, 192, 0, 0, 192, 40, 15, 55, 22, 77, 10560, 4224, 17248],
    [5, "Internal Painting — Royal Emulsion", "sft", 70, 42, 2941, 73, 0, 0, 73, 18, 12, 30, 12, 42, 2190, 876, 2940],
    [6, "External wall Shera Board with Paint", "sft", 128, 188, 24065, 96, 0, 0, 96, 105, 30, 135, 53, 188, 12960, 5088, 24064],
    [7, "Vitrified Tiling", "sft", 296, 174, 51505, 296, 0, 0, 296, 60, 65, 125, 49, 174, 37000, 14504, 51504],
    [8, "Toughened Glass", "sft", 343, 348, 119365, 296, 0, 0, 296, 200, 50, 250, 98, 348, 74000, 29008, 119364],
    [9, "Aluminium Sliding Door", "sft", 159, 903, 143578, 153, 0, 0, 153, 595, 50, 645, 258, 903, 98685, 39474, 143577],
    [10, "Aluminium Window", "sft", 68, 903, 61405, 114, 0, 0, 115, 595, 50, 645, 258, 903, 74175, 29670, 61404],
    [11, "Internal Electrical work", "sft", 296, 70, 20712, 296, 0, 0, 296, 50, 0, 50, 20, 70, 14800, 5920, 20720],
  ];
  const entryDeck: Row[] = [
    [1, "Structural steel — Beams, Columns / Framed Structure", "Kg", 880, 150, 132000, 675, 0, 0, 675, 65, 40, 105, 45, 150, 70875, 30375, 132000],
    [2, "PUFF Panel Roof", "Sft", 207, 278, 57546, 280, 1, 0, 281, 178.5, 20, 198.5, 79.4, 278, 55778, 22306, 57546],
    [3, "PVC / Vox Ceiling", "sft", 207, 278, 57546, 280, 1, 0, 281, 178.5, 20, 198.5, 79.4, 278, 55778, 22306, 57546],
    [4, "Vitrified Tiling", "sft", 207, 174, 36018, 201, 0, 0, 201, 59, 65, 124, 49.6, 174, 24924, 9970, 36018],
    [5, "Internal Electrical work", "sft", 207, 70, 14491, 201, 0, 0, 201, 50, 0, 50, 20, 70, 10050, 4020, 14490],
  ];
  const outdoorDeck: Row[] = [
    [1, "Structural steel — Beams, Columns / Framed Structure", "Kg", 1045, 150, 156750, 1846, 1, 0, 1847, 65, 40, 105, 45, 150, 193935, 83115, 156750],
    [2, "PUFF Panel Roof", "Sft", 349, 278, 97022, 336, 0, 0, 336, 178.5, 20, 198.5, 79.4, 278, 66696, 26678, 97022],
    [3, "PVC / Vox Ceiling", "sft", 349, 278, 97022, 336, 0, 0, 336, 178.5, 20, 198.5, 79.4, 278, 66696, 26678, 97022],
    [4, "Vitrified Tiling", "sft", 254, 174, 44196, 257, 0, 0, 257, 59, 65, 124, 49.6, 174, 31868, 12747, 44196],
    [5, "Internal Electrical work", "sft", 254, 70, 17781, 257, 0, 0, 257, 50, 0, 50, 20, 70, 12850, 5140, 17780],
  ];
  const addon: Row[] = [
    [1, "AC Copper Piping", "m", 30, 1751, 52519, 30, 0, 0, 30, 960.45, 290, 1250.45, 500.18, 1750.63, 37514, 15005, 52519],
    [2, "Transportation", "LS", 1, 295000, 295000, 1, 0, 0, 1, 191750, 0, 191750, 76700, 268450, 191750, 76700, 295000],
  ];

  const widths = [6, 42, 8, 14, 14, 16, 12, 12, 12, 14, 14, 14, 14, 14, 14, 16, 16, 18];
  widths.forEach((w, i) => {
    const col = ws.getColumn(i + 1);
    if ((col.width ?? 0) < w) col.width = w;
  });

  // Determine starting row: explicit (for dedicated sheet) or append after last data row

  let r: number;
  if (typeof startRow === "number") {
    r = startRow;
  } else {
    let lastRow = 1;
    for (let i = ws.rowCount; i >= 1; i--) {
      const row = ws.getRow(i);
      let hasData = false;
      row.eachCell({ includeEmpty: false }, () => { hasData = true; });
      if (hasData) { lastRow = i; break; }
    }
    r = lastRow + 2;
  }

  const thinBorder = {
    top: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    left: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    bottom: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    right: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
  };

  const colLetter = (n: number) => String.fromCharCode(64 + n); // 1->A
  const rangeRow = (row: number) => `${colLetter(1)}${row}:${colLetter(18)}${row}`;
  const rangeAQ = (row: number) => `A${row}:Q${row}`;
  const rangeAO = (row: number) => `A${row}:O${row}`;

  const applyBorders = (row: number) => {
    for (let c = 1; c <= 18; c++) {
      ws.getCell(row, c).border = thinBorder;
    }
  };

  const fillRow = (row: number, argb: string) => {
    for (let c = 1; c <= 18; c++) {
      ws.getCell(row, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    }
  };

  // ROW 1 — Section Title
  safeMerge(ws, rangeRow(r));
  const title = ws.getCell(`A${r}`);
  title.value = "B — ON-SITE WORK";
  title.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  fillRow(r, "FF1A4B5A");
  applyBorders(r);
  ws.getRow(r).height = 22;
  r++;

  // ROW 2 — Column Headers (visual anchor: thick green top border, bold white on green).
  // Note: ExcelJS supports only one freeze pane per sheet, and the existing BOQ + Margin
  // sheet already freezes row 4 for the factory items. We keep that freeze intact and
  // make this on-site header row a strong visual anchor instead.
  headers.forEach((h, i) => {
    const cell = ws.getCell(r, i + 1);
    cell.value = h;
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006039" } };
    cell.border = {
      top: { style: "thick", color: { argb: "FF006039" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });
  ws.getRow(r).height = 42;
  r++;

  const writeSubsection = (
    headerText: string,
    rows: Row[],
    subTotalLabel: string,
    pTotal: number, qTotal: number, rTotal: number,
  ) => {
    // Sub-section header
    safeMerge(ws, rangeRow(r));
    const h = ws.getCell(`A${r}`);
    h.value = headerText;
    h.font = { name: "Arial", bold: true, size: 10, color: { argb: "FF1A4B5A" } };
    h.alignment = { vertical: "middle", horizontal: "left" };
    fillRow(r, "FFD4EAF0");
    applyBorders(r);
    ws.getRow(r).height = 16;
    r++;

    // Data rows
    rows.forEach((data, idx) => {
      const bg = idx % 2 === 0 ? "FFF7F7F7" : "FFFFFFFF";
      data.forEach((v, ci) => {
        const cell = ws.getCell(r, ci + 1);
        cell.value = v as any;
        cell.font = { name: "Arial", size: 9 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", wrapText: false,
          horizontal: ci === 1 ? "left" : ci === 2 ? "center" : ci === 0 ? "center" : "right" };
        // Number formats
        if ([5, 15, 16, 17].includes(ci)) cell.numFmt = "#,##0"; // F,P,Q,R
        else if ([10, 11, 12, 13, 14].includes(ci)) cell.numFmt = "#,##0.00"; // K,L,M,N,O
        else if ([3, 4, 6, 7, 8, 9].includes(ci)) cell.numFmt = "#,##0";
      });
      ws.getRow(r).height = 18;
      r++;
    });

    // Sub-total row
    safeMerge(ws, rangeAO(r));
    const lbl = ws.getCell(`A${r}`);
    lbl.value = subTotalLabel;
    lbl.font = { name: "Arial", bold: true, color: { argb: "FF006039" } };
    lbl.alignment = { vertical: "middle", horizontal: "right" };
    for (let c = 1; c <= 18; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F2ED" } };
      cell.border = thinBorder;
    }
    const setTot = (col: number, val: number) => {
      const cell = ws.getCell(r, col);
      cell.value = val;
      cell.font = { name: "Arial", bold: true, color: { argb: "FF006039" } };
      cell.numFmt = "#,##0";
      cell.alignment = { vertical: "middle", horizontal: "right" };
    };
    setTot(16, pTotal); setTot(17, qTotal); setTot(18, rTotal);
    ws.getRow(r).height = 18;
    r++;
  };

  writeSubsection("I — PRE-FABRICATED PATHWAY (296 SFT)", pathway,
    "Total Budget of Pre-Fabricated Pathway Rs.", 420755, 157666, 578421);
  writeSubsection("II — ENTRY DECK (207 SFT)", entryDeck,
    "Total Budget of Entry Deck Rs.", 217406, 79977, 297601);
  writeSubsection("III — OUTDOOR DECK (254 SFT)", outdoorDeck,
    "Total Budget of Outdoor Deck Rs.", 372045, 154358, 412771);
  writeSubsection("C — ADD-ON", addon,
    "Total Budget of Add-On Rs.", 229264, 91705, 347519);

  // Blank spacer
  r++;

  // Grand Total
  const writeFooter = (label: string, amount: number, fillArgb: string, size = 11) => {
    safeMerge(ws, rangeAQ(r));
    const lbl = ws.getCell(`A${r}`);
    lbl.value = label;
    lbl.font = { name: "Arial", bold: true, size, color: { argb: "FFFFFFFF" } };
    lbl.alignment = { vertical: "middle", horizontal: "right" };
    for (let c = 1; c <= 18; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      cell.border = thinBorder;
    }
    const amt = ws.getCell(r, 18);
    amt.value = amount;
    amt.font = { name: "Arial", bold: true, size, color: { argb: "FFFFFFFF" } };
    amt.numFmt = "#,##0";
    amt.alignment = { vertical: "middle", horizontal: "right" };
    ws.getRow(r).height = 22;
    r++;
  };

  writeFooter("Grand Total (On-Site Work)", 1636312, "FF006039", 11);
  writeFooter("GST @ 18%", 294536, "FF1A4B5A", 10);
  writeFooter("Total (incl. GST)", 1930848, "FF0E7490", 11);
}

export function ProjectSetupUpload({ projectId, userRole, productionSystem, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<SheetResult[]>([]);

  if (!ALLOWED.includes(userRole ?? "")) return null;

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      // Fetch project + counts for pre-fill
      const { data: proj } = await (supabase.from("projects") as any)
        .select("id, name, client_name, division, production_system, contract_value, start_date, est_completion")
        .eq("id", projectId).single();

      const { data: mods } = await (supabase.from("modules") as any)
        .select("id").eq("project_id", projectId).eq("is_archived", false);
      const modIds = (mods || []).map((m: any) => m.id);
      const moduleCount = modIds.length;

      let panelCount = 0;
      if (modIds.length) {
        const { data: panelRows } = await (supabase.from("panels") as any).select("id, module_id");
        panelCount = (panelRows || []).filter((p: any) => modIds.includes(p.module_id)).length;
      }

      const yr = String(new Date().getFullYear()).slice(-2);
      const prefix = String(proj?.name || "").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
      const seq = String(projectId).replace(/-/g, "").slice(0, 3).toUpperCase();
      const projectCode = `${prefix}/${yr}/${seq}`;
      const fmtDate = (d: any) => d ? format(new Date(d), "dd/MM/yyyy") : "";

      // Load the official template from /public/templates/ — preserves layout, styles, formulas.
      const res = await fetch(`/templates/Project_Setup_Template.xlsx`, { cache: "no-cache" });
      if (!res.ok) throw new Error("Template file not found");
      const buf = await res.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);

      const ws = wb.getWorksheet("Project Details");
      if (ws) {
        // Match labels in column A (case-insensitive contains) and fill column B.
        const fills: Array<[string, any]> = [
          ["Project Code", projectCode],
          ["Project Name", proj?.name || ""],
          ["Division", proj?.division || ""],
          ["Production System", proj?.production_system || ""],
          ["Client Name", proj?.client_name || ""],
          ["Contract Value", Number(proj?.contract_value) || 0],
          ["Contract Start Date", fmtDate(proj?.start_date)],
          ["Expected Delivery Date", fmtDate(proj?.est_completion)],
          ["Number of Modules", moduleCount],
          ["Number of Panels", panelCount],
          ["Production Head", "Azad Ali"],
          ["Site Installation Manager", "Awaiz Ahmed"],
          ["Planning Engineer", "Karthik"],
          ["Costing Engineer", "Mohammed Nakeem"],
          ["Operations Architect", "Venkat"],
        ];
        const matchRow = (label: string): number | null => {
          const want = label.toLowerCase();
          for (let r = 1; r <= ws.rowCount; r++) {
            const v = String(ws.getCell(r, 1).value ?? "").trim().toLowerCase();
            if (v === want || v.startsWith(want)) return r;
          }
          return null;
        };
        for (const [label, value] of fills) {
          const r = matchRow(label);
          if (r) ws.getCell(r, 2).value = value as any;
        }
      }

      // Project-specific pre-fill: Vaishnavi Life Mysore 238-244 (VAIS/26/B4C)
      // Split the BOQ + Margin sheet into two: a Factory sheet (frozen row 4 header)
      // and a dedicated On-Site sheet (frozen row 2 header). ExcelJS only supports
      // a single freeze pane per worksheet, so two sheets are required.
      // Match by stable UUID first (bulletproof across users/sessions/caches),
      // then fall back to case-insensitive name match or derived project code.
      const VAISHNAVI_PROJECT_ID = "b4c92051-f6c7-41c9-9462-c0f0fa95d805";
      const normalizedName = String(proj?.name || "").trim().toLowerCase();
      const isVaishnavi =
        String(projectId).toLowerCase() === VAISHNAVI_PROJECT_ID ||
        normalizedName === "vaishnavi life mysore 238-244" ||
        projectCode === "VAIS/26/B4C";
      if (isVaishnavi) {
        const boqWs =
          wb.getWorksheet("BOQ + Margin") ||
          wb.getWorksheet("Tender BOQ") ||
          wb.getWorksheet("BOQ");
        if (boqWs) {
          // Rename existing factory sheet and freeze row 4 (column-header row).
          boqWs.name = "BOQ + Margin (Factory)";
          boqWs.views = [{ state: "frozen", xSplit: 0, ySplit: 4, topLeftCell: "A5", activeCell: "A5" }];

          // Create the dedicated On-Site sheet immediately after the Factory sheet.
          const factoryIdx = wb.worksheets.indexOf(boqWs);
          const onSiteWs = wb.addWorksheet("BOQ + Margin (On-Site)");
          // Move it directly after the factory sheet
          if (typeof (onSiteWs as any).orderNo !== "undefined") {
            (onSiteWs as any).orderNo = factoryIdx + 1;
          }
          // Inject the on-site block starting at row 1; freeze after row 2 (header row).
          injectVaishnaviBoqOnSite(onSiteWs, 1);
          onSiteWs.views = [{ state: "frozen", xSplit: 0, ySplit: 2, topLeftCell: "A3", activeCell: "A3" }];
        }
      }


      const out = await wb.xlsx.writeBuffer();
      const safeName = (proj?.name || "Project").replace(/[^A-Za-z0-9]+/g, "_");
      const blob = new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `Project_Setup_${safeName}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      toast.error(err?.message || "Template download failed");
    } finally {
      setDownloading(false);
    }
  };

  async function processBilling(ws: XLSX.WorkSheet | undefined): Promise<SheetResult> {
    if (!ws) return { name: "Billing", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return { name: "Billing", ok: true, count: 0, message: "Sheet empty — skipped" };
    const milestones = rows
      .filter(r => r["Milestone Description"] || r["Description"])
      .map((r, i) => ({
        project_id: projectId,
        milestone_number: Number(r["#"]) || i + 1,
        description: String(r["Milestone Description"] || r["Description"] || `Milestone ${i + 1}`),
        percentage: Number(r["%"]) || 0,
        amount_excl_gst: 0,
        gst_amount: 0,
        amount_incl_gst: 0,
        gst_applicable: String(r["GST Applicable (Y/N)"] || r["GST Applicable"] || "Y").toUpperCase().startsWith("Y"),
        trigger_event: String(r["Trigger Event"] || "Custom"),
        status: "pending",
      }));
    if (milestones.length === 0) return { name: "Billing", ok: true, count: 0, message: "No rows" };
    await supabase.from("project_billing_milestones").delete().eq("project_id", projectId);
    const { error } = await supabase.from("project_billing_milestones").insert(milestones as any);
    if (error) return { name: "Billing", ok: false, count: 0, message: error.message };
    return { name: "Billing", ok: true, count: milestones.length, message: `${milestones.length} milestones imported` };
  }

  async function processBOQ(ws: XLSX.WorkSheet | undefined, userId: string | null, userName: string | null): Promise<SheetResult> {
    if (!ws) return { name: "BOQ", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = rows.findIndex(r => r && r.some((c: any) => String(c).toLowerCase().includes("item description")));
    if (headerIdx === -1) return { name: "BOQ", ok: true, count: 0, message: "No header — skipped" };
    const dataRows = rows.slice(headerIdx + 1);
    // New column order: 0 S.No | 1 Category | 2 Item Description | 3 Unit |
    // 4 Tender Qty | 5 GFC Qty | 6 Wastage % | 7 BOQ Qty |
    // 8 Material Rate | 9 Labour Rate | 10 OH Rate | 11 BOQ Rate |
    // 12 Tender Amount | 13 GFC Amount | 14 Margin % | 15 Scope
    const parsed: any[] = []; let sno = 0;
    let hasAnyGfc = false;
    dataRows.forEach(r => {
      const desc = String(r[2] || "").trim();
      if (!desc) return;
      sno++;
      const tenderQty = r[4] === "" || r[4] == null ? 0 : Number(r[4]) || 0;
      const gfcQty = r[5] === "" || r[5] == null ? 0 : Number(r[5]) || 0;
      const wastagePct = Number(r[6]) || 0;
      const boqQty = Number(r[7]) || (gfcQty * (1 + wastagePct / 100));
      const matRate = Number(r[8]) || 0, labRate = Number(r[9]) || 0, ohRate = Number(r[10]) || 0;
      const boqRate = Number(r[11]) || (matRate + labRate + ohRate);
      const tenderAmt = Number(r[12]) || (tenderQty * boqRate);
      const gfcAmt = Number(r[13]) || (boqQty * boqRate);
      const marginPct = r[14] != null && r[14] !== "" ? Number(r[14]) : 0;
      const scope = String(r[15] || "Factory").trim();
      if (gfcQty > 0) hasAnyGfc = true;
      parsed.push({
        sno, category: String(r[1] || "Miscellaneous").trim(), item_description: desc, unit: String(r[3] || ""),
        tender_qty: tenderQty, actual_qty: gfcQty, wastage_pct: wastagePct, boq_qty: boqQty,
        material_rate: matRate, labour_rate: labRate, oh_rate: ohRate, boq_rate: boqRate,
        tender_amount: tenderAmt, gfc_amount: gfcAmt, total_amount: gfcAmt || tenderAmt,
        margin_pct: marginPct, scope,
      });
    });
    if (parsed.length === 0) return { name: "BOQ", ok: true, count: 0, message: "No items" };

    // Detect H1 sign-off (from design_stages)
    const { data: signoffs } = await (supabase as any).from("design_stages")
      .select("id").eq("project_id", projectId).eq("stage_name", "H1").eq("status", "completed").limit(1);
    const hasH1 = (signoffs as any[] | null)?.length ? true : false;

    const { data: prev } = await supabase.from("project_boq").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
    const nextV = ((prev as any)?.[0]?.version_number ?? 0) + 1;
    const tenderTotal = parsed.reduce((s, i) => s + (i.tender_amount || 0), 0);
    const gfcTotal = parsed.reduce((s, i) => s + (i.gfc_amount || 0), 0);
    const total = gfcTotal || tenderTotal;
    const marginAmt = parsed.reduce((s, i) => s + ((i.gfc_amount || i.tender_amount) * (i.margin_pct || 0) / 100), 0);
    const blended = total > 0 ? (marginAmt / total) * 100 : 0;
    const factory = parsed.filter(i => i.scope === "Factory" || i.scope === "Both").reduce((s, i) => s + (i.gfc_amount || i.tender_amount), 0);
    const civil = parsed.filter(i => i.scope === "On-Site Civil" || i.scope === "Both").reduce((s, i) => s + (i.gfc_amount || i.tender_amount), 0);
    const gfcPending = hasAnyGfc && !hasH1;
    const { data: boq, error } = await supabase.from("project_boq").insert({
      project_id: projectId, version_number: nextV, uploaded_by: userId, uploaded_by_name: userName,
      total_boq_value: total, blended_margin_pct: blended, factory_scope_value: factory, civil_scope_value: civil,
      tender_total_value: tenderTotal, gfc_total_value: gfcTotal, gfc_pending_h1: gfcPending,
    } as any).select().single();
    if (error || !boq) return { name: "BOQ", ok: false, count: 0, message: error?.message || "BOQ create failed" };
    const items = parsed.map(p => ({ boq_id: (boq as any).id, ...p }));
    for (let i = 0; i < items.length; i += 100) {
      const { error: e2 } = await supabase.from("project_boq_items").insert(items.slice(i, i + 100) as any);
      if (e2) return { name: "BOQ", ok: false, count: 0, message: e2.message };
    }
    const cats = new Set(parsed.map(p => p.category)).size;
    let msg = `${parsed.length} items across ${cats} categories`;
    if (!hasAnyGfc) msg += " — Tender only (GFC pending)";
    else if (gfcPending) msg += " — GFC stored, pending H1 sign-off";
    return { name: "BOQ", ok: true, count: parsed.length, message: msg };
  }

  async function processSchedule(ws: XLSX.WorkSheet | undefined): Promise<SheetResult> {
    if (!ws) return { name: "Schedule", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

    // Find header row containing "Stage #" + "Module #"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i] || [];
      const lower = r.map((c: any) => String(c ?? "").toLowerCase());
      if (lower.some(c => c.includes("stage #")) && lower.some(c => c.includes("module"))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return { name: "Schedule", ok: true, count: 0, message: "Stages-only header not found — sheet skipped" };

    const stageRows: any[] = [];
    const skipped: string[] = [];
    const sys = (productionSystem || "modular").toLowerCase();

    // Pre-load module name → id map
    const { data: mods } = await (supabase.from("modules") as any)
      .select("id, name, module_code")
      .eq("project_id", projectId)
      .eq("is_archived", false);
    const moduleMap = new Map<string, string>();
    (mods || []).forEach((m: any) => {
      if (m.name) moduleMap.set(String(m.name).trim().toLowerCase(), m.id);
      if (m.module_code) moduleMap.set(String(m.module_code).trim().toLowerCase(), m.id);
    });

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]; if (!row || row.every((x: any) => !x || !String(x).trim())) continue;
      const stageNum = parseInt(String(row[0] ?? "").trim(), 10);
      if (!stageNum || stageNum < 1 || stageNum > 15) continue;
      const stageName = String(row[1] ?? "").trim().split("(")[0].trim();
      const moduleName = String(row[2] ?? "").trim();
      const ps = parseDate(row[3]);
      const pe = parseDate(row[4]);
      // Col F (index 5) is Duration (auto). Notes is col G (index 6).
      const notes = String(row[6] ?? "").trim();
      const isNa = /^n\/?a$/i.test(notes) || /\bN\/A\b/i.test(notes);

      if (!isNa && (!ps || !pe)) {
        skipped.push(`Stage ${stageNum} ${stageName} / ${moduleName}`);
        continue;
      }
      stageRows.push({
        project_id: projectId,
        module_id: moduleMap.get(moduleName.toLowerCase()) ?? null,
        stage_number: stageNum,
        stage_name: stageName,
        planned_start: isNa ? null : ps,
        planned_end: isNa ? null : pe,
        status: isNa ? "N/A" : "Upcoming",
        is_na: isNa,
      });
    }

    if (stageRows.length === 0) return { name: "Schedule", ok: true, count: 0, message: "No stage rows" };

    // Replace project_stages for this project (factory rows only — site rows are entered in Site Hub)
    const { error: stageDelErr } = await (supabase as any).from("project_stages").delete().eq("project_id", projectId).lte("stage_number", 15);
    if (stageDelErr) console.warn("project_stages delete blocked (non-fatal):", stageDelErr.message);
    for (let i = 0; i < stageRows.length; i += 50) {
      const { error } = await (supabase as any).from("project_stages").insert(stageRows.slice(i, i + 50));
      if (error) return { name: "Schedule", ok: false, count: 0, message: `project_stages insert failed: ${error.message}` };
    }

    // Auto-clone all factory templates (stage_number 1–15) as project_tasks for each non-N/A stage row.
    // Templates use sub-stage numbers like "1.1", "1.2"; match by integer prefix to the schedule stage #.
    const { data: tmpl } = await (supabase.from("production_task_templates") as any)
      .select("stage_number, task_name, phase_name, stage_name, responsible_role, escalation_role, is_qc_gate, is_payment_milestone, special_note, display_order, task_type")
      .eq("production_system", sys)
      .order("display_order", { ascending: true });

    const stagePrefix = (s: any) => {
      const n = parseInt(String(s ?? "").split(".")[0], 10);
      return Number.isFinite(n) ? n : null;
    };

    const tasksToInsert: any[] = [];
    for (const sr of stageRows) {
      if (sr.is_na) continue;
      const stageTpl = (tmpl || []).filter((t: any) => {
        if (sr.stage_name && t.stage_name && t.stage_name === sr.stage_name) return true;
        return stagePrefix(t.stage_number) === sr.stage_number;
      });
      for (const t of stageTpl) {
        tasksToInsert.push({
          project_id: projectId,
          task_id_in_schedule: t.stage_number,
          task_name: t.task_name,
          phase: t.phase_name,
          stage_name: t.stage_name,
          planned_start_date: sr.planned_start,
          planned_finish_date: sr.planned_end,
          duration_days: 0,
          predecessor_ids: [],
          responsible_role: t.responsible_role,
          escalation_role: t.escalation_role,
          status: "Upcoming",
          completion_percentage: 0,
          delay_days: 0,
          is_locked: false,
          task_type: t.task_type,
          is_qc_gate: !!t.is_qc_gate,
          is_payment_milestone: !!t.is_payment_milestone,
          special_note: t.special_note,
          display_order: t.display_order,
          stage_number: t.stage_number,
        });
      }
    }

    // Fallback: if no templates matched (e.g. system has no sub-stage templates yet),
    // still create one project_task per stage row so the Schedule tab renders immediately.
    if (tasksToInsert.length === 0) {
      for (const sr of stageRows) {
        if (sr.is_na) continue;
        tasksToInsert.push({
          project_id: projectId,
          task_id_in_schedule: String(sr.stage_number),
          task_name: sr.stage_name,
          phase: sr.stage_number <= 2 ? "Pre-Production" : sr.stage_number <= 12 ? "Production" : "Dispatch",
          stage_name: sr.stage_name,
          planned_start_date: sr.planned_start,
          planned_finish_date: sr.planned_end,
          duration_days: 0,
          predecessor_ids: [],
          status: "Upcoming",
          completion_percentage: 0,
          delay_days: 0,
          is_locked: false,
          display_order: sr.stage_number,
          stage_number: String(sr.stage_number),
        });
      }
    }

    const { error: taskDelErr } = await supabase.from("project_tasks").delete().eq("project_id", projectId);
    if (taskDelErr) return { name: "Schedule", ok: false, count: 0, message: `project_tasks delete failed: ${taskDelErr.message}` };
    for (let i = 0; i < tasksToInsert.length; i += 100) {
      const { error } = await supabase.from("project_tasks").insert(tasksToInsert.slice(i, i + 100) as any);
      if (error) return { name: "Schedule", ok: false, count: 0, message: `project_tasks insert failed: ${error.message}` };
    }

    const naCount = stageRows.filter(s => s.is_na).length;
    const msg = `${stageRows.length} stages imported (${naCount} marked N/A), ${tasksToInsert.length} tasks cloned`;
    return { name: "Schedule", ok: true, count: stageRows.length, message: msg, warnings: skipped.length ? [`${skipped.length} rows skipped (missing dates)`] : [] };
  }


  async function processMaterial(ws: XLSX.WorkSheet | undefined, userId: string | null): Promise<SheetResult> {
    if (!ws) return { name: "Materials", ok: false, count: 0, message: "Sheet missing" };
    // Fixed columns: A=#, B=Section, C=Material, D=Unit, E=Tender Qty,
    // F=Ordered Qty, G=PO Release Date, H=Delivery Date, I=Destination, J=Notes
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy", defval: "" });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = (rows[i] || []).map((c: any) => String(c ?? "").toLowerCase());
      if (r.some(c => c.includes("material")) && r.some(c => c.includes("section"))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return { name: "Materials", ok: true, count: 0, message: "Header not found" };

    const items: any[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const material = String(r[2] ?? "").trim();
      if (!material) continue;
      items.push({
        item_id: String(items.length + 1),
        section: String(r[1] ?? "Shell and Core").trim(),
        material_description: material,
        unit: String(r[3] ?? "").trim() || null,
        tender_qty: r[4] === "" || r[4] == null ? null : Number(r[4]) || null,
        material_qty_ordered: r[5] === "" || r[5] == null ? null : Number(r[5]) || null,
        planned_po_release_date: parseDate(r[6]),
        planned_delivery_date: parseDate(r[7]),
        notes: [String(r[8] ?? "").trim() && `Destination: ${String(r[8]).trim()}`, String(r[9] ?? "").trim()].filter(Boolean).join(" | ") || null,
        status: "Planned",
      });
    }
    if (items.length === 0) return { name: "Materials", ok: true, count: 0, message: "No items" };
    const { data: prev } = await (supabase.from("project_material_plans") as any).select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1);
    const nextV = ((prev as any)?.[0]?.version ?? 0) + 1;
    const { data: plan, error } = await (supabase.from("project_material_plans") as any).insert({ project_id: projectId, version: nextV, uploaded_by: userId ?? "" }).select("id").single();
    if (error || !plan) return { name: "Materials", ok: false, count: 0, message: error?.message || "Plan create failed" };
    const withPlan = items.map(it => ({ ...it, plan_id: (plan as any).id }));
    for (let i = 0; i < withPlan.length; i += 50) {
      const { error: e2 } = await (supabase.from("project_material_plan_items") as any).insert(withPlan.slice(i, i + 50));
      if (e2) return { name: "Materials", ok: false, count: 0, message: `project_material_plan_items insert failed: ${e2.message}` };
    }
    return { name: "Materials", ok: true, count: items.length, message: `${items.length} items imported` };
  }

  async function processScope(ws: XLSX.WorkSheet | undefined, userId: string): Promise<SheetResult> {
    if (!ws) return { name: "Scope", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return { name: "Scope", ok: true, count: 0, message: "Sheet empty" };
    const items = rows.filter(r => r["Item"]).map((r, i) => {
      const scopeVal = String(r["Scope"] || "").toLowerCase();
      let resp: string = "not_in_scope";
      if (scopeVal.includes("habit")) resp = "habitainer";
      else if (scopeVal.includes("external")) resp = "external_contractor";
      else if (scopeVal.includes("tbd")) resp = "not_in_scope";
      return {
        section_label: String(r["Area"] || "Builder Finish"),
        item_name: String(r["Item"]),
        responsibility: resp,
        sort_order: i,
      };
    });
    if (items.length === 0) return { name: "Scope", ok: true, count: 0, message: "No items" };

    const { data: existing } = await supabase.from("project_scope_of_work").select("id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let scopeId = (existing as any)?.id;
    if (!scopeId) {
      const { data, error } = await supabase.from("project_scope_of_work").insert({ project_id: projectId, created_by: userId } as any).select("id").single();
      if (error) return { name: "Scope", ok: false, count: 0, message: error.message };
      scopeId = (data as any).id;
    }
    await supabase.from("project_scope_items").delete().eq("scope_id", scopeId);
    const sectionMap: Record<string, string> = {
      "design": "design_consultants", "consultants": "design_consultants",
      "builder": "builder_finish", "finish": "builder_finish",
      "external": "external_structures", "structures": "external_structures",
      "site": "site_related",
    };
    const payload = items.map(it => {
      const lower = it.section_label.toLowerCase();
      let section = "builder_finish";
      for (const [k, v] of Object.entries(sectionMap)) if (lower.includes(k)) { section = v; break; }
      return { scope_id: scopeId, section, item_name: it.item_name, responsibility: it.responsibility, sort_order: it.sort_order };
    });
    const { error } = await supabase.from("project_scope_items").insert(payload as any);
    if (error) return { name: "Scope", ok: false, count: 0, message: error.message };
    return { name: "Scope", ok: true, count: items.length, message: `${items.length} items imported` };
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setResults([]); setOpen(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const findSheet = (...names: string[]) => {
        for (const n of names) {
          const found = wb.SheetNames.find(s => s.toLowerCase().trim() === n.toLowerCase());
          if (found) return wb.Sheets[found];
        }
        return undefined;
      };
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", userId || "").maybeSingle();
      const userName = (prof as any)?.full_name || user?.email || null;

      const out: SheetResult[] = [];
      out.push(await processBilling(findSheet("Billing Milestones", "Billing")));
      out.push(await processBOQ(findSheet("BOQ + Margin", "Tender BOQ", "BOQ"), userId, userName));
      out.push(await processSchedule(findSheet("Project Schedule", "Schedule")));
      out.push(await processMaterial(findSheet("Material Plan", "Materials"), userId));
      if (userId) out.push(await processScope(findSheet("Scope of Work", "Scope"), userId));

      setResults(out);
      const totalImported = out.reduce((s, r) => s + (r.ok ? r.count : 0), 0);
      const failures = out.filter(r => !r.ok);
      if (failures.length > 0) {
        toast.error(`${failures.length} sheet${failures.length > 1 ? "s" : ""} failed: ${failures.map(f => `${f.name} — ${f.message}`).join(" | ")}`);
      } else if (totalImported > 0) {
        toast.success(`Project setup imported — ${totalImported} rows total`);
        // Stamp the project so individual upload buttons hide on every tab
        await (supabase.from("projects") as any)
          .update({ setup_uploaded_at: new Date().toISOString(), setup_uploaded_by_name: userName })
          .eq("id", projectId);
      }
      // Notify every tab on this page so they refetch immediately
      dispatchProjectImported(projectId);
      onImported?.();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Project Setup Template
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5" style={{ backgroundColor: "#006039", color: "white" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Project Setup
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {busy ? "Processing Project Setup…" : results.length > 0 && results.every(r => r.ok)
                ? "Project Setup uploaded successfully"
                : "Project Setup Import"}
            </DialogTitle>
            <DialogDescription>
              {busy ? "Reading every sheet and writing to the project tabs." : "Each sheet was processed independently."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {busy && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</div>}
            {results.map(r => (
              <div key={r.name} className="text-sm flex items-start gap-2">
                {r.ok ? <Check className="h-4 w-4 mt-0.5" style={{ color: "#006039" }} /> : <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: "#F40009" }} />}
                <div className="flex-1">
                  <div>
                    <span className="font-semibold">
                      {r.name === "Billing" ? "Billing" :
                        r.name === "BOQ" ? "BOQ" :
                        r.name === "Schedule" ? "Schedule" :
                        r.name === "Materials" ? "Materials" :
                        r.name === "Scope" ? "Scope" : r.name}:
                    </span>{" "}
                    {r.ok && r.count > 0 ? (
                      <>
                        <span className="font-mono">{r.count}</span>{" "}
                        {r.name === "Billing" ? "milestone" + (r.count > 1 ? "s" : "") + " loaded" :
                          r.name === "BOQ" ? "items loaded" :
                          r.name === "Schedule" ? "stages loaded" :
                          r.name === "Materials" ? "items loaded" :
                          r.name === "Scope" ? "items loaded" : r.message}
                      </>
                    ) : r.message}
                  </div>
                  {r.warnings?.map((w, i) => (
                    <div key={i} className="text-xs flex items-center gap-1" style={{ color: "#D4860A" }}><AlertTriangle className="h-3 w-3" /> {w}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {!busy && results.some(r => r.ok && r.count > 0) && (
              <Button size="sm" style={{ backgroundColor: "#006039", color: "white" }} onClick={() => { setOpen(false); navigate(`/projects/${projectId}`); }}>
                Go to Project <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
