import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Download, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { downloadTrialBalanceTemplate } from "@/lib/xlsx-templates";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WIPStatement } from "@/components/finance/WIPStatement";
import { parseTrialBalanceFile, type TBRow } from "@/lib/tally-tb-parser";
import { MIS_CATEGORIES, suggestMISCategory, type MISCategory } from "@/lib/tally-mis-mapping";
import { buildMappingIndex, resolveLedgerCategory, type LedgerMappingRow } from "@/lib/ledger-normalize";


interface LedgerEntry {
  ledger_name: string;
  debit: number;
  credit: number;
  opening_balance?: number;
  closing_balance?: number;
  category?: string;
  /** Group / subtotal row — display & drill-down only, never summed. */
  is_group?: boolean;
  /** P&L A/c, Difference in opening balances — never mapped to a category. */
  is_excluded?: boolean;
  level?: number;
  parent_name?: string | null;
  /** Root group → … → immediate parent. */
  ancestors?: string[];
}

interface SuggestedLedger {
  name: string;
  chain: string[];
  amount: number;
  suggested: MISCategory | null;
  confidence: "high" | "low";
  reason: string;
}


/** Only leaf ledgers that are not reconciliation entries may be summed or mapped. */
const isMappable = (e: LedgerEntry) => !e.is_group && !e.is_excluded;

interface MISUpload {
  id: string;
  period_label: string;
  raw_data: LedgerEntry[];
  ads_split: Record<string, number>;
}

function sumByCategory(entries: LedgerEntry[], mappings: Record<string, string>, category: string): number {
  // Revenue/income: credit - debit (positive = income)
  // Costs/expenses: debit - credit (positive = expense)
  const isIncome = ["revenue", "other_income", "unbilled_revenue"].includes(category);
  return entries
    .filter(e => isMappable(e) && mappings[e.ledger_name] === category)
    .reduce((sum, e) => sum + (isIncome ? (e.credit - e.debit) : (e.debit - e.credit)), 0);
}

function formatPct(value: number, totalIncome: number): string {
  if (!totalIncome || totalIncome === 0) return "—";
  const pct = (value / totalIncome) * 100;
  return pct.toFixed(2) + "%";
}

function getLedgerDisplayAmount(entry: LedgerEntry, category: string): number {
  const isIncome = ["revenue", "other_income", "unbilled_revenue"].includes(category);
  return isIncome ? entry.credit - entry.debit : entry.debit - entry.credit;
}

function MISRow({ label, amount, pctStr, bold, large, color }: {
  label: string; amount: number; pctStr?: string; bold?: boolean; large?: boolean; color?: string;
}) {
  const style: React.CSSProperties = {
    color: color || "#1A1A1A",
    fontWeight: bold ? 700 : 400,
    fontSize: large ? 18 : 14,
  };
  return (
    <div className="flex justify-between items-center py-1.5 px-2" style={style}>
      <span className="font-display">{label}</span>
      <div className="flex gap-6 items-center">
        <span className="font-mono text-right min-w-[100px]">₹{Math.abs(amount).toLocaleString("en-IN")}</span>
        {pctStr !== undefined && (
          <span className="text-right min-w-[50px] text-xs" style={{ color: "#666666" }}>{pctStr}</span>
        )}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t my-1" style={{ borderColor: "#E5E7EB" }} />;
}

function DoubleDivider() {
  return <div className="border-t-2 my-2" style={{ borderColor: "#006039" }} />;
}

function categorizeLedger(name: string): string {
  const n = name.toLowerCase();
  if (/bank|hdfc|icici|sbi|axis bank|kotak|yes bank|indusind/.test(n)) return "Bank";
  if (/receivable|sundry debtors/.test(n)) return "Debtor";
  if (/payable|sundry creditors/.test(n)) return "Creditor";
  if (/stock|inventory|opening stock|closing stock/.test(n)) return "Inventory";
  return "Other";
}

/**
 * Period labels must match on meaning, not on exact text, so a re-upload of the
 * same financial period REPLACES the previous import instead of creating a
 * duplicate. Strips the stray "Particulars" prefix older imports captured,
 * collapses whitespace and normalises casing.
 */
export function normalizePeriodLabel(label: string): string {
  return (label ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^particulars\s*/i, "")
    .toLowerCase();
}

interface UploadSummary {
  total: number;
  groups: number;
  leaves: number;
  excluded: number;
  categories: Record<string, number>;
  skipped: { row: number; reason: string }[];
  period: string;
  reconciles: boolean;
  reconciliationMessage: string;
  debitGap: number;
  creditGap: number;
  suspects: { row: number; ledger_name: string; reason: string }[];
  /** True when the import was refused because the leaves do not reconcile. */
  blocked: boolean;
}

export function MISTab() {
  const [uploads, setUploads] = useState<MISUpload[]>([]);
  const [mappingRows, setMappingRows] = useState<LedgerMappingRow[]>([]);
  const mapIndex = useMemo(() => buildMappingIndex(mappingRows), [mappingRows]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [adsDrawerOpen, setAdsDrawerOpen] = useState(false);
  const [adsValues, setAdsValues] = useState<Record<string, number>>({});
  const [suggestedLedgers, setSuggestedLedgers] = useState<SuggestedLedger[]>([]);
  const [mappingDrawerOpen, setMappingDrawerOpen] = useState(false);
  const [newMappings, setNewMappings] = useState<Record<string, string>>({});
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const initialFetchDone = useRef(false);

  const currentUpload = uploads.find(u => u.id === currentUploadId) || null;

  const fetchData = useCallback(async (keepCurrentId?: string) => {
    const [{ data: u }, { data: m }] = await Promise.all([
      supabase.from("finance_mis_uploads").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("ledger_mappings").select("*"),
    ]);
    setMappingRows((m || []) as LedgerMappingRow[]);
    const parsed: MISUpload[] = (u || []).map((row: any) => ({
      id: row.id,
      period_label: row.period_label,
      raw_data: Array.isArray(row.raw_data) ? row.raw_data : [],
      ads_split: typeof row.ads_split === "object" && row.ads_split ? row.ads_split : {},
    }));
    setUploads(parsed);
    if (keepCurrentId && parsed.find(p => p.id === keepCurrentId)) {
      setCurrentUploadId(keepCurrentId);
    } else if (parsed.length > 0 && !keepCurrentId) {
      setCurrentUploadId(parsed[0].id);
    }
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchData();
    }
  }, [fetchData]);

  const doUpload = async (file: File) => {
    try {
      const parsed = await parseTrialBalanceFile(file);
      const entries: LedgerEntry[] = parsed.rows.map((r: TBRow) => ({
        ledger_name: r.ledger_name,
        debit: r.debit,
        credit: r.credit,
        closing_balance: r.net,
        category: r.category,
        is_group: r.is_group,
        is_excluded: r.is_excluded,
        level: r.level,
        parent_name: r.parent_name,
        ancestors: r.ancestors,
      }));

      if (entries.length === 0) { toast.error("No data rows found in file"); return; }

      // Use detected period or user-entered label
      const finalPeriod = periodLabel.trim() || parsed.detectedPeriod || "Unknown Period";

      // ── HARD RECONCILIATION GATE ──
      // Leaf debits must equal leaf credits AND the file's own Grand Total.
      // If they don't, nothing is imported or categorised — the gap is shown instead.
      if (!parsed.reconciles) {
        setUploadSummary({
          total: entries.length,
          groups: parsed.groups.length,
          leaves: parsed.leaves.length,
          excluded: parsed.rows.filter(r => r.is_excluded).length,
          categories: {},
          skipped: parsed.skipped,
          period: finalPeriod,
          reconciles: false,
          reconciliationMessage: parsed.reconciliationMessage,
          debitGap: parsed.debitGap,
          creditGap: parsed.creditGap,
          suspects: parsed.suspects,
          blocked: true,
        });
        toast.error("Import stopped — trial balance does not reconcile. Review the gap before importing.");
        return;
      }

      // Delete existing uploads for same period
      const existing = uploads.find(u => u.period_label === finalPeriod);
      if (existing) {
        await supabase.from("finance_mis_uploads").delete().eq("id", existing.id);
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase.from("finance_mis_uploads").insert({
        period_label: finalPeriod,
        uploaded_by: user?.id,
        raw_data: entries as any,
      }).select().single();
      if (error) throw error;

      // Only leaf ledgers (excluding reconciliation entries) need a category mapping.
      // Each unmapped leaf gets a pre-filled suggestion from its name + group chain.
      const seen = new Set<string>();
      const suggestions: SuggestedLedger[] = [];
      entries.filter(isMappable).forEach(e => {
        if (resolveLedgerCategory(mapIndex, e.ledger_name).category || seen.has(e.ledger_name)) return;
        seen.add(e.ledger_name);
        const s = suggestMISCategory(e.ledger_name, e.ancestors || []);
        suggestions.push({
          name: e.ledger_name,
          chain: e.ancestors || [],
          amount: Math.abs(e.debit || e.credit),
          suggested: s.category,
          confidence: s.confidence,
          reason: s.reason,
        });
      });
      if (suggestions.length > 0) {
        const prefill: Record<string, string> = {};
        suggestions.forEach(s => { if (s.suggested) prefill[s.name] = s.suggested; });
        setSuggestedLedgers(suggestions);
        setNewMappings(prefill);
        setMappingDrawerOpen(true);
      }

      const newUpload: MISUpload = {
        id: inserted.id,
        period_label: inserted.period_label,
        raw_data: entries,
        ads_split: {},
      };
      setUploads(prev => [newUpload, ...prev.filter(u => u.id !== existing?.id)]);
      setCurrentUploadId(inserted.id);

      // Build category summary from leaf ledgers only
      const categories: Record<string, number> = {};
      entries.filter(isMappable).forEach(e => {
        const cat = e.category || "Other";
        categories[cat] = (categories[cat] || 0) + 1;
      });

      setUploadSummary({
        total: entries.length,
        groups: parsed.groups.length,
        leaves: parsed.leaves.length,
        excluded: parsed.rows.filter(r => r.is_excluded).length,
        categories,
        skipped: parsed.skipped,
        period: finalPeriod,
        reconciles: true,
        reconciliationMessage: parsed.reconciliationMessage,
        debitGap: parsed.debitGap,
        creditGap: parsed.creditGap,
        suspects: parsed.suspects,
        blocked: false,
      });

      toast.success(`${parsed.leaves.length} leaf ledgers imported (${parsed.groups.length} group rows kept for drill-down)`);
      setPeriodLabel("");
    } catch (err: any) {

      toast.error(err.message || "Upload failed");
    }
  };


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if period already exists
    const label = periodLabel.trim();
    if (label && uploads.find(u => u.period_label === label)) {
      setPendingFile(file);
      setConfirmReplace(true);
    } else {
      await doUpload(file);
    }
    e.target.value = "";
  };

  const saveMappings = async () => {
    const entries = Object.entries(newMappings).filter(([, v]) => v);
    if (entries.length === 0) { setMappingDrawerOpen(false); return; }

    for (const [ledger_name, mis_category] of entries) {
      await supabase.from("ledger_mappings").upsert({ ledger_name, mis_category }, { onConflict: "ledger_name" });
    }
    // Refresh mapping rows (need ids + normalized keys back from the DB)
    const { data: refreshed } = await supabase.from("ledger_mappings").select("*");
    setMappingRows((refreshed || []) as LedgerMappingRow[]);
    toast.success("Ledger mappings saved");
    setMappingDrawerOpen(false);
  };

  const saveAdsSplit = async () => {
    if (!currentUpload) return;
    const { error } = await supabase.from("finance_mis_uploads")
      .update({ ads_split: adsValues as any })
      .eq("id", currentUpload.id);
    if (error) {
      toast.error("Failed to save ADS values");
      return;
    }
    // Update local state directly — no refetch
    setUploads(prev => prev.map(u =>
      u.id === currentUpload.id ? { ...u, ads_split: { ...adsValues } } : u
    ));
    toast.success("ADS values saved");
    setAdsDrawerOpen(false);
  };

  const openAdsDrawer = () => {
    if (currentUpload) {
      setAdsValues({ ...(currentUpload.ads_split || {}) });
    }
    setAdsDrawerOpen(true);
  };

  const downloadTemplate = () => downloadTrialBalanceTemplate();

  const entries = currentUpload?.raw_data || [];

  // Fallback resolution: an incoming ledger that doesn't match any stored name
  // exactly may still match after normalization. Those hits are NEVER silent —
  // they're flagged in the UI and recorded on the mapping row.
  const fallbackHits = useMemo(() => {
    const hits: { incoming: string; mapping: LedgerMappingRow }[] = [];
    const seen = new Set<string>();
    entries.forEach((e) => {
      if (!isMappable(e) || seen.has(e.ledger_name)) return;
      seen.add(e.ledger_name);
      const r = resolveLedgerCategory(mapIndex, e.ledger_name);
      if (r.viaFallback && r.mapping) hits.push({ incoming: e.ledger_name, mapping: r.mapping });
    });
    return hits;
  }, [entries, mapIndex]);

  // Effective map = exact matches + normalization fallbacks for this upload.
  const mappings = useMemo(() => {
    const m: Record<string, string> = { ...mapIndex.exact };
    fallbackHits.forEach((h) => { m[h.incoming] = h.mapping.mis_category; });
    return m;
  }, [mapIndex, fallbackHits]);

  // Record fallback matches so naming drift in Tally exports stays visible.
  const loggedFallbacks = useRef<Set<string>>(new Set());
  useEffect(() => {
    fallbackHits.forEach(async (h) => {
      const key = `${h.mapping.id}:${h.incoming}`;
      if (loggedFallbacks.current.has(key)) return;
      loggedFallbacks.current.add(key);
      if (h.mapping.last_fallback_variant === h.incoming) return;
      await supabase.from("ledger_mappings").update({
        last_fallback_variant: h.incoming,
        last_fallback_at: new Date().toISOString(),
        fallback_match_count: (h.mapping.fallback_match_count ?? 0) + 1,
      } as any).eq("id", h.mapping.id);
    });
  }, [fallbackHits]);

  const getMISValue = (category: string) => sumByCategory(entries, mappings, category);

  const salesRevenue = getMISValue("revenue");
  const otherIncome = getMISValue("other_income");
  const unbilledRevenue = getMISValue("unbilled_revenue");
  const totalIncome = getMISValue("revenue") + getMISValue("other_income") + getMISValue("unbilled_revenue");
  const fp = (v: number) => formatPct(v, totalIncome);

  const rawMaterials = getMISValue("raw_materials");
  const manufacturing = getMISValue("manufacturing");
  const totalVariable = rawMaterials + manufacturing;
  const contribution = totalIncome - totalVariable;
  const rentElec = getMISValue("rent_electricity");
  const salaries = getMISValue("salaries");
  const dirRem = getMISValue("director_remuneration");
  const otherFixed = getMISValue("other_fixed");
  const totalFixed = rentElec + salaries + dirRem + otherFixed;
  const ebitda = contribution - totalFixed;
  const depreciation = getMISValue("depreciation");
  const interest = getMISValue("interest");
  const pbt = ebitda - depreciation - interest;
  const tax = getMISValue("tax");
  const pat = pbt - tax;

  const adsVal = (key: string) => (currentUpload?.ads_split as Record<string, number>)?.[key] || 0;
  const hasAds = currentUpload && Object.keys(currentUpload.ads_split || {}).length > 0;
  const zeroIncome = entries.length > 0 && totalIncome === 0;

  return (
    <div className="space-y-4 mt-2">
      {/* Upload Controls */}
      <Card style={{ backgroundColor: "#F7F7F7" }}>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs" style={{ color: "#666666" }}>Period Label</Label>
              <Input
                placeholder="e.g. Q3 FY 2025-26"
                value={periodLabel}
                onChange={e => setPeriodLabel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <label>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
                  <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Trial Balance</span>
                </Button>
              </label>
              <Button variant="outline" onClick={downloadTemplate} style={{ borderColor: "#006039", color: "#006039" }}>
                <Download className="h-4 w-4 mr-2" /> Download TB Template
              </Button>
            </div>
          </div>
          {uploads.length > 1 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs" style={{ color: "#666666" }}>Period:</Label>
              <select
                className="text-sm border rounded px-2 py-1"
                value={currentUploadId || ""}
                onChange={e => setCurrentUploadId(e.target.value)}
              >
                {uploads.map(u => <option key={u.id} value={u.id}>{u.period_label}</option>)}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Summary */}
      {uploadSummary && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold font-display" style={{ color: uploadSummary.blocked ? "#F40009" : "#006039" }}>
              {uploadSummary.blocked
                ? `✕ Import stopped — trial balance does not reconcile`
                : `✓ Uploaded Successfully — ${uploadSummary.leaves} leaf ledgers imported`}
            </p>
            <p className="text-xs" style={{ color: "#1A1A1A" }}>Period: {uploadSummary.period}</p>
            <p className="text-xs" style={{ color: "#666" }}>
              {uploadSummary.leaves} leaf ledgers · {uploadSummary.groups} group / sub-total rows kept for drill-down only (never summed)
              {uploadSummary.excluded > 0 ? ` · ${uploadSummary.excluded} reconciliation rows excluded (P&L A/c, opening-balance difference)` : ""}
            </p>
            <p className="text-xs font-mono p-2 rounded" style={{
              color: uploadSummary.blocked ? "#F40009" : "#006039",
              backgroundColor: uploadSummary.blocked ? "#FFF0F0" : "#E8F2ED",
            }}>
              {uploadSummary.reconciliationMessage}
            </p>
            {uploadSummary.blocked && (
              <div className="text-xs space-y-1 p-2 rounded" style={{ backgroundColor: "#FDF6E7", color: "#1A1A1A" }}>
                <p>Nothing was imported or categorised. Gap: <strong>₹{Math.round(Math.abs(uploadSummary.debitGap)).toLocaleString("en-IN")}</strong> debit / <strong>₹{Math.round(Math.abs(uploadSummary.creditGap)).toLocaleString("en-IN")}</strong> credit.</p>
                {uploadSummary.suspects.length > 0 ? (
                  <>
                    <p className="font-semibold" style={{ color: "#D4860A" }}>Suspected misclassified rows ({uploadSummary.suspects.length}):</p>
                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {uploadSummary.suspects.map(s => (
                        <p key={s.row} className="text-[10px]" style={{ color: "#666" }}>Row {s.row} · {s.ledger_name} — {s.reason}</p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[11px]" style={{ color: "#666" }}>No indent/arithmetic conflicts found — check the file's own Grand Total row and any rows with missing Debit/Credit values.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(uploadSummary.categories).map(([cat, count]) => (
                <span key={cat} className="px-2 py-1 rounded" style={{
                  backgroundColor: cat === "Bank" ? "#E8F2ED" : cat === "Debtor" ? "#EBF5FF" : cat === "Creditor" ? "#FFF3CD" : cat === "Inventory" ? "#F3E8FF" : "#F7F7F7",
                  color: "#1A1A1A",
                }}>
                  {cat} ({count})
                </span>
              ))}
            </div>
            {(() => {
              const invEntries = (currentUpload?.raw_data || []).filter((e: any) => e.category === "Inventory" && !e.is_group && !e.is_excluded);
              const invTotal = invEntries.reduce((s: number, e: any) => s + Math.abs(e.closing_balance || e.debit - e.credit), 0);
              return invEntries.length > 0 ? (
                <p className="text-xs font-mono" style={{ color: "#006039" }}>Opening Stock Value: ₹{invTotal.toLocaleString("en-IN")}</p>
              ) : null;
            })()}
            {uploadSummary.skipped.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-xs cursor-pointer flex items-center gap-1" style={{ color: "#D4860A" }}>
                  <ChevronRight className="h-3 w-3" /> {uploadSummary.skipped.length} rows skipped
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-4 pt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {uploadSummary.skipped.map((s, i) => (
                      <p key={i} className="text-[10px]" style={{ color: "#999" }}>Row {s.row}: {s.reason}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setUploadSummary(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {currentUpload && entries.length > 0 && (
        <>
          {/* Section A: Contribution Analysis */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>
                Contribution Analysis — {currentUpload.period_label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {zeroIncome && (
                <div className="rounded px-3 py-2 mb-2 text-sm" style={{ backgroundColor: "#FFF8E1", color: "#D4860A", border: "1px solid #D4860A" }}>
                  Total Income is ₹0 — percentages cannot be calculated. Check that your Trial Balance has revenue entries in the Credit column and that revenue ledgers are mapped correctly.
                </div>
              )}
              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ color: "#006039" }}>Income</div>
              <MISRow label="Sales Revenue" amount={salesRevenue} pctStr={fp(salesRevenue)} />
              <MISRow label="Other Income" amount={otherIncome} pctStr={fp(otherIncome)} />
              <MISRow label="Unbilled Revenue" amount={unbilledRevenue} pctStr={fp(unbilledRevenue)} />
              <Divider />
              <MISRow label="Total Income" amount={totalIncome} pctStr={totalIncome ? "100.00%" : "—"} bold />

              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2 mt-2" style={{ color: "#006039" }}>Variable Costs</div>
              <MISRow label="Raw Materials" amount={rawMaterials} pctStr={fp(rawMaterials)} />
              <MISRow label="Manufacturing Expenses" amount={manufacturing} pctStr={fp(manufacturing)} />
              <Divider />
              <MISRow label="Total Variable Cost" amount={totalVariable} pctStr={fp(totalVariable)} bold />

              <DoubleDivider />
              <MISRow label="CONTRIBUTION" amount={contribution} pctStr={fp(contribution)} bold large color={contribution >= 0 ? "#006039" : "#F40009"} />
              <div className="flex justify-end px-2 pb-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{
                  backgroundColor: contribution >= 0 ? "#E8F2ED" : "#FFF0F0",
                  color: contribution >= 0 ? "#006039" : "#F40009",
                }}>
                  Contribution Margin: {totalIncome ? ((contribution / totalIncome) * 100).toFixed(2) : "—"}%
                </span>
              </div>
              <DoubleDivider />

              <div className="text-xs font-semibold uppercase tracking-wider py-2 px-2" style={{ color: "#006039" }}>Fixed Costs</div>
              <MISRow label="Rent + Electricity" amount={rentElec} pctStr={fp(rentElec)} />
              <MISRow label="Salaries" amount={salaries} pctStr={fp(salaries)} />
              <MISRow label="Director Remuneration" amount={dirRem} pctStr={fp(dirRem)} />
              <MISRow label="Other Fixed Expenses" amount={otherFixed} pctStr={fp(otherFixed)} />
              <Divider />
              <MISRow label="Total Fixed Costs" amount={totalFixed} pctStr={fp(totalFixed)} bold />

              <DoubleDivider />
              <MISRow label="EBITDA" amount={ebitda} pctStr={fp(ebitda)} bold large color={ebitda >= 0 ? "#006039" : "#F40009"} />
              <DoubleDivider />

              <MISRow label="Depreciation" amount={depreciation} pctStr={fp(depreciation)} />
              <MISRow label="Interest" amount={interest} pctStr={fp(interest)} />
              <Divider />
              <MISRow label="Profit Before Tax" amount={pbt} pctStr={fp(pbt)} bold />
              <MISRow label="Tax" amount={tax} pctStr={fp(tax)} />
              <Divider />
              <MISRow label="Profit After Tax" amount={pat} pctStr={fp(pat)} bold large color={pat >= 0 ? "#006039" : "#F40009"} />
            </CardContent>
          </Card>

          {/* Section B: Division Split */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>Division Split</CardTitle>
              <Button variant="outline" size="sm" onClick={openAdsDrawer}>
                <Pencil className="h-3 w-3 mr-1" /> Edit ADS Values
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ color: "#666666" }}>
                      <th className="text-left py-2 font-display">Line Item</th>
                      <th className="text-right py-2 font-display">Consolidated (₹)</th>
                      <th className="text-right py-2 font-display">ADS (₹)</th>
                      <th className="text-right py-2 font-display">Habitainer (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {[
                      { label: "Sales Revenue", consolidated: salesRevenue, key: "revenue" },
                      { label: "Raw Materials", consolidated: rawMaterials, key: "raw_materials" },
                      { label: "Manufacturing", consolidated: manufacturing, key: "manufacturing" },
                      { label: "Contribution", consolidated: contribution, key: "contribution" },
                      { label: "Fixed Costs", consolidated: totalFixed, key: "fixed" },
                      { label: "EBITDA", consolidated: ebitda, key: "ebitda" },
                      { label: "PAT", consolidated: pat, key: "pat" },
                    ].map(row => {
                      const ads = adsVal(row.key);
                      const hab = row.consolidated - ads;
                      return (
                        <tr key={row.key} className="border-b">
                          <td className="py-1.5 font-display font-medium" style={{ color: "#1A1A1A" }}>{row.label}</td>
                          <td className="text-right py-1.5">₹{Math.abs(row.consolidated).toLocaleString("en-IN")}</td>
                          <td className="text-right py-1.5">{hasAds ? `₹${Math.abs(ads).toLocaleString("en-IN")}` : "—"}</td>
                          <td className="text-right py-1.5" style={{ color: hasAds ? (hab >= 0 ? "#006039" : "#F40009") : "#666" }}>
                            {hasAds ? `₹${Math.abs(hab).toLocaleString("en-IN")}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {fallbackHits.length > 0 && (
            <Card style={{ borderColor: "#D4860A" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display" style={{ color: "#D4860A" }}>
                  Matched via normalization ({fallbackHits.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <p className="text-xs" style={{ color: "#666" }}>
                  These ledgers did not match a saved mapping exactly — they matched only after
                  normalizing spacing, case and punctuation. Review them: this is how Tally export
                  naming drift shows up.
                </p>
                {fallbackHits.map((h) => (
                  <div key={h.incoming} className="text-xs" style={{ color: "#1A1A1A" }}>
                    <span className="font-mono">{h.incoming}</span>
                    <span style={{ color: "#666" }}> → saved as </span>
                    <span className="font-mono">{h.mapping.ledger_name}</span>
                    <span style={{ color: "#666" }}> ({MIS_CATEGORIES[h.mapping.mis_category as MISCategory] || h.mapping.mis_category})</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Section C: Detailed Ledger View */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2 flex flex-row items-center gap-2 cursor-pointer">
                  <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" style={{ color: "#006039" }} />
                  <CardTitle className="text-lg font-display" style={{ color: "#1A1A1A" }}>Detailed Ledger View</CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {Object.entries(MIS_CATEGORIES).map(([cat, label]) => {
                    const catEntries = entries.filter(e => isMappable(e) && mappings[e.ledger_name] === cat);
                    if (catEntries.length === 0) return null;
                    return (
                      <Collapsible key={cat}>
                        <CollapsibleTrigger className="w-full flex items-center gap-2 py-2 text-sm font-semibold cursor-pointer" style={{ color: "#006039" }}>
                          <ChevronDown className="h-3 w-3" />
                          {label} ({catEntries.length} ledgers)
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pl-5 space-y-0.5 pb-2">
                            {catEntries.map((e, i) => {
                              const displayAmount = getLedgerDisplayAmount(e, cat);
                              return (
                              <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: "#1A1A1A" }}>
                                <span>{e.ledger_name}</span>
                                <div className="flex gap-4">
                                  <span className="font-mono">₹{Math.abs(displayAmount).toLocaleString("en-IN")}</span>
                                  <span className="text-xs" style={{ color: "#666" }}>{fp(displayAmount)}</span>
                                </div>
                              </div>
                            )})}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                  {entries.filter(e => isMappable(e) && !mappings[e.ledger_name]).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold" style={{ color: "#D4860A" }}>
                        Unmapped Ledgers ({entries.filter(e => isMappable(e) && !mappings[e.ledger_name]).length})
                      </p>
                      <div className="pl-5 space-y-0.5 pt-1">
                        {entries.filter(e => isMappable(e) && !mappings[e.ledger_name]).map((e, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5" style={{ color: "#999" }}>
                            <span>{e.ledger_name}</span>
                            <span className="font-mono">₹{(e.debit || e.credit).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </>
      )}

      {/* WIP Statement Section */}
      <WIPStatement />

      {(!currentUpload || entries.length === 0) && (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-sm" style={{ color: "#666666" }}>Upload a Trial Balance to generate MIS analysis</p>
          </CardContent>
        </Card>
      )}

      {/* ADS Split Drawer */}
      <Sheet open={adsDrawerOpen} onOpenChange={setAdsDrawerOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle className="font-display">Edit ADS Values</SheetTitle></SheetHeader>
          <div className="space-y-3 py-4">
            {["revenue", "raw_materials", "manufacturing", "contribution", "fixed", "ebitda", "pat"].map(key => (
              <div key={key}>
                <Label className="text-xs" style={{ color: "#666666" }}>{key.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())}</Label>
                <Input
                  type="number"
                  value={adsValues[key] ?? ""}
                  onChange={e => setAdsValues(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <SheetFooter>
            <Button onClick={saveAdsSplit} className="w-full" style={{ backgroundColor: "#006039" }}>Save ADS Split</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Ledger Mapping Drawer — pre-filled auto-suggestions for bulk confirmation */}
      <Sheet open={mappingDrawerOpen} onOpenChange={setMappingDrawerOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle className="font-display">Confirm Ledger Categories</SheetTitle>
          </SheetHeader>
          {(() => {
            const high = suggestedLedgers.filter(s => s.confidence === "high");
            const low = suggestedLedgers.filter(s => s.confidence !== "high");
            const row = (s: SuggestedLedger) => (
              <div key={s.name} className="rounded border p-2" style={{ borderColor: "#E5E7EB" }}>
                <div className="flex justify-between gap-2 items-start">
                  <Label className="text-xs font-medium" style={{ color: "#1A1A1A" }}>{s.name}</Label>
                  <span className="text-[10px] font-mono" style={{ color: "#666" }}>₹{s.amount.toLocaleString("en-IN")}</span>
                </div>
                <p className="text-[10px] mt-0.5" style={{ color: "#999" }}>
                  {s.chain.length ? s.chain.join(" › ") : "Top level"} · {s.reason}
                </p>
                <select
                  className="w-full mt-1 text-sm border rounded px-2 py-1.5"
                  style={{ borderColor: newMappings[s.name] ? "#006039" : "#D4860A" }}
                  value={newMappings[s.name] || ""}
                  onChange={e => setNewMappings(prev => ({ ...prev, [s.name]: e.target.value }))}
                >
                  <option value="">— Select Category —</option>
                  {Object.entries(MIS_CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            );
            return (
              <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
                <p className="text-xs" style={{ color: "#666666" }}>
                  Categories are auto-suggested from each ledger's name and its Tally group chain — nothing is applied until you save.
                </p>
                {low.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold" style={{ color: "#D4860A" }}>
                      Needs your input ({low.length}) — no confident match
                    </p>
                    {low.map(row)}
                  </div>
                )}
                {high.length > 0 && (
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="text-xs font-semibold flex items-center gap-1 cursor-pointer" style={{ color: "#006039" }}>
                      <ChevronDown className="h-3 w-3" /> Auto-suggested ({high.length}) — review &amp; confirm
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 pt-2">{high.map(row)}</div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })()}
          <SheetFooter className="border-t px-6 py-3 flex-col gap-2 sm:flex-col" style={{ backgroundColor: "#F7F7F7" }}>
            <p className="text-[11px] w-full" style={{ color: "#666" }}>
              {Object.values(newMappings).filter(Boolean).length} of {suggestedLedgers.length} ledgers have a category
            </p>
            <Button onClick={saveMappings} className="w-full" style={{ backgroundColor: "#006039" }}>
              Confirm &amp; Save {Object.values(newMappings).filter(Boolean).length} Mappings
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>


      {/* Replace Confirmation Dialog */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Replace Existing Trial Balance?</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: "#666" }}>
            A Trial Balance for <strong>{periodLabel}</strong> already exists. Uploading will replace it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmReplace(false); setPendingFile(null); }}>Cancel</Button>
            <Button onClick={async () => { setConfirmReplace(false); if (pendingFile) { await doUpload(pendingFile); setPendingFile(null); } }} style={{ backgroundColor: "#F40009", color: "white" }}>Replace & Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
