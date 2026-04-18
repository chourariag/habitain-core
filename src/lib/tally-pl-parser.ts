// Tally Profit & Loss parser — handles double-column Tally export format.
// Returns parsed sections + line items, plus validation against L=R balance.

export type PLSide = "income" | "expense";

export interface ParsedLineItem {
  side: PLSide;
  section_name: string;
  hstack_category: string | null;
  account_name: string;
  amount: number;
  is_subtotal: boolean;
  is_section_header: boolean;
  display_order: number;
}

export interface ParsedPL {
  financial_year: string;     // e.g. "2025-26"
  period_start: string | null; // ISO date
  period_end: string | null;
  total_revenue: number;
  total_cogs_net: number;       // Opening + Purchases - Closing
  total_direct_expenses: number;
  total_indirect_expenses: number;
  total_other_income: number;
  gross_profit: number;
  gross_profit_pct: number;
  net_profit_loss: number;       // negative if loss
  net_margin_pct: number;
  is_loss: boolean;
  left_total: number;
  right_total: number;
  balance_diff: number;
  line_items: ParsedLineItem[];
}

// Tally section → HStack category mapping
const EXPENSE_SECTION_MAP: Record<string, string> = {
  "Opening Stock": "Cost of Goods",
  "Purchase Accounts": "Direct Materials",
  "Direct Expenses": "Direct Labour & Overheads",
  "Indirect Expenses": "Overhead & Admin",
};
const INCOME_SECTION_MAP: Record<string, string> = {
  "Sales Accounts": "Revenue",
  "Closing Stock": "Cost of Goods",
  "Indirect Incomes": "Other Income",
};

const TOTAL_KEYWORDS = ["total", "gross profit", "nett loss", "nett profit", "net loss", "net profit"];

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").replace(/[₹\s]/g, "").trim();
  if (!s) return null;
  // Handle (123.45) negative
  const neg = /^\(.+\)$/.test(s);
  const cleaned = neg ? s.replace(/[()]/g, "") : s;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  return neg ? -n : n;
}

function parsePeriodRow(text: string): { fy: string; start: string | null; end: string | null } {
  // e.g. "1-Apr-25 to 31-Mar-26"
  const m = text.match(/(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})\s*(?:to|To|TO)\s*(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})/);
  if (!m) return { fy: "Unknown", start: null, end: null };
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const yr = (y: string) => (y.length === 2 ? `20${y}` : y);
  const start = `${yr(m[3])}-${months[m[2].toLowerCase()] || "01"}-${m[1].padStart(2, "0")}`;
  const end = `${yr(m[6])}-${months[m[5].toLowerCase()] || "12"}-${m[4].padStart(2, "0")}`;
  const startYr = parseInt(yr(m[3]));
  const endYr = parseInt(yr(m[6]));
  const fy = `${startYr}-${String(endYr).slice(-2)}`;
  return { fy, start, end };
}

function isTotalRow(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return TOTAL_KEYWORDS.some(k => lower.includes(k));
}

export async function parseTallyPL(file: File): Promise<ParsedPL> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Find period row + header row
  let period = { fy: "Unknown", start: null as string | null, end: null as string | null };
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i] || [];
    const a = r[0] != null ? String(r[0]).trim() : "";
    if (a && /\d.*to.*\d/i.test(a)) {
      const p = parsePeriodRow(a);
      if (p.fy !== "Unknown") period = p;
    }
    if (a.toLowerCase() === "particulars") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error("Could not find 'Particulars' header row in Tally export.");

  // Walk data rows
  const items: ParsedLineItem[] = [];
  let leftSection = "";   // current expense section
  let rightSection = "";  // current income section
  let leftTotal = 0;
  let rightTotal = 0;
  let order = 0;

  // Section subtotals trackers
  const sectionTotals: Record<string, number> = {};

  const pushItem = (it: Omit<ParsedLineItem, "display_order">) => {
    items.push({ ...it, display_order: order++ });
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const aName = r[0] != null ? String(r[0]).trim() : "";
    const aAmt = toNumber(r[1]);
    const aSub = toNumber(r[2]);
    const dName = r[3] != null ? String(r[3]).trim() : "";
    const dAmt = toNumber(r[4]);
    const dSub = toNumber(r[5]);

    // ── LEFT (expense) ──
    if (aName) {
      const isTotal = isTotalRow(aName);
      if (isTotal) {
        // Final left total or "Total" row
        if (aSub != null && /^total$/i.test(aName)) {
          leftTotal = aSub;
        }
        // Capture Nett Loss / Gross Profit balancing rows as line items for transparency
        if (aAmt != null || aSub != null) {
          pushItem({
            side: "expense",
            section_name: leftSection || aName,
            hstack_category: null,
            account_name: aName,
            amount: aAmt ?? aSub ?? 0,
            is_subtotal: true,
            is_section_header: false,
          });
        }
      } else if (aAmt == null && (aSub != null || (aSub == null && !aName.includes(":")))) {
        // Section header (col B empty)
        leftSection = aName;
        if (EXPENSE_SECTION_MAP[aName]) {
          pushItem({
            side: "expense",
            section_name: aName,
            hstack_category: EXPENSE_SECTION_MAP[aName],
            account_name: aName,
            amount: aSub ?? 0,
            is_subtotal: false,
            is_section_header: true,
          });
          if (aSub != null) sectionTotals[aName] = aSub;
        }
      } else if (aAmt != null) {
        // Line item
        pushItem({
          side: "expense",
          section_name: leftSection,
          hstack_category: EXPENSE_SECTION_MAP[leftSection] || null,
          account_name: aName,
          amount: aAmt,
          is_subtotal: false,
          is_section_header: false,
        });
      }
    }

    // ── RIGHT (income) ──
    if (dName) {
      const isTotal = isTotalRow(dName);
      if (isTotal) {
        if (dSub != null && /^total$/i.test(dName)) {
          rightTotal = dSub;
        }
        if (dAmt != null || dSub != null) {
          pushItem({
            side: "income",
            section_name: rightSection || dName,
            hstack_category: null,
            account_name: dName,
            amount: dAmt ?? dSub ?? 0,
            is_subtotal: true,
            is_section_header: false,
          });
        }
      } else if (dAmt == null) {
        rightSection = dName;
        if (INCOME_SECTION_MAP[dName]) {
          pushItem({
            side: "income",
            section_name: dName,
            hstack_category: INCOME_SECTION_MAP[dName],
            account_name: dName,
            amount: dSub ?? 0,
            is_subtotal: false,
            is_section_header: true,
          });
          if (dSub != null) sectionTotals[dName] = dSub;
        }
      } else if (dAmt != null) {
        pushItem({
          side: "income",
          section_name: rightSection,
          hstack_category: INCOME_SECTION_MAP[rightSection] || null,
          account_name: dName,
          amount: dAmt,
          is_subtotal: false,
          is_section_header: false,
        });
      }
    }
  }

  // Compute totals from line items (use section totals where present, else sum line items)
  const sumSection = (sec: string, side: PLSide) => {
    if (sectionTotals[sec] != null) return sectionTotals[sec];
    return items
      .filter(it => it.section_name === sec && it.side === side && !it.is_section_header && !it.is_subtotal)
      .reduce((s, it) => s + it.amount, 0);
  };

  const totalRevenue = sumSection("Sales Accounts", "income");
  const openingStock = sumSection("Opening Stock", "expense");
  const closingStock = sumSection("Closing Stock", "income");
  const purchases = sumSection("Purchase Accounts", "expense");
  const directExp = sumSection("Direct Expenses", "expense");
  const indirectExp = sumSection("Indirect Expenses", "expense");
  const otherIncome = sumSection("Indirect Incomes", "income");

  const cogsNet = openingStock + purchases - closingStock;
  const grossProfit = totalRevenue - cogsNet - directExp;
  const grossProfitPct = totalRevenue ? (grossProfit / totalRevenue) * 100 : 0;
  const netPL = grossProfit - indirectExp + otherIncome;
  const netMarginPct = totalRevenue ? (netPL / totalRevenue) * 100 : 0;

  const balanceDiff = Math.abs(leftTotal - rightTotal);

  return {
    financial_year: period.fy,
    period_start: period.start,
    period_end: period.end,
    total_revenue: totalRevenue,
    total_cogs_net: cogsNet,
    total_direct_expenses: directExp,
    total_indirect_expenses: indirectExp,
    total_other_income: otherIncome,
    gross_profit: grossProfit,
    gross_profit_pct: grossProfitPct,
    net_profit_loss: netPL,
    net_margin_pct: netMarginPct,
    is_loss: netPL < 0,
    left_total: leftTotal,
    right_total: rightTotal,
    balance_diff: balanceDiff,
    line_items: items,
  };
}

export const fmtINR = (n: number) =>
  `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

export const fmtINRSigned = (n: number) =>
  `${n < 0 ? "-" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
