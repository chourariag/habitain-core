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
    headers: ["S.No", "Category", "Item Description", "Unit", "Actual Qty", "Wastage %", "BOQ Qty", "Material Rate (₹)", "Labour Rate (₹)", "OH Rate (₹)", "BOQ Rate (₹)", "Total Amount (₹)", "Margin %", "Scope (Factory / On-Site Civil / Both)"] as const,
    sample: [[1, "Structural Steel", "LGSF C-Channel 89mm", "RFT", 100, 10, 110, 85, 45, 15, 145, 15950, 8.5, "Factory"]] as const,
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
} as const;
