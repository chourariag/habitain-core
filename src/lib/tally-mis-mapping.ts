// Auto-suggestion of MIS categories for Trial Balance leaf ledgers.
//
// Suggestions combine the ledger's own name with its parent-group chain
// (root group → sub-group → ledger). Every suggestion is a SUGGESTION only —
// the UI must show it for confirmation, never apply it silently.

export const MIS_CATEGORIES = {
  revenue: "Sales Revenue",
  other_income: "Other Income",
  unbilled_revenue: "Unbilled Revenue",
  raw_materials: "Raw Materials",
  manufacturing: "Manufacturing Expenses",
  rent_electricity: "Rent + Electricity",
  salaries: "Salaries",
  director_remuneration: "Director Remuneration",
  other_fixed: "Other Fixed Expenses",
  depreciation: "Depreciation",
  interest: "Interest",
  tax: "Tax",
  // Balance Sheet (leaf ledgers only)
  bs_capital: "Capital & Reserves",
  bs_loans: "Loans & Borrowings",
  bs_debtors: "Sundry Debtors",
  bs_creditors: "Sundry Creditors",
  bs_fixed_assets: "Fixed Assets",
  bs_bank_cash: "Bank & Cash",
  bs_inventory: "Inventory",
  bs_duties_taxes: "Duties & Taxes",
  bs_other_bs: "Other Balance Sheet",
} as const;

export type MISCategory = keyof typeof MIS_CATEGORIES;

export interface CategorySuggestion {
  category: MISCategory | null;
  /** high = safe to bulk-confirm, low = user must decide. */
  confidence: "high" | "low";
  reason: string;
}

const has = (s: string, re: RegExp) => re.test(s);

/** Root-group → default Balance Sheet / P&L bucket. */
function fromChain(chain: string[], name: string): CategorySuggestion | null {
  const root = (chain[0] || "").toLowerCase();
  const sub = chain.slice(1).join(" | ").toLowerCase();
  const n = name.toLowerCase();

  if (has(root, /capital account|reserves? & surplus|share capital/)) {
    return { category: "bs_capital", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /loans? \(liability\)|secured loans|unsecured loans|borrowing/)) {
    return { category: "bs_loans", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /current liabilit|branch\s*\/\s*divisions/)) {
    if (has(sub + " " + n, /duties\s*&?\s*taxes|gst|tds|professional tax|pf payable|esi/))
      return { category: "bs_duties_taxes", confidence: "high", reason: "Duties & Taxes under Current Liabilities" };
    if (has(sub + " " + n, /sundry creditor|creditors for/))
      return { category: "bs_creditors", confidence: "high", reason: "Sundry Creditors under Current Liabilities" };
    return { category: "bs_other_bs", confidence: "high", reason: `Under "${chain[0]}" — Balance Sheet` };
  }
  if (has(root, /fixed assets|investments/)) {
    return { category: "bs_fixed_assets", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /current assets/)) {
    if (has(n, /bank|cash/)) return { category: "bs_bank_cash", confidence: "high", reason: "Bank / Cash under Current Assets" };
    if (has(n, /stock|inventory/)) return { category: "bs_inventory", confidence: "high", reason: "Stock under Current Assets" };
    if (has(n, /debtor|receivable/)) return { category: "bs_debtors", confidence: "high", reason: "Debtors under Current Assets" };
    if (has(n, /unbilled/)) return { category: "unbilled_revenue", confidence: "high", reason: "Unbilled revenue" };
    return { category: "bs_other_bs", confidence: "high", reason: `Under "${chain[0]}" — Balance Sheet` };
  }
  if (has(root, /sales accounts?|sales revenue/)) {
    return { category: "revenue", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /purchase accounts?/)) {
    return { category: "raw_materials", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /^(direct|indirect) incomes?/)) {
    return { category: "other_income", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /^direct expenses?/)) {
    return { category: "manufacturing", confidence: "high", reason: `Under "${chain[0]}"` };
  }
  if (has(root, /^indirect expenses?/)) {
    return { category: "other_fixed", confidence: "low", reason: `Under "${chain[0]}" — no specific name match` };
  }
  return null;
}

/** Strong name patterns win over the group chain (e.g. Rent inside Direct Expenses). */
function fromName(name: string, chain: string[]): CategorySuggestion | null {
  const n = name.toLowerCase();
  const isExpenseChain = /expenses?$/.test((chain[0] || "").toLowerCase());

  if (has(n, /depreciation/) && !has(n, /res\.?,?\s*depreciation/))
    return { category: "depreciation", confidence: "high", reason: "Depreciation" };
  if (has(n, /director'?s? remun/))
    return { category: "director_remuneration", confidence: "high", reason: "Director remuneration" };
  if (has(n, /salar|employee cost|staff welfare|stipend|wages|gratuity|leave encash|bonus|pf employer|klwf/) && isExpenseChain)
    return { category: "salaries", confidence: "high", reason: "Employee cost" };
  if (has(n, /rent|electricity|water charges/) && isExpenseChain)
    return { category: "rent_electricity", confidence: "high", reason: "Rent / utilities" };
  if (has(n, /interest/) && isExpenseChain)
    return { category: "interest", confidence: "high", reason: "Interest cost" };
  if (has(n, /income tax|tds expense|deferred tax expense/) && isExpenseChain)
    return { category: "tax", confidence: "high", reason: "Tax" };
  if (!isExpenseChain && has(n, /^bank |bank account|cash-in-hand|cash in hand|petty cash/))
    return { category: "bs_bank_cash", confidence: "high", reason: "Bank / cash ledger" };
  if (has(n, /opening stock|closing stock|inventory/))
    return { category: "bs_inventory", confidence: "high", reason: "Stock ledger" };
  if (has(n, /sundry debtor|accounts receivable/))
    return { category: "bs_debtors", confidence: "high", reason: "Debtors ledger" };
  if (has(n, /sundry creditor/))
    return { category: "bs_creditors", confidence: "high", reason: "Creditors ledger" };
  if (has(n, /unbilled revenue/))
    return { category: "unbilled_revenue", confidence: "high", reason: "Unbilled revenue" };
  if (
    has(n, /transport|travell?ing|freight|office expense|printing|professional charges|consultancy|conveyance|telephone|internet|subscription|business promotion|marketing|audit fee|bank charges|boarding|repair|maintenance|insurance|packing|loading|canteen|crane|fabrication|labour charges|civil work|erection|installation|scaffolding|generator|diesel|cleaning|waste|hiring charges|service charges/) &&
    isExpenseChain
  ) {
    const variable = /^direct expenses?/.test((chain[0] || "").toLowerCase());
    return {
      category: variable ? "manufacturing" : "other_fixed",
      confidence: "high",
      reason: variable ? "Direct/manufacturing expense" : "Operating overhead",
    };
  }
  return null;
}

const VAGUE = /^(roundoff|round off|write off|misc|miscellaneous|other|others|suspense|difference)/i;

export function suggestMISCategory(name: string, chain: string[]): CategorySuggestion {
  if (VAGUE.test(name.trim())) {
    const chained = fromChain(chain, name);
    return chained
      ? { ...chained, confidence: "low", reason: `Ambiguous name — ${chained.reason}` }
      : { category: null, confidence: "low", reason: "Ambiguous ledger name" };
  }
  return (
    fromName(name, chain) ||
    fromChain(chain, name) || { category: null, confidence: "low", reason: "No confident pattern match" }
  );
}
