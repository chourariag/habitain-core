import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, PackagePlus, AlertTriangle } from "lucide-react";

type SMR = {
  id: string;
  project_id: string;
  material_name: string;
  material_category: string | null;
  quantity: number;
  unit: string;
  reason: string;
  urgency: "normal" | "urgent";
  status: "pending" | "approved" | "rejected" | "issued";
  rejection_reason: string | null;
  approved_at: string | null;
  issued_at: string | null;
  created_at: string;
  created_by: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-primary/20 text-primary",
  rejected: "bg-destructive/15 text-destructive",
  issued: "bg-primary text-primary-foreground",
};

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
}

export function SpecialMaterialRequests({ projectId, projectName, userRole }: Props) {
  const [rows, setRows] = useState<SMR[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejectFor, setRejectFor] = useState<SMR | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({
    material_name: "",
    material_category: "",
    quantity: "",
    unit: "",
    reason: "",
    urgency: "normal" as "normal" | "urgent",
  });

  const canCreate = userRole === "factory_floor_supervisor" || userRole === "super_admin" || userRole === "managing_director";
  const canApprove = ["production_head", "head_operations", "managing_director", "super_admin"].includes(userRole ?? "");
  const canIssue = ["stores_executive", "managing_director", "super_admin"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("special_material_requests" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as SMR[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`smr-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "special_material_requests", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, load]);

  const approvedLast30 = rows.filter(r => r.status === "approved" || r.status === "issued")
    .filter(r => r.approved_at && new Date(r.approved_at).getTime() > Date.now() - 30 * 24 * 3600 * 1000).length;

  const submit = async () => {
    if (!form.material_name.trim() || !form.quantity || !form.unit.trim() || !form.reason.trim()) {
      toast.error("Material, quantity, unit and reason are required");
      return;
    }
    const qty = Number(form.quantity);
    if (!(qty > 0)) { toast.error("Quantity must be > 0"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("special_material_requests" as any).insert({
      project_id: projectId,
      material_name: form.material_name.trim(),
      material_category: form.material_category.trim() || null,
      quantity: qty,
      unit: form.unit.trim(),
      reason: form.reason.trim(),
      urgency: form.urgency,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Special material request submitted");
    setOpenCreate(false);
    setForm({ material_name: "", material_category: "", quantity: "", unit: "", reason: "", urgency: "normal" });
    load();
  };

  const approve = async (r: SMR) => {
    const { error } = await supabase.from("special_material_requests" as any)
      .update({ status: "approved", approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Approved");
  };

  const reject = async () => {
    if (!rejectFor) return;
    if (!rejectReason.trim()) { toast.error("Reason is mandatory"); return; }
    const { error } = await supabase.from("special_material_requests" as any)
      .update({ status: "rejected", rejection_reason: rejectReason.trim(), approved_by: (await supabase.auth.getUser()).data.user?.id, approved_at: new Date().toISOString() })
      .eq("id", rejectFor.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rejected");
    setRejectFor(null); setRejectReason("");
  };

  const markIssued = async (r: SMR) => {
    const { error } = await supabase.from("special_material_requests" as any)
      .update({ status: "issued", issued_by: (await supabase.auth.getUser()).data.user?.id, issued_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) toast.error(error.message); else toast.success("Marked as issued");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold">Special Material Requests</h2>
          <p className="text-xs text-muted-foreground">Materials needed outside the approved Material Plan — {projectName}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setOpenCreate(true)} style={{ backgroundColor: "#006039" }} className="text-white">
            <PackagePlus className="h-4 w-4 mr-2" /> Special Material Request
          </Button>
        )}
      </div>

      {approvedLast30 > 3 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-warning-foreground mt-0.5" />
          <p className="text-sm">
            <strong>{approvedLast30}</strong> special material requests approved on this project in the last 30 days. Planning Head has been notified to review BOQ/design.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm border border-border">
          <p className="text-sm text-muted-foreground">No special material requests yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-card rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.material_name}</span>
                    <span className="text-sm text-muted-foreground">— {r.quantity} {r.unit}</span>
                    {r.material_category && <Badge variant="outline" className="text-xs">{r.material_category}</Badge>}
                    {r.urgency === "urgent" && <Badge className="bg-destructive text-destructive-foreground text-xs">URGENT</Badge>}
                    <Badge className={STATUS_STYLES[r.status]}>{r.status}</Badge>
                  </div>
                  <p className="text-xs mt-1"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
                  {r.rejection_reason && <p className="text-xs mt-1 text-destructive">Rejected: {r.rejection_reason}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">Raised {new Date(r.created_at).toLocaleString("en-IN")}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status === "pending" && canApprove && (
                    <>
                      <Button size="sm" onClick={() => approve(r)} style={{ backgroundColor: "#006039" }} className="text-white">Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setRejectFor(r)}>Reject</Button>
                    </>
                  )}
                  {r.status === "approved" && canIssue && (
                    <Button size="sm" onClick={() => markIssued(r)} style={{ backgroundColor: "#006039" }} className="text-white">Mark Issued</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Special Material Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Project</Label>
              <Input value={projectName} disabled />
            </div>
            <div>
              <Label>Material name *</Label>
              <Input value={form.material_name} onChange={(e) => setForm({ ...form, material_name: e.target.value })} />
            </div>
            <div>
              <Label>Material category</Label>
              <Input value={form.material_category} onChange={(e) => setForm({ ...form, material_category: e.target.value })} placeholder="e.g. Steel, Electrical, Plumbing" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity *</Label>
                <Input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              </div>
              <div>
                <Label>Unit *</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="nos / kg / m" />
              </div>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} placeholder="Mandatory — why is this needed outside the Material Plan?" />
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={(v: any) => setForm({ ...form, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => { if (!o) { setRejectFor(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject request</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectFor(null); setRejectReason(""); }}>Cancel</Button>
            <Button onClick={reject} variant="destructive">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
