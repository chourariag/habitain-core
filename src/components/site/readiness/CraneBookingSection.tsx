import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { craneComplete } from "@/lib/site-readiness-foundation";
import { ReadinessPhotos, type ReadinessPhoto } from "./ReadinessPhotos";

interface Props { projectId: string; canEdit: boolean; onComplete: (done: boolean) => void }

const EMPTY = { vendor_name: "", vendor_contact_phone: "", operator_name: "", operator_phone: "", capacity_tonnes: "", booked_for_date: "", slot_hours: "", operator_site_visit_done: false, operator_visit_date: "", comment: "" };
const EMPTY_COST = { rate_inr: "", rate_basis: "", total_cost_inr: "", advance_paid_inr: "" };
const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: string) => (v.trim() === "" ? null : Number(v));

export function CraneBookingSection({ projectId, canEdit, onComplete }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [c, setC] = useState(EMPTY);
  const [photos, setPhotos] = useState<ReadinessPhoto[]>([]);
  const [cost, setCost] = useState(EMPTY_COST);
  const [costVisible, setCostVisible] = useState(false);
  const [costEntered, setCostEntered] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cr }, { data: co }, { data: entered }] = await Promise.all([
      (supabase.from("site_readiness_crane") as any).select("*").eq("project_id", projectId).maybeSingle(),
      (supabase.from("site_readiness_crane_cost") as any).select("*").eq("project_id", projectId).maybeSingle(),
      (supabase.rpc as any)("crane_cost_entered", { p_project_id: projectId }),
    ]);
    if (cr) {
      setC({ vendor_name: s(cr.vendor_name), vendor_contact_phone: s(cr.vendor_contact_phone), operator_name: s(cr.operator_name), operator_phone: s(cr.operator_phone), capacity_tonnes: s(cr.capacity_tonnes), booked_for_date: s(cr.booked_for_date), slot_hours: s(cr.slot_hours), operator_site_visit_done: !!cr.operator_site_visit_done, operator_visit_date: s(cr.operator_visit_date), comment: s(cr.comment) });
      setPhotos(Array.isArray(cr.photo_paths) ? cr.photo_paths : []);
    }
    setCostVisible(!!co);
    if (co) setCost({ rate_inr: s(co.rate_inr), rate_basis: s(co.rate_basis), total_cost_inr: s(co.total_cost_inr), advance_paid_inr: s(co.advance_paid_inr) });
    setCostEntered(!!entered);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  const complete = craneComplete(c, costEntered);
  useEffect(() => { onComplete(complete); }, [complete, onComplete]);

  const save = async (nextPhotos = photos) => {
    if (c.operator_site_visit_done && !c.operator_visit_date) { toast.error("Enter the operator site visit date."); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from("site_readiness_crane") as any).upsert({
        project_id: projectId, vendor_name: c.vendor_name || null, vendor_contact_phone: c.vendor_contact_phone || null,
        operator_name: c.operator_name || null, operator_phone: c.operator_phone || null, capacity_tonnes: n(c.capacity_tonnes),
        booked_for_date: c.booked_for_date || null, slot_hours: n(c.slot_hours), operator_site_visit_done: c.operator_site_visit_done,
        operator_visit_date: c.operator_visit_date || null, comment: c.comment || null, photo_paths: nextPhotos,
      }, { onConflict: "project_id" });
      if (error) throw error;
      const hasCost = Object.values(cost).some((v) => v.trim() !== "");
      if (hasCost && (costVisible || !costEntered)) {
        const { error: e2 } = await (supabase.from("site_readiness_crane_cost") as any).upsert({
          project_id: projectId, rate_inr: n(cost.rate_inr), rate_basis: cost.rate_basis || null, total_cost_inr: n(cost.total_cost_inr), advance_paid_inr: n(cost.advance_paid_inr),
        }, { onConflict: "project_id" });
        if (e2) throw e2;
      }
      toast.success("Crane booking saved");
      await load();
    } catch (e: any) {
      toast.error(/row-level security|permission/i.test(e?.message ?? "") ? "You don't have permission to change the crane booking." : (e?.message || "Could not save. Try again."));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const F = ({ label, k, type = "text", mode }: { label: string; k: keyof typeof EMPTY; type?: string; mode?: "decimal" | "tel" }) => (
    <label className="text-xs space-y-1 min-w-0 block"><span className="block text-muted-foreground">{label}</span>
      <Input type={type} inputMode={mode} disabled={!canEdit} value={c[k] as string} onChange={(e) => setC((p) => ({ ...p, [k]: e.target.value }))} className="h-9 text-sm" /></label>
  );
  const CF = ({ label, k, mode }: { label: string; k: keyof typeof EMPTY_COST; mode?: "decimal" }) => (
    <label className="text-xs space-y-1 min-w-0 block"><span className="block text-muted-foreground">{label}</span>
      <Input inputMode={mode} disabled={!canEdit} value={cost[k]} onChange={(e) => setCost((p) => ({ ...p, [k]: e.target.value }))} className="h-9 text-sm" /></label>
  );

  return (
    <div className="space-y-3 min-w-0">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {F({ label: "Vendor *", k: "vendor_name" })}
        {F({ label: "Vendor contact phone *", k: "vendor_contact_phone", type: "tel", mode: "tel" })}
        {F({ label: "Operator name", k: "operator_name" })}
        {F({ label: "Operator phone", k: "operator_phone", type: "tel", mode: "tel" })}
        {F({ label: "Capacity (tonnes) *", k: "capacity_tonnes", mode: "decimal" })}
        {F({ label: "Booked for date *", k: "booked_for_date", type: "date" })}
        {F({ label: "Slot (hours)", k: "slot_hours", mode: "decimal" })}
      </div>
      <div className="rounded-md border border-border p-2.5 space-y-2">
        <label className="flex items-center gap-2 text-sm"><Checkbox disabled={!canEdit} checked={c.operator_site_visit_done} onCheckedChange={(v) => setC((p) => ({ ...p, operator_site_visit_done: !!v }))} /> Operator site visit done *</label>
        {c.operator_site_visit_done && F({ label: "Visit date *", k: "operator_visit_date", type: "date" })}
      </div>
      <div className="rounded-md border border-border p-2.5 space-y-2">
        <p className="text-xs font-semibold">Crane cost (₹) *</p>
        {costEntered && !costVisible ? (
          <p className="text-xs text-muted-foreground">Cost has been entered. Amounts are visible to finance and senior management only.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CF({ label: "Rate (₹)", k: "rate_inr", mode: "decimal" })}
            {CF({ label: "Rate basis (per hour, per day, lump sum)", k: "rate_basis" })}
            {CF({ label: "Total cost (₹)", k: "total_cost_inr", mode: "decimal" })}
            {CF({ label: "Advance paid (₹)", k: "advance_paid_inr", mode: "decimal" })}
          </div>
        )}
      </div>
      <Textarea rows={2} disabled={!canEdit} value={c.comment} onChange={(e) => setC((p) => ({ ...p, comment: e.target.value }))} placeholder="Comment (optional)" className="text-sm" />
      <ReadinessPhotos projectId={projectId} folder="crane" photos={photos} readOnly={!canEdit} onChange={(p) => { setPhotos(p); save(p); }} />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && <Button size="sm" variant="outline" onClick={() => save()} disabled={saving} className="w-full sm:w-auto">{saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save crane booking</Button>}
        <span className={cn("text-xs font-medium", complete ? "text-primary" : "text-muted-foreground")}>{complete ? "Crane booking complete" : "Needs vendor, contact, date, capacity, operator visit and cost"}</span>
      </div>
    </div>
  );
}
