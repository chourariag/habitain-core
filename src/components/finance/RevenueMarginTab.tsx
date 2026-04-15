import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { Download, Search, Save, Loader2 } from "lucide-react";

const ACCESS_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
  "sales_director", "architecture_director",
];
const EDIT_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
];

const SITE_MANAGERS = ["All", "Azad", "Awaiz", "Bala", "Naik"];

interface ProjectRow {
  project_id: string;
  project_code: string;
  project_name: string;
  site_manager: string;
  original_valuation: number;
  billed_revenue_incl_gst: number;
  received_value_incl_gst: number;
  cost_to_date: number;
  expected_final_cost: number;
  anticipated_margin: number;
  tender_margin_pct: number | null;
  gfc_margin_pct: number | null;
  actual_margin_pct: number;
  planned_delivery: string | null;
  actual_delivery: string | null;
  planned_handover: string | null;
  actual_handover: string | null;
  expected_variations: number;
  anticipated_revenue: number;
  remaining_to_claim: number;
  notes: string | null;
  status: string;
}

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n || 0).toFixed(1) + "%";
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
};

function marginBg(pct: number) {
  if (pct >= 30) return { backgroundColor: "#E8F2ED", color: "#006039" };
  if (pct >= 20) return {};
  if (pct >= 10) return { backgroundColor: "#FFF3CD", color: "#D4860A" };
  return { backgroundColor: "#FFE8E8", color: "#F40009" };
}

function deliveryDot(planned: string | null, actual: string | null) {
  if (!planned) return { color: "#999", label: "—" };
  if (!actual) return { color: "#999", label: "—" };
  const diff = differenceInDays(parseISO(actual), parseISO(planned));
  if (diff <= 0) return { color: "#006039", label: "●" };
  if (diff <= 7) return { color: "#D4860A", label: "●" };
  return { color: "#F40009", label: "●" };
}

export function RevenueMarginTab() {
  const { role, userId } = useUserRole();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<ProjectRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editCost, setEditCost] = useState("");
  const [editDelivery, setEditDelivery] = useState("");
  const [editHandover, setEditHandover] = useState("");
  const [editVariations, setEditVariations] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [filterManager, setFilterManager] = useState("All");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const hasAccess = ACCESS_ROLES.includes(role || "");
  const canEdit = EDIT_ROLES.includes(role || "");

  const loadData = useCallback(async () => {
    setLoading(true);

    const [projRes, rmRes, msRes, mrsRes, actualsRes] = await Promise.all([
      supabase.from("projects").select("id, name, status, contract_value, start_date, est_completion, client_name")
        .eq("is_archived", false)
        .in("status", ["active", "in_progress", "completed", "on_hold"]),
      supabase.from("project_revenue_margin").select("*"),
      supabase.from("project_billing_milestones").select("project_id, status, amount_excl_gst, amount_incl_gst"),
      supabase.from("material_requests").select("project_id, quantity, unit_cost"),
      supabase.from("daily_actuals").select("project_id, hours_worked"),
    ]);

    const projects = projRes.data || [];
    const rmData = rmRes.data || [];
    const milestones = (msRes.data || []) as any[];
    const mrs = mrsRes.data || [];
    const actuals = actualsRes.data || [];

    // Maps
    const rmMap: Record<string, any> = {};
    rmData.forEach((r: any) => { rmMap[r.project_id] = r; });

    const billedMap: Record<string, number> = {};
    const receivedMap: Record<string, number> = {};
    milestones.forEach((m: any) => {
      if (!m.project_id) return;
      if (m.status === "billed" || m.status === "received") {
        billedMap[m.project_id] = (billedMap[m.project_id] || 0) + Number(m.amount_incl_gst || 0);
      }
      if (m.status === "received") {
        receivedMap[m.project_id] = (receivedMap[m.project_id] || 0) + Number(m.amount_incl_gst || 0);
      }
    });

    const matMap: Record<string, number> = {};
    mrs.forEach((r: any) => {
      if (r.project_id) matMap[r.project_id] = (matMap[r.project_id] || 0) + ((r.quantity || 0) * (r.unit_cost || 0));
    });

    const labourMap: Record<string, number> = {};
    actuals.forEach((a: any) => {
      if (a.project_id) labourMap[a.project_id] = (labourMap[a.project_id] || 0) + ((a.hours_worked || 0) * 250);
    });

    const built: ProjectRow[] = projects.map((p: any) => {
      const rm = rmMap[p.id] || {};
      const originalVal = Number(rm.original_valuation) || Number(p.contract_value) || 0;
      const expectedCost = Number(rm.expected_final_cost) || 0;
      const expectedVar = Number(rm.expected_variations) || 0;
      const anticipatedRevenue = originalVal + expectedVar;
      const costToDate = (matMap[p.id] || 0) + (labourMap[p.id] || 0);
      const billedRev = billedMap[p.id] || 0;
      const receivedVal = receivedMap[p.id] || 0;
      const anticipatedMargin = anticipatedRevenue - (expectedCost || costToDate);
      const actualMarginPct = anticipatedRevenue > 0 ? ((anticipatedRevenue - costToDate) / anticipatedRevenue) * 100 : 0;
      const remainingToClaim = billedRev - receivedVal > 0 ? billedRev - receivedVal : anticipatedRevenue * 1.18 - billedRev;

      return {
        project_id: p.id,
        project_code: p.name?.split(" ")[0] || p.id.slice(0, 8),
        project_name: p.name || "",
        site_manager: "—",
        original_valuation: originalVal,
        billed_revenue_incl_gst: billedRev,
        received_value_incl_gst: receivedVal,
        cost_to_date: costToDate,
        expected_final_cost: expectedCost,
        anticipated_margin: anticipatedMargin,
        tender_margin_pct: rm.tender_margin_pct ?? null,
        gfc_margin_pct: rm.gfc_margin_pct ?? null,
        actual_margin_pct: actualMarginPct,
        planned_delivery: p.est_completion || null,
        actual_delivery: rm.anticipated_delivery_date || null,
        planned_handover: p.est_completion || null,
        actual_handover: rm.anticipated_handover_date || null,
        expected_variations: expectedVar,
        anticipated_revenue: anticipatedRevenue,
        remaining_to_claim: Math.max(0, remainingToClaim),
        notes: rm.notes || null,
        status: p.status || "active",
      };
    });

    setRows(built);
    setLoading(false);
  }, []);

  useEffect(() => { if (hasAccess) loadData(); }, [hasAccess, loadData]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.project_name.toLowerCase().includes(q) || r.project_code.toLowerCase().includes(q));
    }
    if (filterManager !== "All") result = result.filter(r => r.site_manager === filterManager);
    if (filterStatus !== "all") result = result.filter(r => r.status === filterStatus);

    result = [...result].sort((a, b) => {
      if (sortBy === "margin_asc") return a.actual_margin_pct - b.actual_margin_pct;
      if (sortBy === "margin_desc") return b.actual_margin_pct - a.actual_margin_pct;
      if (sortBy === "remaining") return b.remaining_to_claim - a.remaining_to_claim;
      if (sortBy === "delivery") return (a.planned_delivery || "").localeCompare(b.planned_delivery || "");
      return a.project_name.localeCompare(b.project_name);
    });
    return result;
  }, [rows, search, filterManager, filterStatus, sortBy]);

  // Totals
  const totals = useMemo(() => {
    const active = filtered;
    const totalRevenue = active.reduce((s, r) => s + r.anticipated_revenue, 0);
    const totalCost = active.reduce((s, r) => s + (r.expected_final_cost || r.cost_to_date), 0);
    return {
      count: active.length,
      anticipatedRevenue: totalRevenue,
      received: active.reduce((s, r) => s + r.received_value_incl_gst, 0),
      companyMargin: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      originalVal: active.reduce((s, r) => s + r.original_valuation, 0),
      billed: active.reduce((s, r) => s + r.billed_revenue_incl_gst, 0),
      costToDate: active.reduce((s, r) => s + r.cost_to_date, 0),
      expectedCost: active.reduce((s, r) => s + r.expected_final_cost, 0),
      anticipatedMargin: active.reduce((s, r) => s + r.anticipated_margin, 0),
      remaining: active.reduce((s, r) => s + r.remaining_to_claim, 0),
    };
  }, [filtered]);

  function openEdit(row: ProjectRow) {
    setEditRow(row);
    setEditCost(String(row.expected_final_cost || ""));
    setEditDelivery(row.actual_delivery || "");
    setEditHandover(row.actual_handover || "");
    setEditVariations(String(row.expected_variations || ""));
    setEditNotes(row.notes || "");
  }

  async function handleSave() {
    if (!editRow) return;
    setSaving(true);

    const payload = {
      project_id: editRow.project_id,
      original_valuation: editRow.original_valuation,
      expected_final_cost: parseFloat(editCost) || 0,
      anticipated_delivery_date: editDelivery || null,
      anticipated_handover_date: editHandover || null,
      expected_variations: parseFloat(editVariations) || 0,
      notes: editNotes.slice(0, 50) || null,
      tender_margin_pct: editRow.tender_margin_pct,
      gfc_margin_pct: editRow.gfc_margin_pct,
    };

    const { error } = await supabase.from("project_revenue_margin").upsert(payload as any, { onConflict: "project_id" });
    if (error) { toast.error(error.message); setSaving(false); return; }

    toast.success("Updated");
    setSaving(false);
    setEditRow(null);
    loadData();
  }

  async function exportToExcel() {
    const headers = [
      "Project Code", "Project Name", "Site Manager", "Original Valuation (₹)",
      "Billed Revenue incl GST (₹)", "Received Value incl GST (₹)", "Cost to Date (₹)",
      "Expected Final Cost (₹)", "Anticipated Margin (₹)", "Tender Margin %",
      "GFC Margin %", "Actual Margin %", "Planned Delivery", "Actual Delivery",
      "Planned Handover", "Actual Handover", "Expected Variations (₹)",
      "Anticipated Revenue (₹)", "Remaining to Claim (₹)", "Notes",
    ];

    const csvRows = [headers.join(",")];
    filtered.forEach(r => {
      csvRows.push([
        r.project_code, `"${r.project_name}"`, r.site_manager,
        r.original_valuation, r.billed_revenue_incl_gst, r.received_value_incl_gst,
        r.cost_to_date, r.expected_final_cost, r.anticipated_margin,
        r.tender_margin_pct ?? "", r.gfc_margin_pct ?? "",
        r.actual_margin_pct.toFixed(1), fmtDate(r.planned_delivery),
        fmtDate(r.actual_delivery), fmtDate(r.planned_handover),
        fmtDate(r.actual_handover), r.expected_variations,
        r.anticipated_revenue, r.remaining_to_claim, `"${r.notes || ""}"`,
      ].join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Revenue_and_Margin_Sheet_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  }

  if (!hasAccess) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Access restricted to MD, Directors, and Finance Manager.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Projects", value: String(totals.count) },
          { label: "Anticipated Revenue", value: fmt(totals.anticipatedRevenue) },
          { label: "Received to Date", value: fmt(totals.received) },
          { label: "Company Margin %", value: fmtPct(totals.companyMargin) },
        ].map(t => (
          <Card key={t.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className="text-xl font-bold font-display mt-1" style={{ color: "#006039" }}>{t.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input placeholder="Search project…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 w-48 text-sm" />
        </div>
        <Select value={filterManager} onValueChange={setFilterManager}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SITE_MANAGERS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="margin_asc">Margin % (Low→High)</SelectItem>
            <SelectItem value="margin_desc">Margin % (High→Low)</SelectItem>
            <SelectItem value="remaining">Remaining to Claim</SelectItem>
            <SelectItem value="delivery">Delivery Date</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={exportToExcel} className="ml-auto h-9">
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto border rounded-lg" style={{ borderColor: "hsl(var(--border))" }}>
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-muted/50 border-b">
              {["Code", "Project", "Manager", "Original Val", "Billed (GST)", "Received (GST)",
                "Cost to Date", "Exp. Cost", "Ant. Margin", "Tender %", "GFC %", "Actual %",
                "Plan Del.", "Act. Del.", "Plan Hand.", "Act. Hand.",
                "Exp. Var.", "Ant. Revenue", "Remaining", "Notes"].map(h => (
                <th key={h} className="px-2 py-2 text-left font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={20} className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={20} className="text-center py-8 text-muted-foreground">No projects found</td></tr>
            ) : (
              filtered.map(r => {
                const mStyle = marginBg(r.actual_margin_pct);
                const delDot = deliveryDot(r.planned_delivery, r.actual_delivery);
                const handDot = deliveryDot(r.planned_handover, r.actual_handover);
                return (
                  <tr key={r.project_id}
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => canEdit && openEdit(r)}>
                    <td className="px-2 py-2 font-mono text-[11px]">{r.project_code}</td>
                    <td className="px-2 py-2 font-medium max-w-[160px] truncate">{r.project_name}</td>
                    <td className="px-2 py-2">{r.site_manager}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.original_valuation)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.billed_revenue_incl_gst)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.received_value_incl_gst)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.cost_to_date)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.expected_final_cost)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{fmt(r.anticipated_margin)}</td>
                    <td className="px-2 py-2 text-right">{r.tender_margin_pct != null ? fmtPct(r.tender_margin_pct) : "—"}</td>
                    <td className="px-2 py-2 text-right">{r.gfc_margin_pct != null ? fmtPct(r.gfc_margin_pct) : "—"}</td>
                    <td className="px-2 py-2 text-right font-bold rounded" style={mStyle}>{fmtPct(r.actual_margin_pct)}</td>
                    <td className="px-2 py-2">{fmtDate(r.planned_delivery)}</td>
                    <td className="px-2 py-2">
                      <span style={{ color: delDot.color }}>{delDot.label}</span>{" "}{fmtDate(r.actual_delivery)}
                    </td>
                    <td className="px-2 py-2">{fmtDate(r.planned_handover)}</td>
                    <td className="px-2 py-2">
                      <span style={{ color: handDot.color }}>{handDot.label}</span>{" "}{fmtDate(r.actual_handover)}
                    </td>
                    <td className="px-2 py-2 text-right">{fmt(r.expected_variations)}</td>
                    <td className="px-2 py-2 text-right font-semibold">{fmt(r.anticipated_revenue)}</td>
                    <td className="px-2 py-2 text-right">{fmt(r.remaining_to_claim)}</td>
                    <td className="px-2 py-2 max-w-[100px] truncate text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {/* Sticky Footer Totals */}
          {filtered.length > 0 && (
            <tfoot>
              <tr className="bg-muted/50 border-t font-semibold text-xs sticky bottom-0">
                <td className="px-2 py-2" colSpan={3}>Totals</td>
                <td className="px-2 py-2 text-right">{fmt(totals.originalVal)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.billed)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.received)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.costToDate)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.expectedCost)}</td>
                <td className="px-2 py-2 text-right">{fmt(totals.anticipatedMargin)}</td>
                <td className="px-2 py-2" colSpan={2} />
                <td className="px-2 py-2 text-right font-bold" style={{ color: "#006039" }}>{fmtPct(totals.companyMargin)}</td>
                <td className="px-2 py-2" colSpan={6} />
                <td className="px-2 py-2 text-right">{fmt(totals.remaining)}</td>
                <td className="px-2 py-2" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Edit Panel */}
      <Sheet open={!!editRow} onOpenChange={() => setEditRow(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {editRow && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{editRow.project_name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Original Valuation", fmt(editRow.original_valuation)],
                    ["Billed Revenue", fmt(editRow.billed_revenue_incl_gst)],
                    ["Received Value", fmt(editRow.received_value_incl_gst)],
                    ["Cost to Date", fmt(editRow.cost_to_date)],
                  ].map(([label, val]) => (
                    <div key={label as string} className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold text-foreground">{val}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Expected Final Cost (₹)</Label>
                    <Input type="number" value={editCost} onChange={e => setEditCost(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Anticipated Delivery Date</Label>
                    <Input type="date" value={editDelivery} onChange={e => setEditDelivery(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Anticipated Handover Date</Label>
                    <Input type="date" value={editHandover} onChange={e => setEditHandover(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Expected Variations (₹)</Label>
                    <Input type="number" value={editVariations} onChange={e => setEditVariations(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Notes (max 50 chars)</Label>
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value.slice(0, 50))}
                      maxLength={50} className="h-16" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">{editNotes.length}/50</p>
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full">
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
