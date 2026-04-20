import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, ChevronDown, ChevronRight, AlertTriangle, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { parseTallyPL, fmtINR, fmtINRSigned, ParsedPL } from "@/lib/tally-pl-parser";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie, Legend } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface UploadRow {
  id: string;
  financial_year: string;
  period_start: string | null;
  period_end: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  total_revenue: number;
  total_cogs: number;
  total_direct_expenses: number;
  total_indirect_expenses: number;
  total_other_income: number;
  gross_profit: number;
  gross_profit_pct: number;
  net_profit_loss: number;
  net_margin_pct: number;
  is_loss: boolean;
  is_current: boolean;
  source_file_name: string | null;
}

interface LineItem {
  id: string;
  upload_id: string;
  side: "income" | "expense";
  section_name: string;
  hstack_category: string | null;
  account_name: string;
  amount: number;
  is_subtotal: boolean;
  is_section_header: boolean;
  display_order: number;
}

const SECTION_ORDER_INCOME = ["Sales Accounts", "Indirect Incomes"];
const SECTION_LABELS: Record<string, string> = {
  "Sales Accounts": "REVENUE",
  "Indirect Incomes": "OTHER INCOME",
  "Direct Expenses": "DIRECT EXPENSES",
  "Indirect Expenses": "INDIRECT EXPENSES",
};

export function ProfitLossTab() {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [activeUpload, setActiveUpload] = useState<UploadRow | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [parsing, setParsing] = useState(false);
  const [pendingParsed, setPendingParsed] = useState<ParsedPL | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>("");
  const [confirmReplace, setConfirmReplace] = useState<UploadRow | null>(null);

  const loadUploads = async () => {
    const { data } = await supabase
      .from("profit_loss_uploads")
      .select("*")
      .order("uploaded_at", { ascending: false });
    const list = (data as UploadRow[]) || [];
    setUploads(list);
    const current = list.find(u => u.is_current) || list[0] || null;
    if (current) setActiveUpload(current);
  };

  useEffect(() => { loadUploads(); }, []);

  useEffect(() => {
    if (!activeUpload) { setLines([]); return; }
    supabase
      .from("profit_loss_line_items")
      .select("*")
      .eq("upload_id", activeUpload.id)
      .order("display_order", { ascending: true })
      .then(({ data }) => setLines((data as LineItem[]) || []));
  }, [activeUpload?.id]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    try {
      const parsed = await parseTallyPL(file);
      if (parsed.balance_diff > 1) {
        toast.error(
          `File does not balance — Left: ₹${Math.round(parsed.left_total).toLocaleString("en-IN")} | Right: ₹${Math.round(parsed.right_total).toLocaleString("en-IN")} | Diff: ₹${Math.round(parsed.balance_diff).toLocaleString("en-IN")}`,
          { duration: 8000 }
        );
        setParsing(false);
        e.target.value = "";
        return;
      }
      setPendingParsed(parsed);
      setPendingFileName(file.name);
      const existing = uploads.find(u => u.financial_year === parsed.financial_year && u.is_current);
      if (existing) {
        setConfirmReplace(existing);
      } else {
        await persistUpload(parsed, file.name, null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to parse Tally P&L");
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const persistUpload = async (parsed: ParsedPL, fileName: string, replacingId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    let uploaderName: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("auth_user_id", user.id).maybeSingle();
      uploaderName = prof?.display_name || user.email || null;
    }

    // Mark previous current as superseded
    if (replacingId) {
      await supabase.from("profit_loss_uploads").update({ is_current: false }).eq("financial_year", parsed.financial_year).eq("is_current", true);
    }

    const { data: upload, error } = await supabase.from("profit_loss_uploads").insert({
      financial_year: parsed.financial_year,
      period_start: parsed.period_start,
      period_end: parsed.period_end,
      uploaded_by: user?.id,
      uploaded_by_name: uploaderName,
      total_revenue: parsed.total_revenue,
      total_cogs: parsed.total_cogs_net,
      total_direct_expenses: parsed.total_direct_expenses,
      total_indirect_expenses: parsed.total_indirect_expenses,
      total_other_income: parsed.total_other_income,
      gross_profit: parsed.gross_profit,
      gross_profit_pct: parsed.gross_profit_pct,
      net_profit_loss: parsed.net_profit_loss,
      net_margin_pct: parsed.net_margin_pct,
      is_loss: parsed.is_loss,
      is_current: true,
      source_file_name: fileName,
    }).select().single();

    if (error || !upload) {
      toast.error(error?.message || "Failed to save upload");
      return;
    }

    if (parsed.line_items.length) {
      const payload = parsed.line_items.map(li => ({ ...li, upload_id: upload.id }));
      const { error: liErr } = await supabase.from("profit_loss_line_items").insert(payload);
      if (liErr) toast.error("Line items failed: " + liErr.message);
    }

    toast.success(`Imported ${parsed.line_items.length} line items for FY ${parsed.financial_year}`);
    setPendingParsed(null);
    setPendingFileName("");
    await loadUploads();
  };

  const onConfirmReplace = async () => {
    if (!pendingParsed) return;
    await persistUpload(pendingParsed, pendingFileName, confirmReplace?.id || null);
    setConfirmReplace(null);
  };

  const downloadTemplate = () => {
    const t = TEMPLATES.plUpload;
    downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample);
  };

  // Group lines by section for display
  const grouped = useMemo(() => {
    const g: Record<string, LineItem[]> = {};
    lines.forEach(li => {
      if (!g[li.section_name]) g[li.section_name] = [];
      g[li.section_name].push(li);
    });
    return g;
  }, [lines]);

  const sectionTotal = (sec: string) =>
    (grouped[sec] || [])
      .filter(li => !li.is_subtotal && !li.is_section_header)
      .reduce((s, li) => s + li.amount, 0);

  const exportTallyFormat = async () => {
    if (!activeUpload || !lines.length) return;
    const XLSX = await import("xlsx");
    const expenses = lines.filter(l => l.side === "expense");
    const incomes = lines.filter(l => l.side === "income");
    const maxLen = Math.max(expenses.length, incomes.length);
    const aoa: any[][] = [
      ["Altree Habitats Pvt Ltd"],
      [""], [""], [""], [""],
      ["Profit & Loss A/c"],
      [`${activeUpload.period_start || ""} to ${activeUpload.period_end || ""}`],
      [""],
      ["Particulars", "", "", "Particulars", "", ""],
    ];
    for (let i = 0; i < maxLen; i++) {
      const e = expenses[i];
      const inc = incomes[i];
      aoa.push([
        e?.account_name || "",
        e && !e.is_section_header && !e.is_subtotal ? e.amount : null,
        e && (e.is_section_header || e.is_subtotal) ? e.amount : null,
        inc?.account_name || "",
        inc && !inc.is_section_header && !inc.is_subtotal ? inc.amount : null,
        inc && (inc.is_section_header || inc.is_subtotal) ? inc.amount : null,
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "P&L");
    XLSX.writeFile(wb, `PL_${activeUpload.financial_year}.xlsx`);
  };

  const deleteUpload = async (id: string) => {
    if (!confirm("Delete this P&L upload? This cannot be undone.")) return;
    const { error } = await supabase.from("profit_loss_uploads").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Upload deleted");
    await loadUploads();
  };

  // Derived metric calcs (use stored totals)
  const u = activeUpload;
  const directCostPct = u && u.total_revenue ? ((u.total_cogs + u.total_direct_expenses) / u.total_revenue) * 100 : 0;
  const overheadPct = u && u.total_revenue ? (u.total_indirect_expenses / u.total_revenue) * 100 : 0;

  // Revenue breakdown chart
  const revenueChart = useMemo(() => {
    if (!u) return [];
    const revLines = (grouped["Sales Accounts"] || []).filter(li => !li.is_section_header && !li.is_subtotal);
    return revLines.map(li => ({
      name: li.account_name.length > 22 ? li.account_name.slice(0, 22) + "…" : li.account_name,
      value: li.amount,
      pct: u.total_revenue ? (li.amount / u.total_revenue) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [grouped, u]);

  // Cost breakdown chart
  const costChart = useMemo(() => {
    if (!u) return [];
    return [
      { name: "Direct Materials (COGS)", value: Math.max(u.total_cogs, 0) },
      { name: "Direct Labour & Overheads", value: u.total_direct_expenses },
      { name: "Indirect Expenses", value: u.total_indirect_expenses },
    ].filter(c => c.value > 0);
  }, [u]);

  const COST_COLORS = ["#006039", "#D4860A", "#5C3F8C"];

  // Year comparison
  const currentByYear = useMemo(() => {
    const byYear: Record<string, UploadRow> = {};
    uploads.filter(u => u.is_current).forEach(u => { byYear[u.financial_year] = u; });
    return byYear;
  }, [uploads]);

  const yearKeys = Object.keys(currentByYear).sort();
  const showCompare = yearKeys.length >= 2;

  // Alerts
  const alerts: { level: "warn" | "danger"; msg: string }[] = [];
  if (u) {
    if (u.is_loss) {
      const cover = u.total_revenue
        ? ((u.total_revenue / (u.total_cogs + u.total_direct_expenses + u.total_indirect_expenses)) * 100).toFixed(1)
        : "0";
      alerts.push({ level: "danger", msg: `Net Loss of ${fmtINR(Math.abs(u.net_profit_loss))} for FY ${u.financial_year}. Revenue covers only ${cover}% of total costs.` });
    }
    const labour = lines.find(l => /labour charges/i.test(l.account_name) && l.side === "expense");
    if (labour && u.total_revenue) {
      const pct = (labour.amount / u.total_revenue) * 100;
      if (pct > 30) alerts.push({ level: "warn", msg: `Labour cost is ${pct.toFixed(1)}% of revenue — review labour efficiency.` });
    }
    const dir = lines.find(l => /directors remuneration/i.test(l.account_name) && l.side === "expense");
    if (dir && u.total_revenue) {
      const pct = (dir.amount / u.total_revenue) * 100;
      if (pct > 15) alerts.push({ level: "warn", msg: `Directors Remuneration is ${pct.toFixed(1)}% of revenue.` });
    }
    const trans = lines.find(l => /transportation/i.test(l.account_name) && l.side === "expense");
    if (trans && u.total_revenue) {
      const pct = (trans.amount / u.total_revenue) * 100;
      if (pct > 5) alerts.push({ level: "warn", msg: `Transportation Charges are ${pct.toFixed(1)}% of revenue.` });
    }
  }

  return (
    <div className="space-y-4 mt-2">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} disabled={parsing} />
            <Button asChild style={{ backgroundColor: "#006039" }} disabled={parsing}>
              <span className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" /> {parsing ? "Parsing..." : "Upload P&L"}
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
          {activeUpload && (
            <Button variant="outline" onClick={exportTallyFormat}>
              <Download className="h-4 w-4 mr-2" /> Export P&L
            </Button>
          )}
        </div>
        {uploads.length > 0 && (
          <select
            className="text-sm border rounded px-2 py-1 bg-white"
            value={activeUpload?.id || ""}
            onChange={e => setActiveUpload(uploads.find(u => u.id === e.target.value) || null)}
          >
            {uploads.map(u => (
              <option key={u.id} value={u.id}>
                FY {u.financial_year} {u.is_current ? "(current)" : "(v" + (uploads.filter(x => x.financial_year === u.financial_year).indexOf(u) + 1) + ")"} — {new Date(u.uploaded_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        )}
      </div>

      {!activeUpload && (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-sm" style={{ color: "#666" }}>
              Upload the Tally Profit &amp; Loss export (.xlsx) to view the company P&amp;L.
            </p>
          </CardContent>
        </Card>
      )}

      {activeUpload && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Revenue</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#1A1A1A" }}>{fmtINR(activeUpload.total_revenue)}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Gross Profit</p>
              <p className="text-2xl font-bold mt-1" style={{ color: activeUpload.gross_profit < 0 ? "#F40009" : "#006039" }}>
                {fmtINRSigned(activeUpload.gross_profit)}
              </p>
              <p className="text-xs mt-1" style={{ color: "#666" }}>{activeUpload.gross_profit_pct.toFixed(1)}% of Revenue</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Net {activeUpload.is_loss ? "Loss" : "Profit"}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: activeUpload.is_loss ? "#F40009" : "#006039" }}>
                {fmtINRSigned(activeUpload.net_profit_loss)}
              </p>
              <p className="text-xs mt-1" style={{ color: activeUpload.is_loss ? "#F40009" : "#006039" }}>{activeUpload.net_margin_pct.toFixed(1)}%</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>Period</p>
              <p className="text-lg font-bold mt-1" style={{ color: "#1A1A1A" }}>FY {activeUpload.financial_year}</p>
              <p className="text-xs mt-1" style={{ color: "#666" }}>
                Uploaded {new Date(activeUpload.uploaded_at).toLocaleDateString()} {activeUpload.uploaded_by_name ? `by ${activeUpload.uploaded_by_name}` : ""}
              </p>
            </CardContent></Card>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-3 rounded border"
                  style={{
                    backgroundColor: a.level === "danger" ? "#FEF2F2" : "#FFFBEB",
                    borderColor: a.level === "danger" ? "#F40009" : "#D4860A",
                    color: a.level === "danger" ? "#991B1B" : "#92400E",
                  }}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-sm">{a.msg}</span>
                </div>
              ))}
            </div>
          )}

          {/* Income Statement */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Income Statement — FY {activeUpload.financial_year}</CardTitle></CardHeader>
            <CardContent>
              {/* REVENUE */}
              <PLSection
                title="REVENUE"
                items={(grouped["Sales Accounts"] || []).filter(li => !li.is_section_header && !li.is_subtotal)}
                total={sectionTotal("Sales Accounts")}
                totalLabel="TOTAL REVENUE"
                collapsed={!!collapsed["Sales Accounts"]}
                onToggle={() => setCollapsed(c => ({ ...c, "Sales Accounts": !c["Sales Accounts"] }))}
              />

              {/* COGS */}
              <div className="mt-3 pt-3 border-t">
                <button
                  className="w-full flex items-center justify-between text-left font-bold text-sm"
                  onClick={() => setCollapsed(c => ({ ...c, COGS: !c.COGS }))}
                  style={{ color: "#1A1A1A" }}
                >
                  <span className="flex items-center gap-1">
                    {collapsed.COGS ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    COST OF GOODS SOLD
                  </span>
                  <span className="font-mono">{fmtINR(activeUpload.total_cogs)}</span>
                </button>
                {!collapsed.COGS && (
                  <div className="mt-2 space-y-1 pl-5">
                    {(grouped["Opening Stock"] || []).filter(li => !li.is_section_header).map(li => (
                      <PLLine key={li.id} name={li.account_name} amount={li.amount} />
                    ))}
                    {(grouped["Purchase Accounts"] || []).filter(li => !li.is_section_header && !li.is_subtotal).map(li => (
                      <PLLine key={li.id} name={"— " + li.account_name} amount={li.amount} />
                    ))}
                    {(grouped["Closing Stock"] || []).filter(li => !li.is_section_header).map(li => (
                      <PLLine key={li.id} name={"— " + li.account_name + " (less)"} amount={-li.amount} />
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-1 border-t mt-1">
                      <span>NET COGS</span>
                      <span className="font-mono">{fmtINR(activeUpload.total_cogs)}</span>
                    </div>
                  </div>
                )}
              </div>

              <PLSection
                title="DIRECT EXPENSES"
                items={(grouped["Direct Expenses"] || []).filter(li => !li.is_section_header && !li.is_subtotal)}
                total={activeUpload.total_direct_expenses}
                totalLabel="TOTAL DIRECT EXPENSES"
                collapsed={!!collapsed["Direct Expenses"]}
                onToggle={() => setCollapsed(c => ({ ...c, "Direct Expenses": !c["Direct Expenses"] }))}
              />

              {/* GROSS PROFIT */}
              <div className="mt-3 pt-3 border-t-2 flex justify-between text-base font-bold" style={{ color: activeUpload.gross_profit < 0 ? "#F40009" : "#006039" }}>
                <span>GROSS PROFIT</span>
                <span className="font-mono">{fmtINRSigned(activeUpload.gross_profit)} ({activeUpload.gross_profit_pct.toFixed(1)}%)</span>
              </div>

              <PLSection
                title="INDIRECT EXPENSES"
                items={(grouped["Indirect Expenses"] || []).filter(li => !li.is_section_header && !li.is_subtotal)}
                total={activeUpload.total_indirect_expenses}
                totalLabel="TOTAL INDIRECT EXPENSES"
                collapsed={!!collapsed["Indirect Expenses"]}
                onToggle={() => setCollapsed(c => ({ ...c, "Indirect Expenses": !c["Indirect Expenses"] }))}
              />

              <PLSection
                title="OTHER INCOME"
                items={(grouped["Indirect Incomes"] || []).filter(li => !li.is_section_header && !li.is_subtotal)}
                total={activeUpload.total_other_income}
                totalLabel="TOTAL OTHER INCOME"
                collapsed={!!collapsed["Indirect Incomes"]}
                onToggle={() => setCollapsed(c => ({ ...c, "Indirect Incomes": !c["Indirect Incomes"] }))}
              />

              {/* NET P&L */}
              <div
                className="mt-3 pt-3 border-t-4 flex justify-between text-lg font-bold"
                style={{ color: activeUpload.is_loss ? "#F40009" : "#006039", borderTopColor: "#1A1A1A" }}
              >
                <span>NET {activeUpload.is_loss ? "LOSS" : "PROFIT"}</span>
                <span className="font-mono">{fmtINRSigned(activeUpload.net_profit_loss)} ({activeUpload.net_margin_pct.toFixed(1)}%)</span>
              </div>
            </CardContent>
          </Card>

          {/* Derived metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Gross Margin %" value={activeUpload.gross_profit_pct} />
            <MetricCard label="Direct Cost %" value={directCostPct} invertGood />
            <MetricCard label="Overhead %" value={overheadPct} invertGood />
            <MetricCard label="Net Margin %" value={activeUpload.net_margin_pct} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown</CardTitle></CardHeader>
              <CardContent>
                {revenueChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(220, revenueChart.length * 32)}>
                    <BarChart data={revenueChart} layout="vertical" margin={{ left: 0, right: 30 }}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#666" }} width={140} />
                      <Tooltip formatter={(v: number) => fmtINR(v)} />
                      <Bar dataKey="value" fill="#006039" radius={[0, 3, 3, 0]} label={{ position: "right", formatter: (v: number) => v && activeUpload.total_revenue ? `${((v / activeUpload.total_revenue) * 100).toFixed(1)}%` : "", fontSize: 10, fill: "#1A1A1A" }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-xs" style={{ color: "#666" }}>No revenue lines</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={costChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                      {costChart.map((_, i) => <Cell key={i} fill={COST_COLORS[i % COST_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtINR(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Year comparison */}
          {showCompare && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Year Comparison</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs" style={{ color: "#666" }}>Metric</th>
                      {yearKeys.map(y => (
                        <th key={y} className="text-right py-2 text-xs" style={{ color: "#666" }}>FY {y}</th>
                      ))}
                      <th className="text-right py-2 text-xs" style={{ color: "#666" }}>Δ</th>
                      <th className="text-right py-2 text-xs" style={{ color: "#666" }}>Δ %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { l: "Revenue", k: "total_revenue" as const, higherBetter: true },
                      { l: "Gross Profit", k: "gross_profit" as const, higherBetter: true },
                      { l: "Net Profit", k: "net_profit_loss" as const, higherBetter: true },
                      { l: "Gross Margin %", k: "gross_profit_pct" as const, higherBetter: true, pct: true },
                      { l: "Net Margin %", k: "net_margin_pct" as const, higherBetter: true, pct: true },
                      { l: "COGS", k: "total_cogs" as const, higherBetter: false },
                      { l: "Direct Expenses", k: "total_direct_expenses" as const, higherBetter: false },
                      { l: "Indirect Expenses", k: "total_indirect_expenses" as const, higherBetter: false },
                    ].map(row => {
                      const last = yearKeys[yearKeys.length - 1];
                      const prev = yearKeys[yearKeys.length - 2];
                      const cur = currentByYear[last][row.k] as number;
                      const pri = currentByYear[prev][row.k] as number;
                      const delta = cur - pri;
                      const deltaPct = pri ? (delta / Math.abs(pri)) * 100 : 0;
                      const good = row.higherBetter ? delta >= 0 : delta <= 0;
                      const color = delta === 0 ? "#666" : good ? "#006039" : "#F40009";
                      return (
                        <tr key={row.l} className="border-b">
                          <td className="py-1.5 text-xs">{row.l}</td>
                          {yearKeys.map(y => (
                            <td key={y} className="text-right py-1.5 font-mono text-xs">
                              {row.pct ? `${(currentByYear[y][row.k] as number).toFixed(1)}%` : fmtINRSigned(currentByYear[y][row.k] as number)}
                            </td>
                          ))}
                          <td className="text-right py-1.5 font-mono text-xs" style={{ color }}>
                            {row.pct ? `${delta.toFixed(1)}%` : fmtINRSigned(delta)}
                          </td>
                          <td className="text-right py-1.5 font-mono text-xs" style={{ color }}>
                            {deltaPct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Version history */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Upload History</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {uploads.map(u => (
                  <AccordionItem key={u.id} value={u.id}>
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-3 text-left">
                        <span>FY {u.financial_year}</span>
                        {u.is_current && <Badge style={{ backgroundColor: "#006039", color: "#fff" }}>Current</Badge>}
                        <span className="text-xs" style={{ color: "#666" }}>
                          {new Date(u.uploaded_at).toLocaleString()} {u.uploaded_by_name ? `· ${u.uploaded_by_name}` : ""}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Revenue:</span> <span className="font-mono">{fmtINR(u.total_revenue)}</span></div>
                        <div><span className="text-muted-foreground">Gross:</span> <span className="font-mono">{fmtINRSigned(u.gross_profit)}</span></div>
                        <div><span className="text-muted-foreground">Net:</span> <span className="font-mono" style={{ color: u.is_loss ? "#F40009" : "#006039" }}>{fmtINRSigned(u.net_profit_loss)}</span></div>
                        <div><span className="text-muted-foreground">File:</span> {u.source_file_name || "—"}</div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => setActiveUpload(u)}>View</Button>
                        <Button size="sm" variant="outline" onClick={() => deleteUpload(u.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmReplace} onOpenChange={open => !open && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing P&L for FY {pendingParsed?.financial_year}?</AlertDialogTitle>
            <AlertDialogDescription>
              FY {confirmReplace?.financial_year} was already uploaded on {confirmReplace ? new Date(confirmReplace.uploaded_at).toLocaleDateString() : ""} {confirmReplace?.uploaded_by_name ? `by ${confirmReplace.uploaded_by_name}` : ""}.
              The previous version will be kept in upload history. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingParsed(null); setConfirmReplace(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmReplace} style={{ backgroundColor: "#006039" }}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PLSection({
  title, items, total, totalLabel, collapsed, onToggle,
}: {
  title: string;
  items: LineItem[];
  total: number;
  totalLabel: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-3 pt-3 border-t">
      <button
        className="w-full flex items-center justify-between text-left font-bold text-sm"
        onClick={onToggle}
        style={{ color: "#1A1A1A" }}
      >
        <span className="flex items-center gap-1">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {title}
        </span>
        <span className="font-mono">{fmtINRSigned(total)}</span>
      </button>
      {!collapsed && (
        <div className="mt-2 space-y-1 pl-5">
          {items.map(li => <PLLine key={li.id} name={li.account_name} amount={li.amount} />)}
          <div className="flex justify-between text-sm font-bold pt-1 border-t mt-1">
            <span>{totalLabel}</span>
            <span className="font-mono">{fmtINRSigned(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PLLine({ name, amount }: { name: string; amount: number }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "#1A1A1A" }}>{name}</span>
      <span className="font-mono" style={{ color: amount < 0 ? "#F40009" : "#1A1A1A" }}>
        {fmtINRSigned(amount)}
      </span>
    </div>
  );
}

function MetricCard({ label, value, invertGood }: { label: string; value: number; invertGood?: boolean }) {
  const good = invertGood ? value < 50 : value >= 0;
  const color = value === 0 ? "#666" : good ? "#006039" : "#F40009";
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs uppercase tracking-wide" style={{ color: "#666" }}>{label}</p>
        <p className="text-2xl font-bold mt-1 font-mono" style={{ color }}>{value.toFixed(1)}%</p>
      </CardContent>
    </Card>
  );
}
