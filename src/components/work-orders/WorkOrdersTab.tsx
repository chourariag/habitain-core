import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, FileDown, AlertTriangle, CheckCircle2, XCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";
import { generateWorkOrderPdf } from "@/lib/work-order-pdf";

const WORK_TYPES = [
  "Painting","Tiling","Wooden Flooring","Fabrication","Electrical Works","False Ceiling",
  "Wall Panelling","Waterproofing","Civil Work","Carpentry","Plumbing","HVAC","Cladding","Glazing","Other",
];
const MEASUREMENT = ["Per SFT","Per RFT","Per KG","Per Unit","Per Day","Fixed Lump Sum"];
const UNIT_BY_BASIS: Record<string, string> = {
  "Per SFT":"sft","Per RFT":"rft","Per KG":"kg","Per Unit":"unit","Per Day":"day","Fixed Lump Sum":"lump sum",
};
const BOQ_CATEGORIES = [
  "Structure","Insulation","Wall Boarding","Ceiling","Flooring",
  "Openings","Cladding","Painting","Waterproofing",
  "MEP Electrical","MEP Plumbing","Civil","Miscellaneous",
];

const STATUS_LABEL: Record<string,{label:string;bg:string;color:string}> = {
  pending_costing_approval: { label: "Pending Costing", bg:"#FFF8E8", color:"#D4860A" },
  clarification_needed: { label: "Clarification Needed", bg:"#FFF8E8", color:"#D4860A" },
  rejected: { label: "Rejected", bg:"#FFF0F0", color:"#F40009" },
  approved_pending_issue: { label: "Approved — Pending Issue", bg:"#E8F2ED", color:"#006039" },
  pending_director_approval: { label: "Pending Director Approval", bg:"#FFF8E8", color:"#D4860A" },
  issued: { label: "Issued", bg:"#E8F2ED", color:"#006039" },
  work_in_progress: { label: "Work In Progress", bg:"#E8F2ED", color:"#006039" },
  completed_pending_measurement: { label: "Completed — Pending Measurement", bg:"#FFF8E8", color:"#D4860A" },
  measured_signed_off: { label: "Measured & Signed Off", bg:"#E8F2ED", color:"#006039" },
  closed: { label: "Closed", bg:"#E0E0E0", color:"#666" },
};

const fmtINR = (n: number) => `₹${(n||0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

type Mode = "factory" | "site" | "finance" | "project" | "all";

interface Props {
  mode: Mode;
  projectId?: string;          // when scoped to a project (factory/site/project)
  projectName?: string;
}

export function WorkOrdersTab({ mode, projectId, projectName }: Props) {
  const { role, userId } = useUserRole();
  const [wos, setWos] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [openDetail, setOpenDetail] = useState<any | null>(null);

  const canRaise = ["super_admin","managing_director","production_head","site_installation_mgr"].includes(role ?? "");
  const canCostingApprove = ["super_admin","managing_director","planning_engineer","costing_engineer"].includes(role ?? "");
  const canDirectorApprove = ["super_admin","managing_director","finance_director","sales_director","architecture_director"].includes(role ?? "");
  const canIssue = ["super_admin","managing_director","finance_director","finance_manager","accounts_executive"].includes(role ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("work_orders").select("*").eq("is_archived", false).order("raised_at", { ascending: false });
    if (projectId && (mode === "factory" || mode === "site" || mode === "project")) q = q.eq("project_id", projectId);
    if (mode === "finance") q = q.in("status", ["approved_pending_issue","issued","work_in_progress","completed_pending_measurement","measured_signed_off","closed"]);
    const [woRes, subRes, projRes] = await Promise.all([
      q,
      supabase.from("subcontractors").select("id,sub_id,company_name,contact_person,phone,email,work_type,typical_rate,rate_unit,factory_or_site,status").eq("status","active").order("company_name"),
      supabase.from("projects").select("id,name").eq("is_archived", false).order("name"),
    ]);
    setWos(woRes.data ?? []);
    setSubs(subRes.data ?? []);
    setProjects(projRes.data ?? []);
    setLoading(false);
  }, [projectId, mode]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    if (mode === "factory") return wos.filter(w => {
      const sub = subs.find(s => s.id === w.subcontractor_id);
      return !sub || sub.factory_or_site === "factory" || sub.factory_or_site === "both" || w.location_area?.toLowerCase().includes("bay");
    });
    if (mode === "site") return wos.filter(w => {
      const sub = subs.find(s => s.id === w.subcontractor_id);
      return !sub || sub.factory_or_site === "site" || sub.factory_or_site === "both" || !w.location_area?.toLowerCase().includes("bay");
    });
    return wos;
  }, [wos, subs, mode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display font-semibold text-base" style={{ color:"#1A1A1A" }}>Work Orders</h3>
          <p className="text-xs" style={{ color:"#666" }}>
            {mode === "finance" ? "Approved WOs ready to issue" : "Subcontractor work orders"}
          </p>
        </div>
        {canRaise && mode !== "finance" && (
          <Button size="sm" onClick={() => setOpenNew(true)} style={{ background:"#006039" }}>
            <Plus className="h-4 w-4 mr-1" /> New Work Order
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No work orders.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>WO Number</TableHead>
                  {!projectId && <TableHead>Project</TableHead>}
                  <TableHead>Subcontractor</TableHead>
                  <TableHead>Work Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(w => {
                  const sub = subs.find(s => s.id === w.subcontractor_id);
                  const proj = projects.find(p => p.id === w.project_id);
                  const sl = STATUS_LABEL[w.status] ?? { label: w.status, bg:"#F5F5F5", color:"#666" };
                  return (
                    <TableRow key={w.id} className="cursor-pointer" onClick={() => setOpenDetail(w)}>
                      <TableCell className="font-mono text-xs">{w.wo_number}</TableCell>
                      {!projectId && <TableCell className="text-xs">{proj?.name ?? "—"}</TableCell>}
                      <TableCell className="text-xs">{sub?.company_name ?? sub?.contact_person ?? "—"}</TableCell>
                      <TableCell className="text-xs">{w.work_type}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmtINR(Number(w.total_value))}</TableCell>
                      <TableCell className="text-xs">{w.planned_start_date ? format(new Date(w.planned_start_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge className="border-0 text-[10px]" style={{ background: sl.bg, color: sl.color }}>{sl.label}</Badge>
                      </TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setOpenDetail(w); }}>Open</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {openNew && (
        <NewWorkOrderDialog
          projects={projectId ? projects.filter(p => p.id === projectId) : projects}
          defaultProjectId={projectId}
          subs={subs}
          mode={mode}
          userId={userId}
          onClose={() => setOpenNew(false)}
          onSaved={fetchAll}
        />
      )}
      {openDetail && (
        <WorkOrderDetailDialog
          wo={openDetail}
          sub={subs.find(s => s.id === openDetail.subcontractor_id)}
          project={projects.find(p => p.id === openDetail.project_id)}
          role={role}
          userId={userId}
          canCostingApprove={canCostingApprove}
          canDirectorApprove={canDirectorApprove}
          canIssue={canIssue}
          canRaise={canRaise}
          onClose={() => setOpenDetail(null)}
          onChanged={() => { fetchAll(); setOpenDetail(null); }}
        />
      )}
    </div>
  );
}

// ---------------- New WO Dialog ----------------
function NewWorkOrderDialog({ projects, defaultProjectId, subs, mode, userId, onClose, onSaved }: any) {
  const [form, setForm] = useState({
    project_id: defaultProjectId ?? (projects[0]?.id ?? ""),
    subcontractor_id: "",
    work_type: "",
    scope_of_work: "",
    location_area: "",
    measurement_basis: "Per SFT",
    quantity: "",
    rate: "",
    boq_category: "Miscellaneous",
    planned_start_date: format(new Date(), "yyyy-MM-dd"),
    planned_completion_date: "",
    notes_to_costing: "",
  });
  const [saving, setSaving] = useState(false);

  const filteredSubs = useMemo(() => {
    if (mode === "factory") return subs.filter((s:any) => s.factory_or_site === "factory" || s.factory_or_site === "both");
    if (mode === "site") return subs.filter((s:any) => s.factory_or_site === "site" || s.factory_or_site === "both");
    return subs;
  }, [subs, mode]);

  const selectedSub = subs.find((s:any) => s.id === form.subcontractor_id);
  const total = Number(form.quantity || 0) * Number(form.rate || 0);
  const rateDiffers = selectedSub?.typical_rate && Number(form.rate || 0) !== Number(selectedSub.typical_rate);

  const onPickSub = (id: string) => {
    const s = subs.find((x:any) => x.id === id);
    setForm(f => ({
      ...f,
      subcontractor_id: id,
      work_type: s?.work_type ?? f.work_type,
      rate: s?.typical_rate ? String(s.typical_rate) : f.rate,
    }));
  };

  const save = async () => {
    if (!form.project_id || !form.subcontractor_id || !form.scope_of_work || !form.location_area || !form.planned_completion_date) {
      toast.error("Fill all required fields"); return;
    }
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", userId).maybeSingle();
      const { error } = await supabase.from("work_orders").insert({
        project_id: form.project_id,
        subcontractor_id: form.subcontractor_id,
        work_type: form.work_type,
        scope_of_work: form.scope_of_work.trim(),
        location_area: form.location_area.trim(),
        measurement_basis: form.measurement_basis,
        quantity: Number(form.quantity) || 0,
        unit: UNIT_BY_BASIS[form.measurement_basis],
        rate: Number(form.rate) || 0,
        total_value: total,
        boq_category: form.boq_category,
        planned_start_date: form.planned_start_date,
        planned_completion_date: form.planned_completion_date,
        notes_to_costing: form.notes_to_costing.trim() || null,
        raised_by: userId,
        raised_by_name: profile?.display_name ?? null,
        status: "pending_costing_approval",
      } as any);
      if (error) throw error;

      // Notify costing engineers
      const { data: costingUsers } = await supabase
        .from("profiles").select("auth_user_id")
        .in("role", ["planning_engineer","costing_engineer"]).eq("is_active", true);
      if (costingUsers?.length) {
        await insertNotifications(costingUsers.map((u:any) => ({
          recipient_id: u.auth_user_id,
          title: "Work Order pending approval",
          body: `${form.work_type} | ${fmtINR(total)} — review against budget`,
          category: "work_order",
        })));
      }
      toast.success("Work Order submitted for costing approval");
      onSaved(); onClose();
    } catch (e:any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map((p:any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcontractor *</Label>
              <Select value={form.subcontractor_id} onValueChange={onPickSub}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {filteredSubs.map((s:any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.company_name ?? s.contact_person} — {s.work_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Work Type *</Label>
              <Select value={form.work_type} onValueChange={(v) => setForm({ ...form, work_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>BOQ Category *</Label>
              <Select value={form.boq_category} onValueChange={(v) => setForm({ ...form, boq_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BOQ_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Scope of Work *</Label>
            <Textarea rows={3} value={form.scope_of_work} placeholder="e.g. Internal painting of all bedrooms — 2 coats emulsion, colour as per finish schedule"
              onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} />
          </div>
          <div>
            <Label>Location / Area *</Label>
            <Input placeholder={mode === "factory" ? "e.g. Bay 4 — Module M-101" : "e.g. Ground Floor — Bedrooms 1 & 2"}
              value={form.location_area} onChange={(e) => setForm({ ...form, location_area: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Measurement *</Label>
              <Select value={form.measurement_basis} onValueChange={(v) => setForm({ ...form, measurement_basis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEASUREMENT.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity *</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div>
              <Label>Rate (₹) *</Label>
              <Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
              {selectedSub?.typical_rate && (
                <p className="text-[10px] mt-1" style={{ color: rateDiffers ? "#D4860A" : "#666" }}>
                  Register rate: ₹{selectedSub.typical_rate} {selectedSub.rate_unit ?? ""}
                  {rateDiffers && " — costing engineer will review"}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Planned Start *</Label><Input type="date" value={form.planned_start_date} onChange={(e) => setForm({ ...form, planned_start_date: e.target.value })} /></div>
            <div><Label>Planned Completion *</Label><Input type="date" value={form.planned_completion_date} onChange={(e) => setForm({ ...form, planned_completion_date: e.target.value })} /></div>
          </div>
          <div>
            <Label>Notes to Costing Engineer</Label>
            <Textarea rows={2} value={form.notes_to_costing} onChange={(e) => setForm({ ...form, notes_to_costing: e.target.value })} />
          </div>

          <div className="rounded-md p-3" style={{ backgroundColor: "#F7F7F7" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total WO Value</span>
              <span className="font-display font-bold text-lg" style={{ color: "#006039" }}>{fmtINR(total)}</span>
            </div>
            {total > 50000 && (
              <p className="text-[11px] mt-1" style={{ color: "#D4860A" }}>
                ⚠ Above ₹50,000 — Director approval required after costing approval.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "#006039" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Detail / Action Dialog ----------------
function WorkOrderDetailDialog({ wo, sub, project, role, userId, canCostingApprove, canDirectorApprove, canIssue, canRaise, onClose, onChanged }: any) {
  const [action, setAction] = useState<"approve"|"reject"|"clarify"|null>(null);
  const [note, setNote] = useState("");
  const [editRate, setEditRate] = useState(String(wo.rate));
  const [editQty, setEditQty] = useState(String(wo.quantity));
  const [busy, setBusy] = useState(false);
  const [actualQty, setActualQty] = useState(String(wo.quantity));
  const [deductions, setDeductions] = useState("0");

  // budget check
  const [budgetInfo, setBudgetInfo] = useState<{ gfc:number; spent:number } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: boqs } = await supabase.from("project_boq").select("id").eq("project_id", wo.project_id).order("version_number", { ascending: false }).limit(1);
      let gfc = 0;
      if (boqs?.[0]) {
        const { data: items } = await supabase.from("project_boq_items").select("category,total_amount").eq("boq_id", boqs[0].id);
        gfc = (items ?? []).filter((i:any) => (i.category ?? "").toLowerCase() === wo.boq_category.toLowerCase())
          .reduce((s:number, i:any) => s + Number(i.total_amount || 0), 0);
      }
      const { data: prevWos } = await supabase.from("work_orders").select("total_value")
        .eq("project_id", wo.project_id).eq("boq_category", wo.boq_category)
        .in("status", ["approved_pending_issue","pending_director_approval","issued","work_in_progress","completed_pending_measurement","measured_signed_off","closed"])
        .neq("id", wo.id);
      const spent = (prevWos ?? []).reduce((s:number, w:any) => s + Number(w.total_value || 0), 0);
      setBudgetInfo({ gfc, spent });
    })();
  }, [wo.id, wo.project_id, wo.boq_category]);

  const sl = STATUS_LABEL[wo.status] ?? { label: wo.status, bg:"#F5F5F5", color:"#666" };
  const remaining = budgetInfo ? budgetInfo.gfc - budgetInfo.spent - Number(wo.total_value) : 0;
  const remainingPct = budgetInfo && budgetInfo.gfc > 0 ? (remaining / budgetInfo.gfc) * 100 : 0;
  const budgetTone = !budgetInfo || budgetInfo.gfc === 0 ? "muted" : remaining < 0 ? "red" : remainingPct < 10 ? "amber" : "green";

  const notify = async (roles: string[], title: string, body: string) => {
    const { data } = await supabase.from("profiles").select("auth_user_id").in("role", roles as any).eq("is_active", true);
    if (data?.length) await insertNotifications(data.map((u:any) => ({ recipient_id: u.auth_user_id, title, body, category: "work_order" })));
  };

  const doCostingAction = async (kind: "approve"|"reject"|"clarify") => {
    if ((kind === "reject" || kind === "clarify") && !note.trim()) { toast.error("Reason / message required"); return; }
    setBusy(true);
    try {
      const newValue = Number(editQty) * Number(editRate);
      const aboveLimit = newValue > 50000;
      const updates: any = {};
      if (kind === "approve") {
        updates.status = aboveLimit ? "pending_director_approval" : "approved_pending_issue";
        updates.costing_approved_by = userId;
        updates.costing_approved_at = new Date().toISOString();
        updates.costing_notes = note.trim() || null;
        updates.rate = Number(editRate);
        updates.quantity = Number(editQty);
        updates.total_value = newValue;
      } else if (kind === "reject") {
        updates.status = "rejected";
        updates.rejection_reason = note.trim();
      } else {
        updates.status = "clarification_needed";
        const thread = Array.isArray(wo.clarification_thread) ? wo.clarification_thread : [];
        updates.clarification_thread = [...thread, { from: "costing", at: new Date().toISOString(), message: note.trim() }];
      }
      const { error } = await supabase.from("work_orders").update(updates).eq("id", wo.id);
      if (error) throw error;
      if (kind === "approve") {
        if (aboveLimit) await notify(["managing_director","finance_director","sales_director","architecture_director"], "WO needs Director approval", `${wo.wo_number} — ${fmtINR(newValue)}`);
        else await notify(["finance_manager","accounts_executive"], "WO ready to issue", `${wo.wo_number} — ${fmtINR(newValue)}`);
      } else if (wo.raised_by) {
        await insertNotifications({ recipient_id: wo.raised_by, title: kind === "reject" ? "WO Rejected" : "Clarification needed", body: `${wo.wo_number}: ${note}`, category: "work_order" });
      }
      toast.success("Updated");
      onChanged();
    } catch (e:any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doDirectorApprove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("work_orders").update({
        status: "approved_pending_issue",
        director_approved_by: userId, director_approved_at: new Date().toISOString(),
      }).eq("id", wo.id);
      if (error) throw error;
      await notify(["finance_manager","accounts_executive"], "WO ready to issue", `${wo.wo_number} — ${fmtINR(Number(wo.total_value))}`);
      toast.success("Approved");
      onChanged();
    } catch (e:any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doGenerateAndIssue = async () => {
    setBusy(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", userId).maybeSingle();
      const pdfUrl = await generateWorkOrderPdf({ wo, sub, project, issuerName: profile?.display_name ?? "Finance & Administration" });
      const { error } = await supabase.from("work_orders").update({
        status: "issued", issued_by: userId, issued_at: new Date().toISOString(), pdf_url: pdfUrl,
      }).eq("id", wo.id);
      if (error) throw error;
      if (wo.raised_by) await insertNotifications({ recipient_id: wo.raised_by, title: "WO Issued", body: `${wo.wo_number} issued to ${sub?.company_name ?? sub?.contact_person ?? ""}`, category: "work_order" });
      toast.success("WO issued — PDF generated");
      onChanged();
    } catch (e:any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doMarkStarted = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("work_orders").update({ status: "work_in_progress" }).eq("id", wo.id);
      if (error) throw error; toast.success("Marked started"); onChanged();
    } catch (e:any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doMarkComplete = async () => {
    setBusy(true);
    try {
      const finalAmount = Number(actualQty) * Number(wo.rate) - Number(deductions || 0);
      const { error: cErr } = await supabase.from("work_order_closure").insert({
        wo_id: wo.id, actual_qty: Number(actualQty), deductions: Number(deductions || 0),
        final_amount: finalAmount, signed_off_by: userId, signed_off_at: new Date().toISOString(),
      });
      if (cErr) throw cErr;
      const { error } = await supabase.from("work_orders").update({ status: "measured_signed_off" }).eq("id", wo.id);
      if (error) throw error;
      await notify(["finance_manager","accounts_executive"], "WO ready for payment", `${wo.wo_number} — ${fmtINR(finalAmount)}`);
      toast.success("Closure recorded — sent to Finance for payment");
      onChanged();
    } catch (e:any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm">{wo.wo_number}</span>
            <Badge className="border-0 text-[10px]" style={{ background: sl.bg, color: sl.color }}>{sl.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" value={project?.name ?? "—"} />
            <Field label="Subcontractor" value={sub ? `${sub.company_name ?? sub.contact_person}` : "—"} />
            <Field label="Work Type" value={wo.work_type} />
            <Field label="BOQ Category" value={wo.boq_category} />
            <Field label="Location" value={wo.location_area} />
            <Field label="Measurement" value={`${wo.measurement_basis} (${wo.unit ?? ""})`} />
            <Field label="Quantity × Rate" value={`${wo.quantity} × ₹${wo.rate}`} />
            <Field label="Total Value" value={fmtINR(Number(wo.total_value))} />
            <Field label="Planned Start" value={format(new Date(wo.planned_start_date), "dd/MM/yyyy")} />
            <Field label="Planned Completion" value={format(new Date(wo.planned_completion_date), "dd/MM/yyyy")} />
          </div>
          <div>
            <Label className="text-xs">Scope</Label>
            <p className="text-xs mt-1 p-2 rounded" style={{ backgroundColor: "#F7F7F7" }}>{wo.scope_of_work}</p>
          </div>
          {wo.notes_to_costing && (
            <div><Label className="text-xs">Notes to Costing</Label><p className="text-xs mt-1">{wo.notes_to_costing}</p></div>
          )}

          {/* Budget panel for costing approval */}
          {wo.status === "pending_costing_approval" && canCostingApprove && budgetInfo && (
            <div className="border rounded p-3 space-y-2" style={{
              borderColor: budgetTone === "red" ? "#F40009" : budgetTone === "amber" ? "#D4860A" : budgetTone === "green" ? "#006039" : "#E0E0E0",
              backgroundColor: budgetTone === "red" ? "#FFF0F0" : budgetTone === "amber" ? "#FFF8E8" : budgetTone === "green" ? "#E8F2ED" : "#F7F7F7"
            }}>
              <p className="font-semibold text-xs">Budget Check — {wo.boq_category}</p>
              <div className="text-xs space-y-1">
                <div className="flex justify-between"><span>GFC Budget for category:</span><span className="font-mono">{fmtINR(budgetInfo.gfc)}</span></div>
                <div className="flex justify-between"><span>Already committed (other approved WOs):</span><span className="font-mono">{fmtINR(budgetInfo.spent)}</span></div>
                <div className="flex justify-between"><span>This WO value:</span><span className="font-mono">{fmtINR(Number(wo.total_value))}</span></div>
                <div className="flex justify-between font-semibold"><span>Remaining after this WO:</span><span className="font-mono">{fmtINR(remaining)}</span></div>
              </div>
              {budgetTone === "red" && (
                <p className="text-xs flex items-center gap-1" style={{ color:"#F40009" }}>
                  <AlertTriangle className="h-3 w-3" /> This WO exceeds the GFC budget for {wo.boq_category}. Approve only if a budget revision has been agreed.
                </p>
              )}
              {budgetInfo.gfc === 0 && <p className="text-[11px]" style={{ color:"#666" }}>No GFC budget uploaded for this category yet.</p>}
            </div>
          )}

          {/* Costing approval actions */}
          {wo.status === "pending_costing_approval" && canCostingApprove && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold">Costing Engineer Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Adjust Quantity</Label><Input type="number" value={editQty} onChange={(e) => setEditQty(e.target.value)} /></div>
                <div><Label className="text-xs">Adjust Rate</Label><Input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)} /></div>
              </div>
              <Textarea rows={2} placeholder="Note / reason / clarification message" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => doCostingAction("approve")} disabled={busy} style={{ background:"#006039" }}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
                <Button size="sm" variant="outline" onClick={() => doCostingAction("clarify")} disabled={busy} style={{ borderColor:"#D4860A", color:"#D4860A" }}>Request Clarification</Button>
                <Button size="sm" variant="outline" onClick={() => doCostingAction("reject")} disabled={busy} style={{ borderColor:"#F40009", color:"#F40009" }}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
              </div>
            </div>
          )}

          {/* Director approval */}
          {wo.status === "pending_director_approval" && canDirectorApprove && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold">Director Approval Required (above ₹50,000)</p>
              <Button size="sm" onClick={doDirectorApprove} disabled={busy} style={{ background:"#006039" }}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
              </Button>
            </div>
          )}

          {/* Issue */}
          {wo.status === "approved_pending_issue" && canIssue && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold">Issue Work Order</p>
              <Button size="sm" onClick={doGenerateAndIssue} disabled={busy} style={{ background:"#006039" }}>
                <Send className="h-4 w-4 mr-1" /> Generate PDF & Issue
              </Button>
            </div>
          )}

          {/* PDF download once issued */}
          {wo.pdf_url && (
            <a href={wo.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color:"#006039" }}>
              <FileDown className="h-3 w-3" /> Download Work Order PDF
            </a>
          )}

          {/* Track work progress */}
          {wo.status === "issued" && canRaise && (
            <Button size="sm" variant="outline" onClick={doMarkStarted} disabled={busy}>Mark Work Started</Button>
          )}
          {wo.status === "work_in_progress" && canRaise && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-semibold">Mark Complete & Sign Off Measurement</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Actual Quantity</Label><Input type="number" value={actualQty} onChange={(e) => setActualQty(e.target.value)} /></div>
                <div><Label className="text-xs">Deductions (₹)</Label><Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} /></div>
              </div>
              <p className="text-xs">Final Amount: <span className="font-mono font-semibold">{fmtINR(Number(actualQty) * Number(wo.rate) - Number(deductions || 0))}</span></p>
              <Button size="sm" onClick={doMarkComplete} disabled={busy} style={{ background:"#006039" }}>Mark Complete & Send to Finance</Button>
            </div>
          )}

          {wo.rejection_reason && (
            <div className="text-xs p-2 rounded" style={{ backgroundColor:"#FFF0F0", color:"#F40009" }}>
              Rejection reason: {wo.rejection_reason}
            </div>
          )}
        </div>

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
