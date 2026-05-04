import * as XLSX from "xlsx";

/** Generate and download an XLSX template with the given headers and sample data */
export function downloadXlsxTemplate(
  filename: string,
  sheetName: string,
  headers: readonly string[],
  sampleRows: readonly (readonly (string | number | null)[])[] = []
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...headers], ...sampleRows.map(r => [...r])]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ──────────────── Template definitions ────────────────

export const TEMPLATES = {
  expense: {
    filename: "Expense_Report_Template.xlsx",
    sheet: "Expenses",
    headers: ["Date (DD/MM/YYYY)", "Employee Name", "Category", "Description", "Basic Amount (excl GST)", "GST Amount", "Total Amount", "Receipt Number", "Payment Mode", "Approved By", "Remarks"] as const,
    sample: [["15/04/2026", "Karthik M", "Travel", "Site visit — Malur to Bangalore", 2200, 396, 2596, "REC-0042", "UPI", "Azad", "Monthly reimbursement"]] as const,
  },
  tallyPO: {
    filename: "PO_Register_Template.xlsx",
    sheet: "Purchase Orders",
    headers: ["Date", "Particulars", "Vch Type", "Vch No", "Order Ref No", "Order Amount", "Narration (project name)"] as const,
    sample: [["15/04/2026", "Malur Tubes — MS Steel 40x40", "Purchase Order", "PO-2026-0048", "PO-048", 185000, "Project Whitefield Villa — Module M1"]] as const,
  },
  trialBalance: {
    filename: "Trial_Balance_Template.xlsx",
    sheet: "Trial Balance",
    headers: ["Particulars", "Opening Balance", "Debit", "Credit", "Closing Balance"] as const,
    sample: [
      ["Sales — Modular Structures", 0, 0, 4973740, 4973740],
      ["Purchase — Structural Steel", 0, 3200000, 0, 3200000],
      ["HDFC Bank — Current A/c", 250000, 100000, 80000, 270000],
    ] as const,
  },
  bankLedger: {
    filename: "Bank_Ledger_Template.xlsx",
    sheet: "Bank Ledger",
    headers: ["Date", "Dr/Cr", "Particulars", "Vch Type", "Vch No", "Debit", "Credit"] as const,
    sample: [
      ["05/04/2026", "Dr", "Client Payment — Whitefield Villa Phase 1", "Receipt", "RCP-001", 500000, 0],
      ["10/04/2026", "Cr", "Malur Tubes — PO-048 Payment", "Payment", "PAY-001", 0, 185000],
    ] as const,
  },
  creditorLedger: {
    filename: "Creditor_Ledger_Template.xlsx",
    sheet: "Creditor Ledger",
    headers: ["Ledger Name", "Opening Balance", "Debit", "Credit", "Closing Balance"] as const,
    sample: [
      ["Malur Tubes", 0, 185000, 0, 185000],
      ["Shera India — Cera Board", 0, 45000, 0, 45000],
    ] as const,
  },
  debtorLedger: {
    filename: "Debtor_Ledger_Template.xlsx",
    sheet: "Debtor Ledger",
    headers: ["Ledger Name", "Opening Balance", "Debit", "Credit", "Closing Balance"] as const,
    sample: [
      ["Client A — Whitefield Villa", 0, 0, 500000, 500000],
      ["Client B — HSR Layout", 0, 0, 350000, 350000],
    ] as const,
  },
  boq: {
    filename: "BOQ_Template.xlsx",
    sheet: "BOQ",
    headers: ["S.No", "Category", "Item Description", "Unit", "Tender Qty", "Actual Qty", "Wastage %", "BOQ Qty", "Material Rate (₹)", "Labour Rate (₹)", "OH Rate (₹)", "BOQ Rate (₹)", "Total Amount (₹)", "Margin %", "Scope (Factory / On-Site Civil / Both)"] as const,
    sample: [[1, "Structural Steel", "LGSF C-Channel 89mm", "RFT", 95, 100, 10, 110, 85, 45, 15, 145, 15950, 8.5, "Factory"]] as const,
  },
  budget: {
    filename: "Budget_Template.xlsx",
    sheet: "Budgets",
    headers: ["SL No", "Category", "Client Price", "GFC Budget Allocated", "Vendor", "Invoice No", "Invoice Date", "Description", "Basic Amount Excl GST", "Remark"] as const,
    sample: [[1, "Structural Steel", 5000000, 4200000, "Malur Tubes", "INV-4521", "15/04/2026", "MS Steel Plates 3mm — Module M1", 185000, ""]] as const,
  },
  materialPlan: {
    filename: "Material_Plan_Template.xlsx",
    sheet: "Material Plan",
    headers: ["ID", "Section", "Material Description", "Qty Variation Note", "Tender Qty", "Unit", "GFC Quantity", "Indent Qty", "Indent Unit", "Indent Received (Y/N)", "Material Qty Ordered", "Planned PO Release Date", "Planned Procurement Date", "Planned Delivery Date", "Actual PO Release Date", "Actual Procurement Date", "Supplier Committed Delivery Date", "Actual Delivery Date", "Material Qty Received", "Delay Days", "Reason for Delay", "Status"] as const,
    sample: [["MP-001", "Shell and Core", "MS Tubes 40x40x2mm", "", 500, "Rft", 520, 520, "Rft", "Y", 520, "01/05/2026", "05/05/2026", "15/05/2026", "", "", "", "", 0, 0, "", "Ordered"]] as const,
  },
  schedule: {
    filename: "Schedule_Template.xlsx",
    sheet: "Schedule",
    headers: ["Phase", "Stage #", "Task Type", "Task / Sub-task", "Who Does It", "Input Required", "Output / Deliverable", "HStack Action", "QC Gate?", "Duration (days)", "Notes"] as const,
    sample: [["Factory Production", "3B.1", "task", "Main frame fabrication and erection", "fabrication_foreman", "Primed steel from 3A", "Erected frame", "Update stage tracker", "Yes — QC at stage end", 5, ""]] as const,
  },
  variationRegister: {
    filename: "Variation_Register_Template.xlsx",
    sheet: "Variations",
    headers: ["V.No", "Description", "Scope Change Type", "Tender Qty", "GFC Qty", "Variance Qty", "Unit", "Material Rate ₹", "Labour Rate ₹", "Basic Rate ₹", "Margin %", "Final Rate ₹", "Final Cost ₹", "Initiated By", "Date Raised", "Notes"] as const,
    sample: [["V001", "Additional cladding panel — east wall", "Addition", 0, 10, 10, "Nos", 500, 200, 700, 30, 910, 9100, "Karan", "15/04/2026", ""]] as const,
  },
  plUpload: {
    filename: "PL_Template.xlsx",
    sheet: "P&L",
    headers: ["Particulars", "Amount", "Sub-total", "Particulars", "Amount", "Sub-total"] as const,
    sample: [
      ["Opening Stock", null, 3952416, "Sales Accounts", null, 10859512],
      ["Purchase — Materials", 5403326, null, "Modular Structures", 4973740, null],
    ] as const,
  },
  cashflow: {
    filename: "CashFlow_Template.xlsx",
    sheet: "Cash Flow",
    headers: ["Date (DD/MM/YYYY)", "Type (inflow/outflow)", "Description", "Project Name", "Amount", "Category"] as const,
    sample: [["01/04/2026", "inflow", "Client Payment — Phase 1", "Whitefield Villa", 500000, "Client Payment"]] as const,
  },
  payments: {
    filename: "Payments_Template.xlsx",
    sheet: "Payments",
    headers: ["Project Name", "Client Name", "Milestone Description", "Due Date (DD/MM/YYYY)", "Amount"] as const,
    sample: [["Whitefield Villa", "Client A", "Foundation Complete", "15/04/2026", 500000]] as const,
  },
  tenderBudget: {
    filename: "Tender_Budget_Template.xlsx",
    sheet: "Tender Budget",
    headers: ["Category", "Description", "Tender Qty", "GFC Qty", "Unit", "Material Rate (₹)", "Labour Rate (₹)", "OH Rate (₹)", "Total Rate (₹)", "Total Amount (₹)", "Margin %", "Notes"] as const,
    sample: [["Structural Steel", "LGSF C-Channel 89mm x 3000mm", 500, 510, "RFT", 85, 45, 15, 145, 73950, 8.5, "Total Amount = GFC Qty × Total Rate"]] as const,
  },
} as const;

// ──────────────── Schedule Template (Hardik Gowda format) ────────────────

interface ScheduleTemplateTask {
  phase_name: string;
  stage_number: string;
  task_type: string;
  task_name: string;
  predecessor_stage_numbers: string[] | null;
  typical_duration_days: number | null;
}

const TASK_TYPE_COLORS: Record<string, string> = {
  qc_gate: "FFE8E8",
  "sign-off": "E8F2ED",
  payment: "FFF3CD",
  "sub-task": "F7F7F7",
};

export function downloadScheduleTemplate(
  filename: string,
  tasks: ScheduleTemplateTask[],
) {
  const wb = XLSX.utils.book_new();

  // Row 1 blank, Row 2 headers
  const rows: any[][] = [
    [], // Row 1 blank
    ["", "ID", "Name", "Duration", "Predecessors", "Planned Start date", "Planned finish date"],
  ];

  let currentPhase = "";

  for (const t of tasks) {
    // Phase section header
    if (t.phase_name && t.phase_name !== currentPhase) {
      currentPhase = t.phase_name;
      rows.push([currentPhase, "", "", "", "", "", ""]);
    }

    const predecessors = (t.predecessor_stage_numbers ?? []).join(",");
    let name = t.task_name;
    const tt = t.task_type ?? "task";

    if (tt === "qc_gate") name = `[QC] ${name}`;
    else if (tt === "sign-off") name = `[SIGN-OFF] ${name}`;
    else if (tt === "payment") name = `[PAYMENT] ${name}`;

    const isTask = tt === "task";
    const duration = isTask ? "" : 0;
    const startDate = "";
    const finishDate = "";

    rows.push(["", t.stage_number, name, duration, predecessors, startDate, finishDate]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 },  // A - section
    { wch: 8 },   // B - ID
    { wch: 45 },  // C - Name
    { wch: 12 },  // D - Duration
    { wch: 18 },  // E - Predecessors
    { wch: 20 },  // F - Planned Start
    { wch: 20 },  // G - Planned Finish
  ];

  // Apply color coding
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let R = 2; R <= range.e.r; R++) { // Skip blank row 0 and header row 1
    const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
    const cellB = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
    const cellC = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];

    const aVal = cellA?.v ? String(cellA.v).trim() : "";
    const bVal = cellB?.v ? String(cellB.v).trim() : "";
    const cVal = cellC?.v ? String(cellC.v).trim() : "";

    let bgColor = "FFFFFF";

    // Section header: text in col A
    if (aVal && !bVal) {
      bgColor = "E5E5E5";
    } else if (cVal.startsWith("[QC]")) {
      bgColor = "FFE8E8";
    } else if (cVal.startsWith("[SIGN-OFF]")) {
      bgColor = "E8F2ED";
    } else if (cVal.startsWith("[PAYMENT]")) {
      bgColor = "FFF3CD";
    } else {
      // Check if it's a sub-task (duration = 0 and has an ID)
      const cellD = ws[XLSX.utils.encode_cell({ r: R, c: 3 })];
      if (bVal && cellD?.v === 0) {
        bgColor = "F7F7F7";
      }
    }

    // Apply fill to all cells in the row (xlsx community edition doesn't write fills,
    // but we set the metadata for compatibility with xlsx-style or other writers)
    for (let C = 0; C <= 6; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        ...(ws[addr].s ?? {}),
        fill: { fgColor: { rgb: bgColor } },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Schedule");
  XLSX.writeFile(wb, filename);
}

// ──────────────── Material Plan Template (Hardik Gowda format) ────────────────

interface MaterialPlanRow {
  section: string;
  id: string | number | null;
  material: string;
  unit: string;
  isSubItem?: boolean;
}

const MATERIAL_PLAN_DATA: MaterialPlanRow[] = [
  // SHELL AND CORE
  { section: "SHELL AND CORE", id: 1, material: "Structural Steel — Beams, Columns, Framed Structure", unit: "KG" },
  { section: "SHELL AND CORE", id: null, material: "Stiffener & Base Plate 75*75*8 mm", unit: "KG", isSubItem: true },
  { section: "SHELL AND CORE", id: null, material: "LGSF", unit: "KG", isSubItem: true },
  { section: "SHELL AND CORE", id: null, material: "Lifting hooks", unit: "KG", isSubItem: true },
  { section: "SHELL AND CORE", id: 2, material: "Deck Sheet 1.0mm — Floor & Roof", unit: "KG" },
  { section: "SHELL AND CORE", id: 3, material: "Welded Wire Mesh 2.5mm 50mm C/C — Floor & Roof", unit: "KG" },
  { section: "SHELL AND CORE", id: 4, material: "Chicken Wire Mesh 1mm 25mm — Floor & Roof", unit: "KG" },
  { section: "SHELL AND CORE", id: 5, material: "EPS Thermocol Sheet — Floor & Roof", unit: "Nos" },
  { section: "SHELL AND CORE", id: 6, material: "Self Drilling Screws — Floor & Roof", unit: "Nos" },
  { section: "SHELL AND CORE", id: 7, material: "Roofing Concrete Plain Cement Mortar 1:2", unit: "CFT" },
  // BUILDER FINISH
  { section: "BUILDER FINISH", id: 8, material: "Rockwool Slab 48kg 50mm — Inner Wall", unit: "SFT" },
  { section: "BUILDER FINISH", id: 9, material: "Habit Board 13mm — Inner Wall", unit: "SFT" },
  { section: "BUILDER FINISH", id: 10, material: "Toilet Cement Board", unit: "SFT" },
  { section: "BUILDER FINISH", id: 11, material: "Shera Neu Wall Board 10mm — External Wall", unit: "SFT" },
  { section: "BUILDER FINISH", id: 12, material: "Gypsum Board 12.5mm — Ceiling", unit: "SFT" },
  { section: "BUILDER FINISH", id: null, material: "Boarding accessories", unit: "—", isSubItem: true },
  { section: "BUILDER FINISH", id: 13, material: "Internal Painting — Jointing Compound, Putty, Primer, Paint", unit: "SFT" },
  { section: "BUILDER FINISH", id: 14, material: "Shera Plank — Exterior Finish", unit: "SFT" },
  { section: "BUILDER FINISH", id: 15, material: "Aluminium Foil", unit: "SQM" },
  { section: "BUILDER FINISH", id: 17, material: "Aluminium Glass Windows", unit: "SFT" },
  { section: "BUILDER FINISH", id: 18, material: "Aluminium Vents", unit: "SFT" },
  { section: "BUILDER FINISH", id: null, material: "Wooden Flooring", unit: "SFT", isSubItem: true },
  { section: "BUILDER FINISH", id: 19, material: "Vitrified Flooring and Tile Dadoing — Bathroom", unit: "SFT" },
  { section: "BUILDER FINISH", id: 23, material: "Rain Water Gutter PVC", unit: "KG" },
  { section: "BUILDER FINISH", id: 24, material: "Concealed Items — Electrical", unit: "—" },
  { section: "BUILDER FINISH", id: 24, material: "Concealed Items — Plumbing", unit: "—" },
  { section: "BUILDER FINISH", id: 25, material: "Plumbing Fixtures", unit: "—" },
  { section: "BUILDER FINISH", id: 26, material: "Electrical Fixtures", unit: "SFT" },
  { section: "BUILDER FINISH", id: 33, material: "Roof Screeding 50mm", unit: "CFT" },
  { section: "BUILDER FINISH", id: 35, material: "AC Copper Piping 1.5MT", unit: "MTR" },
  { section: "BUILDER FINISH", id: null, material: "MS Flashing", unit: "—", isSubItem: true },
];

export function downloadMaterialPlanTemplate(filename: string, clientName: string) {
  const wb = XLSX.utils.book_new();

  // Row 1: Client name header
  // Row 2: Group headers with merges
  // Row 3: Column headers
  const rows: any[][] = [
    [clientName, "", "", "", "", "", "", "", ""],
    ["", "", "", "", "Quantity", "", "Plan - Dates", "", ""],
    ["", "ID", "Material", "planned Indent release date", "Tender Qty", "Unit", "PO release date", "Material Procurement", "Material Delivery"],
  ];

  let currentSection = "";
  for (const item of MATERIAL_PLAN_DATA) {
    // Section header
    if (item.section !== currentSection) {
      currentSection = item.section;
      rows.push([currentSection, "", "", "", "", "", "", "", ""]);
    }

    rows.push([
      "",
      item.id ?? "",
      item.material,
      "", // planned indent release date
      "", // tender qty
      item.unit,
      "", // PO release date
      "", // material procurement
      "", // material delivery
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Client name
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } }, // "Quantity"
    { s: { r: 1, c: 6 }, e: { r: 1, c: 8 } }, // "Plan - Dates"
  ];

  ws["!cols"] = [
    { wch: 20 },  // A - section
    { wch: 6 },   // B - ID
    { wch: 50 },  // C - Material
    { wch: 22 },  // D - indent release
    { wch: 12 },  // E - Tender Qty
    { wch: 8 },   // F - Unit
    { wch: 18 },  // G - PO release
    { wch: 20 },  // H - Material Procurement
    { wch: 20 },  // I - Material Delivery
  ];

  // Color coding for section headers (metadata; full write requires xlsx-style)
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  for (let R = 3; R <= range.e.r; R++) {
    const cellA = ws[XLSX.utils.encode_cell({ r: R, c: 0 })];
    const aVal = cellA?.v ? String(cellA.v).trim() : "";
    const cellB = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
    const bVal = cellB?.v ? String(cellB.v).trim() : "";

    if (aVal && !bVal) {
      // Section header - dark green with white text
      for (let C = 0; C <= 8; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { v: "", t: "s" };
        ws[addr].s = {
          fill: { fgColor: { rgb: "006039" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Material Plan");
  XLSX.writeFile(wb, filename);
}
