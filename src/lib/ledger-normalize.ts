// Ledger-name normalization — mirrors public.normalize_ledger_name() in the DB.
// Order: NFKC -> lower -> collapse internal whitespace -> trim -> strip trailing punctuation.
// The normalized form is a FALLBACK LOOKUP KEY ONLY. The exact ledger_name is
// always what gets stored and displayed.
export function normalizeLedgerName(name: string): string {
  return (name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s!-/:-@[-`{-~]+$/g, "");
}

export interface LedgerMappingRow {
  id: string;
  ledger_name: string;
  mis_category: string;
  normalized_name?: string | null;
  last_fallback_variant?: string | null;
  last_fallback_at?: string | null;
  fallback_match_count?: number | null;
}

export interface MappingIndex {
  /** Exact ledger_name -> category. */
  exact: Record<string, string>;
  /** Normalized name -> mapping row (fallback only). */
  normalized: Record<string, LedgerMappingRow>;
}

export function buildMappingIndex(rows: LedgerMappingRow[]): MappingIndex {
  const exact: Record<string, string> = {};
  const normalized: Record<string, LedgerMappingRow> = {};
  rows.forEach((r) => {
    exact[r.ledger_name] = r.mis_category;
    normalized[r.normalized_name || normalizeLedgerName(r.ledger_name)] = r;
  });
  return { exact, normalized };
}

export interface Resolution {
  category: string | null;
  /** True when matched only after normalization — must be surfaced, never silent. */
  viaFallback: boolean;
  mapping?: LedgerMappingRow;
}

export function resolveLedgerCategory(index: MappingIndex, incomingName: string): Resolution {
  const exact = index.exact[incomingName];
  if (exact) return { category: exact, viaFallback: false };
  const row = index.normalized[normalizeLedgerName(incomingName)];
  if (row) return { category: row.mis_category, viaFallback: true, mapping: row };
  return { category: null, viaFallback: false };
}
