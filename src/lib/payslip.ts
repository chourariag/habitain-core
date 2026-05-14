import jsPDF from "jspdf";
import logoImg from "@/assets/logo.png";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface PayrollConfig {
  monthly_ctc: number;
  basic_pct: number;
  hra_pct: number;
  pt_amount: number;
  tds_monthly: number;
  pan?: string | null;
  pf_number?: string | null;
  bank_account?: string | null;
  bank_name?: string | null;
  ifsc?: string | null;
  designation?: string | null;
  department?: string | null;
  doj?: string | null;
}

export interface PayslipBreakup {
  basic: number;
  hra: number;
  special_allowance: number;
  gross_earnings: number;
  pf_deduction: number;
  pt_deduction: number;
  tds_deduction: number;
  total_deductions: number;
  net_pay: number;
}

export function calcPayslip(cfg: PayrollConfig): PayslipBreakup {
  const ctc = Number(cfg.monthly_ctc) || 0;
  const basicPct = Number(cfg.basic_pct) || 0;
  const hraPct = Number(cfg.hra_pct) || 0;
  const basic = +(ctc * basicPct / 100).toFixed(2);
  const hra = +(basic * hraPct / 100).toFixed(2);
  const special_allowance = +(ctc - basic - hra).toFixed(2);
  const gross_earnings = +(basic + hra + special_allowance).toFixed(2);
  const pf_deduction = +(basic * 0.12).toFixed(2);
  const pt_deduction = Number(cfg.pt_amount) || 0;
  const tds_deduction = Number(cfg.tds_monthly) || 0;
  const total_deductions = +(pf_deduction + pt_deduction + tds_deduction).toFixed(2);
  const net_pay = +(gross_earnings - total_deductions).toFixed(2);
  return { basic, hra, special_allowance, gross_earnings, pf_deduction, pt_deduction, tds_deduction, total_deductions, net_pay };
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? ones[h] + " Hundred" + (r ? " and " : "") : "") + (r ? twoDigits(r) : "");
}
export function rupeesInWords(amount: number): string {
  const n = Math.floor(Math.max(0, amount));
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(twoDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ").trim();
}

const inr = (n: number) => "INR " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let _logoData: string | null = null;
async function loadLogoDataUrl(): Promise<string | null> {
  if (_logoData) return _logoData;
  try {
    const res = await fetch(logoImg);
    const blob = await res.blob();
    _logoData = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return _logoData;
  } catch {
    return null;
  }
}

export interface PayslipMeta {
  employee_name: string;
  employee_id: string;
  designation: string;
  department: string;
  doj: string;
  pan: string;
  pf_number: string;
  bank_account: string;
  bank_name: string;
  ifsc: string;
  days_worked: number;
  days_in_month: number;
  month: number; // 1-12
  year: number;
  generated_on: Date;
  company_gstin?: string;
}

export async function generatePayslipPdf(meta: PayslipMeta, b: PayslipBreakup): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;

  // Header
  const logo = await loadLogoDataUrl();
  if (logo) {
    try { doc.addImage(logo, "PNG", M, 32, 56, 56); } catch { /* noop */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(26, 26, 26);
  doc.text("Alternate Real Estate Experiences Pvt Ltd", M + 70, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text("Peenya Industrial Area, Bangalore 560 058", M + 70, 64);
  doc.text(`GSTIN: ${meta.company_gstin || "29AAFCA1234A1Z5"}`, M + 70, 76);

  // Sub-header band
  doc.setFillColor(0, 96, 57); // #006039
  doc.rect(M, 100, W - M * 2, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`PAYSLIP FOR THE MONTH OF ${MONTHS[meta.month - 1].toUpperCase()} ${meta.year}`, W / 2, 116, { align: "center" });

  // Employee details (two columns)
  const detY = 144;
  const colL = M;
  const colR = W / 2 + 8;
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(9);

  const drawRow = (x: number, y: number, label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(102, 102, 102);
    doc.text(label, x, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 26, 26);
    doc.text(value || "—", x + 110, y);
  };

  const left: Array<[string, string]> = [
    ["Employee Name", meta.employee_name],
    ["Employee ID", meta.employee_id],
    ["Designation", meta.designation],
    ["Department", meta.department],
    ["Date of Joining", meta.doj],
  ];
  const right: Array<[string, string]> = [
    ["PAN", meta.pan],
    ["PF Number", meta.pf_number],
    ["Bank Account", meta.bank_account],
    ["Bank", meta.bank_name],
    ["IFSC", meta.ifsc],
  ];
  left.forEach(([l, v], i) => drawRow(colL, detY + i * 16, l, v));
  right.forEach(([l, v], i) => drawRow(colR, detY + i * 16, l, v));
  drawRow(colR, detY + 5 * 16, "Days Worked", `${meta.days_worked} / ${meta.days_in_month}`);

  // Earnings + Deductions tables
  const tY = detY + 6 * 16 + 16;
  const halfW = (W - M * 2 - 8) / 2;
  const drawTable = (x: number, title: string, rows: Array<[string, number]>, totalLabel: string, totalValue: number) => {
    doc.setFillColor(247, 247, 247);
    doc.rect(x, tY, halfW, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text(title, x + 8, tY + 15);
    doc.text("Amount", x + halfW - 8, tY + 15, { align: "right" });

    let y = tY + 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    rows.forEach(([label, val]) => {
      y += 18;
      doc.setTextColor(60, 60, 60);
      doc.text(label, x + 8, y);
      doc.setTextColor(26, 26, 26);
      doc.text(inr(val), x + halfW - 8, y, { align: "right" });
    });
    y += 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(x + 8, y, x + halfW - 8, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 96, 57);
    doc.text(totalLabel, x + 8, y);
    doc.text(inr(totalValue), x + halfW - 8, y, { align: "right" });
    return y;
  };

  const yE = drawTable(
    M, "Earnings",
    [["Basic Salary", b.basic], ["House Rent Allowance", b.hra], ["Special Allowance", b.special_allowance]],
    "GROSS EARNINGS", b.gross_earnings,
  );
  const dedRows: Array<[string, number]> = [
    ["Employee PF (12%)", b.pf_deduction],
    ["Professional Tax", b.pt_deduction],
  ];
  if (b.tds_deduction > 0) dedRows.push(["TDS", b.tds_deduction]);
  const yD = drawTable(M + halfW + 8, "Deductions", dedRows, "TOTAL DEDUCTIONS", b.total_deductions);

  // Net Pay band
  const netY = Math.max(yE, yD) + 24;
  doc.setFillColor(232, 242, 237); // light green
  doc.rect(M, netY, W - M * 2, 56, "F");
  doc.setDrawColor(0, 96, 57);
  doc.setLineWidth(1);
  doc.rect(M, netY, W - M * 2, 56);
  doc.setLineWidth(0.2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 96, 57);
  doc.text(`NET PAY: ${inr(b.net_pay)}`, W / 2, netY + 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Amount in words: Rupees ${rupeesInWords(b.net_pay)} only`, W / 2, netY + 42, { align: "center" });

  // Footer
  const footY = netY + 90;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("This is a computer-generated payslip and does not require a signature.", W / 2, footY, { align: "center" });
  doc.text(
    `Generated on: ${meta.generated_on.toLocaleDateString("en-GB")} | HStack by Habitainer`,
    W / 2, footY + 14, { align: "center" },
  );

  return doc.output("blob");
}
