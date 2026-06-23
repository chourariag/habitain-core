import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Loader2, Search, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

const EDIT_ROLES = ["super_admin","managing_director","finance_director","sales_director","architecture_director","head_operations","procurement","planning_head"];
const TYPES = ["Labour","Supply","Labour+Supply","Design","Consultancy"];
const STATUSES = ["Active","Completed","On Hold","Disputed"];

interface Row {
  id: string; contract_number: string; project_id: string | null; vendor_name: string;
  scope_of_work: string | null; contract_type: string | null;
  contract_value_excl_gst: number; gst_percent: number; contract_value_incl_gst: number;
  start_date: string | null; end_date: string | null;
  retention_percent: number; retention_amount: number;
  payment_terms: string | null; status: string; remarks: string | null;
}

interface Props { userRole: string | null; projects: { id: string; name: string }[]; }

const statusStyle = (s: string): React.CSSProperties => {
  switch (s) {
    case "Active": return { backgroundColor: "#E8F2ED", color: "#006039" };
    case "Completed": return { backgroundColor: "#F0F0F0", color: "#666666" };
    case "On Hold": return { backgroundColor: "#FFF8E8", color: "#D4860A" };
    case "Disputed": return { backgroundColor: "#FFF0F0", color: "#F40009" };
    default: return {};
  }
};

const blankForm = {
  project_id: "", vendor_name: "", scope_of_work: "", contract_type: "",
  contract_value_excl_gst: "", gst_percent: "18", start_date: "", end_date: "",
  retention_percent: "0", payment_terms: "", status: "Active", remarks: "",
};

export function ContractsRegisterTab({ userRole, projects }: Props) {
  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const canView = canEdit || ["finance_manager"].includes(userRole ?? "");
  const [rows, setRows] = useState<Row[]>([]);
  const [subVendors, setSubVendors] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(blankForm);

  const projectsMap = useMemo(() => {
    const m: Record<string, string> = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const fetchRows = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    const [contracts, subs] = await Promise.all([
      (supabase.from("contracts_register" as any) as any).select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("subcontractors").select("company_name,contact_person"),
    ]);
    if (contracts.error) toast.error(contracts.error.message);
    setRows((contracts.data as Row[]) ?? []);
    const set = new Set<string>();
    (subs.data ?? []).forEach((s: any) => {
      if (s.company_name) set.add(s.company_name.toLowerCase());
      if (s.contact_person) set.add(s.contact_person.toLowerCase());
    });
    setSubVendors(set);
    setLoading(false);
  }, [canView]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const vendors = useMemo(() => Array.from(new Set(rows.map((r) => r.vendor_name))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (filterProject !== "all" && r.project_id !== filterProject) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterVendor !== "all" && r.vendor_name !== filterVendor) return false;
      if (q) {
        const proj = (projectsMap[r.project_id ?? ""] ?? "").toLowerCase();
        if (!r.vendor_name.toLowerCase().includes(q) && !proj.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterProject, filterStatus, filterVendor, search, projectsMap]);

  const summary = useMemo(() => {
    const active = filtered.filter((r) => r.status === "Active");
    const activeValue = active.reduce((s, r) => s + Number(r.contract_value_incl_gst || 0), 0);
    const retention = filtered.reduce((s, r) => s + Number(r.retention_amount || 0), 0);
    const now = new Date();
    const monStart = startOfMonth(now), monEnd = endOfMonth(now);
    const endingThisMonth = filtered.filter((r) => r.end_date && isWithinInterval(parseISO(r.end_date), { start: monStart, end: monEnd })).length;
    const disputed = filtered.filter((r) => r.status === "Disputed").length;
    return { activeCount: active.length, activeValue, retention, endingThisMonth, disputed };
  }, [filtered]);

  const openAdd = () => { setEditingId(null); setForm(blankForm); setDialogOpen(true); };
  const openEdit = (r: Row) => {
    setEditingId(r.id);
    setForm({
      project_id: r.project_id ?? "",
      vendor_name: r.vendor_name,
      scope_of_work: r.scope_of_work ?? "",
      contract_type: r.contract_type ?? "",
      contract_value_excl_gst: String(r.contract_value_excl_gst ?? ""),
      gst_percent: String(r.gst_percent ?? "18"),
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      retention_percent: String(r.retention_percent ?? "0"),
      payment_terms: r.payment_terms ?? "",
      status: r.status,
      remarks: r.remarks ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.vendor_name.trim()) { toast.error("Vendor name required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      project_id: form.project_id || null,
      vendor_name: form.vendor_name.trim(),
      scope_of_work: form.scope_of_work || null,
      contract_type: form.contract_type || null,
      contract_value_excl_gst: Number(form.contract_value_excl_gst || 0),
      gst_percent: Number(form.gst_percent || 0),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      retention_percent: Number(form.retention_percent || 0),
      payment_terms: form.payment_terms || null,
      status: form.status,
      remarks: form.remarks || null,
    };
    const op = editingId
      ? (supabase.from("contracts_register" as any) as any).update(payload).eq("id", editingId)
      : (supabase.from("contracts_register" as any) as any).insert({ ...payload, created_by: user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Contract updated" : "Contract added");
    setDialogOpen(false);
    fetchRows();
  };

  const exportXlsx = () => {
    const data = filtered.map((r) => ({
      "Contract No.": r.contract_number,
      Project: projectsMap[r.project_id ?? ""] ?? "",
      Vendor: r.vendor_name,
      Scope: r.scope_of_work ?? "",
      Type: r.contract_type ?? "",
      "Value (excl GST)": Number(r.contract_value_excl_gst || 0),
      "GST %": Number(r.gst_percent || 0),
      "Value (incl GST)": Number(r.contract_value_incl_gst || 0),
      "Start": r.start_date ?? "",
      "End": r.end_date ?? "",
      "Retention %": Number(r.retention_percent || 0),
      "Retention ₹": Number(r.retention_amount || 0),
      "Payment Terms": r.payment_terms ?? "",
      Status: r.status,
      Remarks: r.remarks ?? "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Contracts");
    XLSX.writeFile(wb, `contracts-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  if (!canView) {
    return <Card><CardContent className="py-10 text-center text-sm" style={{ color: "#666666" }}>You do not have access to the Contracts Register.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Contracts</div><div className="text-2xl font-display font-bold" style={{ color: "#1A1A1A" }}>{summary.activeCount}</div><div className="text-xs" style={{ color: "#666" }}>₹{summary.activeValue.toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Retention Held</div><div className="text-2xl font-display font-bold" style={{ color: "#006039" }}>₹{summary.retention.toLocaleString("en-IN")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Ending This Month</div><div className="text-2xl font-display font-bold" style={{ color: "#D4860A" }}>{summary.endingThisMonth}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Disputed</div><div className="text-2xl font-display font-bold" style={{ color: "#F40009" }}>{summary.disputed}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-[240px]" placeholder="Search vendor / project" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">Project</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[140px]">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[160px]">
          <Label className="text-xs">Vendor</Label>
          <Select value={filterVendor} onValueChange={setFilterVendor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem>{vendors.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportXlsx}><Download className="h-4 w-4 mr-1" /> Export</Button>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAdd} style={{ backgroundColor: "#006039" }}><Plus className="h-4 w-4 mr-1" /> Add Contract</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingId ? "Edit Contract" : "Add Contract"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Project</Label>
                    <Select value={form.project_id} onValueChange={(v) => setForm((f: any) => ({ ...f, project_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Vendor / Subcontractor</Label><Input value={form.vendor_name} onChange={(e) => setForm((f: any) => ({ ...f, vendor_name: e.target.value }))} /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Scope of Work</Label><Textarea value={form.scope_of_work} onChange={(e) => setForm((f: any) => ({ ...f, scope_of_work: e.target.value }))} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Contract Type</Label>
                    <Select value={form.contract_type} onValueChange={(v) => setForm((f: any) => ({ ...f, contract_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Value (excl GST) ₹</Label><Input type="number" value={form.contract_value_excl_gst} onChange={(e) => setForm((f: any) => ({ ...f, contract_value_excl_gst: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">GST %</Label><Input type="number" value={form.gst_percent} onChange={(e) => setForm((f: any) => ({ ...f, gst_percent: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((f: any) => ({ ...f, end_date: e.target.value }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Retention %</Label><Input type="number" value={form.retention_percent} onChange={(e) => setForm((f: any) => ({ ...f, retention_percent: e.target.value }))} /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Payment Terms</Label><Textarea rows={2} value={form.payment_terms} onChange={(e) => setForm((f: any) => ({ ...f, payment_terms: e.target.value }))} placeholder="e.g. 30% advance, 60% at delivery, 10% on completion" /></div>
                  <div className="space-y-1 col-span-2"><Label className="text-xs">Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm((f: any) => ({ ...f, remarks: e.target.value }))} /></div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full mt-3" style={{ backgroundColor: "#006039" }}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: "#666666" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: "#666666" }}>No contracts yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract No.</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value (incl GST)</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead className="text-right">Retention ₹</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isSub = subVendors.has(r.vendor_name.toLowerCase());
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.contract_number}</TableCell>
                      <TableCell className="text-sm">{projectsMap[r.project_id ?? ""] ?? "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {r.vendor_name}
                          {isSub && (
                            <Link to="/production?tab=people" className="text-xs text-primary inline-flex items-center gap-0.5 hover:underline">
                              <ExternalLink className="h-3 w-3" /> View
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.contract_type ?? "—"}</TableCell>
                      <TableCell className="text-right">₹{Number(r.contract_value_incl_gst || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-sm">{r.start_date ? format(parseISO(r.start_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{r.end_date ? format(parseISO(r.end_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-right">₹{Number(r.retention_amount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><Badge style={statusStyle(r.status)}>{r.status}</Badge></TableCell>
                      {canEdit && (
                        <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
