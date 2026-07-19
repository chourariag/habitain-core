import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Loader2, AlertCircle, Clock, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { format, addMonths, differenceInDays, parseISO } from "date-fns";

const SKILL_TYPES = [
  "Arc Welder","MIG Welder","TIG Welder","Fitter","External Painter","Internal Painter",
  "Wall Panelling","Tiles Mason","Civil Mason","Civil Helper","Helper","Carpenter",
  "Electrician","Plumber","HVAC Installer","Fabricator","False Ceiling","Waterproofing","Driver","Other",
];

const MANAGE_ROLES = ["super_admin","managing_director","finance_director","production_head","site_installation_mgr","finance_manager"];
const VIEW_ROLES = [...MANAGE_ROLES,"sales_director","architecture_director","hr_executive"];

type Contractor = {
  id: string; company_name: string; contact_person: string | null; phone: string | null;
  department: string; status: string;
};

type Worker = {
  id: string; contractor_id: string | null; name: string; skill_type: string;
  department: string; monthly_salary: number; status: string;
  date_joined: string; salary_review_due: string;
  on_leave_return_date: string | null; notes: string | null;
  deactivated_reason: string | null;
};

const defaultDeptForRole = (role: string | null) =>
  role === "site_installation_mgr" ? "site" : "factory";

export function LabourRegisterTab() {
  const { role, userId } = useUserRole();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [openContractor, setOpenContractor] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState<Worker | null>(null);
  const [editOpen, setEditOpen] = useState<Worker | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Worker | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const canView = VIEW_ROLES.includes(role ?? "");
  const canManage = MANAGE_ROLES.includes(role ?? "");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [c, w] = await Promise.all([
      supabase.from("labour_contractors").select("*").order("company_name"),
      supabase.from("labour_workers").select("*").order("name"),
    ]);
    setContractors((c.data ?? []) as Contractor[]);
    setWorkers((w.data ?? []) as Worker[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (canView) fetchAll(); }, [fetchAll, canView]);

  const reviewsDueSoon = useMemo(
    () => workers.filter(w => w.status === "active" && differenceInDays(parseISO(w.salary_review_due), new Date()) <= 30 && differenceInDays(parseISO(w.salary_review_due), new Date()) >= 0).length,
    [workers]
  );

  const loadHistory = async (w: Worker) => {
    setHistoryOpen(w);
    const { data } = await supabase.from("labour_worker_rate_history")
      .select("*").eq("worker_id", w.id).order("effective_from", { ascending: false });
    setHistory(data ?? []);
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Lock className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Restricted</h3>
          <p className="text-sm text-muted-foreground mt-1">Labour Register access is limited to MD, Directors, Finance, and HR.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4 relative pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Labour Register</h2>
          <p className="text-xs text-muted-foreground">Confidential — rates visible only to MD, Directors, Finance.</p>
        </div>
        {reviewsDueSoon > 0 && (
          <Badge style={{ background: "#FFF8E8", color: "#D4860A" }} className="border-0">
            <Clock className="w-3 h-3 mr-1" /> {reviewsDueSoon} salary reviews due this month
          </Badge>
        )}
      </div>

      <Accordion type="single" collapsible value={openContractor ?? ""} onValueChange={(v) => setOpenContractor(v || null)}>
        {contractors.map(c => {
          const list = workers.filter(w => w.contractor_id === c.id);
          const active = list.filter(w => w.status === "active").length;
          return (
            <AccordionItem key={c.id} value={c.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex-1 flex items-center justify-between pr-2">
                  <div className="text-left">
                    <div className="font-semibold">{c.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.contact_person ?? "—"} {c.phone ? `· ${c.phone}` : ""} · {c.department}
                    </div>
                  </div>
                  <Badge variant="outline">{active}/{list.length} active</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map(w => <WorkerCard key={w.id} w={w} canManage={canManage} onStatus={() => setStatusOpen(w)} onEdit={() => setEditOpen(w)} onHistory={() => loadHistory(w)} />)}
                  {list.length === 0 && <div className="text-sm text-muted-foreground p-4">No workers yet.</div>}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {canManage && (
        <Button
          onClick={() => setAddOpen(true)}
          className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0 z-40"
          style={{ background: "#006039" }}
        >
          <Plus className="w-6 h-6" />
        </Button>
      )}

      <AddWorkerDialog
        open={addOpen} onOpenChange={setAddOpen}
        contractors={contractors} defaultDepartment={defaultDeptForRole(role)}
        onSaved={fetchAll}
      />
      {statusOpen && (
        <StatusDialog
          worker={statusOpen} onOpenChange={(o) => { if (!o) setStatusOpen(null); }}
          onSaved={() => { setStatusOpen(null); fetchAll(); }}
        />
      )}
      {editOpen && (
        <EditWorkerDialog
          worker={editOpen} contractors={contractors}
          onOpenChange={(o) => { if (!o) setEditOpen(null); }}
          onSaved={() => { setEditOpen(null); fetchAll(); }}
        />
      )}
      {historyOpen && (
        <Dialog open={!!historyOpen} onOpenChange={(o) => { if (!o) setHistoryOpen(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Rate History — {historyOpen.name}</DialogTitle></DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {history.length === 0 && <p className="text-sm text-muted-foreground">No history.</p>}
              {history.map(h => (
                <div key={h.id} className="border rounded p-2 text-sm flex justify-between">
                  <div>
                    <div>₹{Number(h.monthly_salary).toLocaleString()}/month</div>
                    <div className="text-xs text-muted-foreground">
                      From {format(parseISO(h.effective_from), "dd MMM yyyy")}
                      {h.effective_to ? ` to ${format(parseISO(h.effective_to), "dd MMM yyyy")}` : " · current"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function WorkerCard({ w, canManage, onStatus, onEdit, onHistory }: { w: Worker; canManage: boolean; onStatus: () => void; onEdit: () => void; onHistory: () => void }) {
  const daily = w.monthly_salary / 26;
  const ot = daily / 8;
  const reviewDate = parseISO(w.salary_review_due);
  const days = differenceInDays(reviewDate, new Date());
  let reviewColor = "#006039", showAlert = false;
  if (days < 0) { reviewColor = "#F40009"; showAlert = true; }
  else if (days <= 30) { reviewColor = "#D4860A"; showAlert = true; }

  const statusStyle = w.status === "active" ? { bg: "#E8F2ED", fg: "#006039", label: "Active" }
    : w.status === "on_leave" ? { bg: "#FFF8E8", fg: "#D4860A", label: "On Leave" }
    : { bg: "#E0E0E0", fg: "#666", label: "Inactive" };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium">{w.name}</div>
            <div className="text-xs text-muted-foreground">{w.skill_type}</div>
          </div>
          <Badge style={{ background: statusStyle.bg, color: statusStyle.fg }} className="border-0">{statusStyle.label}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><div className="text-muted-foreground">Monthly</div><div className="font-semibold">₹{w.monthly_salary.toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">Daily</div><div>₹{Math.round(daily).toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">OT/hr</div><div>₹{Math.round(ot).toLocaleString()}</div></div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-muted-foreground">Joined: </span>{format(parseISO(w.date_joined), "dd/MM/yyyy")}
          </div>
          <div className="flex items-center gap-1" style={{ color: reviewColor }}>
            {showAlert && (days < 0 ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />)}
            Review: {format(reviewDate, "dd/MM/yyyy")}
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={onStatus}>Status</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onHistory}>History</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddWorkerDialog({ open, onOpenChange, contractors, defaultDepartment, onSaved }: any) {
  const [form, setForm] = useState({
    name: "", skill_type: "", skill_other: "", department: defaultDepartment,
    contractor_id: "", new_contractor_name: "", new_contractor_contact: "", new_contractor_phone: "",
    monthly_salary: "", date_joined: format(new Date(), "yyyy-MM-dd"), notes: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(f => ({ ...f, department: defaultDepartment })); }, [open, defaultDepartment]);

  const monthly = Number(form.monthly_salary) || 0;
  const daily = monthly / 26;
  const ot = daily / 8;
  const reviewDue = form.date_joined ? format(addMonths(parseISO(form.date_joined), 12), "yyyy-MM-dd") : "";

  const save = async () => {
    const skill = form.skill_type === "Other" ? form.skill_other.trim() : form.skill_type;
    if (!form.name.trim() || !skill || !form.department || !monthly || !form.date_joined) {
      toast.error("Please fill required fields"); return;
    }
    setSaving(true);
    try {
      let contractorId = form.contractor_id;
      if (form.contractor_id === "__new__") {
        if (!form.new_contractor_name.trim()) { toast.error("Company name required"); setSaving(false); return; }
        const { data, error } = await supabase.from("labour_contractors").insert({
          company_name: form.new_contractor_name.trim(),
          contact_person: form.new_contractor_contact.trim() || null,
          phone: form.new_contractor_phone.trim() || null,
          department: form.department,
        }).select().single();
        if (error) throw error;
        contractorId = data.id;
      }
      const { error } = await supabase.from("labour_workers").insert({
        contractor_id: contractorId || null, name: form.name.trim(), skill_type: skill,
        department: form.department, monthly_salary: monthly,
        date_joined: form.date_joined, salary_review_due: reviewDue,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
      toast.success("Worker added");
      onOpenChange(false); onSaved();
      setForm({ name: "", skill_type: "", skill_other: "", department: defaultDepartment, contractor_id: "", new_contractor_name: "", new_contractor_contact: "", new_contractor_phone: "", monthly_salary: "", date_joined: format(new Date(), "yyyy-MM-dd"), notes: "" });
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Worker</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Skill Type *</Label>
              <Select value={form.skill_type} onValueChange={(v) => setForm({ ...form, skill_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{SKILL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department *</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="factory">Factory</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.skill_type === "Other" && (
            <div><Label>Skill (specify)</Label><Input value={form.skill_other} onChange={(e) => setForm({ ...form, skill_other: e.target.value })} /></div>
          )}
          <div>
            <Label>Contractor Company</Label>
            <Select value={form.contractor_id} onValueChange={(v) => setForm({ ...form, contractor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {contractors.map((c: Contractor) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                <SelectItem value="__new__">+ Add new company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.contractor_id === "__new__" && (
            <div className="space-y-2 p-2 border rounded">
              <Input placeholder="Company name *" value={form.new_contractor_name} onChange={(e) => setForm({ ...form, new_contractor_name: e.target.value })} />
              <Input placeholder="Contact person" value={form.new_contractor_contact} onChange={(e) => setForm({ ...form, new_contractor_contact: e.target.value })} />
              <Input placeholder="Phone" value={form.new_contractor_phone} onChange={(e) => setForm({ ...form, new_contractor_phone: e.target.value })} />
            </div>
          )}
          <div>
            <Label>Monthly Salary ₹ *</Label>
            <Input type="number" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
            {monthly > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Daily: ₹{Math.round(daily).toLocaleString()} · OT/hr: ₹{Math.round(ot).toLocaleString()}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date Joined *</Label><Input type="date" value={form.date_joined} onChange={(e) => setForm({ ...form, date_joined: e.target.value })} /></div>
            <div><Label>Salary Review Due</Label><Input type="date" value={reviewDue} disabled /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "#006039" }}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditWorkerDialog({ worker, contractors, onOpenChange, onSaved }: any) {
  const [form, setForm] = useState({
    name: worker.name, skill_type: worker.skill_type, contractor_id: worker.contractor_id ?? "",
    department: worker.department, monthly_salary: String(worker.monthly_salary),
    date_joined: worker.date_joined, salary_review_due: worker.salary_review_due, notes: worker.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const monthly = Number(form.monthly_salary) || 0;
  const daily = monthly / 26;
  const ot = daily / 8;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("labour_workers").update({
        name: form.name.trim(), skill_type: form.skill_type, contractor_id: form.contractor_id || null,
        department: form.department, monthly_salary: monthly,
        date_joined: form.date_joined, salary_review_due: form.salary_review_due,
        notes: form.notes.trim() || null,
      }).eq("id", worker.id);
      if (error) throw error;
      toast.success("Worker updated");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {worker.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Skill Type</Label>
              <Select value={form.skill_type} onValueChange={(v) => setForm({ ...form, skill_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SKILL_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="factory">Factory</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Contractor</Label>
            <Select value={form.contractor_id} onValueChange={(v) => setForm({ ...form, contractor_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{contractors.map((c: Contractor) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Monthly Salary ₹</Label>
            <Input type="number" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} />
            <div className="text-xs text-muted-foreground mt-1">
              Daily: ₹{Math.round(daily).toLocaleString()} · OT/hr: ₹{Math.round(ot).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Changing salary will reset Salary Review Due to 12 months from today and snapshot a new rate history entry.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Date Joined</Label><Input type="date" value={form.date_joined} onChange={(e) => setForm({ ...form, date_joined: e.target.value })} /></div>
            <div><Label>Salary Review Due</Label><Input type="date" value={form.salary_review_due} onChange={(e) => setForm({ ...form, salary_review_due: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "#006039" }}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ worker, onOpenChange, onSaved }: any) {
  const [status, setStatus] = useState(worker.status);
  const [returnDate, setReturnDate] = useState<string>(worker.on_leave_return_date ?? "");
  const [reason, setReason] = useState(worker.deactivated_reason ?? "Left");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const update: any = { status };
      if (status === "on_leave") { update.on_leave_return_date = returnDate || null; update.deactivated_at = null; update.deactivated_reason = null; }
      else if (status === "inactive") { update.deactivated_reason = reason; update.deactivated_at = new Date().toISOString(); update.on_leave_return_date = null; }
      else { update.on_leave_return_date = null; update.deactivated_at = null; update.deactivated_reason = null; }
      const { error } = await supabase.from("labour_workers").update(update).eq("id", worker.id);
      if (error) throw error;
      toast.success("Status updated"); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Change Status — {worker.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {status === "on_leave" && (
            <div><Label>Return Date (optional)</Label><Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} /></div>
          )}
          {status === "inactive" && (
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Left">Left</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                  <SelectItem value="Seasonal">Seasonal</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ background: "#006039" }}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
