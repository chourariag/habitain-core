import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

const EDIT_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","planning_head"];

const MONTHS = ["apr","may","jun","jul","aug","sep","oct","nov","dec","jan","feb","mar"];
const MONTH_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const CATEGORIES: { value: string; label: string }[] = [
  { value: "3d_factory", label: "Habitainer Factory — 3D" },
  { value: "2d_factory", label: "Habitainer Factory — 2D" },
  { value: "on_site", label: "On-Site Works" },
  { value: "outsourced", label: "Outsourced Contractors" },
];

const STATUSES = ["GFC","Design","Tender","On Hold","Completed"];

const statusStyle = (s: string): React.CSSProperties => {
  switch (s) {
    case "GFC": return { backgroundColor: "#E8F2ED", color: "#006039" };
    case "Design": return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    case "Tender": return { backgroundColor: "#F0F0F0", color: "#666666" };
    case "On Hold": return { backgroundColor: "#FFF0F0", color: "#F40009" };
    case "Completed": return { backgroundColor: "#E8F2ED", color: "#006039" };
    default: return {};
  }
};

interface Row {
  id: string; project_id: string | null; project_name: string;
  category: string; status: string | null; tech_type: string | null;
  contract_value_cr: number; modules_count: number; sqft: number; location: string | null;
  monthly_output: Record<string, number>; notes: string | null; financial_year: string;
}

function currentFY(): string {
  const d = new Date();
  const y = d.getFullYear();
  const start = d.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

const blankForm = {
  project_id: "", project_name: "", category: "3d_factory", status: "Design",
  tech_type: "3D", contract_value_cr: "", modules_count: "", sqft: "", location: "", notes: "",
};

export function OrderBookTab({ projects }: { projects: { id: string; name: string }[] }) {
  const { role } = useUserRole();
  const canEdit = EDIT_ROLES.includes(role ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [fy, setFy] = useState(currentFY());
  const [view, setView] = useState<"table" | "gantt">("table");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(blankForm);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("order_book" as any) as any)
      .select("*").eq("is_archived", false).eq("financial_year", fy).order("display_order");
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [fy]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const summary = useMemo(() => {
    const closed = rows.filter((r) => r.status === "Completed").reduce((s, r) => s + Number(r.contract_value_cr || 0), 0);
    const forecast = rows.reduce((s, r) => s + Number(r.contract_value_cr || 0), 0);
    const sqft = rows.reduce((s, r) => s + Number(r.sqft || 0), 0);
    return {
      closed, forecast, sqft,
      threeD: rows.filter((r) => r.category === "3d_factory").length,
      twoD: rows.filter((r) => r.category === "2d_factory").length,
      onSite: rows.filter((r) => r.category === "on_site").length,
      outsourced: rows.filter((r) => r.category === "outsourced").length,
    };
  }, [rows]);

  const grouped = useMemo(() => {
    const m: Record<string, Row[]> = {};
    CATEGORIES.forEach((c) => { m[c.value] = []; });
    rows.forEach((r) => { (m[r.category] ??= []).push(r); });
    return m;
  }, [rows]);

  const openAdd = () => { setEditingId(null); setForm(blankForm); setDialogOpen(true); };
  const openEdit = (r: Row) => {
    setEditingId(r.id);
    setForm({
      project_id: r.project_id ?? "", project_name: r.project_name,
      category: r.category, status: r.status ?? "Design", tech_type: r.tech_type ?? "",
      contract_value_cr: String(r.contract_value_cr ?? ""), modules_count: String(r.modules_count ?? ""),
      sqft: String(r.sqft ?? ""), location: r.location ?? "", notes: r.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.project_name.trim()) { toast.error("Project name required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      project_id: form.project_id || null,
      project_name: form.project_name.trim(),
      category: form.category,
      status: form.status || null,
      tech_type: form.tech_type || null,
      contract_value_cr: Number(form.contract_value_cr || 0),
      modules_count: Number(form.modules_count || 0),
      sqft: Number(form.sqft || 0),
      location: form.location || null,
      notes: form.notes || null,
      financial_year: fy,
    };
    const op = editingId
      ? (supabase.from("order_book" as any) as any).update(payload).eq("id", editingId)
      : (supabase.from("order_book" as any) as any).insert({ ...payload, created_by: user?.id, monthly_output: {} });
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Updated" : "Added");
    setDialogOpen(false); fetchRows();
  };

  const updateMonth = async (row: Row, month: string, value: string) => {
    const num = value === "" ? null : Number(value);
    const next = { ...(row.monthly_output ?? {}) };
    if (num == null) delete next[month]; else next[month] = num;
    const { error } = await (supabase.from("order_book" as any) as any)
      .update({ monthly_output: next }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => r.id === row.id ? { ...r, monthly_output: next } : r));
  };

  const updateNotes = async (id: string, notes: string) => {
    const { error } = await (supabase.from("order_book" as any) as any).update({ notes: notes || null }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const removeRow = async (id: string) => {
    if (!confirm("Remove this project from the order book?")) return;
    const { error } = await (supabase.from("order_book" as any) as any).update({ is_archived: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchRows();
  };

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Closed</div><div className="text-lg font-display font-bold">₹{summary.closed.toFixed(2)} Cr</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</div><div className="text-lg font-display font-bold">₹{summary.forecast.toFixed(2)} Cr</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Sqft</div><div className="text-lg font-display font-bold">{summary.sqft.toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Factory 3D</div><div className="text-lg font-display font-bold">{summary.threeD}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Factory 2D</div><div className="text-lg font-display font-bold">{summary.twoD}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">On-Site</div><div className="text-lg font-display font-bold">{summary.onSite}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Outsourced</div><div className="text-lg font-display font-bold">{summary.outsourced}</div></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">Financial Year</Label>
          <Select value={fy} onValueChange={setFy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["2024-25","2025-26","2026-27","2027-28"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">View</Label>
          <div className="flex rounded-md border">
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} style={view === "table" ? { backgroundColor: "#006039" } : {}}>Table</Button>
            <Button variant={view === "gantt" ? "default" : "ghost"} size="sm" onClick={() => setView("gantt")} style={view === "gantt" ? { backgroundColor: "#006039" } : {}}>Gantt</Button>
          </div>
        </div>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="ml-auto" style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editingId ? "Edit Project" : "Add Project"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Link to Project (optional)</Label>
                  <Select value={form.project_id} onValueChange={(v) => {
                    const p = projects.find((x) => x.id === v);
                    setForm((f: any) => ({ ...f, project_id: v, project_name: p?.name ?? f.project_name }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select project (or enter name below)" /></SelectTrigger>
                    <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2"><Label className="text-xs">Project Name</Label><Input value={form.project_name} onChange={(e) => setForm((f: any) => ({ ...f, project_name: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f: any) => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Tech</Label>
                  <Select value={form.tech_type} onValueChange={(v) => setForm((f: any) => ({ ...f, tech_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["3D","2D","1D","2D+3D"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Contract Value (₹ Cr)</Label><Input type="number" step="0.01" value={form.contract_value_cr} onChange={(e) => setForm((f: any) => ({ ...f, contract_value_cr: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Modules</Label><Input type="number" value={form.modules_count} onChange={(e) => setForm((f: any) => ({ ...f, modules_count: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Sqft</Label><Input type="number" value={form.sqft} onChange={(e) => setForm((f: any) => ({ ...f, sqft: e.target.value }))} /></div>
                <div className="space-y-1 col-span-2"><Label className="text-xs">Location</Label><Input value={form.location} onChange={(e) => setForm((f: any) => ({ ...f, location: e.target.value }))} /></div>
                <div className="space-y-1 col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full mt-3" style={{ backgroundColor: "#006039" }}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
              </Button>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
      ) : view === "table" ? (
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const items = grouped[cat.value] ?? [];
            const monthTotals: Record<string, number> = {};
            MONTHS.forEach((m) => { monthTotals[m] = items.reduce((s, r) => s + Number(r.monthly_output?.[m] || 0), 0); });
            const isCollapsed = collapsed[cat.value];
            return (
              <Card key={cat.value}>
                <CardContent className="p-0">
                  <button onClick={() => setCollapsed((c) => ({ ...c, [cat.value]: !c[cat.value] }))}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <span className="font-display font-semibold" style={{ color: "#1A1A1A" }}>{cat.label}</span>
                      <Badge variant="outline">{items.length}</Badge>
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Tech</TableHead>
                            <TableHead className="text-right">₹ Cr</TableHead>
                            <TableHead className="text-right">Mod</TableHead>
                            <TableHead className="text-right">Sqft</TableHead>
                            <TableHead>Location</TableHead>
                            {MONTH_LABELS.map((m) => <TableHead key={m} className="text-center px-2">{m}</TableHead>)}
                            <TableHead>Notes</TableHead>
                            {canEdit && <TableHead></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.length === 0 ? (
                            <TableRow><TableCell colSpan={20} className="text-center text-sm text-muted-foreground py-4">No projects in this category.</TableCell></TableRow>
                          ) : items.map((r, idx) => (
                            <TableRow key={r.id}>
                              <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell>{r.status && <Badge style={statusStyle(r.status)}>{r.status}</Badge>}</TableCell>
                              <TableCell className="text-sm font-medium">{r.project_name}</TableCell>
                              <TableCell className="text-sm">{r.tech_type ?? "—"}</TableCell>
                              <TableCell className="text-right text-sm">{Number(r.contract_value_cr || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right text-sm">{r.modules_count ?? 0}</TableCell>
                              <TableCell className="text-right text-sm">{Number(r.sqft || 0).toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-sm">{r.location ?? "—"}</TableCell>
                              {MONTHS.map((m) => (
                                <TableCell key={m} className="text-center px-1">
                                  {canEdit ? (
                                    <Input type="number" className="h-7 w-14 text-center text-xs px-1"
                                      defaultValue={r.monthly_output?.[m] ?? ""}
                                      onBlur={(e) => {
                                        const cur = r.monthly_output?.[m] ?? "";
                                        if (String(cur) !== e.target.value) updateMonth(r, m, e.target.value);
                                      }} />
                                  ) : (r.monthly_output?.[m] ?? "—")}
                                </TableCell>
                              ))}
                              <TableCell className="min-w-[140px]">
                                {canEdit ? (
                                  <Input className="h-7 text-xs" defaultValue={r.notes ?? ""} onBlur={(e) => { if (e.target.value !== (r.notes ?? "")) updateNotes(r.id, e.target.value); }} />
                                ) : (r.notes ?? "—")}
                              </TableCell>
                              {canEdit && (
                                <TableCell className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {items.length > 0 && (
                            <TableRow className="bg-muted/30 font-semibold">
                              <TableCell colSpan={8} className="text-right text-xs uppercase tracking-wider">Monthly Output</TableCell>
                              {MONTHS.map((m) => <TableCell key={m} className="text-center text-sm">{monthTotals[m] || ""}</TableCell>)}
                              <TableCell colSpan={canEdit ? 2 : 1}></TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        // Gantt view
        <Card>
          <CardContent className="p-4 overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid items-center gap-1 mb-2 text-xs font-semibold text-muted-foreground" style={{ gridTemplateColumns: `220px repeat(12, 1fr)` }}>
                <div>Project</div>
                {MONTH_LABELS.map((m) => <div key={m} className="text-center">{m}</div>)}
              </div>
              {rows.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No projects to chart.</div>
              ) : rows.map((r) => {
                const months = MONTHS.map((m, i) => ({ m, i, val: Number(r.monthly_output?.[m] || 0) }));
                const active = months.filter((x) => x.val > 0);
                const first = active.length ? Math.min(...active.map((x) => x.i)) : -1;
                const last = active.length ? Math.max(...active.map((x) => x.i)) : -1;
                const color = r.status === "GFC" || r.status === "Completed" ? "#006039"
                  : r.status === "Design" ? "#D4860A"
                  : r.status === "On Hold" ? "#F40009" : "#999999";
                return (
                  <div key={r.id} className="grid items-center gap-1 py-1.5 border-t" style={{ gridTemplateColumns: `220px repeat(12, 1fr)` }}>
                    <div className="text-sm font-medium truncate pr-2">{r.project_name}</div>
                    {MONTHS.map((_, i) => {
                      const isStart = i === first;
                      const inRange = first >= 0 && i >= first && i <= last;
                      return (
                        <div key={i} className="h-6 relative">
                          {inRange && isStart && (
                            <div className="absolute inset-y-1 rounded text-[10px] text-white flex items-center justify-center font-semibold px-1"
                              style={{ backgroundColor: color, left: 2, right: `calc(${(last - first) * -100}% - 4px)`, width: `calc(${(last - first + 1) * 100}% - 4px)` }}>
                              {r.status}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
