// Tally Trial Balance parser — hierarchy aware.
//
// A Tally TB export nests Group → Sub-group → Ledger rows, where every parent
// row carries the SAME total as the sum of its children. Summing every row
// double/triple/quadruple counts. This parser detects group rows and marks
// them display-only; ONLY leaf ledgers are summed or mapped to MIS categories.

export interface TBRow {
  row_number: number;       // 1-indexed row in the source file
  ledger_name: string;
  debit: number;
  credit: number;
  net: number;              // debit - credit
  level: number;            // 0 = top-level group / leaf, deeper = nested
  is_group: boolean;        // group / subtotal row — never summed
  is_excluded: boolean;     // P&L A/c, Difference in opening balances, etc.
  parent_name: string | null;
  category?: string;
}

export interface TBParseResult {
  rows: TBRow[];            // full tree in document order (groups + leaves)
  leaves: TBRow[];          // leaf ledgers only
  groups: TBRow[];
  headerBlock: string[];    // company / address / period lines above the table
  detectedPeriod: string;
  leafDebitTotal: number;
  leafCreditTotal: number;
  fileGrandTotalDebit: number | null;
  fileGrandTotalCredit: number | null;
  reconciles: boolean;
  reconciliationMessage: string;
  skipped: { row: number; reason: string }[];
}

/** Rows never mapped to an operational MIS category (closing / reconciliation entries). */
export const EXCLUDED_LEDGER_PATTERNS: RegExp[] = [
  /profit\s*(&|and)?\s*loss(\s*a\/?c)?/i,
  /difference\s+in\s+opening\s+balance/i,
];

const TOTAL_ROW_PATTERNS: RegExp[] = [/^grand\s*total$/i, /^total$/i];

export const TOLERANCE = 1; // ₹1 rounding tolerance

export function isExcludedLedger(name: string): boolean {
  return EXCLUDED_LEDGER_PATTERNS.some(p => p.test(name));
}

function isTotalRow(name: string): boolean {
  return TOTAL_ROW_PATTERNS.some(p => p.test(name.trim()));
}

export function toNum(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[,₹\s]/g, "").trim();
  if (!s) return 0;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.replace(/[()]/g, ""); }
  if (/(cr|dr)$/i.test(s)) s = s.replace(/(cr|dr)$/i, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : sign * n;
}

export function categorizeLedger(name: string): string {
  const n = name.toLowerCase();
  if (/bank|hdfc|icici|sbi|axis bank|kotak|yes bank|indusind/.test(n)) return "Bank";
  if (/receivable|sundry debtors/.test(n)) return "Debtor";
  if (/payable|sundry creditors/.test(n)) return "Creditor";
  if (/stock|inventory/.test(n)) return "Inventory";
  if (/capital|reserve|surplus/.test(n)) return "Capital & Reserves";
  if (/loan|borrow/.test(n)) return "Loans";
  if (/fixed asset|plant|machinery|furniture|vehicle|building|computer|equipment/.test(n)) return "Fixed Assets";
  return "Other";
}

interface RawRow { row_number: number; name: string; debit: number; credit: number }

/**
 * Detect group vs leaf rows.
 *
 * A row is a group header when its value equals the sum of the top-level rows
 * of the contiguous block beneath it. The narrowest matching block is taken
 * first, then the block is extended while its LAST top-level row is itself
 * followed by rows summing to that row's own value — which is how Tally's
 * repeated totals nest (Loans → Unsecured Loans → four ledgers, all
 * ₹54,43,265; Current Liabilities → Provisions → Audit Fees Payable).
 * Only leaf rows are ever summed.
 */
export function buildHierarchy(raw: RawRow[]): TBRow[] {
  const cache = new Map<string, { items: TBRow[]; topSum: number; lastTopNet: number }>();

  const classify = (start: number, end: number, parent: string | null): { items: TBRow[]; topSum: number; lastTopNet: number } => {
    if (start > end) return { items: [], topSum: 0, lastTopNet: 0 };
    const key = `${start}:${end}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const items: TBRow[] = [];
    let topSum = 0;
    let lastTopNet = 0;
    let i = start;
    while (i <= end) {
      const r = raw[i];
      const net = r.debit - r.credit;
      let childEnd = -1;
      if (Math.abs(net) > TOLERANCE) {
        for (let j = i + 1; j <= end; j++) {
          if (Math.abs(classify(i + 1, j, null).topSum - net) <= TOLERANCE) { childEnd = j; break; }
        }
      }
      // Tail extension: the deepest repeated total may sit just outside the
      // matched block — absorb it so nested duplicates stay one branch.
      if (childEnd > i) {
        for (;;) {
          const blk = classify(i + 1, childEnd, null);
          let extended = false;
          for (let k = childEnd + 1; k <= end; k++) {
            if (Math.abs(classify(childEnd + 1, k, null).topSum - blk.lastTopNet) <= TOLERANCE) {
              childEnd = k;
              extended = true;
              break;
            }
          }
          if (!extended) break;
        }
      }
      const isGroup = childEnd > i;
      items.push({
        row_number: r.row_number,
        ledger_name: r.name,
        debit: r.debit,
        credit: r.credit,
        net,
        level: 0, // depth assigned after the tree is settled
        is_group: isGroup,
        is_excluded: isExcludedLedger(r.name),
        parent_name: parent,
        category: isGroup ? undefined : categorizeLedger(r.name),
      });
      topSum += net;
      lastTopNet = net;
      if (isGroup) {
        items.push(
          ...classify(i + 1, childEnd, null).items.map(it => (it.parent_name === null ? { ...it, parent_name: r.name } : it)),
        );
        i = childEnd + 1;
      } else {
        i++;
      }
    }
    const res = { items, topSum, lastTopNet };
    cache.set(key, res);
    return res;
  };

  const { items } = classify(0, raw.length - 1, null);
  // Assign nesting depth from parent chain
  const depth = new Map<string, number>();
  for (const it of items) {
    const lvl = it.parent_name ? (depth.get(it.parent_name) ?? 0) + 1 : 0;
    it.level = lvl;
    if (it.is_group) depth.set(it.ledger_name, lvl);
  }
  return items;
}



export function parseTrialBalanceRows(rows: any[][]): TBParseResult {
  const skipped: { row: number; reason: string }[] = [];
  const headerBlock: string[] = [];
  let detectedPeriod = "";

  // ── Locate the "Particulars" header (may span multiple rows) ──
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] || []).map(c => (c == null ? "" : String(c).trim()));
    const joined = cells.filter(Boolean).join(" ");
    if (/\d{1,2}-[a-z]{3}-\d{2,4}\s*to\s*\d{1,2}-[a-z]{3}-\d{2,4}/i.test(joined)) detectedPeriod = joined;
    if (headerRowIdx === -1 && joined) headerBlock.push(joined);
    if (cells.some(c => /^particulars$/i.test(c))) { headerRowIdx = i; break; }
  }

  // Column detection: find Debit / Credit columns in the header band (header row + 2 rows)
  let debitCol = -1, creditCol = -1;
  if (headerRowIdx >= 0) {
    for (let i = headerRowIdx; i <= headerRowIdx + 2 && i < rows.length; i++) {
      (rows[i] || []).forEach((c, idx) => {
        const s = c == null ? "" : String(c).trim().toLowerCase();
        if (debitCol === -1 && s === "debit") debitCol = idx;
        if (creditCol === -1 && s === "credit") creditCol = idx;
      });
    }
  }
  if (debitCol === -1) debitCol = 1;
  if (creditCol === -1) creditCol = 2;

  const dataStart = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;

  const raw: RawRow[] = [];
  let fileGrandTotalDebit: number | null = null;
  let fileGrandTotalCredit: number | null = null;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i] || [];
    const name = row[0] != null ? String(row[0]).trim() : "";
    if (!name) continue;
    if (/^particulars$/i.test(name) || /^(debit|credit)$/i.test(name)) continue;

    const debit = toNum(row[debitCol]);
    const credit = toNum(row[creditCol]);

    if (isTotalRow(name)) {
      fileGrandTotalDebit = debit;
      fileGrandTotalCredit = credit;
      continue;
    }
    if (debit === 0 && credit === 0) {
      skipped.push({ row: i + 1, reason: `All values zero: "${name}"` });
      continue;
    }
    raw.push({ row_number: i + 1, name, debit, credit });
  }

  const tree = buildHierarchy(raw);
  const leaves = tree.filter(r => !r.is_group);
  const groups = tree.filter(r => r.is_group);

  const leafDebitTotal = leaves.reduce((s, r) => s + r.debit, 0);
  const leafCreditTotal = leaves.reduce((s, r) => s + r.credit, 0);

  const sidesMatch = Math.abs(leafDebitTotal - leafCreditTotal) <= TOLERANCE;
  const grandMatch =
    fileGrandTotalDebit == null ||
    (Math.abs(leafDebitTotal - fileGrandTotalDebit) <= TOLERANCE &&
      Math.abs(leafCreditTotal - (fileGrandTotalCredit ?? 0)) <= TOLERANCE);

  const reconciles = sidesMatch && grandMatch;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const reconciliationMessage = reconciles
    ? `Reconciled — ${leaves.length} leaf ledgers, ${groups.length} group rows. Leaf Debit = Leaf Credit = ${fmt(leafDebitTotal)}${fileGrandTotalDebit != null ? " (matches file Grand Total)" : ""}.`
    : !sidesMatch
      ? `Does not reconcile — leaf Debit ${fmt(leafDebitTotal)} ≠ leaf Credit ${fmt(leafCreditTotal)}.`
      : `Does not reconcile — leaf totals ${fmt(leafDebitTotal)} / ${fmt(leafCreditTotal)} do not match the file's Grand Total ${fmt(fileGrandTotalDebit || 0)} / ${fmt(fileGrandTotalCredit || 0)}.`;

  return {
    rows: tree,
    leaves,
    groups,
    headerBlock,
    detectedPeriod,
    leafDebitTotal,
    leafCreditTotal,
    fileGrandTotalDebit,
    fileGrandTotalCredit,
    reconciles,
    reconciliationMessage,
    skipped,
  };
}

export async function parseTrialBalanceFile(file: File): Promise<TBParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  return parseTrialBalanceRows(rows);
}
