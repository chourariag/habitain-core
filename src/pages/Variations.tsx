import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";

interface Variation {
  id: string;
  ref_number: string;
  description: string;
  scope_type: string;
  gfc_qty: number;
  material_rate: number;
  labour_rate: number;
  margin_pct: number;
  basic_rate: number;
  margin_rate: number;
  final_rate: number;
  final_cost: number;
  margin_amount: number;
  status: string;
  approval_stage: string | null;
  approved_by_karan: boolean;
  approved_by_shiv: boolean;
  approved_by_md: boolean;
  client_approved: boolean;
  notes: string | null;
  created_at: string;
  project_id: string;
}

const SCOPE_TYPES = ["Client Request", "Design Change", "Site Condition", "Regulatory", "Value Engineering", "Other"];

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#666", bg: "#F7F7F7" },
  pending_approval: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  client_approved: { color: "#2563EB", bg: "#EFF6FF" },
};

function calcRates(materialRate: number, labourRate: number, marginPct: number, gfcQty: number) {
  const basicRate = materialRate + labourRate;
  const marginRate = marginPct > 0 && marginPct < 100
    ? basicRate * marginPct / (100 - marginPct)
    : 0;
  const finalRate = basicRate + marginRate;
  const finalCost = finalRate * gfcQty;
  const marginAmount = marginRate * gfcQty;
  return { basicRate, marginRate, finalRate, finalCost, marginAmount };
}

function VariationsContent() {
  const { selectedProjectId } = useProjectContext();
  const { role: userRole } = useUserRole();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "",
    scope_type: "Client Request",
    gfc_qty: "",
    material_rate: "",
    labour_rate: "",
    margin_pct: "20",
    notes: "",
  });

  const fetch = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    const { data } = await (supabase.from("variations" as any) as any)
      .select("*")
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false });
    setVariations(data ?? []);
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { fetch(); }, [fetch]);

  const calcs = useCallback(() => {
    const mat = parseFloat(form.material_rate) || 0;
    const lab = parseFloat(form.labour_rate) || 0;
    const marg = parseFloat(form.margin_pct) || 0;
    const qty = parseFloat(form.gfc_qty) || 0;
    return calcRates(mat, lab, marg, qty);
  }, [form]);

  const handleCreate = async () => {
    if (!form.description) { toast.error("Description required"); return; }
    if (!form.gfc_qty) { toast.error("GFC Qty required"); return; }
    setSaving(true);
    const { data: existing } = await (supabase.from("variations" as any) as any)
      .select("ref_number")
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false })
      .limit(1);
    const lastRef = existing?.[0]?.ref_number ?? "VR-000";
    const lastNum = parseInt(lastRef.replace("VR-", ""), 10) || 0;
    const refNumber = `VR-${String(lastNum + 1).padStart(3, "0")}`;
    const c = calcs();
    const { error } = await (supabase.from("variations" as any) as any).insert({
      project_id: selectedProjectId,
      ref_number: refNumber,
      description: form.description,
      scope_type: form.scope_type,
      gfc_qty: parseFloat(form.gfc_qty) || 0,
      material_rate: parseFloat(form.material_rate) || 0,
      labour_rate: parseFloat(form.labour_rate) || 0,
      margin_pct: parseFloat(form.margin_pct) || 0,
      basic_rate: c.basicRate,
      margin_rate: c.marginRate,
      final_rate: c.finalRate,
      final_cost: c.finalCost,
      margin_amount: c.marginAmount,
      status: "draft",
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); } else {
      toast.success(`${refNumber} created`);
      setAddOpen(false);
      setForm({ description: "", scope_type: "Client Request", gfc_qty: "", material_rate: "", labour_rate: "", margin_pct: "20", notes: "" });
      fetch();
    }
    setSaving(false);
  };

  const handleApprove = async (v: Variation) => {
    const update: Record<string, any> = {};
    if (userRole === "architecture_director" && !v.approved_by_karan) {
      update.approved_by_karan = true;
      // Determine next stage
      const threshold = v.final_cost;
      if (threshold <= 25000) {
        update.status = "approved";
        update.approval_stage = "approved";
      } else {
        update.approval_stage = "pending_shiv";
        update.status = "pending_approval";
      }
    } else if (userRole === "finance_director" && v.approved_by_karan && !v.approved_by_shiv) {
      update.approved_by_shiv = true;
      if (v.final_cost <= 200000) {
        update.status = "approved";
        update.approval_stage = "approved";
      } else {
        update.approval_stage = "pending_md";
        update.status = "pending_approval";
      }
    } else if (userRole === "managing_director" && v.approved_by_karan && v.approved_by_shiv && !v.approved_by_md) {
      update.approved_by_md = true;
      update.status = "approved";
      update.approval_stage = "approved";
    } else {
      toast.error("Not your approval turn or already approved");
      return;
    }
    const { error } = await (supabase.from("variations" as any) as any).update(update).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Approved"); fetch(); }
  };

  const handleSubmitForApproval = async (v: Variation) => {
    const { error } = await (supabase.from("variations" as any) as any).update({
      status: "pending_approval",
      approval_stage: "pending_karan",
    }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Submitted for approval"); fetch(); }
  };

  const handleReject = async (v: Variation) => {
    const { error } = await (supabase.from("variations" as any) as any).update({
      status: "rejected",
      approval_stage: null,
    }).eq("id", v.id);
    if (error) toast.error(error.message);
    else { toast.success("Rejected"); fetch(); }
  };

  const { basicRate, marginRate, finalRate, finalCost, marginAmount } = calcs();

  const totalFinalCost = variations.reduce((s, v) => s + (v.final_cost ?? 0), 0);
  const totalMargin = variations.reduce((s, v) => s + (v.margin_amount ?? 0), 0);
  const approvedCount = variations.filter((v) => v.status === "approved" || v.status === "client_approved").length;

  const canApprove = ["architecture_director", "finance_director", "managing_director"].includes(userRole ?? "");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Variations", value: variations.length.toString() },
          { label: "Approved Revenue", value: `₹${totalFinalCost.toLocaleString("en-IN")}` },
          { label: "Total Margin", value: `₹${totalMargin.toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border p-3 text-center" style={{ backgroundColor: "#F7F7F7" }}>
            <p className="text-xs" style={{ color: "#666" }}>{s.label}</p>
            <p className="text-lg font-bold font-display mt-0.5" style={{ color: "#1A1A1A" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {variations.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "#999" }}>No variations yet.</p>
      ) : (
        <div className="space-y-2">
          {variations.map((v) => {
            const sc = STATUS_COLORS[v.status] ?? STATUS_COLORS.draft;
            return (
              <Card key={v.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold font-display" style={{ color: "#006039" }}>{v.ref_number}</span>
                        <Badge variant="outline" className="text-[9px] h-4" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                          {v.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] h-4" style={{ color: "#666", borderColor: "#ddd" }}>
                          {v.scope_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium mt-1" style={{ color: "#1A1A1A" }}>{v.description}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]" style={{ color: "#666" }}>
                        <span>Qty: <b>{v.gfc_qty}</b></span>
                        <span>Final Rate: <b>₹{(v.final_rate ?? 0).toLocaleString("en-IN")}</b></span>
                        <span className="font-bold" style={{ color: "#006039" }}>₹{(v.final_cost ?? 0).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="text-[10px] mt-1" style={{ color: "#999" }}>
                        Basic ₹{(v.basic_rate ?? 0).toLocaleString("en-IN")} | Margin ₹{(v.margin_amount ?? 0).toLocaleString("en-IN")} ({v.margin_pct}%)
                      </div>

                      {/* Approval chain */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {[
                          { label: "Karan", done: v.approved_by_karan },
                          ...(v.final_cost > 25000 ? [{ label: "Shiv", done: v.approved_by_shiv }] : []),
                          ...(v.final_cost > 200000 ? [{ label: "MD", done: v.approved_by_md }] : []),
                        ].map((step) => (
                          <div key={step.label} className="flex items-center gap-0.5 text-[9px]" style={{ color: step.done ? "#006039" : "#999" }}>
                            {step.done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {step.label}
                          </div>
                        ))}
                      </div>

                      <p className="text-[10px] mt-1" style={{ color: "#bbb" }}>{format(new Date(v.created_at), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      {v.status === "draft" && (
                        <Button size="sm" className="h-6 text-[9px] px-2 text-white" style={{ backgroundColor: "#D4860A" }} onClick={() => handleSubmitForApproval(v)}>
                          Submit
                        </Button>
                      )}
                      {canApprove && v.status === "pending_approval" && (
                        <>
                          <Button size="sm" className="h-6 text-[9px] px-2 text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove(v)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2" style={{ color: "#F40009" }} onClick={() => handleReject(v)}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New Variation</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Scope Type</Label>
              <Select value={form.scope_type} onValueChange={(v) => setForm((f) => ({ ...f, scope_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">GFC Qty *</Label>
                <Input type="number" value={form.gfc_qty} onChange={(e) => setForm((f) => ({ ...f, gfc_qty: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Material Rate (₹)</Label>
                <Input type="number" value={form.material_rate} onChange={(e) => setForm((f) => ({ ...f, material_rate: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Labour Rate (₹)</Label>
                <Input type="number" value={form.labour_rate} onChange={(e) => setForm((f) => ({ ...f, labour_rate: e.target.value }))} className="mt-1" placeholder="0" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Margin %</Label>
              <Input type="number" value={form.margin_pct} onChange={(e) => setForm((f) => ({ ...f, margin_pct: e.target.value }))} className="mt-1" placeholder="20" />
            </div>

            {/* Live calc preview */}
            <div className="rounded-lg p-3 space-y-1 text-xs" style={{ backgroundColor: "#E8F2ED" }}>
              <p className="font-semibold text-[10px] uppercase tracking-wider" style={{ color: "#006039" }}>Live Calculation</p>
              <div className="grid grid-cols-2 gap-1" style={{ color: "#1A1A1A" }}>
                <span>Basic Rate:</span><span className="font-semibold">₹{basicRate.toLocaleString("en-IN")}</span>
                <span>Margin Rate:</span><span className="font-semibold">₹{marginRate.toLocaleString("en-IN")}</span>
                <span>Final Rate:</span><span className="font-semibold">₹{finalRate.toLocaleString("en-IN")}</span>
                <span className="font-bold" style={{ color: "#006039" }}>Final Cost:</span>
                <span className="font-bold text-sm" style={{ color: "#006039" }}>₹{finalCost.toLocaleString("en-IN")}</span>
                <span>Margin Amount:</span><span className="font-semibold">₹{marginAmount.toLocaleString("en-IN")}</span>
              </div>
              {finalCost > 200000 && (
                <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "#D4860A" }}>
                  <AlertTriangle className="h-3 w-3" />
                  Requires 3-tier approval (Karan → Shiv → MD)
                </div>
              )}
              {finalCost > 25000 && finalCost <= 200000 && (
                <div className="flex items-center gap-1 mt-1 text-[10px]" style={{ color: "#D4860A" }}>
                  <AlertTriangle className="h-3 w-3" />
                  Requires 2-tier approval (Karan → Shiv)
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <p className="text-[10px]" style={{ color: "#666" }}>
              Note: Approved variations will be included in the project revenue and margin analysis.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Variation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-10">
        <Button
          onClick={() => setAddOpen(true)}
          className="rounded-full h-12 w-12 shadow-lg text-white"
          style={{ backgroundColor: "#006039" }}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

export default function Variations() {
  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden">
      <MobileProjectSwitcher />
      <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "#1A1A1A" }}>Variation Register</h1>
      <p className="text-sm mb-4" style={{ color: "#666666" }}>Track, price and approve project variations with full audit trail</p>
      <ProjectScopeGuard>
        <VariationsContent />
      </ProjectScopeGuard>
    </div>
  );
}
