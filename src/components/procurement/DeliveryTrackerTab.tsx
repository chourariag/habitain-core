import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STANDARD_CATEGORIES = [
  "Structural Steel", "Concrete", "Internal Boarding", "Boarding & Ceiling",
  "Doors & Windows", "Wooden Doors", "Shell & Core", "Flooring", "Tiles",
  "MEP Fixtures", "Granite Countertop", "Carpentry", "Builder Finish",
  "On-Site Works", "Handover",
];

const EDIT_ROLES = ["super_admin","managing_director","procurement","stores_executive","planning_engineer","planning_head","head_operations"];
const VIEW_ROLES = [...EDIT_ROLES,"finance_director","sales_director","architecture_director","production_head","site_installation_mgr","costing_engineer"];

interface Row {
  id: string;
  project_id: string;
  material_category: string;
  planned_delivery_date: string | null;
  actual_delivery_date: string | null;
  delay_days: number | null;
  status: string;
  risk_level: string | null;
  mitigation_note: string | null;
}

interface Props { userRole: string | null; projects: { id: string; name: string }[]; }

const statusStyle = (s: string): React.CSSProperties => {
  switch (s) {
    case "On Track": return { backgroundColor: "#E8F2ED", color: "#006039" };
    case "At Risk": return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    case "Delayed": return { backgroundColor: "#FFF0F0", color: "#F40009" };
    default: return { backgroundColor: "#F0F0F0", color: "#666666" };
  }
};

export function DeliveryTrackerTab({ userRole, projects }: Props) {
  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const canView = VIEW_ROLES.includes(userRole ?? "");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [allProjects, setAllProjects] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    project_id: "", material_category: "", custom_category: "",
    planned_delivery_date: "", actual_delivery_date: "",
    risk_level: "", mitigation_note: "",
  });

  useEffect(() => {
    if (!projectId && projects.length) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const fetchRows = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    let q = (supabase.from("material_delivery_tracker" as any) as any)
      .select("*").eq("is_archived", false).order("planned_delivery_date", { ascending: true });
    if (!allProjects && projectId) q = q.eq("project_id", projectId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [allProjects, projectId, canView]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const projectsMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const summary = useMemo(() => {
    const total = rows.length;
    const onTrack = rows.filter((r) => r.status === "On Track").length;
    const atRisk = rows.filter((r) => r.status === "At Risk").length;
    const delayed = rows.filter((r) => r.status === "Delayed").length;
    const delays = rows.filter((r) => r.status === "Delayed" && r.delay_days != null).map((r) => r.delay_days as number);
    const avg = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
    return { total, onTrack, atRisk, delayed, avg };
  }, [rows]);

  const openAdd = () => {
    setForm({
      project_id: projectId || projects[0]?.id || "",
      material_category: "", custom_category: "",
      planned_delivery_date: "", actual_delivery_date: "",
      risk_level: "", mitigation_note: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const category = form.material_category === "__custom__" ? form.custom_category.trim() : form.material_category;
    if (!form.project_id || !category) { toast.error("Project and material category required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("material_delivery_tracker" as any) as any).insert({
      project_id: form.project_id,
      material_category: category,
      planned_delivery_date: form.planned_delivery_date || null,
      actual_delivery_date: form.actual_delivery_date || null,
      risk_level: form.risk_level || null,
      mitigation_note: form.mitigation_note || null,
      created_by: user?.id,
      updated_by: user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery record added");
    setDialogOpen(false);
    fetchRows();
  };

  const updateField = async (id: string, patch: Partial<Row>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("material_delivery_tracker" as any) as any)
      .update({ ...patch, updated_by: user?.id }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    fetchRows();
  };

  const archiveRow = async (id: string) => {
    if (!confirm("Remove this record?")) return;
    const { error } = await (supabase.from("material_delivery_tracker" as any) as any)
      .update({ is_archived: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    fetchRows();
  };

  const exportCsv = () => {
    const header = ["Project","Material Category","Planned Delivery","Actual Delivery","Delay (Days)","Status","Risk Level","Mitigation Note"];
    const lines = rows.map((r) => [
      projectsMap[r.project_id] ?? "",
      r.material_category,
      r.planned_delivery_date ?? "",
      r.actual_delivery_date ?? "",
      r.delay_days ?? "",
      r.status,
      r.risk_level ?? "",
      (r.mitigation_note ?? "").replace(/"/g, '""'),
    ].map((c) => `"${c}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `delivery-tracker-${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <Card><CardContent className="py-10 text-center text-sm" style={{ color: "#666666" }}>You do not have access to the Delivery Tracker.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Tracked</div><div className="text-2xl font-display font-bold" style={{ color: "#1A1A1A" }}>{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">On Track</div><div className="text-2xl font-display font-bold" style={{ color: "#006039" }}>{summary.onTrack}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">At Risk</div><div className="text-2xl font-display font-bold" style={{ color: "#D4860A" }}>{summary.atRisk}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Delayed</div><div className="text-2xl font-display font-bold" style={{ color: "#F40009" }}>{summary.delayed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Avg Delay (days)</div><div className="text-2xl font-display font-bold" style={{ color: "#1A1A1A" }}>{summary.avg}</div></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={allProjects} onCheckedChange={setAllProjects} id="all-projects" />
          <Label htmlFor="all-projects" className="text-sm">All projects view</Label>
        </div>
        {!allProjects && (
          <div className="space-y-1 min-w-[240px]">
            <Label className="text-xs">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export</Button>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Material</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Delivery Record</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Project</Label>
                    <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Material Category</Label>
                    <Select value={form.material_category} onValueChange={(v) => setForm((f) => ({ ...f, material_category: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {STANDARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        <SelectItem value="__custom__">+ Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.material_category === "__custom__" && (
                      <Input className="mt-2" placeholder="Custom category" value={form.custom_category}
                        onChange={(e) => setForm((f) => ({ ...f, custom_category: e.target.value }))} />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Planned Delivery</Label><Input type="date" value={form.planned_delivery_date} onChange={(e) => setForm((f) => ({ ...f, planned_delivery_date: e.target.value }))} /></div>
                    <div className="space-y-1"><Label className="text-xs">Actual Delivery</Label><Input type="date" value={form.actual_delivery_date} onChange={(e) => setForm((f) => ({ ...f, actual_delivery_date: e.target.value }))} /></div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Risk Level</Label>
                    <Select value={form.risk_level} onValueChange={(v) => setForm((f) => ({ ...f, risk_level: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select risk" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Mitigation Note</Label><Textarea value={form.mitigation_note} onChange={(e) => setForm((f) => ({ ...f, mitigation_note: e.target.value }))} /></div>
                  <Button onClick={handleSave} disabled={saving} className="w-full" style={{ backgroundColor: "#006039" }}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: "#666666" }}>Loading…</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: "#666666" }}>No delivery records yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {allProjects && <TableHead>Project</TableHead>}
                  <TableHead>Material Category</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Delay (Days)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Mitigation</TableHead>
                  {canEdit && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    {allProjects && <TableCell className="text-sm">{projectsMap[r.project_id] ?? "—"}</TableCell>}
                    <TableCell className="font-medium" style={{ color: "#1A1A1A" }}>{r.material_category}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Input type="date" className="h-8 w-[140px]" defaultValue={r.planned_delivery_date ?? ""}
                          onBlur={(e) => { const v = e.target.value || null; if (v !== (r.planned_delivery_date ?? null)) updateField(r.id, { planned_delivery_date: v }); }} />
                      ) : (r.planned_delivery_date ? format(new Date(r.planned_delivery_date), "dd/MM/yyyy") : "—")}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Input type="date" className="h-8 w-[140px]" defaultValue={r.actual_delivery_date ?? ""}
                          onBlur={(e) => { const v = e.target.value || null; if (v !== (r.actual_delivery_date ?? null)) updateField(r.id, { actual_delivery_date: v }); }} />
                      ) : (r.actual_delivery_date ? format(new Date(r.actual_delivery_date), "dd/MM/yyyy") : "—")}
                    </TableCell>
                    <TableCell style={{ color: (r.delay_days ?? 0) > 0 ? "#F40009" : "#006039", fontWeight: 600 }}>
                      {r.delay_days == null ? "—" : r.delay_days}
                    </TableCell>
                    <TableCell><span className="text-xs font-medium px-2 py-0.5 rounded-full" style={statusStyle(r.status)}>{r.status}</span></TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select value={r.risk_level ?? ""} onValueChange={(v) => updateField(r.id, { risk_level: v as any })}>
                          <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (r.risk_level ?? "—")}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {canEdit ? (
                        <Input className="h-8" defaultValue={r.mitigation_note ?? ""}
                          onBlur={(e) => { const v = e.target.value || null; if (v !== (r.mitigation_note ?? null)) updateField(r.id, { mitigation_note: v }); }} />
                      ) : (r.mitigation_note ?? "—")}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => archiveRow(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
