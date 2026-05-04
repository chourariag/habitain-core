import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, IndianRupee, TrendingDown, TrendingUp, Wallet, Info, Upload, Download, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { WorkOrdersTab } from "@/components/work-orders/WorkOrdersTab";

const BOQ_CATEGORIES = [
  "Structure", "Insulation", "Wall Boarding", "Ceiling", "Flooring",
  "Openings", "Cladding", "Painting", "Waterproofing",
  "MEP Electrical", "MEP Plumbing", "Civil", "Miscellaneous",
];

interface Props {
  projectId: string;
  contractValue: number;
  userRole: string | null;
}

interface BoqItem { category: string | null; total_amount: number | null; }
interface Grn {
  id: string; boq_category: string; vendor_name: string; invoice_no: string | null;
  invoice_date: string | null; description: string | null;
  basic_amount_excl_gst: number; remark: string | null;
}
interface ManualEntry {
  id: string; boq_category: string; vendor_name: string | null; invoice_no: string | null;
  entry_date: string; description: string | null; amount_excl_gst: number; remark: string | null;
}
type Row =
  | (Grn & { _source: "grn" })
  | (ManualEntry & { _source: "manual" });

interface TenderBudgetItem {
  category: string;
  total_amount: number;
}

const fmtINR = (n: number) =>
  `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export function BudgetTrackingTab({ projectId, contractValue, userRole }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [manuals, setManuals] = useState<ManualEntry[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const navigate = useNavigate();
  const [hasH1Signoff, setHasH1Signoff] = useState(false);
  const [tenderBudgetItems, setTenderBudgetItems] = useState<TenderBudgetItem[]>([]);
  const [tenderTotal, setTenderTotal] = useState(0);
  const [quotationValue, setQuotationValue] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [woCommitted, setWoCommitted] = useState<Record<string, number>>({});
  const gfcFileRef = useRef<HTMLInputElement>(null);

  const canEdit = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "procurement"].includes(userRole ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: boqs } = await supabase
      .from("project_boq").select("id").eq("project_id", projectId)
      .order("version_number", { ascending: false }).limit(1);

    let items: BoqItem[] = [];
    if (boqs && boqs.length > 0) {
      const { data } = await supabase.from("project_boq_items")
        .select("category,total_amount").eq("boq_id", boqs[0].id);
      items = (data ?? []) as any;
    }

    const [grnRes, manRes] = await Promise.all([
      (supabase.from("project_grns" as any) as any).select("*").eq("project_id", projectId).order("received_at", { ascending: false }),
      (supabase.from("project_budget_manual_entries" as any) as any).select("*").eq("project_id", projectId).order("entry_date", { ascending: false }),
    ]);

    // Check H1 sign-off from design_stages
    const { data: signoffs } = await (supabase as any).from("design_stages")
      .select("id")
      .eq("project_id", projectId)
      .eq("stage_name", "H1")
      .eq("status", "completed")
      .limit(1);
    setHasH1Signoff((signoffs ?? []).length > 0);

    // Fetch tender budget
    const { data: tenderBudgets } = await (supabase as any).from("project_tender_budget")
      .select("*")
      .eq("project_id", projectId)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (tenderBudgets && tenderBudgets.length > 0) {
      const tb = tenderBudgets[0];
      setTenderTotal(Number(tb.total_tender_value) || 0);
      setQuotationValue(Number(tb.quotation_value) || 0);
      const { data: tbItems } = await (supabase as any).from("project_tender_budget_items")
        .select("category, total_amount")
        .eq("budget_id", tb.id);
      setTenderBudgetItems((tbItems ?? []).map((i: any) => ({
        category: i.category ?? "Miscellaneous",
        total_amount: Number(i.total_amount) || 0,
      })));
    }

    // Fetch committed WOs (approved+) per BOQ category
    const { data: woRows } = await supabase
      .from("work_orders")
      .select("boq_category,total_value,status")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .in("status", ["approved_pending_issue","pending_director_approval","issued","work_in_progress","completed_pending_measurement","measured_signed_off","closed"]);
    const woMap: Record<string, number> = {};
    (woRows ?? []).forEach((w: any) => {
      const cat = BOQ_CATEGORIES.find(c => c.toLowerCase() === (w.boq_category ?? "").toLowerCase()) ?? "Miscellaneous";
      woMap[cat] = (woMap[cat] ?? 0) + Number(w.total_value || 0);
    });
    setWoCommitted(woMap);

    setBoqItems(items);
    setGrns((grnRes.data ?? []) as Grn[]);
    setManuals((manRes.data ?? []) as ManualEntry[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const budgetByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    BOQ_CATEGORIES.forEach((c) => (map[c] = 0));
    boqItems.forEach((i) => {
      const cat = (i.category ?? "").trim();
      const matched = BOQ_CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? "Miscellaneous";
      map[matched] = (map[matched] ?? 0) + (Number(i.total_amount) || 0);
    });
    return map;
  }, [boqItems]);

  const tenderByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    BOQ_CATEGORIES.forEach((c) => (map[c] = 0));
    tenderBudgetItems.forEach((i) => {
      const matched = BOQ_CATEGORIES.find((c) => c.toLowerCase() === i.category.toLowerCase()) ?? "Miscellaneous";
      map[matched] = (map[matched] ?? 0) + i.total_amount;
    });
    return map;
  }, [tenderBudgetItems]);

  const rowsByCategory = useMemo(() => {
    const map: Record<string, Row[]> = {};
    BOQ_CATEGORIES.forEach((c) => (map[c] = []));
    grns.forEach((g) => {
      const c = BOQ_CATEGORIES.includes(g.boq_category) ? g.boq_category : "Miscellaneous";
      map[c].push({ ...g, _source: "grn" });
    });
    manuals.forEach((m) => {
      const c = BOQ_CATEGORIES.includes(m.boq_category) ? m.boq_category : "Miscellaneous";
      map[c].push({ ...m, _source: "manual" });
    });
    return map;
  }, [grns, manuals]);

  const totalBudget = Object.values(budgetByCategory).reduce((s, n) => s + n, 0);
  const totalSpent =
    grns.reduce((s, g) => s + Number(g.basic_amount_excl_gst || 0), 0) +
    manuals.reduce((s, m) => s + Number(m.amount_excl_gst || 0), 0);
  const balance = totalBudget - totalSpent;
  const marginPct = contractValue > 0 ? ((contractValue - totalSpent) / contractValue) * 100 : 0;

  const handleGfcUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const items: any[] = [];
      for (const row of rows) {
        const cat = row["Category"] || row["category"] || "Miscellaneous";
        const desc = row["Item Description"] || row["Description"] || "";
        const totalAmt = Number(row["Total Amount (₹)"] || row["Total Amount"] || 0);
        if (!desc && !totalAmt) continue;
        const tenderQty = Number(row["Tender Qty"] || 0);
        const actualQty = Number(row["Actual Qty"] || 0);
        const wastagePct = Number(row["Wastage %"] || 0);
        // BOQ Qty = Actual Qty + Wastage% (compute if not supplied)
        const boqQtyRaw = row["BOQ Qty"];
        const boqQty = boqQtyRaw === "" || boqQtyRaw === undefined || boqQtyRaw === null
          ? actualQty * (1 + wastagePct / 100)
          : Number(boqQtyRaw) || 0;
        items.push({
          category: cat,
          item_description: desc,
          unit: row["Unit"] || "",
          tender_qty: tenderQty,
          actual_qty: actualQty,
          wastage_pct: wastagePct,
          boq_qty: boqQty,
          material_rate: Number(row["Material Rate (₹)"] || row["Material Rate"] || 0),
          labour_rate: Number(row["Labour Rate (₹)"] || row["Labour Rate"] || 0),
          oh_rate: Number(row["OH Rate (₹)"] || row["OH Rate"] || 0),
          boq_rate: Number(row["BOQ Rate (₹)"] || row["BOQ Rate"] || 0),
          total_amount: totalAmt,
          margin_pct: Number(row["Margin %"] || 0),
          scope: row["Scope (Factory / On-Site Civil / Both)"] || row["Scope"] || "",
        });
      }

      if (items.length === 0) { toast.error("No items found in file"); setUploading(false); return; }

      // Create BOQ version
      const { data: prevBoqs } = await supabase.from("project_boq")
        .select("version_number").eq("project_id", projectId)
        .order("version_number", { ascending: false }).limit(1);
      const nextVersion = ((prevBoqs as any)?.[0]?.version_number ?? 0) + 1;

      const { data: newBoq, error: boqErr } = await supabase.from("project_boq")
        .insert({ project_id: projectId, version_number: nextVersion, uploaded_by: user.id } as any)
        .select("id").single();
      if (boqErr) throw boqErr;

      const boqId = (newBoq as any).id;
      const boqItems = items.map((i) => ({ boq_id: boqId, ...i }));
      for (let i = 0; i < boqItems.length; i += 50) {
        await supabase.from("project_boq_items").insert(boqItems.slice(i, i + 50) as any);
      }

      toast.success(`${items.length} GFC budget items uploaded`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (gfcFileRef.current) gfcFileRef.current.value = "";
    }
  };

  const hasBothBudgets = tenderTotal > 0 && totalBudget > 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* GFC Budget Upload Section */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-sm font-semibold" style={{ color: "#1A1A1A" }}>GFC Budget</h3>
            <div className="flex gap-2">
              <input ref={gfcFileRef} type="file" accept=".xlsx" className="hidden" onChange={handleGfcUpload} />
              <Button size="sm" variant="outline" onClick={() => downloadXlsxTemplate(TEMPLATES.boq.filename, TEMPLATES.boq.sheet, TEMPLATES.boq.headers, TEMPLATES.boq.sample)}
                style={{ borderColor: "#006039", color: "#006039" }} className="text-xs gap-1">
                <Download className="h-3 w-3" /> Template
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button size="sm" onClick={() => gfcFileRef.current?.click()}
                        disabled={!hasH1Signoff || uploading}
                        className="text-xs gap-1" style={hasH1Signoff ? { backgroundColor: "#006039" } : {}}>
                        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : hasH1Signoff ? <Upload className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        Upload GFC Budget
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!hasH1Signoff && (
                    <TooltipContent>
                      <p>GFC sign-off required before uploading GFC budget</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          {!hasH1Signoff && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#D4860A" }}>
              <Lock className="h-3 w-3" /> GFC budget upload is locked until H1 sign-off is recorded in the Design Portal
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget Comparison View */}
      {hasBothBudgets && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#006039", color: "white" }}>
                  <th colSpan={7} className="text-left px-3 py-2 font-display font-semibold text-sm">Budget Comparison</th>
                </tr>
                <tr className="border-b text-muted-foreground" style={{ backgroundColor: "#F7F7F7" }}>
                  <th className="text-left px-3 py-1.5 font-medium">Category</th>
                  <th className="text-right px-3 py-1.5 font-medium">Tender Budget ₹</th>
                  <th className="text-right px-3 py-1.5 font-medium">GFC Budget ₹</th>
                  <th className="text-right px-3 py-1.5 font-medium">Variance ₹</th>
                  <th className="text-right px-3 py-1.5 font-medium">Variance %</th>
                  <th className="text-right px-3 py-1.5 font-medium">Spent ₹</th>
                  <th className="text-right px-3 py-1.5 font-medium">Balance vs GFC ₹</th>
                </tr>
              </thead>
              <tbody>
                {BOQ_CATEGORIES.map((cat) => {
                  const tender = tenderByCategory[cat] ?? 0;
                  const gfc = budgetByCategory[cat] ?? 0;
                  if (tender === 0 && gfc === 0) return null;
                  const variance = gfc - tender;
                  const variancePct = tender > 0 ? (variance / tender) * 100 : 0;
                  const spent = (rowsByCategory[cat] ?? []).reduce(
                    (s, r) => s + (r._source === "grn" ? Number(r.basic_amount_excl_gst || 0) : Number((r as ManualEntry).amount_excl_gst || 0)), 0
                  );
                  const balanceGfc = gfc - spent;

                  const amberFlag = tender > 0 && variancePct > 10;
                  const redFlag = spent > gfc && gfc > 0;

                  return (
                    <tr key={cat} className="border-b" style={redFlag ? { backgroundColor: "#FEE2E2" } : amberFlag ? { backgroundColor: "#FFF8E8" } : {}}>
                      <td className="px-3 py-1.5 font-medium">
                        {cat}
                        {redFlag && <AlertTriangle className="h-3 w-3 inline ml-1" style={{ color: "#F40009" }} />}
                        {amberFlag && !redFlag && <AlertTriangle className="h-3 w-3 inline ml-1" style={{ color: "#D4860A" }} />}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(tender)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(gfc)}</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: variance > 0 ? "#F40009" : "#006039" }}>{fmtINR(variance)}</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: variancePct > 10 ? "#D4860A" : "#1A1A1A" }}>{variancePct.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(spent)}</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: balanceGfc >= 0 ? "#006039" : "#F40009" }}>{fmtINR(balanceGfc)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Top summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<IndianRupee className="h-4 w-4" />} label="Contract Value" value={fmtINR(contractValue)} />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="GFC Budget" value={fmtINR(totalBudget)} />
        <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Actually Spent" value={fmtINR(totalSpent)} />
        <SummaryCard
          icon={balance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          label="Balance"
          value={fmtINR(balance)}
          tone={balance >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Margin vs Contract"
          value={`${marginPct.toFixed(1)}%`}
          tone={marginPct >= 20 ? "good" : marginPct >= 10 ? "warn" : "bad"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Manual Entry
          </Button>
        )}
        <button
          onClick={() => navigate(`/procurement?tab=grn&project=${projectId}`)}
          className="text-xs font-medium flex items-center gap-1 hover:underline"
          style={{ color: "#006039" }}
        >
          View all GRNs for this project →
        </button>
      </div>

      {/* Per-category tables */}
      <div className="space-y-3">
        {BOQ_CATEGORIES.map((cat) => {
          const rows = rowsByCategory[cat] ?? [];
          const budget = budgetByCategory[cat] ?? 0;
          const spent = rows.reduce(
            (s, r) => s + (r._source === "grn" ? Number(r.basic_amount_excl_gst || 0) : Number((r as ManualEntry).amount_excl_gst || 0)),
            0,
          );
          const committed = woCommitted[cat] ?? 0;
          const bal = budget - spent - committed;
          if (rows.length === 0 && budget === 0 && committed === 0) return null;

          return (
            <Card key={cat}>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#006039", color: "white" }}>
                      <th colSpan={6} className="text-left px-3 py-2 font-display font-semibold text-sm">{cat}</th>
                    </tr>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-3 py-1.5 font-medium">Vendor</th>
                      <th className="text-left px-3 py-1.5 font-medium">Invoice No</th>
                      <th className="text-left px-3 py-1.5 font-medium">Date</th>
                      <th className="text-left px-3 py-1.5 font-medium">Description</th>
                      <th className="text-right px-3 py-1.5 font-medium">Amount excl GST</th>
                      <th className="text-left px-3 py-1.5 font-medium">Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={6} className="px-3 py-3 text-center text-muted-foreground italic">No entries yet</td></tr>
                    ) : rows.map((r) => {
                      const amt = r._source === "grn" ? r.basic_amount_excl_gst : (r as ManualEntry).amount_excl_gst;
                      const date = r._source === "grn" ? r.invoice_date : (r as ManualEntry).entry_date;
                      return (
                        <tr key={r.id} className={`border-b ${r._source === "manual" ? "bg-muted/40" : ""}`}>
                          <td className="px-3 py-1.5">{r.vendor_name ?? "—"}</td>
                          <td className="px-3 py-1.5">{r.invoice_no ?? "—"}</td>
                          <td className="px-3 py-1.5">{date ? format(new Date(date), "dd MMM yy") : "—"}</td>
                          <td className="px-3 py-1.5">
                            {r.description ?? "—"}
                            {r._source === "manual" && <Badge variant="outline" className="ml-2 text-[10px]">Manual</Badge>}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">{fmtINR(Number(amt) || 0)}</td>
                          <td className="px-3 py-1.5">{r.remark ?? "—"}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/60 font-medium">
                      <td colSpan={4} className="px-3 py-1.5 text-right">Total Spent (GRNs + Manual)</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(spent)}</td>
                      <td />
                    </tr>
                    <tr className="font-medium" style={{ color: "#D4860A" }}>
                      <td colSpan={4} className="px-3 py-1.5 text-right">Committed (Approved Work Orders)</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(committed)}</td>
                      <td />
                    </tr>
                    <tr className="font-medium">
                      <td colSpan={4} className="px-3 py-1.5 text-right">GFC Budget Allocated</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtINR(budget)}</td>
                      <td />
                    </tr>
                    <tr className="font-semibold border-t-2">
                      <td colSpan={4} className="px-3 py-1.5 text-right">Balance (Budget − Spent − Committed)</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: bal >= 0 ? "#006039" : "#F40009" }}>
                        {fmtINR(bal)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Project-level Work Orders */}
      <div className="pt-2 border-t">
        <WorkOrdersTab mode="project" projectId={projectId} />
      </div>

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} projectId={projectId} onSaved={fetchAll} />
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "good" ? "#006039" : tone === "bad" ? "#F40009" : tone === "warn" ? "#D4860A" : "#1A1A1A";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">{icon}<span>{label}</span></div>
        <div className="text-base font-display font-bold font-mono" style={{ color }}>{value}</div>
      </CardContent>
    </Card>
  );
}



function ManualEntryDialog({ open, onOpenChange, projectId, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    boq_category: "Miscellaneous", vendor_name: "", invoice_no: "",
    entry_date: format(new Date(), "yyyy-MM-dd"), description: "", amount_excl_gst: "", remark: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.amount_excl_gst) { toast.error("Amount required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let name: string | null = null;
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", user.id).maybeSingle();
      name = (prof as any)?.full_name ?? user.email ?? null;
    }
    const { error } = await (supabase.from("project_budget_manual_entries" as any) as any).insert({
      project_id: projectId,
      boq_category: form.boq_category,
      vendor_name: form.vendor_name.trim() || null,
      invoice_no: form.invoice_no.trim() || null,
      entry_date: form.entry_date,
      description: form.description.trim() || null,
      amount_excl_gst: Number(form.amount_excl_gst) || 0,
      remark: form.remark.trim() || null,
      created_by: user?.id ?? null,
      created_by_name: name,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Manual entry added");
    onOpenChange(false);
    setForm({ ...form, vendor_name: "", invoice_no: "", description: "", amount_excl_gst: "", remark: "" });
    onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display">Manual Budget Entry</SheetTitle></SheetHeader>
        <div className="space-y-3 py-4">
          <Field label="BOQ Category">
            <Select value={form.boq_category} onValueChange={(v) => setForm({ ...form, boq_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOQ_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vendor"><Input value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Invoice No"><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
            <Field label="Date"><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Amount excl GST *"><Input type="number" inputMode="decimal" value={form.amount_excl_gst} onChange={(e) => setForm({ ...form, amount_excl_gst: e.target.value })} /></Field>
          <Field label="Remark"><Input value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} /></Field>
        </div>
        <SheetFooter><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
