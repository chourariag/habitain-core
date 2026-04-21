import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, TrendingDown, TrendingUp, ChevronDown, ChevronRight, AlertTriangle, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLLineItem {
  account: string;
  amount: number;
  side: "expense" | "income";
  section: string; // "cogs" | "direct_expenses" | "direct_incomes" | "indirect_expenses" | "sales" | "other_income" | "opening_stock" | "closing_stock"
}

interface TallyPL {
  id?: string;
  fy: string;
  period_label: string;
  company_name: string;
  total_revenue: number;
  opening_stock: number;
  closing_stock: number;
  purchase_total: number;
  direct_expenses_total: number;
  direct_incomes_total: number;
  gross_profit: number;
  indirect_expenses_total: number;
  other_income_total: number;
  net_result: number;
  line_items: PLLineItem[];
  left_total: number;
  right_total: number;
  created_at?: string;
}

// ─── Tally XLSX Parser ────────────────────────────────────────────────────────

function parseTallyPL(rows: any[][]): TallyPL {
  // Detect company name from row 0 (first cell with text)
  const companyName = String(rows[0]?.[0] ?? rows[1]?.[0] ?? "Alternate Real Estate Experiences Private Limited").trim();

  // Detect period from rows 0–8: look for a cell containing "to"
  let periodLabel = "";
  let fy = "";
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    for (const cell of rows[i]) {
      const s = String(cell ?? "").trim();
      if (s.toLowerCase().includes(" to ") && (s.includes("-") || s.includes("Apr") || s.includes("Mar") || s.includes("2024") || s.includes("2025") || s.includes("2026"))) {
        periodLabel = s;
        // Extract FY: look for year pair
        const yearMatch = s.match(/(\d{4})/g);
        if (yearMatch && yearMatch.length >= 2) {
          fy = `FY ${yearMatch[0]}-${String(yearMatch[yearMatch.length - 1]).slice(-2)}`;
        } else if (yearMatch) {
          const y = parseInt(yearMatch[0]);
          fy = `FY ${y}-${String(y + 1).slice(-2)}`;
        }
        break;
      }
    }
    if (periodLabel) break;
  }
  if (!fy) fy = "FY 2025-26";
  if (!periodLabel) periodLabel = "1 Apr 2025 to 31 Mar 2026";

  // Find data start row: look for "Particulars" header
  let dataStart = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const firstCell = String(row[0] ?? "").trim().toLowerCase();
    if (firstCell === "particulars") { dataStart = i + 1; break; }
  }
  if (dataStart < 0) dataStart = 9;

  const lineItems: PLLineItem[] = [];

  // Section tracking
  // LEFT side (cols 0,1,2): Expenses
  // RIGHT side (cols 3,4,5): Income
  type Section = "opening_stock" | "cogs" | "direct_expenses" | "direct_incomes" | "indirect_expenses" | "closing_stock" | "sales" | "other_income" | "unknown";
  let leftSection: Section = "unknown";
  let rightSection: Section = "unknown";

  const parseAmount = (v: any): number => {
    if (v == null || v === "" || v === undefined) return 0;
    if (typeof v === "number") return Math.round(v);
    const s = String(v).replace(/[₹,\s]/g, "").replace(/[()]/g, "");
    if (s === "" || s === "-") return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n);
  };

  const sectionKeywords: Record<string, Section> = {
    "opening stock": "opening_stock",
    "purchase accounts": "cogs",
    "purchase account": "cogs",
    "direct expenses": "direct_expenses",
    "direct expense": "direct_expenses",
    "direct incomes": "direct_incomes",
    "direct income": "direct_incomes",
    "indirect expenses": "indirect_expenses",
    "indirect expense": "indirect_expenses",
    "closing stock": "closing_stock",
    "sales accounts": "sales",
    "sales account": "sales",
    "other income": "other_income",
    "income": "other_income",
  };

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Left side (expense)
    const leftLabel = String(row[0] ?? "").trim();
    const leftAmt = parseAmount(row[1]);
    const leftSubtotal = parseAmount(row[2]);

    // Right side (income)
    const rightLabel = String(row[3] ?? "").trim();
    const rightAmt = parseAmount(row[4]);
    const rightSubtotal = parseAmount(row[5]);

    // Detect section changes
    const leftLower = leftLabel.toLowerCase();
    const rightLower = rightLabel.toLowerCase();

    for (const [key, sec] of Object.entries(sectionKeywords)) {
      if (leftLower.includes(key) && leftAmt === 0 && leftSubtotal === 0) {
        leftSection = sec;
      }
      if (rightLower.includes(key) && rightAmt === 0 && rightSubtotal === 0) {
        rightSection = sec;
      }
    }

    // Detect "To Profit & Loss" / "By Gross Profit" totals to update section
    if (leftLower.includes("gross profit") || leftLower.includes("profit & loss")) {
      leftSection = "indirect_expenses";
    }
    if (rightLower.includes("gross profit")) {
      rightSection = "indirect_expenses";
    }

    // Add left line items (skip blanks, section headers, totals)
    if (leftLabel && leftAmt !== 0 && !Object.keys(sectionKeywords).some(k => leftLower.includes(k))) {
      const isTotal = leftLower.includes("total") || leftLower.startsWith("to ");
      if (!isTotal) {
        lineItems.push({ account: leftLabel, amount: leftAmt, side: "expense", section: leftSection });
      }
    }

    // Add right line items
    if (rightLabel && rightAmt !== 0 && !Object.keys(sectionKeywords).some(k => rightLower.includes(k))) {
      const isTotal = rightLower.includes("total") || rightLower.startsWith("by ");
      if (!isTotal) {
        // Sales: positive. Closing stock: treated specially.
        const section = rightSection === "closing_stock"
          ? "closing_stock"
          : rightSection === "other_income"
          ? "other_income"
          : "sales";
        lineItems.push({ account: rightLabel, amount: rightAmt, side: "income", section });
      }
    }

    // Capture subtotals for section totals
    if (leftLower.startsWith("to ") && leftSubtotal !== 0) {
      // section subtotal on left - skip as line item
    }
  }

  // ─── Compute Aggregates ───────────────────────────────────────────────────

  const sumSection = (s: string) => lineItems.filter(l => l.section === s).reduce((acc, l) => acc + l.amount, 0);

  const openingStock = sumSection("opening_stock");
  const purchases = sumSection("cogs");
  const closingStock = sumSection("closing_stock");
  const directExpenses = sumSection("direct_expenses");
  const directIncomes = sumSection("direct_incomes");
  const indirectExpenses = sumSection("indirect_expenses");
  const totalRevenue = sumSection("sales");
  const otherIncome = sumSection("other_income");

  const netCOGS = openingStock + purchases - closingStock;
  const grossProfit = totalRevenue - netCOGS - directExpenses + directIncomes;
  const netResult = grossProfit + otherIncome - indirectExpenses;

  // Left total (expenses + loss if positive result)
  const leftTotal = openingStock + purchases + directExpenses + indirectExpenses + (netResult < 0 ? Math.abs(netResult) : 0);
  const rightTotal = totalRevenue + closingStock + otherIncome + (netResult > 0 ? netResult : 0);

  return {
    fy,
    period_label: periodLabel,
    company_name: companyName,
    total_revenue: totalRevenue,
    opening_stock: openingStock,
    closing_stock: closingStock,
    purchase_total: purchases,
    direct_expenses_total: directExpenses,
    direct_incomes_total: directIncomes,
    gross_profit: grossProfit,
    indirect_expenses_total: indirectExpenses,
    other_income_total: otherIncome,
    net_result: netResult,
    line_items: lineItems,
    left_total: leftTotal,
    right_total: rightTotal,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtINR(n: number, abs = false): string {
  const val = abs ? Math.abs(n) : n;
  if (val < 0) return `−₹${Math.abs(val).toLocaleString("en-IN")}`;
  return `₹${val.toLocaleString("en-IN")}`;
}

function pct(n: number): string { return `${n.toFixed(1)}%`; }

// ─── Section Component ───────────────────────────────────────────────────────

function PLSection({ title, total, items, defaultOpen = false, totalColor }: {
  title: string; total: number; items: PLLineItem[]; defaultOpen?: boolean; totalColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        style={{ backgroundColor: "#F7F7F7" }}
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-semibold font-display" style={{ color: "#1A1A1A" }}>{title}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: totalColor ?? "#1A1A1A" }}>{fmtINR(Math.abs(total))}</span>
          {open ? <ChevronDown className="h-4 w-4" style={{ color: "#999" }} /> : <ChevronRight className="h-4 w-4" style={{ color: "#999" }} />}
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <p className="px-4 py-2 text-xs" style={{ color: "#999" }}>No items</p>
          ) : items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2">
              <span className="text-xs" style={{ color: "#444" }}>{item.account}</span>
              <span className="text-xs font-mono" style={{ color: item.amount < 0 ? "#F40009" : "#1A1A1A" }}>
                {fmtINR(item.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PLTab() {
  const [pl, setPL] = useState<TallyPL | null>(null);
  const [allPLs, setAllPLs] = useState<TallyPL[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [replaceDialog, setReplaceDialog] = useState<{ existing: TallyPL; incoming: TallyPL } | null>(null);

  const fetchLatest = useCallback(async () => {
    const { data } = await (supabase.from("tally_pl_imports" as any) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    const rows: TallyPL[] = (data ?? []).map((r: any) => ({ ...r, line_items: r.line_items ?? [] }));
    setAllPLs(rows);
    setPL(rows[0] ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  const savePL = async (parsed: TallyPL) => {
    const { error } = await (supabase.from("tally_pl_imports" as any) as any).insert({
      fy: parsed.fy,
      period_label: parsed.period_label,
      company_name: parsed.company_name,
      total_revenue: parsed.total_revenue,
      opening_stock: parsed.opening_stock,
      closing_stock: parsed.closing_stock,
      purchase_total: parsed.purchase_total,
      direct_expenses_total: parsed.direct_expenses_total,
      direct_incomes_total: parsed.direct_incomes_total,
      gross_profit: parsed.gross_profit,
      indirect_expenses_total: parsed.indirect_expenses_total,
      other_income_total: parsed.other_income_total,
      net_result: parsed.net_result,
      line_items: parsed.line_items,
      left_total: parsed.left_total,
      right_total: parsed.right_total,
    });
    if (error) throw new Error(error.message);
  };

  const deleteFY = async (fy: string) => {
    await (supabase.from("tally_pl_imports" as any) as any).delete().eq("fy", fy);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // File type validation
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Please upload an Excel (.xlsx) file exported from Tally.");
      return;
    }

    setUploading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const parsed = parseTallyPL(raw);

      // Check for duplicate FY
      const existing = allPLs.find((p) => p.fy === parsed.fy);
      if (existing) {
        setReplaceDialog({ existing, incoming: parsed });
        setUploading(false);
        return;
      }

      await savePL(parsed);
      toast.success(`Imported ${parsed.line_items.length} line items for ${parsed.fy}. ${Math.abs(parsed.left_total - parsed.right_total) < 1000 ? "File balanced ✓" : "Note: file totals differ."}`);
      fetchLatest();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  const handleReplace = async (confirm: boolean) => {
    if (!replaceDialog) return;
    if (confirm) {
      try {
        await deleteFY(replaceDialog.incoming.fy);
        await savePL(replaceDialog.incoming);
        toast.success(`${replaceDialog.incoming.fy} replaced successfully.`);
        fetchLatest();
      } catch (err: any) { toast.error(err.message); }
    }
    setReplaceDialog(null);
  };

  const downloadTemplate = () => {
    const XLSX_HEADERS = [
      ["Alternate Real Estate Experiences Private Limited"],
      ["#42, Doddaballapur Industrial Area, Doddaballapur"],
      ["UDYAM-KR-03-0122680"],
      [""],
      ["Profit & Loss A/c"],
      [""],
      ["1-Apr-25 to 31-Mar-26"],
      ["Alternate Real Estate Experiences Private Limited"],
      ["Particulars", "Amount", "", "Particulars", "Amount", ""],
      ["Opening Stock", 39524164, "", "Sales Accounts", "", ""],
      ["", "", "", "Modular Structures", 49737398, ""],
    ];
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet(XLSX_HEADERS);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
      XLSX.writeFile(wb, "Tally_PL_Template.xlsx");
    });
  };

  if (loading) return <div className="flex justify-center py-12"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;

  if (!pl) {
    return (
      <div className="space-y-4 mt-2">
        <div className="flex flex-wrap gap-2 items-center">
          <label>
            <input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }} disabled={uploading}>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {uploading ? "Processing…" : "Upload P&L"}
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download Template</Button>
        </div>
        <Card className="py-16">
          <CardContent className="text-center space-y-2">
            <BarChart2 className="h-10 w-10 mx-auto" style={{ color: "#ddd" }} />
            <p className="text-sm" style={{ color: "#666" }}>No P&L uploaded yet.</p>
            <p className="text-xs" style={{ color: "#999" }}>Upload your Tally Profit & Loss export (.xlsx) to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoss = pl.net_result < 0;
  const grossMarginPct = pl.total_revenue > 0 ? (pl.gross_profit / pl.total_revenue) * 100 : 0;
  const netMarginPct = pl.total_revenue > 0 ? (pl.net_result / pl.total_revenue) * 100 : 0;
  const directCostPct = pl.total_revenue > 0 ? ((pl.purchase_total + pl.direct_expenses_total) / pl.total_revenue) * 100 : 0;
  const overheadPct = pl.total_revenue > 0 ? (pl.indirect_expenses_total / pl.total_revenue) * 100 : 0;

  const bySection = (section: string) => pl.line_items.filter((l) => l.section === section);

  // Revenue breakdown chart
  const revItems = bySection("sales").sort((a, b) => b.amount - a.amount).slice(0, 6);
  const revChartData = revItems.map((r) => ({
    name: r.account.length > 22 ? r.account.slice(0, 20) + "…" : r.account,
    amount: r.amount,
    pct: pl.total_revenue > 0 ? (r.amount / pl.total_revenue * 100) : 0,
  }));

  // Cost breakdown chart
  const costChartData = [
    { name: "Direct Materials", amount: pl.purchase_total },
    { name: "Direct Expenses", amount: pl.direct_expenses_total },
    { name: "Indirect Expenses", amount: pl.indirect_expenses_total },
  ].filter((d) => d.amount > 0);

  const CHART_COLORS = ["#006039", "#D4860A", "#2563EB", "#9333EA", "#059669", "#B45309"];

  // Year comparison
  const prevPL = allPLs.find((p) => p.fy !== pl.fy);

  const balanceDiff = Math.abs(pl.left_total - pl.right_total);
  const balanced = balanceDiff < 1000;

  return (
    <div className="space-y-4 mt-2">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <label>
            <input type="file" accept=".xlsx" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }} disabled={uploading}>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />{uploading ? "Processing…" : "Upload P&L"}
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download Template</Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs" style={{ color: balanced ? "#006039" : "#D4860A", borderColor: balanced ? "#006039" : "#D4860A" }}>
            {balanced ? "✓ File balanced" : `⚠ Diff ₹${balanceDiff.toLocaleString("en-IN")}`}
          </Badge>
          <span className="text-xs" style={{ color: "#666" }}>{pl.period_label}</span>
        </div>
      </div>

      {/* Net Loss Alert */}
      {isLoss && (
        <div className="flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: "#FEE2E2" }}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#F40009" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#F40009" }}>
              Net Loss of {fmtINR(Math.abs(pl.net_result))} for {pl.fy}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#666" }}>
              Revenue covers only {(100 + netMarginPct).toFixed(1)}% of total costs. Overhead at {pct(overheadPct)} of revenue.
            </p>
          </div>
        </div>
      )}

      {/* 4-Tile Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border p-3" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-xs" style={{ color: "#666" }}>Total Revenue</p>
          <p className="text-lg font-bold font-display mt-0.5" style={{ color: "#1A1A1A" }}>{fmtINR(pl.total_revenue)}</p>
        </div>
        <div className="rounded-xl border border-border p-3" style={{ backgroundColor: "#E8F2ED" }}>
          <p className="text-xs" style={{ color: "#006039" }}>Gross Profit</p>
          <p className="text-lg font-bold font-display mt-0.5" style={{ color: "#006039" }}>{fmtINR(pl.gross_profit)}</p>
          <p className="text-xs" style={{ color: "#006039" }}>{pct(grossMarginPct)}</p>
        </div>
        <div className="rounded-xl border border-border p-3" style={{ backgroundColor: isLoss ? "#FEE2E2" : "#E8F2ED" }}>
          <p className="text-xs" style={{ color: isLoss ? "#F40009" : "#006039" }}>{isLoss ? "Net Loss" : "Net Profit"}</p>
          <p className="text-lg font-bold font-display mt-0.5" style={{ color: isLoss ? "#F40009" : "#006039" }}>{fmtINR(Math.abs(pl.net_result))}</p>
          <p className="text-xs" style={{ color: isLoss ? "#F40009" : "#006039" }}>{pct(Math.abs(netMarginPct))}</p>
        </div>
        <div className="rounded-xl border border-border p-3" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-xs" style={{ color: "#666" }}>Period</p>
          <p className="text-sm font-bold font-display mt-0.5" style={{ color: "#1A1A1A" }}>{pl.fy}</p>
          <p className="text-[10px]" style={{ color: "#999" }}>{pl.company_name.split(" ").slice(0, 3).join(" ")}…</p>
        </div>
      </div>

      {/* Derived Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Gross Margin %", value: pct(grossMarginPct), color: "#006039", bg: "#E8F2ED" },
          { label: "Direct Cost %", value: pct(directCostPct), color: "#1A1A1A", bg: "#F7F7F7" },
          { label: "Overhead %", value: pct(overheadPct), color: overheadPct > 25 ? "#D4860A" : "#1A1A1A", bg: overheadPct > 25 ? "#FFF8E8" : "#F7F7F7" },
          { label: "Net Margin %", value: pct(netMarginPct), color: isLoss ? "#F40009" : "#006039", bg: isLoss ? "#FEE2E2" : "#E8F2ED" },
        ].map((m) => (
          <div key={m.label} className="rounded-lg border border-border p-3 text-center" style={{ backgroundColor: m.bg }}>
            <p className="text-xs" style={{ color: "#666" }}>{m.label}</p>
            <p className="text-xl font-bold font-display mt-0.5" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Income Statement — collapsible sections */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Income Statement — {pl.fy}</p>

        {/* Revenue */}
        <PLSection title="Revenue (Sales Accounts)" total={pl.total_revenue} items={bySection("sales")} defaultOpen totalColor="#006039" />

        {/* COGS block */}
        <div className="rounded-xl border border-border p-3 space-y-2" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Cost of Goods Sold</p>
          <div className="flex justify-between text-xs px-1">
            <span style={{ color: "#444" }}>Opening Stock</span>
            <span className="font-mono">{fmtINR(pl.opening_stock)}</span>
          </div>
          <PLSection title="Purchase Accounts" total={pl.purchase_total} items={bySection("cogs")} />
          <div className="flex justify-between text-xs px-1">
            <span style={{ color: "#444" }}>Less: Closing Stock</span>
            <span className="font-mono" style={{ color: "#006039" }}>−{fmtINR(pl.closing_stock)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold px-1 pt-1 border-t border-border">
            <span>Net COGS</span>
            <span style={{ color: "#D4860A" }}>{fmtINR(pl.opening_stock + pl.purchase_total - pl.closing_stock)}</span>
          </div>
        </div>

        <PLSection title="Direct Expenses" total={pl.direct_expenses_total} items={bySection("direct_expenses")} />
        {pl.direct_incomes_total > 0 && (
          <PLSection title="Direct Incomes (deduction)" total={-pl.direct_incomes_total} items={bySection("direct_incomes")} totalColor="#006039" />
        )}

        {/* Gross Profit line */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: "#E8F2ED" }}>
          <span className="text-sm font-bold font-display" style={{ color: "#006039" }}>Gross Profit</span>
          <div className="text-right">
            <p className="text-base font-bold" style={{ color: "#006039" }}>{fmtINR(pl.gross_profit)}</p>
            <p className="text-xs" style={{ color: "#006039" }}>{pct(grossMarginPct)}</p>
          </div>
        </div>

        <PLSection title="Indirect Expenses" total={pl.indirect_expenses_total} items={bySection("indirect_expenses")} />
        {pl.other_income_total > 0 && (
          <PLSection title="Other Income" total={pl.other_income_total} items={bySection("other_income")} totalColor="#006039" />
        )}

        {/* Net Result line */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ backgroundColor: isLoss ? "#FEE2E2" : "#E8F2ED" }}>
          <div className="flex items-center gap-2">
            {isLoss ? <TrendingDown className="h-4 w-4" style={{ color: "#F40009" }} /> : <TrendingUp className="h-4 w-4" style={{ color: "#006039" }} />}
            <span className="text-sm font-bold font-display" style={{ color: isLoss ? "#F40009" : "#006039" }}>
              {isLoss ? "Net Loss" : "Net Profit"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-base font-bold" style={{ color: isLoss ? "#F40009" : "#006039" }}>{fmtINR(Math.abs(pl.net_result))}</p>
            <p className="text-xs" style={{ color: isLoss ? "#F40009" : "#006039" }}>{pct(Math.abs(netMarginPct))}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      {revChartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#666" }}>Revenue Breakdown</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revChartData} layout="vertical" margin={{ left: 0, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "#666" }} width={120} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
                  {revChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#666" }}>Cost Breakdown</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={costChartData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                  {costChartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Year comparison */}
      {prevPL ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: "#F7F7F7", color: "#666" }}>Year-over-Year Comparison</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                  <th className="text-left px-4 py-2">Metric</th>
                  <th className="text-right px-4 py-2">{prevPL.fy}</th>
                  <th className="text-right px-4 py-2">{pl.fy}</th>
                  <th className="text-right px-4 py-2">Change ₹</th>
                  <th className="text-right px-4 py-2">Change %</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue", curr: pl.total_revenue, prev: prevPL.total_revenue },
                  { label: "Gross Profit", curr: pl.gross_profit, prev: prevPL.gross_profit },
                  { label: "Net Result", curr: pl.net_result, prev: prevPL.net_result },
                ].map((row) => {
                  const change = row.curr - row.prev;
                  const changePct = row.prev !== 0 ? (change / Math.abs(row.prev)) * 100 : 0;
                  return (
                    <tr key={row.label} style={{ borderBottom: "1px solid #F0F0F0" }}>
                      <td className="px-4 py-2 font-medium">{row.label}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtINR(row.prev)}</td>
                      <td className="px-4 py-2 text-right font-mono">{fmtINR(row.curr)}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: change >= 0 ? "#006039" : "#F40009" }}>{change >= 0 ? "+" : ""}{fmtINR(change)}</td>
                      <td className="px-4 py-2 text-right" style={{ color: changePct >= 0 ? "#006039" : "#F40009" }}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border p-4 text-center">
          <p className="text-xs" style={{ color: "#999" }}>Upload prior year P&L to see year-over-year comparison.</p>
        </div>
      )}

      {/* Replace Dialog */}
      <Dialog open={!!replaceDialog} onOpenChange={(o) => { if (!o) setReplaceDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Replace Existing P&L?</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "#666" }}>
            A P&L for <strong>{replaceDialog?.incoming.fy}</strong> already exists. Replace it with the new upload?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleReplace(false)}>No, Keep Existing</Button>
            <Button onClick={() => handleReplace(true)} style={{ backgroundColor: "#F40009" }} className="text-white">Yes, Replace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
