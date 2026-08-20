import { describe, it, expect } from "vitest";
import { parseTrialBalanceRows, isExcludedLedger } from "@/lib/tally-tb-parser";

// Mirrors the real Tally export shape: letterhead block, spanning header,
// then Group → Sub-group → Ledger rows where parents repeat child totals.
const rows: any[][] = [
  ["HStack Modular Pvt Ltd"], ["Malur, Karnataka"], ["GSTIN 29AAAAA0000A1Z5"],
  [], ["Trial Balance"], ["1-Apr-25 to 31-Mar-26"], [], [],
  ["Particulars", "Closing Balance", null],
  [null, "Debit", "Credit"],
  [null, null, null],
  ["Loans (Liability)", 0, 5443265],
  ["Unsecured Loans", 0, 5443265],
  ["Director Loan A", 0, 2000000],
  ["Director Loan B", 0, 1443265],
  ["Bank Loan C", 0, 1500000],
  ["Bank Loan D", 0, 500000],
  ["Current Liabilities", 0, 300000],
  ["Duties & Taxes", 0, 200000],
  ["GST Payable", 0, 120000],
  ["TDS Payable", 0, 80000],
  ["Provisions", 0, 100000],
  ["Audit Fees Payable", 0, 100000],
  ["Sundry Debtors", 5743265, 0],
  ["Profit & Loss A/c", 0, 0],
  ["Grand Total", 5743265, 5743265],
];

describe("trial balance hierarchy", () => {
  const r = parseTrialBalanceRows(rows);

  it("detects group rows and leaf ledgers", () => {
    expect(r.groups.map(g => g.ledger_name)).toEqual([
      "Loans (Liability)", "Unsecured Loans", "Current Liabilities", "Duties & Taxes", "Provisions",
    ]);
    expect(r.leaves.map(l => l.ledger_name)).toEqual([
      "Director Loan A", "Director Loan B", "Bank Loan C", "Bank Loan D",
      "GST Payable", "TDS Payable", "Audit Fees Payable", "Sundry Debtors",
    ]);
  });

  it("sums leaves only and reconciles to the file grand total", () => {
    expect(r.leafCreditTotal).toBe(5743265);
    expect(r.leafDebitTotal).toBe(5743265);
    expect(r.fileGrandTotalDebit).toBe(5743265);
    expect(r.reconciles).toBe(true);
  });

  it("excludes reconciliation ledgers", () => {
    expect(isExcludedLedger("Profit & Loss A/c")).toBe(true);
    expect(isExcludedLedger("Difference in opening balances")).toBe(true);
    expect(isExcludedLedger("Sundry Debtors")).toBe(false);
  });

  it("flags a file that does not reconcile", () => {
    const bad = parseTrialBalanceRows([
      ["Particulars", "Debit", "Credit"],
      ["Ledger A", 100, 0],
      ["Ledger B", 0, 90],
      ["Grand Total", 100, 90],
    ]);
    expect(bad.reconciles).toBe(false);
  });
});
