// Tally Trial Balance parser — hierarchy aware.
//
// A Tally TB export nests Group → Sub-group → Ledger rows, where every parent
// row carries the SAME total as the sum of its children. Summing every row
// double/triple/quadruple counts. This parser detects group rows and marks
// them display-only; ONLY leaf ledgers are summed or mapped to MIS categories.

/** Display-safe cleanup: NFKC + collapse internal whitespace + trim. Casing/punctuation preserved. */
export const cleanLedgerName = (n: string) => (n ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();

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
  /** Root group → … → immediate parent (excludes the row itself). */
  ancestors: string[];
  /** Raw Excel indent of the Particulars cell, when the file carries it. */
  indent?: number;
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
  /** Leaf total − file Grand Total (0 when reconciled). */
  debitGap: number;
  creditGap: number;
  /** Rows whose arithmetic classification disagrees with the file's indent metadata. */
  suspects: { row: number; ledger_name: string; reason: string }[];
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

interface RawRow { row_number: number; name: string; debit: number; credit: number; indent?: number }

interface Node { idx: number; children: Node[] }

/**
 * Detect group vs leaf rows.
 *
 * Tally exports carry no indentation metadata, so the tree is recovered purely
 * from arithmetic: a row is a group when the top-level rows of the contiguous
 * block beneath it sum to that row's Debit AND Credit independently.
 *
 * Equal-valued siblings (two ledgers with the same amount) are genuinely
 * ambiguous locally, so the parse is a backtracking search anchored on the
 * file's own Grand Total — the segmentation whose top-level rows reproduce the
 * Grand Total on both sides is the correct one. Grouping is preferred over
 * leaves, so real Group → Sub-group → Ledger chains collapse into one branch.
 * Only leaf rows are ever summed.
 */
export function buildHierarchy(raw: RawRow[], targetDebit?: number | null, targetCredit?: number | null): TBRow[] {
  const n = raw.length;
  const groupCache = new Map<string, Node[] | null>();

  /** Segment rows [start..end] so that top-level Debit/Credit sums hit the targets (null = any). */
  const segment = (start: number, end: number, tD: number | null, tC: number | null): Node[] | null => {
    const key = `${start}:${end}:${tD ?? "*"}:${tC ?? "*"}`;
    if (groupCache.has(key)) return groupCache.get(key)!;
    groupCache.set(key, null); // guard against re-entrancy
    const rec = (i: number, remD: number | null, remC: number | null): Node[] | null => {
      if (i > end) {
        if (remD == null) return [];
        return Math.abs(remD) <= TOLERANCE && Math.abs(remC!) <= TOLERANCE ? [] : null;
      }
      const r = raw[i];
      if (remD != null && (r.debit - remD > TOLERANCE || r.credit - remC! > TOLERANCE)) return null;
      const nextD = remD == null ? null : remD - r.debit;
      const nextC = remC == null ? null : remC! - r.credit;

      // Prefer treating the row as a group header.
      if (r.debit > TOLERANCE || r.credit > TOLERANCE) {
        for (let k = i + 1; k <= end; k++) {
          const kids = segment(i + 1, k, r.debit, r.credit);
          if (!kids) continue;
          const rest = rec(k + 1, nextD, nextC);
          if (rest) return [{ idx: i, children: kids }, ...rest];
        }
      }
      const rest = rec(i + 1, nextD, nextC);
      return rest ? [{ idx: i, children: [] }, ...rest] : null;
    };
    const out = rec(start, tD, tC);
    groupCache.set(key, out);
    return out;
  };

  let roots =
    targetDebit != null && targetCredit != null
      ? segment(0, n - 1, targetDebit, targetCredit)
      : null;
  if (!roots) roots = segment(0, n - 1, null, null) ?? raw.map((_, i) => ({ idx: i, children: [] }));

  const items: TBRow[] = [];

  const walk = (nodes: Node[], level: number, chain: string[]) => {
    for (const node of nodes) {
      const r = raw[node.idx];
      const isGroup = node.children.length > 0;
      items.push({
        row_number: r.row_number,
        // Same NFKC + whitespace-collapse rule as public.normalize_ledger_name();
        // fixes Tally's double-spaced exports (e.g. "Karan Nadig -  Share Capital") at source.
        ledger_name: cleanLedgerName(r.name),
        debit: r.debit,
        credit: r.credit,
        net: r.debit - r.credit,
        level,
        is_group: isGroup,
        is_excluded: isExcludedLedger(r.name),
        parent_name: chain.length ? chain[chain.length - 1] : null,
        ancestors: [...chain],
        indent: r.indent,
        category: isGroup ? undefined : categorizeLedger(r.name),
      });
      if (isGroup) walk(node.children, level + 1, [...chain, r.name]);
    }
  };
  walk(roots, 0, []);
  return items;
}





export function parseTrialBalanceRows(rows: any[][], indentByRow?: Record<number, number>): TBParseResult {
  const skipped: { row: number; reason: string }[] = [];
  const headerBlock: string[] = [];
  let detectedPeriod = "";

  // ── Locate the "Particulars" header (may span multiple rows) ──
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] || []).map(c => (c == null ? "" : String(c).trim()));
    const joined = cells.filter(Boolean).join(" ");
    // Capture ONLY the date range, not the whole header line (Tally often puts
    // "Particulars" and the period in the same visual row).
    const periodMatch = joined.match(/(\d{1,2}-[a-z]{3}-\d{2,4})\s*to\s*(\d{1,2}-[a-z]{3}-\d{2,4})/i);
    if (periodMatch) detectedPeriod = `${periodMatch[1]} to ${periodMatch[2]}`;
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
    raw.push({ row_number: i + 1, name, debit, credit, indent: indentByRow?.[i + 1] });
  }

  const tree = buildHierarchy(raw, fileGrandTotalDebit, fileGrandTotalCredit);
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
  const debitGap = fileGrandTotalDebit == null ? 0 : leafDebitTotal - fileGrandTotalDebit;
  const creditGap = fileGrandTotalCredit == null ? 0 : leafCreditTotal - fileGrandTotalCredit;

  // Cross-check the arithmetic tree against the file's own indent metadata:
  // a row followed by a more deeply indented row should be a group, and vice versa.
  const suspects: { row: number; ledger_name: string; reason: string }[] = [];
  if (indentByRow && !reconciles) {
    const ordered = [...tree].sort((a, b) => a.row_number - b.row_number);
    ordered.forEach((r, i) => {
      const next = ordered[i + 1];
      const ri = indentByRow[r.row_number];
      const ni = next ? indentByRow[next.row_number] : undefined;
      if (ri == null || ni == null) return;
      const indentSaysGroup = ni > ri;
      if (indentSaysGroup && !r.is_group) {
        suspects.push({ row: r.row_number, ledger_name: r.ledger_name, reason: "Indent suggests a group header, but it was summed as a leaf" });
      } else if (!indentSaysGroup && r.is_group) {
        suspects.push({ row: r.row_number, ledger_name: r.ledger_name, reason: "Treated as a group, but the indent suggests a leaf ledger" });
      }
    });
  }

  const fmt = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
  const reconciliationMessage = reconciles
    ? `Reconciled — ${leaves.length} leaf ledgers, ${groups.length} group rows. Leaf Debit = Leaf Credit = ${fmt(leafDebitTotal)}${fileGrandTotalDebit != null ? " (matches file Grand Total)" : ""}.`
    : !sidesMatch
      ? `Does not reconcile — leaf Debit ${fmt(leafDebitTotal)} ≠ leaf Credit ${fmt(leafCreditTotal)} (out by ${fmt(leafDebitTotal - leafCreditTotal)}).`
      : `Does not reconcile — leaf totals ${fmt(leafDebitTotal)} / ${fmt(leafCreditTotal)} vs the file's Grand Total ${fmt(fileGrandTotalDebit || 0)} / ${fmt(fileGrandTotalCredit || 0)} (gap ${fmt(debitGap)} debit, ${fmt(creditGap)} credit).`;

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
    debitGap,
    creditGap,
    suspects,
    skipped,
  };
}

/**
 * Read the Excel indent level of every Particulars (column A) cell.
 * Tally writes real indents (0 = top-level group, deeper = sub-group / ledger);
 * SheetJS drops them, so the workbook zip is read directly.
 * Returns a 1-indexed row → indent map, or null when unavailable (e.g. CSV).
 */
export async function extractIndentMap(buf: ArrayBuffer): Promise<Record<number, number> | null> {
  try {
    const { unzipSync, strFromU8 } = await import("fflate");
    const zip = unzipSync(new Uint8Array(buf));
    const stylesFile = zip["xl/styles.xml"];
    const sheetKey = Object.keys(zip).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
    if (!stylesFile || !sheetKey) return null;
    const styles = strFromU8(stylesFile);
    const cellXfs = styles.split("<cellXfs")[1]?.split("</cellXfs>")[0];
    if (!cellXfs) return null;
    const indents = [...cellXfs.matchAll(/<xf\b[\s\S]*?(?:\/>|<\/xf>)/g)].map(m => {
      const a = m[0].match(/indent="(\d+)"/);
      return a ? Number(a[1]) : 0;
    });
    const sheet = strFromU8(zip[sheetKey]);
    const out: Record<number, number> = {};
    for (const rm of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const rn = Number(rm[1]);
      const cm = rm[2].match(new RegExp(`<c r="A${rn}"[^>]*>`));
      const s = cm && cm[0].match(/s="(\d+)"/);
      out[rn] = s ? indents[Number(s[1])] ?? 0 : 0;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export async function parseTrialBalanceFile(file: File): Promise<TBParseResult> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const indentByRow = await extractIndentMap(buf);
  return parseTrialBalanceRows(rows, indentByRow ?? undefined);
}

