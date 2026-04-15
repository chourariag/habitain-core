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

  // Auto-width columns
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ──────────────── Template definitions ────────────────

export const TEMPLATES = {
  expense: {
    filename: "Expense_Report_Template.xlsx",
    sheet: "Expenses",
    headers: ["Date (DD/MM/YYYY)", "Category", "Description", "Amount", "Project Name", "Receipt Reference"],
    sample: [["15/04/2026", "Travel", "Site visit - Bangalore", 2500, "Project Alpha", "REC-001"]],
  },
  tallyPO: {
    filename: "Tally_PO_Template.xlsx",
    sheet: "Purchase Orders",
    headers: ["Date", "Voucher No", "Party Name", "Type (PO/WO)", "Item Name", "Quantity", "Rate", "Amount", "Narration"],
    sample: [["15/04/2026", "PO-001", "Steel Corp Ltd", "PO", "MS Steel Plate", 100, 450, 45000, "For Project Alpha - Module M1"]],
  },
  trialBalance: {
    filename: "Trial_Balance_Template.xlsx",
    sheet: "Trial Balance",
    headers: ["Particulars", "Opening Balance", "Debit", "Credit", "Closing Balance"],
    sample: [
      ["Sales - Domestic", 0, 0, 500000, 500000],
      ["Raw Material Purchased", 0, 300000, 0, 300000],
      ["Factory Rent", 0, 50000, 0, 50000],
      ["HDFC Bank", 250000, 100000, 80000, 270000],
      ["Sundry Debtors", 150000, 50000, 30000, 170000],
      ["Sundry Creditors", 0, 20000, 90000, 70000],
    ],
  },
  bankLedger: {
    filename: "Bank_Ledger_Template.xlsx",
    sheet: "Bank Ledger",
    headers: ["Date (DD/MM/YYYY)", "Particulars", "Vch Type", "Vch No", "Debit", "Credit"],
    sample: [
      ["01/04/2026", "Opening Balance", "", "", 0, 0],
      ["05/04/2026", "Client Payment - Project Alpha", "Receipt", "RCP-001", 500000, 0],
      ["10/04/2026", "Steel Corp Ltd - PO Payment", "Payment", "PAY-001", 0, 150000],
    ],
  },
  creditorLedger: {
    filename: "Creditor_Ledger_Template.xlsx",
    sheet: "Creditor Ledger",
    headers: ["Party Name", "Bill Date (DD/MM/YYYY)", "Bill No", "Due Date (DD/MM/YYYY)", "Amount"],
    sample: [
      ["Steel Corp Ltd", "01/04/2026", "INV-4521", "01/05/2026", 150000],
      ["Electrical Supplies Co", "10/04/2026", "INV-892", "10/05/2026", 45000],
    ],
  },
  debtorLedger: {
    filename: "Debtor_Ledger_Template.xlsx",
    sheet: "Debtor Ledger",
    headers: ["Party Name", "Bill Date (DD/MM/YYYY)", "Bill No", "Due Date (DD/MM/YYYY)", "Amount"],
    sample: [
      ["Client A - Project Alpha", "15/03/2026", "HB-INV-001", "15/04/2026", 500000],
      ["Client B - Project Beta", "01/04/2026", "HB-INV-002", "01/05/2026", 350000],
    ],
  },
  boq: {
    filename: "BOQ_Template.xlsx",
    sheet: "BOQ",
    headers: ["S.No", "Category", "Item Description", "Unit", "Actual Qty", "Rate (₹)", "Amount (₹)", "Remark"],
    sample: [[1, "Structure", "MS Steel Plate 3mm", "Kg", 500, 85, 42500, ""]],
  },
  budget: {
    filename: "Budget_Template.xlsx",
    sheet: "Budgets",
    headers: ["Project Name", "Sanctioned Budget", "Labour Budget", "Logistics Budget"],
    sample: [["Project Alpha", 5000000, 800000, 300000]],
  },
  materialPlan: {
    filename: "Material_Plan_Template.xlsx",
    sheet: "Material Plan",
    headers: ["ID", "Section", "Material Description", "Qty Variation Note", "Tender Qty", "Unit", "GFC Quantity", "Indent Qty", "Indent Unit", "Indent Received (Y/N)", "Material Qty Ordered", "Planned PO Release Date", "Planned Procurement Date", "Planned Delivery Date", "Actual PO Release Date", "Actual Procurement Date", "Supplier Committed Delivery Date", "Actual Delivery Date", "Material Qty Received", "Delay Days", "Reason for Delay", "Status"],
    sample: [["MP-001", "Structure", "MS Steel Plate 3mm", "", 500, "Kg", 520, 520, "Kg", "Y", 520, "01/04/2026", "05/04/2026", "15/04/2026", "", "", "", "", 0, 0, "", "Ordered"]],
  },
  schedule: {
    filename: "Schedule_Template.xlsx",
    sheet: "Schedule",
    headers: ["ID", "Task Name", "Duration (days)", "Predecessors", "Planned Start Date", "Planned Finish Date", "Responsible Role", "Phase"],
    sample: [["T-001", "Sub-Frame Fabrication", 5, "", "01/04/2026", "05/04/2026", "fabrication_foreman", "Production"]],
  },
  variationRegister: {
    filename: "Variation_Register_Template.xlsx",
    sheet: "Variations",
    headers: ["V.No", "Description", "Scope Change Type", "Tender Qty", "GFC Qty", "Unit", "Tender Rate", "GFC Rate", "Tender Amount", "GFC Amount", "Difference", "Category", "Status"],
    sample: [["V-001", "Additional cladding panel", "Addition", 0, 10, "Nos", 0, 5000, 0, 50000, 50000, "Material", "Pending"]],
  },
  plUpload: {
    filename: "PL_Upload_Template.xlsx",
    sheet: "P&L Data",
    headers: ["Month", "Year", "Revenue", "Materials", "Labour", "Logistics", "Other COGS", "Office Admin", "Marketing", "RM Costs", "Depreciation", "Other Opex"],
    sample: [[4, 2026, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  },
  cashflow: {
    filename: "CashFlow_Template.xlsx",
    sheet: "Cash Flow",
    headers: ["Date (DD/MM/YYYY)", "Type (inflow/outflow)", "Description", "Project Name", "Amount", "Category"],
    sample: [["01/04/2026", "inflow", "Client Payment - Phase 1", "Project Alpha", 500000, "Client Payment"]],
  },
  payments: {
    filename: "Payments_Template.xlsx",
    sheet: "Payments",
    headers: ["Project Name", "Client Name", "Milestone Description", "Due Date (DD/MM/YYYY)", "Amount"],
    sample: [["Project Alpha", "Client A", "Foundation Complete", "15/04/2026", 500000]],
  },
} as const;
