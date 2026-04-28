import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { toast } from "sonner";
import { Upload, Download, Loader2, Package, CheckCircle2, Clock, AlertTriangle, FileWarning } from "lucide-react";
import { format, differenceInDays, addDays, isBefore, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { downloadXlsxTemplate, downloadMaterialPlanTemplate, TEMPLATES } from "@/lib/xlsx-templates";

const SECTIONS = ["All", "Shell and Core", "Builder Finish", "Add-ons"];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Delivered: { label: "Delivered", className: "bg-[#006039]/10 text-[#006039] border-[#006039]/20" },
  "On Track": { label: "On Track", className: "bg-blue-100 text-blue-800 border-blue-200" },
  "At Risk": { label: "At Risk", className: "bg-amber-100 text-amber-800 border-amber-200" },
  Overdue: { label: "Overdue", className: "bg-red-100 text-red-800 border-red-200" },
  "Pending PO": { label: "Pending PO", className: "bg-muted text-muted-foreground border-border" },
  Upcoming: { label: "Upcoming", className: "bg-blue-50 text-blue-700 border-blue-100" },
  Pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-100" },
};

interface MaterialItem {
  id: string;
  plan_id: string;
  item_id: string;
  section: string;
  material_description: string;
  qty_variation_note: string | null;
  tender_qty: number | null;
  unit: string | null;
  gfc_qty: number | null;
  indent_qty: number | null;
  indent_unit: string | null;
  indent_received: string | null;
  material_qty_ordered: number | null;
  planned_po_release_date: string | null;
  planned_procurement_date: string | null;
  planned_delivery_date: string | null;
  actual_po_release_date: string | null;
  actual_procurement_date: string | null;
  supplier_committed_date: string | null;
  actual_delivery_date: string | null;
  material_qty_received: number | null;
  delay_days: number;
  reason_for_delay: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
}

interface Props {
  projectId: string;
  userRole: string | null;
}

function computeStatus(item: any): string {
  if (item.actual_delivery_date) return "Delivered";
  if (!item.actual_po_release_date && !item.planned_po_release_date) return "Pending PO";
  if (!item.actual_po_release_date && item.planned_po_release_date) return "Pending PO";

  const today = new Date();
  const committed = item.supplier_committed_date ? new Date(item.supplier_committed_date) : null;
  const planned = item.planned_delivery_date ? new Date(item.planned_delivery_date) : null;

  if (committed) {
    if (isBefore(committed, today)) return "Overdue";
    if (isBefore(committed, addDays(today, 3))) return "At Risk";
    return "On Track";
  }
  if (planned) {
    if (isBefore(planned, today)) return "Pending";
    return "Upcoming";
  }
  return "Upcoming";
}

function calcDelay(item: any): number {
  if (item.actual_delivery_date && item.supplier_committed_date) {
    return differenceInDays(new Date(item.actual_delivery_date), new Date(item.supplier_committed_date));
  }
  if (!item.actual_delivery_date && item.supplier_committed_date && isBefore(new Date(item.supplier_committed_date), new Date())) {
    return differenceInDays(new Date(), new Date(item.supplier_committed_date));
  }
  return 0;
}

export function MaterialPlanTab({ projectId, userRole }: Props) {
  const [items, setItems] = useState<MaterialItem[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("All");
  const [editItem, setEditItem] = useState<MaterialItem | null>(null);
  const [editForm, setEditForm] = useState({ supplier_committed_date: "", actual_delivery_date: "", material_qty_received: "", reason_for_delay: "" });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = ["procurement", "stores_executive", "super_admin", "managing_director"].includes(userRole ?? "");
  const canEdit = ["procurement", "stores_executive", "super_admin", "managing_director"].includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: plans } = await (supabase.from("project_material_plans") as any)
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      setPlanId(plans[0].id);
      const { data: planItems } = await (supabase.from("project_material_plan_items") as any)
        .select("*")
        .eq("plan_id", plans[0].id)
        .order("item_id", { ascending: true });
      setItems(planItems ?? []);
    } else {
      setPlanId(null);
      setItems([]);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const parseDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return format(val, "yyyy-MM-dd");
    const s = String(val).trim();
    const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) {
      const yr = parts[3].length === 2 ? "20" + parts[3] : parts[3];
      return `${yr}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

        // Find header row — accept "Material", "Material Description", or "Material Name"
        const isMaterialHeader = (c: any) => {
          const v = String(c ?? "").toLowerCase().trim();
          return v === "material" || v === "material description" || v === "material name";
        };
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
          const row = rows[i];
          if (row && row.some(isMaterialHeader)) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) { toast.error("Could not find header row with 'Material', 'Material Description', or 'Material Name'"); return; }

        const headers = rows[headerIdx].map((h: any) => String(h ?? "").toLowerCase().trim());
        const col = (keywords: string[]) => headers.findIndex((h) => keywords.some((k) => h.includes(k)));
        const colExact = (values: string[]) => headers.findIndex((h) => values.includes(h));

        const colMap = {
          id: col(["id"]),
          section: col(["section"]),
          desc: (() => {
            const exact = colExact(["material", "material description", "material name"]);
            return exact !== -1 ? exact : col(["material description", "material name"]);
          })(),
          qtyVar: col(["qty variation"]),
          tenderQty: col(["tender qty", "tender quantity"]),
          unit: col(["unit"]),
          gfcQty: col(["gfc qty", "gfc quantity"]),
          indentQty: col(["indent qty"]),
          indentUnit: col(["indent unit"]),
          indentReceived: col(["indent received"]),
          orderedQty: col(["material qty ordered", "qty ordered"]),
          plannedPO: col(["planned po release"]),
          plannedProc: col(["planned procurement"]),
          plannedDel: col(["planned delivery"]),
          actualPO: col(["actual po release"]),
          actualProc: col(["actual procurement"]),
          supplierCommitted: col(["supplier committed"]),
          actualDel: col(["actual delivery"]),
          qtyReceived: col(["qty received", "material qty received"]),
          delayDays: col(["delay days"]),
          reason: col(["reason for delay"]),
          status: col(["status"]),
        };

        if (colMap.desc === -1) { toast.error("Missing 'Material' / 'Material Description' / 'Material Name' column"); return; }

        let currentSection = "Shell and Core";
        const parsed: any[] = [];

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: any) => !c || !String(c).trim())) continue;

          // Section header detection: column B empty, column C has ALL CAPS text
          const colBVal = row[1] ? String(row[1]).trim() : "";
          const colCVal = row[2] ? String(row[2]).trim() : "";
          if (!colBVal && colCVal && colCVal === colCVal.toUpperCase() && colCVal.length > 3 && !row[colMap.desc]) {
            currentSection = colCVal.split(/\s+/).map((w: string) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
            continue;
          }

          const descVal = colMap.desc >= 0 ? String(row[colMap.desc] ?? "").trim() : "";
          if (!descVal) continue;

          // Also detect section from section column if present
          if (colMap.section >= 0 && row[colMap.section]) {
            const sectionVal = String(row[colMap.section]).trim();
            if (sectionVal) currentSection = sectionVal;
          }

          const item: any = {
            item_id: colMap.id >= 0 ? String(row[colMap.id] ?? (i - headerIdx)) : String(i - headerIdx),
            section: currentSection,
            material_description: descVal,
            qty_variation_note: colMap.qtyVar >= 0 ? String(row[colMap.qtyVar] ?? "") || null : null,
            tender_qty: colMap.tenderQty >= 0 ? parseFloat(String(row[colMap.tenderQty] ?? "0")) || null : null,
            unit: colMap.unit >= 0 ? String(row[colMap.unit] ?? "") || null : null,
            gfc_qty: colMap.gfcQty >= 0 ? parseFloat(String(row[colMap.gfcQty] ?? "0")) || null : null,
            indent_qty: colMap.indentQty >= 0 ? parseFloat(String(row[colMap.indentQty] ?? "0")) || null : null,
            indent_unit: colMap.indentUnit >= 0 ? String(row[colMap.indentUnit] ?? "") || null : null,
            indent_received: colMap.indentReceived >= 0 ? String(row[colMap.indentReceived] ?? "N") : "N",
            material_qty_ordered: colMap.orderedQty >= 0 ? parseFloat(String(row[colMap.orderedQty] ?? "0")) || null : null,
            planned_po_release_date: colMap.plannedPO >= 0 ? parseDate(row[colMap.plannedPO]) : null,
            planned_procurement_date: colMap.plannedProc >= 0 ? parseDate(row[colMap.plannedProc]) : null,
            planned_delivery_date: colMap.plannedDel >= 0 ? parseDate(row[colMap.plannedDel]) : null,
            actual_po_release_date: colMap.actualPO >= 0 ? parseDate(row[colMap.actualPO]) : null,
            actual_procurement_date: colMap.actualProc >= 0 ? parseDate(row[colMap.actualProc]) : null,
            supplier_committed_date: colMap.supplierCommitted >= 0 ? parseDate(row[colMap.supplierCommitted]) : null,
            actual_delivery_date: colMap.actualDel >= 0 ? parseDate(row[colMap.actualDel]) : null,
            material_qty_received: colMap.qtyReceived >= 0 ? parseFloat(String(row[colMap.qtyReceived] ?? "0")) || null : null,
            reason_for_delay: colMap.reason >= 0 ? String(row[colMap.reason] ?? "") || null : null,
          };

          item.delay_days = calcDelay(item);
          item.status = computeStatus(item);
          parsed.push(item);
        }

        if (parsed.length === 0) { toast.error("No material items found in file"); return; }

        // Create plan header
        const { data: { user } } = await supabase.auth.getUser();
        const { data: prevPlans } = await (supabase.from("project_material_plans") as any)
          .select("version")
          .eq("project_id", projectId)
          .order("version", { ascending: false })
          .limit(1);
        const nextVersion = ((prevPlans as any)?.[0]?.version ?? 0) + 1;

        const { data: newPlan } = await (supabase.from("project_material_plans") as any)
          .insert({ project_id: projectId, version: nextVersion, uploaded_by: user?.id ?? "" })
          .select("id")
          .single();

        if (!newPlan) { toast.error("Failed to create material plan"); return; }

        // Delete old items if replacing
        if (planId) {
          await (supabase.from("project_material_plan_items") as any).delete().eq("plan_id", planId);
        }

        // Insert items in batches
        const itemsWithPlan = parsed.map((p) => ({ ...p, plan_id: newPlan.id }));
        for (let i = 0; i < itemsWithPlan.length; i += 50) {
          await (supabase.from("project_material_plan_items") as any).insert(itemsWithPlan.slice(i, i + 50));
        }

        toast.success(`${parsed.length} materials imported`);
        fetchData();
      } catch (err: any) {
        toast.error("Failed to parse: " + (err.message ?? "Unknown error"));
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = async () => {
    // Fetch project client name for header
    const { data: proj } = await supabase.from("projects").select("client_name, name").eq("id", projectId).maybeSingle();
    const clientName = (proj as any)?.client_name || (proj as any)?.name || "Project";
    const safeName = clientName.replace(/[^a-z0-9]+/gi, "_");
    downloadMaterialPlanTemplate(`Material_Plan_${safeName}.xlsx`, clientName);
  };

  const openEdit = (item: MaterialItem) => {
    setEditItem(item);
    setEditForm({
      supplier_committed_date: item.supplier_committed_date ?? "",
      actual_delivery_date: item.actual_delivery_date ?? "",
      material_qty_received: item.material_qty_received?.toString() ?? "",
      reason_for_delay: item.reason_for_delay ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    const updates: any = {
      supplier_committed_date: editForm.supplier_committed_date || null,
      actual_delivery_date: editForm.actual_delivery_date || null,
      material_qty_received: editForm.material_qty_received ? parseFloat(editForm.material_qty_received) : null,
      reason_for_delay: editForm.reason_for_delay || null,
    };
    // Recalc
    updates.delay_days = calcDelay({ ...editItem, ...updates });
    updates.status = computeStatus({ ...editItem, ...updates });

    await (supabase.from("project_material_plan_items") as any)
      .update(updates)
      .eq("id", editItem.id);
    toast.success("Updated");
    setSaving(false);
    setEditItem(null);
    fetchData();
  };

  const filtered = useMemo(() => {
    if (sectionFilter === "All") return items;
    return items.filter((i) => i.section === sectionFilter);
  }, [items, sectionFilter]);

  const summary = useMemo(() => {
    const s = { total: filtered.length, delivered: 0, pending: 0, delayed: 0 };
    filtered.forEach((i) => {
      if (i.status === "Delivered") s.delivered++;
      else if (i.status === "Overdue") s.delayed++;
      else if (i.status === "At Risk") s.delayed++;
      else s.pending++;
    });
    return s;
  }, [filtered]);

  // Due this week + overdue for mobile quick view
  const urgentItems = useMemo(() => {
    const today = new Date();
    const weekEnd = addDays(today, 7);
    return items.filter((i) => {
      if (i.status === "Delivered") return false;
      if (i.status === "Overdue" || i.status === "At Risk") return true;
      const committed = i.supplier_committed_date ? new Date(i.supplier_committed_date) : null;
      const planned = i.planned_delivery_date ? new Date(i.planned_delivery_date) : null;
      const dueDate = committed ?? planned;
      if (dueDate && isBefore(dueDate, weekEnd)) return true;
      return false;
    });
  }, [items]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const fmtDate = (d: string | null) => d ? format(new Date(d), "dd/MM/yy") : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Material Plan</h2>
        {canUpload && (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
            <Button size="sm" variant="outline" onClick={downloadTemplate} style={{ borderColor: "#006039", color: "#006039" }}><Download className="h-4 w-4 mr-1" /> Template</Button>
            <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Upload Plan</Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{canUpload ? 'No material plan uploaded. Click "Upload Plan" to import.' : "No material plan uploaded yet."}</p>
        </CardContent></Card>
      ) : (
        <>
          {/* Section tabs */}
          <ScrollableTabsWrapper>
            <div className="flex gap-1">
              {SECTIONS.map((sec) => (
                <button
                  key={sec}
                  onClick={() => setSectionFilter(sec)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    sectionFilter === sec ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                  style={sectionFilter === sec ? { backgroundColor: "hsl(var(--primary))" } : undefined}
                >
                  {sec}
                </button>
              ))}
            </div>
          </ScrollableTabsWrapper>

          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-2">
            <Card><CardContent className="pt-3 pb-2 text-center">
              <p className="text-lg font-bold text-foreground">{summary.total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </CardContent></Card>
            <Card><CardContent className="pt-3 pb-2 text-center">
              <p className="text-lg font-bold" style={{ color: "#006039" }}>{summary.delivered}</p>
              <p className="text-[10px] text-muted-foreground">Delivered</p>
            </CardContent></Card>
            <Card><CardContent className="pt-3 pb-2 text-center">
              <p className="text-lg font-bold text-foreground">{summary.pending}</p>
              <p className="text-[10px] text-muted-foreground">Pending</p>
            </CardContent></Card>
            <Card><CardContent className="pt-3 pb-2 text-center">
              <p className="text-lg font-bold" style={{ color: "#F40009" }}>{summary.delayed}</p>
              <p className="text-[10px] text-muted-foreground">Delayed</p>
            </CardContent></Card>
          </div>

          {/* Urgent items for mobile */}
          {urgentItems.length > 0 && (
            <div className="md:hidden space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Due This Week / Overdue</h3>
              {urgentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => canEdit && openEdit(item)}
                  className="w-full text-left p-3 rounded-lg border border-border bg-background space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate flex-1">{item.material_description}</p>
                    <Badge variant="outline" className={cn("text-[10px] ml-2", STATUS_CONFIG[item.status]?.className)}>
                      {item.status}
                    </Badge>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Committed: {fmtDate(item.supplier_committed_date)}</span>
                    {item.delay_days > 0 && <span style={{ color: "#F40009" }}>+{item.delay_days}d late</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Full table */}
          <div className="rounded-lg border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[40px]">ID</TableHead>
                  <TableHead className="min-w-[200px]">Material</TableHead>
                  <TableHead className="text-right">GFC Qty</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead>Planned Del.</TableHead>
                  <TableHead>Committed</TableHead>
                  <TableHead>Actual Del.</TableHead>
                  <TableHead className="text-center">Delay</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className={item.status === "Overdue" ? "bg-destructive/5" : ""}>
                    <TableCell className="text-xs text-muted-foreground">{item.item_id}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{item.material_description}</p>
                      <p className="text-[10px] text-muted-foreground">{item.section}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{item.gfc_qty ?? "—"}</TableCell>
                    <TableCell className="text-right text-sm">{item.material_qty_ordered ?? "—"}</TableCell>
                    <TableCell className="text-xs">{fmtDate(item.planned_delivery_date)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(item.supplier_committed_date)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(item.actual_delivery_date)}</TableCell>
                    <TableCell className="text-center">
                      {item.delay_days !== 0 && (
                        <span className="text-xs font-medium" style={{ color: item.delay_days > 0 ? "#F40009" : "#006039" }}>
                          {item.delay_days > 0 ? `+${item.delay_days}d` : `${item.delay_days}d`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", STATUS_CONFIG[item.status]?.className)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editItem} onOpenChange={(v) => { if (!v) setEditItem(null); }}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle className="text-sm">{editItem?.material_description}</SheetTitle>
          </SheetHeader>
          {editItem && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Supplier Committed Date</label>
                  <Input type="date" value={editForm.supplier_committed_date} onChange={(e) => setEditForm((f) => ({ ...f, supplier_committed_date: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Actual Delivery Date</label>
                  <Input type="date" value={editForm.actual_delivery_date} onChange={(e) => setEditForm((f) => ({ ...f, actual_delivery_date: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Qty Received</label>
                  <Input type="number" value={editForm.material_qty_received} onChange={(e) => setEditForm((f) => ({ ...f, material_qty_received: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-muted-foreground">Reason for Delay</label>
                  <Input value={editForm.reason_for_delay} onChange={(e) => setEditForm((f) => ({ ...f, reason_for_delay: e.target.value }))} className="h-9" placeholder="If delayed..." />
                </div>
              </div>
              <Button onClick={saveEdit} disabled={saving} className="w-full">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Update"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
