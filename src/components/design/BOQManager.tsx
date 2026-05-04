import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, Download, AlertTriangle, FileText, Loader2, Eye, List, History } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";

const CATEGORIES = [
  "Structure", "Insulation", "Wall Boarding", "Ceiling", "Flooring",
  "Openings (Doors & Windows)", "Cladding", "Painting", "Waterproofing",
  "MEP Electrical", "MEP Plumbing", "Civil", "Miscellaneous",
];

const UPLOAD_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
  "planning_engineer", "architecture_director", "project_architect", "principal_architect",
  "costing_engineer", "quantity_surveyor",
];

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n || 0).toFixed(1) + "%";

interface BoqItem {
  sno: number;
  category: string;
  item_description: string;
  unit: string;
  tender_qty: number;
  actual_qty: number;
  wastage_pct: number;
  boq_qty: number;
  material_rate: number;
  labour_rate: number;
  oh_rate: number;
  boq_rate: number;
  total_amount: number;
  margin_pct: number | null;
  scope: string;
  procured_qty: number;
}

interface BoqVersion {
  id: string;
  version_number: number;
  uploaded_by_name: string | null;
  uploaded_at: string;
  total_boq_value: number;
  blended_margin_pct: number;
  factory_scope_value: number;
  civil_scope_value: number;
}

interface Props {
  projectId: string;
}

export function BOQManager({ projectId }: Props) {
  const { role, userId } = useUserRole();
  const fileRef = useRef<HTMLInputElement>(null);

  const [versions, setVersions] = useState<BoqVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<BoqVersion | null>(null);
  const [items, setItems] = useState<BoqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<"summary" | "detail">("summary");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [pendingItems, setPendingItems] = useState<BoqItem[] | null>(null);
  const [pendingSummary, setPendingSummary] = useState<{ total: number; margin: number; factory: number; civil: number } | null>(null);

  const canUpload = UPLOAD_ROLES.includes(role || "");

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: boqs } = await supabase
      .from("project_boq")
      .select("*")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false });

    const vList = (boqs || []).map((b: any) => ({
      id: b.id,
      version_number: b.version_number,
      uploaded_by_name: b.uploaded_by_name,
      uploaded_at: b.uploaded_at,
      total_boq_value: Number(b.total_boq_value),
      blended_margin_pct: Number(b.blended_margin_pct),
      factory_scope_value: Number(b.factory_scope_value),
      civil_scope_value: Number(b.civil_scope_value),
    }));
    setVersions(vList);

    if (vList.length > 0) {
      const latest = vList[0];
      setActiveVersion(latest);
      await loadItems(latest.id);
    }
    setLoading(false);
  }, [projectId]);

  async function loadItems(boqId: string) {
    const { data } = await supabase
      .from("project_boq_items")
      .select("*")
      .eq("boq_id", boqId)
      .order("sno");
    setItems((data || []).map((d: any) => ({
      sno: d.sno,
      category: d.category,
      item_description: d.item_description,
      unit: d.unit || "",
      actual_qty: Number(d.actual_qty),
      wastage_pct: Number(d.wastage_pct),
      boq_qty: Number(d.boq_qty),
      material_rate: Number(d.material_rate),
      labour_rate: Number(d.labour_rate),
      oh_rate: Number(d.oh_rate),
      boq_rate: Number(d.boq_rate),
      total_amount: Number(d.total_amount),
      margin_pct: d.margin_pct != null ? Number(d.margin_pct) : null,
      scope: d.scope,
      procured_qty: Number(d.procured_qty),
    })));
  }

  useEffect(() => { loadData(); }, [loadData]);

  function downloadTemplate() {
    const t = TEMPLATES.boq;
    downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample);
    toast.success("Template downloaded");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Only .xlsx files are accepted");
      return;
    }
    parseFile(file);
    e.target.value = "";
  }

  async function parseFile(file: File) {
    setUploading(true);
    setValidationErrors([]);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find header row
      const headerIdx = rows.findIndex(r => r.some((c: any) => String(c).toLowerCase().includes("item description")));
      if (headerIdx === -1) { toast.error("Could not find header row with 'Item Description'"); setUploading(false); return; }

      const dataRows = rows.slice(headerIdx + 1);
      const errors: string[] = [];
      const parsed: BoqItem[] = [];
      let sno = 0;

      dataRows.forEach((r, ri) => {
        const desc = String(r[2] || "").trim();
        if (!desc) return; // skip blank

        sno++;
        // Columns: 0=S.No, 1=Category, 2=Item Description, 3=Unit, 4=Tender Qty,
        // 5=Actual Qty, 6=Wastage %, 7=BOQ Qty, 8=Material Rate, 9=Labour Rate,
        // 10=OH Rate, 11=BOQ Rate, 12=Total Amount, 13=Margin %, 14=Scope
        const tenderQty = Number(r[4]) || 0;
        const actualQty = Number(r[5]) || 0;
        const wastagePct = Number(r[6]) || 0;
        const boqQty = Number(r[7]) || (actualQty * (1 + wastagePct / 100));
        const matRate = Number(r[8]) || 0;
        const labRate = Number(r[9]) || 0;
        const ohRate = Number(r[10]) || 0;
        const boqRate = Number(r[11]) || (matRate + labRate + ohRate);
        const totalAmt = Number(r[12]) || (boqQty * boqRate);
        const marginPct = r[13] != null && r[13] !== "" ? Number(r[13]) : null;
        const scope = String(r[14] || "Factory").trim();
        const category = String(r[1] || "Miscellaneous").trim();

        if (boqRate === 0) errors.push(`Row ${ri + headerIdx + 2}: "${desc}" has BOQ Rate = 0`);
        if (marginPct == null) errors.push(`Row ${ri + headerIdx + 2}: "${desc}" has blank Margin %`);
        if (!["Factory", "On-Site Civil", "Both"].includes(scope)) {
          errors.push(`Row ${ri + headerIdx + 2}: "${desc}" has invalid Scope "${scope}"`);
        }

        parsed.push({
          sno, category, item_description: desc, unit: String(r[3] || ""),
          tender_qty: tenderQty,
          actual_qty: actualQty, wastage_pct: wastagePct, boq_qty: boqQty,
          material_rate: matRate, labour_rate: labRate, oh_rate: ohRate,
          boq_rate: boqRate, total_amount: totalAmt, margin_pct: marginPct,
          scope, procured_qty: 0,
        });
      });

      if (parsed.length === 0) { toast.error("No valid rows found"); setUploading(false); return; }

      const total = parsed.reduce((s, i) => s + i.total_amount, 0);
      const marginAmt = parsed.reduce((s, i) => {
        if (i.margin_pct == null) return s;
        return s + (i.total_amount * i.margin_pct / 100);
      }, 0);
      const blended = total > 0 ? (marginAmt / total) * 100 : 0;
      const factory = parsed.filter(i => i.scope === "Factory" || i.scope === "Both").reduce((s, i) => s + i.total_amount, 0);
      const civil = parsed.filter(i => i.scope === "On-Site Civil" || i.scope === "Both").reduce((s, i) => s + i.total_amount, 0);

      setValidationErrors(errors);
      setPendingItems(parsed);
      setPendingSummary({ total, margin: blended, factory, civil });
    } catch (err: any) {
      toast.error("Failed to parse file: " + (err?.message || "Unknown error"));
    }
    setUploading(false);
  }

  async function confirmUpload() {
    if (!pendingItems || !pendingSummary) return;
    setUploading(true);

    const { data: profile } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", profile?.user?.id || "").maybeSingle();

    const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1;

    const { data: boq, error: boqErr } = await supabase.from("project_boq").insert({
      project_id: projectId,
      version_number: nextVersion,
      uploaded_by: profile?.user?.id || null,
      uploaded_by_name: (prof as any)?.full_name || profile?.user?.email || "Unknown",
      total_boq_value: pendingSummary.total,
      blended_margin_pct: pendingSummary.margin,
      factory_scope_value: pendingSummary.factory,
      civil_scope_value: pendingSummary.civil,
    } as any).select().single();

    if (boqErr || !boq) { toast.error(boqErr?.message || "Failed to create BOQ"); setUploading(false); return; }

    const itemRows = pendingItems.map(i => ({
      boq_id: boq.id,
      sno: i.sno,
      category: i.category,
      item_description: i.item_description,
      unit: i.unit,
      actual_qty: i.actual_qty,
      wastage_pct: i.wastage_pct,
      boq_qty: i.boq_qty,
      material_rate: i.material_rate,
      labour_rate: i.labour_rate,
      oh_rate: i.oh_rate,
      boq_rate: i.boq_rate,
      total_amount: i.total_amount,
      margin_pct: i.margin_pct,
      scope: i.scope,
    }));

    // Insert in batches of 100
    for (let i = 0; i < itemRows.length; i += 100) {
      const batch = itemRows.slice(i, i + 100);
      const { error } = await supabase.from("project_boq_items").insert(batch as any);
      if (error) { toast.error(`Failed to insert items batch: ${error.message}`); setUploading(false); return; }
    }

    toast.success(`BOQ V${nextVersion} uploaded — ${pendingItems.length} items`);
    setPendingItems(null);
    setPendingSummary(null);
    setValidationErrors([]);
    setUploading(false);
    loadData();
  }

  const filteredItems = useMemo(() => {
    if (scopeFilter === "all") return items;
    return items.filter(i => i.scope === scopeFilter || i.scope === "Both");
  }, [items, scopeFilter]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    items.forEach(i => {
      if (!map[i.category]) map[i.category] = { count: 0, total: 0 };
      map[i.category].count++;
      map[i.category].total += i.total_amount;
    });
    const grandTotal = items.reduce((s, i) => s + i.total_amount, 0);
    return Object.entries(map).map(([cat, d]) => ({
      category: cat,
      count: d.count,
      total: d.total,
      pct: grandTotal > 0 ? (d.total / grandTotal) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [items]);

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Loading BOQ…</div>;

  // Pending upload confirmation
  if (pendingItems && pendingSummary) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">BOQ Upload Preview — {pendingItems.length} items parsed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Total BOQ Value</p>
                <p className="text-lg font-bold text-foreground">{fmt(pendingSummary.total)}</p>
              </div>
              <div className="p-3 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Blended Margin</p>
                <p className="text-lg font-bold text-foreground">{fmtPct(pendingSummary.margin)}</p>
              </div>
              <div className="p-3 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Factory Scope</p>
                <p className="text-lg font-bold text-foreground">{fmt(pendingSummary.factory)}</p>
              </div>
              <div className="p-3 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Civil Scope</p>
                <p className="text-lg font-bold text-foreground">{fmt(pendingSummary.civil)}</p>
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> {validationErrors.length} Validation Warning{validationErrors.length > 1 ? "s" : ""}
                </p>
                <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                  {validationErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={confirmUpload} disabled={uploading}>
                {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…</> : <><Upload className="h-4 w-4 mr-1" /> Confirm Upload</>}
              </Button>
              <Button variant="outline" onClick={() => { setPendingItems(null); setPendingSummary(null); setValidationErrors([]); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload & Template buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canUpload && (
          <>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" /> Upload BOQ
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
          </>
        )}
        <Button size="sm" variant="outline" onClick={downloadTemplate} style={{ borderColor: "#006039", color: "#006039" }}>
          <Download className="h-4 w-4 mr-1" /> Download Template
        </Button>

        {versions.length > 1 && (
          <Select
            value={activeVersion?.id || ""}
            onValueChange={v => {
              const ver = versions.find(x => x.id === v);
              if (ver) { setActiveVersion(ver); loadItems(ver.id); }
            }}
          >
            <SelectTrigger className="w-40 h-8 text-xs">
              <History className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.map(v => (
                <SelectItem key={v.id} value={v.id}>V{v.version_number} — {format(new Date(v.uploaded_at), "dd/MM/yy")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* No BOQ uploaded */}
      {!activeVersion && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No BOQ uploaded yet. Upload an Excel file to set the financial baseline.</p>
          </CardContent>
        </Card>
      )}

      {/* BOQ Summary */}
      {activeVersion && (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">V{activeVersion.version_number}</Badge>
            <span>Uploaded by {activeVersion.uploaded_by_name || "—"} on {format(new Date(activeVersion.uploaded_at), "dd/MM/yyyy HH:mm")}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total BOQ Value</p>
              <p className="text-xl font-bold font-display" style={{ color: "#006039" }}>{fmt(activeVersion.total_boq_value)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Factory Scope</p>
              <p className="text-xl font-bold font-display text-foreground">{fmt(activeVersion.factory_scope_value)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Civil Scope</p>
              <p className="text-xl font-bold font-display text-foreground">{fmt(activeVersion.civil_scope_value)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Blended Margin</p>
              <p className="text-xl font-bold font-display" style={{ color: "#006039" }}>{fmtPct(activeVersion.blended_margin_pct)}</p>
            </CardContent></Card>
          </div>

          {/* View toggle + scope filter */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")} className="h-7 text-xs">
              <Eye className="h-3 w-3 mr-1" /> Summary
            </Button>
            <Button size="sm" variant={view === "detail" ? "default" : "outline"} onClick={() => setView("detail")} className="h-7 text-xs">
              <List className="h-3 w-3 mr-1" /> Detail
            </Button>
            <Select value={scopeFilter} onValueChange={setScopeFilter}>
              <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="Factory">Factory</SelectItem>
                <SelectItem value="On-Site Civil">On-Site Civil</SelectItem>
                <SelectItem value="Both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary View */}
          {view === "summary" && (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Total (₹)</TableHead>
                    <TableHead className="text-right">% of BOQ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryBreakdown.map(c => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium text-sm">{c.category}</TableCell>
                      <TableCell className="text-center">{c.count}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(c.total)}</TableCell>
                      <TableCell className="text-right">{fmtPct(c.pct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{items.length}</TableCell>
                    <TableCell className="text-right">{fmt(activeVersion.total_boq_value)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Card>
          )}

          {/* Detail View */}
          {view === "detail" && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {["#", "Category", "Item Description", "Unit", "Actual Qty", "Wastage%", "BOQ Qty",
                      "Mat Rate", "Lab Rate", "OH Rate", "BOQ Rate", "Total ₹", "Margin%", "Scope",
                      "Procured Qty", "Variance"].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const overProcured = item.procured_qty > item.boq_qty;
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/30">
                        <td className="px-2 py-1.5">{item.sno}</td>
                        <td className="px-2 py-1.5">{item.category}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate font-medium">{item.item_description}</td>
                        <td className="px-2 py-1.5">{item.unit}</td>
                        <td className="px-2 py-1.5 text-right">{item.actual_qty}</td>
                        <td className="px-2 py-1.5 text-right">{item.wastage_pct}%</td>
                        <td className="px-2 py-1.5 text-right">{item.boq_qty}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(item.material_rate)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(item.labour_rate)}</td>
                        <td className="px-2 py-1.5 text-right">{fmt(item.oh_rate)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{fmt(item.boq_rate)}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{fmt(item.total_amount)}</td>
                        <td className="px-2 py-1.5 text-right">{item.margin_pct != null ? fmtPct(item.margin_pct) : "—"}</td>
                        <td className="px-2 py-1.5">{item.scope}</td>
                        <td className="px-2 py-1.5 text-right">{item.procured_qty}</td>
                        <td className="px-2 py-1.5 text-right">
                          {overProcured ? (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />+{(item.procured_qty - item.boq_qty).toFixed(1)}
                            </Badge>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
