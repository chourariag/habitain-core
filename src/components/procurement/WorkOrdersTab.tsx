import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";

interface Props {
  userRole: string | null;
  projects: any[];
}

const STATUS_COLORS: Record<string, string> = {
  pending_costing: "bg-amber-100 text-amber-800",
  pending_approval: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  wo_prepared: "bg-emerald-100 text-emerald-800",
  draft: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  pending_costing: "Pending Costing",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  wo_prepared: "WO Prepared",
  draft: "Draft",
};

const CREATOR_ROLES = ["production_head", "site_installation_mgr", "super_admin", "managing_director"];
const COSTING_ROLES = ["costing_engineer", "super_admin"];
const APPROVER_ROLES_LOW = ["planning_head", "head_of_projects", "super_admin", "managing_director"];
const APPROVER_ROLES_HIGH = ["managing_director", "finance_director", "principal_architect", "super_admin"];
const UPLOADER_ROLES = ["accounts_executive", "super_admin"];

async function notifyByRoles(roles: string[], title: string, message: string, priority: "low" | "normal" | "high" = "normal") {
  try {
    const { data: roleRows } = await supabase.from("user_roles").select("user_id").in("role", roles as any);
    const userIds = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)));
    if (!userIds.length) return;
    const rows = userIds.map((uid) => ({ user_id: uid, title, message, priority, type: "wo_request" }));
    await supabase.from("notifications").insert(rows as any);
  } catch (e) {
    console.error("notify error", e);
  }
}

export function WorkOrdersTab({ userRole, projects }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [register, setRegister] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [stages, setStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionRequest, setActionRequest] = useState<any | null>(null);
  const [actionMode, setActionMode] = useState<"costing" | "approve" | null>(null);
  const [uploading, setUploading] = useState(false);

  const canCreate = userRole && CREATOR_ROLES.includes(userRole);
  const canCost = userRole && COSTING_ROLES.includes(userRole);
  const canUpload = userRole && UPLOADER_ROLES.includes(userRole);
  const canApprove = (value: number) => {
    if (!userRole) return false;
    if (value <= 100000) return [...APPROVER_ROLES_LOW, ...APPROVER_ROLES_HIGH].includes(userRole);
    return APPROVER_ROLES_HIGH.includes(userRole);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: reqs }, { data: reg }, { data: scs }, { data: stgs }] = await Promise.all([
      supabase.from("wo_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("work_order_register").select("*").order("wo_date", { ascending: false }),
      supabase.from("subcontractors").select("id, company_name, work_type").eq("status", "active"),
      supabase.from("production_stages").select("stage_name").eq("is_archived", false),
    ]);
    setRequests(reqs || []);
    setRegister(reg || []);
    setSubs(scs || []);
    const unique = Array.from(new Set((stgs || []).map((s: any) => s.stage_name).filter(Boolean)));
    setStages(unique);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);

  return (
    <Tabs defaultValue="requests" className="space-y-4">
      <TabsList>
        <TabsTrigger value="requests">WO Requests</TabsTrigger>
        <TabsTrigger value="register">WO Register</TabsTrigger>
      </TabsList>

      <TabsContent value="requests" className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Work Order Requests</h3>
            <p className="text-sm text-muted-foreground">Subcontractor work — costing → approval chain</p>
          </div>
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> New WO Request</Button>
              </DialogTrigger>
              <NewRequestDialog
                projects={projects}
                subs={subs}
                stages={stages}
                onClose={() => setCreateOpen(false)}
                onCreated={load}
              />
            </Dialog>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Loading…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Subcontractor</TableHead>
                    <TableHead className="text-right">Value (₹)</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No WO requests yet</TableCell></TableRow>
                  ) : requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{projectMap[r.project_id]?.name || "—"}</TableCell>
                      <TableCell>{r.stage_name}</TableCell>
                      <TableCell>{r.subcontractor_name}</TableCell>
                      <TableCell className="text-right">{Number(r.estimated_value).toLocaleString("en-IN")}</TableCell>
                      <TableCell>{r.required_start_date ? format(new Date(r.required_start_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell><Badge className={STATUS_COLORS[r.status] || ""}>{STATUS_LABELS[r.status] || r.status}</Badge></TableCell>
                      <TableCell>
                        {r.status === "pending_costing" && canCost && (
                          <Button size="sm" variant="outline" onClick={() => { setActionRequest(r); setActionMode("costing"); }}>Review</Button>
                        )}
                        {r.status === "pending_approval" && canApprove(Number(r.estimated_value)) && (
                          <Button size="sm" onClick={() => { setActionRequest(r); setActionMode("approve"); }}>Approve</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="register" className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">WO Register (from Tally)</h3>
            <p className="text-sm text-muted-foreground">Daily upload of Work Orders prepared in Tally</p>
          </div>
          {canUpload && (
            <Button disabled={uploading} onClick={() => document.getElementById("wo-upload-input")?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Upload WO Register
            </Button>
          )}
          <input
            type="file" id="wo-upload-input" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              setUploading(true);
              try {
                await uploadRegister(file, requests, projects);
                toast.success("WO Register uploaded");
                await load();
              } catch (err: any) {
                toast.error(err.message || "Upload failed");
              } finally {
                setUploading(false);
                (e.target as HTMLInputElement).value = "";
              }
            }}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Subcontractor</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Linked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {register.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No WOs uploaded yet</TableCell></TableRow>
                ) : register.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono">{w.wo_number}</TableCell>
                    <TableCell>{format(new Date(w.wo_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{w.subcontractor}</TableCell>
                    <TableCell>{projectMap[w.project_id]?.name || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{w.scope_summary || "—"}</TableCell>
                    <TableCell className="text-right">{Number(w.amount).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{w.wo_request_id ? <Badge className="bg-green-100 text-green-800">Matched</Badge> : <Badge variant="outline">Unlinked</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {actionRequest && actionMode && (
        <ActionDialog
          request={actionRequest}
          mode={actionMode}
          projectName={projectMap[actionRequest.project_id]?.name || ""}
          onClose={() => { setActionRequest(null); setActionMode(null); }}
          onDone={load}
        />
      )}
    </Tabs>
  );
}

function NewRequestDialog({ projects, subs, stages, onClose, onCreated }: any) {
  const [form, setForm] = useState({
    project_id: "", stage_name: "", scope_of_work: "",
    subcontractor_name: "", estimated_value: "", required_start_date: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.project_id || !form.stage_name || !form.scope_of_work || !form.subcontractor_name || !form.estimated_value) {
      toast.error("Please fill all required fields"); return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const project = projects.find((p: any) => p.id === form.project_id);
    const { error } = await supabase.from("wo_requests").insert({
      project_id: form.project_id,
      stage_name: form.stage_name,
      scope_of_work: form.scope_of_work,
      subcontractor_name: form.subcontractor_name,
      estimated_value: Number(form.estimated_value),
      required_start_date: form.required_start_date || null,
      status: "pending_costing",
      created_by: user.id,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    await notifyByRoles(
      ["costing_engineer"],
      "WO Request for Costing Review",
      `WO Request for ${project?.name || "project"} — ${form.stage_name}. Check rates and budget.`,
      "high"
    );
    toast.success("WO Request submitted");
    setSaving(false);
    onClose();
    onCreated();
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New Work Order Request</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Project *</Label>
          <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Stage requiring subcontractor work *</Label>
          <Select value={form.stage_name} onValueChange={(v) => setForm({ ...form, stage_name: v })}>
            <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
            <SelectContent>
              {stages.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scope of Work * (detailed)</Label>
          <Textarea rows={4} value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="Detailed description of what subcontractor must do…" />
        </div>
        <div>
          <Label>Subcontractor *</Label>
          <Select value={form.subcontractor_name} onValueChange={(v) => setForm({ ...form, subcontractor_name: v })}>
            <SelectTrigger><SelectValue placeholder="Select subcontractor" /></SelectTrigger>
            <SelectContent>
              {subs.map((s: any) => <SelectItem key={s.id} value={s.company_name}>{s.company_name} {s.work_type ? `(${s.work_type})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Estimated Value (₹) *</Label>
            <Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
          </div>
          <div>
            <Label>Required Start Date</Label>
            <Input type="date" value={form.required_start_date} onChange={(e) => setForm({ ...form, required_start_date: e.target.value })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={saving} onClick={submit}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Submit Request</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ActionDialog({ request, mode, projectName, onClose, onDone }: any) {
  const [notes, setNotes] = useState(request.costing_engineer_notes || "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const value = Number(request.estimated_value);

  const submit = async (action: "approve" | "reject") => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const updates: any = {};
    if (mode === "costing") {
      if (action === "approve") {
        updates.status = "pending_approval";
        updates.costing_engineer_notes = notes || null;
        updates.costing_approved_by = user.id;
        updates.costing_approved_at = new Date().toISOString();
      } else {
        if (!reason.trim()) { toast.error("Rejection reason required"); setSaving(false); return; }
        updates.status = "rejected";
        updates.rejection_reason = reason;
        updates.costing_engineer_notes = notes || null;
      }
    } else {
      if (action === "approve") {
        updates.status = "approved";
        updates.operations_approver_id = user.id;
        updates.operations_approved_at = new Date().toISOString();
      } else {
        if (!reason.trim()) { toast.error("Rejection reason required"); setSaving(false); return; }
        updates.status = "rejected";
        updates.rejection_reason = reason;
      }
    }
    const { error } = await supabase.from("wo_requests").update(updates).eq("id", request.id);
    if (error) { toast.error(error.message); setSaving(false); return; }

    // Notifications
    if (mode === "costing" && action === "approve") {
      const targets = value <= 100000
        ? ["planning_head", "head_of_projects"]
        : ["managing_director", "finance_director", "principal_architect"];
      await notifyByRoles(targets, "WO Request awaiting approval",
        `${projectName} — ${request.subcontractor_name} | ₹${value.toLocaleString("en-IN")}`, "high");
    } else if (mode === "costing" && action === "reject") {
      await notifyByRoles(["production_head", "site_installation_mgr"],
        "WO Request rejected by Costing",
        `${projectName} — ${request.stage_name}. Reason: ${reason}`, "high");
    } else if (mode === "approve" && action === "approve") {
      await notifyByRoles(["accounts_executive"],
        "WO Request approved — prepare WO in Tally",
        `${projectName} | ${request.subcontractor_name} | ₹${value.toLocaleString("en-IN")}`, "high");
    } else if (mode === "approve" && action === "reject") {
      await notifyByRoles(["production_head", "site_installation_mgr", "costing_engineer"],
        "WO Request rejected by Operations",
        `${projectName} — ${request.stage_name}. Reason: ${reason}`, "high");
    }

    toast.success(action === "approve" ? "Approved" : "Rejected");
    setSaving(false);
    onClose();
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{mode === "costing" ? "Costing Review" : "Operations Approval"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Project:</span> {projectName}</div>
            <div><span className="text-muted-foreground">Stage:</span> {request.stage_name}</div>
            <div><span className="text-muted-foreground">Subcontractor:</span> {request.subcontractor_name}</div>
            <div><span className="text-muted-foreground">Value:</span> ₹{value.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <Label>Scope of Work</Label>
            <div className="p-2 border rounded bg-muted/30 whitespace-pre-wrap">{request.scope_of_work}</div>
          </div>
          {mode === "approve" && request.costing_engineer_notes && (
            <div>
              <Label>Costing Notes</Label>
              <div className="p-2 border rounded bg-amber-50">{request.costing_engineer_notes}</div>
            </div>
          )}
          {mode === "costing" && (
            <div>
              <Label>Costing Notes (mandatory if value exceeds BOQ allocation)</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Rejection Reason (only if rejecting)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={saving} onClick={() => submit("reject")}>Reject</Button>
          <Button disabled={saving} onClick={() => submit("approve")}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Approve</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function uploadRegister(file: File, requests: any[], projects: any[]) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Detect header row
  const headerIdx = rows.findIndex((r) => r.some((c) => String(c).toLowerCase().includes("wo")) && r.some((c) => String(c).toLowerCase().includes("date")));
  const start = headerIdx >= 0 ? headerIdx + 1 : 0;

  let currentProjectId: string | null = null;
  const records: any[] = [];

  const findProject = (text: string) => {
    const t = text.toLowerCase();
    const match = projects.find((p: any) =>
      (p.name && t.includes(String(p.name).toLowerCase())) ||
      (p.client_name && t.includes(String(p.client_name).toLowerCase()))
    );
    return match?.id || null;
  };

  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const colA = String(r[0] ?? "").trim();
    const colB = String(r[1] ?? "").trim();
    // Narration row: colA empty, colB has text
    if (!colA && colB) {
      const found = findProject(colB);
      if (found) currentProjectId = found;
      continue;
    }
    // Data row: expect WO No | Date | Subcontractor | Scope | Amount | Status
    const woNumber = colA;
    if (!woNumber || woNumber.toLowerCase().includes("total")) continue;
    const woDateRaw = r[1];
    const subcontractor = String(r[2] ?? "").trim();
    const scope = String(r[3] ?? "").trim();
    const amount = Number(String(r[4] ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    const status = String(r[5] ?? "active").trim() || "active";
    let woDate: string | null = null;
    if (woDateRaw instanceof Date) woDate = woDateRaw.toISOString().slice(0, 10);
    else if (typeof woDateRaw === "number") {
      const d = XLSX.SSF.parse_date_code(woDateRaw);
      if (d) woDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    } else if (typeof woDateRaw === "string" && woDateRaw) {
      const d = new Date(woDateRaw); if (!isNaN(d.getTime())) woDate = d.toISOString().slice(0, 10);
    }
    if (!woDate) continue;

    // Match to wo_request by project + subcontractor
    const matchedRequest = requests.find((req) =>
      req.project_id === currentProjectId &&
      req.subcontractor_name.toLowerCase() === subcontractor.toLowerCase() &&
      ["approved", "pending_approval", "wo_prepared"].includes(req.status)
    );

    records.push({
      wo_number: woNumber,
      wo_date: woDate,
      subcontractor,
      project_id: currentProjectId,
      scope_summary: scope,
      amount,
      status,
      wo_request_id: matchedRequest?.id || null,
      uploaded_by: user.id,
    });
  }

  if (!records.length) throw new Error("No valid WO rows found");

  // Duplicate detection
  const woNumbers = records.map((r) => r.wo_number);
  const { data: existing } = await supabase.from("work_order_register").select("wo_number").in("wo_number", woNumbers);
  const existingSet = new Set((existing || []).map((e: any) => e.wo_number));
  const fresh = records.filter((r) => !existingSet.has(r.wo_number));
  const duplicates = records.length - fresh.length;

  if (fresh.length) {
    const { error } = await supabase.from("work_order_register").insert(fresh);
    if (error) throw error;
  }

  // Mark matched requests as wo_prepared
  const matchedIds = Array.from(new Set(fresh.map((r) => r.wo_request_id).filter(Boolean)));
  if (matchedIds.length) {
    await supabase.from("wo_requests").update({ status: "wo_prepared" }).in("id", matchedIds);
  }

  toast.message(`Imported ${fresh.length} WOs · ${duplicates} duplicate(s) skipped · ${matchedIds.length} linked to requests`);
}
