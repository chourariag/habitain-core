import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { ClientWorkOrder, WoPaymentStage } from "@/lib/contractor-wo";
import { getPaymentStages } from "@/lib/contractor-wo";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workOrder?: ClientWorkOrder | null;
  onSaved: () => void;
}

const emptyWO: any = {
  wo_number: "", amendment_number: "", client_company_name: "", client_contact_name: "",
  client_contact_email: "", client_contact_phone: "", issue_date: "", amendment_date: "",
  commencement_date: "", completion_days: "", retention_pct: "5", dlp_months: "12",
  delay_damages_pct_per_week: "0.5", delay_damages_cap_pct: "5",
  material_advance_pct_1: "25", material_advance_pct_2: "25",
  advance_recovery_threshold_pct: "80", advance_disbursed: "0", advance_recovered_to_date: "0",
  gst_pct: "18", sub_total: "0", discount: "0", grand_total: "0",
  acceptance_platform: "", acceptance_document_id: "", acceptance_date: "",
  our_signatory: "", witness_name: "", acceptance_pdf_url: "", notes: "",
};

export function ClientWorkOrderDialog({ open, onOpenChange, workOrder, onSaved }: Props) {
  const [f, setF] = useState<any>(emptyWO);
  const [stages, setStages] = useState<WoPaymentStage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (workOrder) {
      const next: any = { ...emptyWO };
      Object.keys(emptyWO).forEach((k) => { next[k] = (workOrder as any)[k] ?? ""; });
      setF(next);
      getPaymentStages(workOrder.id).then(setStages);
    } else {
      setF(emptyWO);
      setStages([{ stage_order: 1, stage_name: "", percentage: 0, trigger_description: "" }]);
    }
  }, [open, workOrder]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p: any) => ({ ...p, [k]: e.target.value }));

  const pctTotal = stages.reduce((s, x) => s + (Number(x.percentage) || 0), 0);

  const num = (v: any) => (v === "" || v === null || v === undefined ? 0 : Number(v));
  const dat = (v: any) => (v ? v : null);

  const save = async () => {
    if (!f.wo_number.trim()) { toast.error("Work Order number is required"); return; }
    if (!f.client_company_name.trim()) { toast.error("Client company is required"); return; }
    if (stages.length === 0) { toast.error("Add at least one payment stage"); return; }
    if (stages.some((s) => !s.stage_name.trim())) { toast.error("Every payment stage needs a name"); return; }
    if (Math.abs(pctTotal - 100) > 0.01) { toast.error(`Payment stages total ${pctTotal}% — must equal 100%`); return; }

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const payload: any = {
        wo_number: f.wo_number.trim(),
        amendment_number: f.amendment_number || null,
        client_company_name: f.client_company_name.trim(),
        client_contact_name: f.client_contact_name || null,
        client_contact_email: f.client_contact_email || null,
        client_contact_phone: f.client_contact_phone || null,
        issue_date: dat(f.issue_date), amendment_date: dat(f.amendment_date),
        commencement_date: dat(f.commencement_date),
        completion_days: num(f.completion_days),
        retention_pct: num(f.retention_pct), dlp_months: num(f.dlp_months),
        delay_damages_pct_per_week: num(f.delay_damages_pct_per_week),
        delay_damages_cap_pct: num(f.delay_damages_cap_pct),
        material_advance_pct_1: num(f.material_advance_pct_1),
        material_advance_pct_2: num(f.material_advance_pct_2),
        advance_recovery_threshold_pct: num(f.advance_recovery_threshold_pct),
        advance_disbursed: num(f.advance_disbursed),
        advance_recovered_to_date: num(f.advance_recovered_to_date),
        gst_pct: num(f.gst_pct), sub_total: num(f.sub_total),
        discount: num(f.discount), grand_total: num(f.grand_total),
        acceptance_platform: f.acceptance_platform || null,
        acceptance_document_id: f.acceptance_document_id || null,
        acceptance_date: dat(f.acceptance_date),
        our_signatory: f.our_signatory || null,
        witness_name: f.witness_name || null,
        acceptance_pdf_url: f.acceptance_pdf_url || null,
        acceptance_signed: !!(f.our_signatory && f.acceptance_date && f.acceptance_document_id && f.acceptance_pdf_url),
        notes: f.notes || null,
        updated_by: auth.user?.id ?? null,
      };

      let woId = workOrder?.id;
      if (woId) {
        const { error } = await (supabase.from("client_work_orders" as any) as any).update(payload).eq("id", woId);
        if (error) throw error;
        await (supabase.from("client_wo_payment_stages" as any) as any).delete().eq("work_order_id", woId);
      } else {
        const { data, error } = await (supabase.from("client_work_orders" as any) as any)
          .insert({ ...payload, created_by: auth.user?.id ?? null }).select("id").single();
        if (error) throw error;
        woId = data.id;
      }

      const rows = stages.map((s, i) => ({
        work_order_id: woId, stage_order: i + 1, stage_name: s.stage_name.trim(),
        percentage: Number(s.percentage) || 0, trigger_description: s.trigger_description || null,
      }));
      const { error: sErr } = await (supabase.from("client_wo_payment_stages" as any) as any).insert(rows);
      if (sErr) throw sErr;

      toast.success(workOrder ? "Work Order updated" : "Work Order created");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to save Work Order");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, type = "text", hint }: { label: string; k: string; type?: string; hint?: string }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={f[k] ?? ""} onChange={set(k)} />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-3xl">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-display text-xl">
              {workOrder ? `Work Order ${workOrder.wo_number}` : "New Contractor Work Order"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Client-issued Work Order to ALTREE. Commercial terms apply to every project linked to this WO.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Work Order</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="WO Number *" k="wo_number" />
                <Field label="Amendment No." k="amendment_number" />
                <Field label="Amendment Date" k="amendment_date" type="date" />
                <Field label="Client Company *" k="client_company_name" />
                <Field label="Contact Name" k="client_contact_name" />
                <Field label="Contact Email" k="client_contact_email" type="email" />
                <Field label="Contact Phone" k="client_contact_phone" />
                <Field label="Issue Date" k="issue_date" type="date" />
                <Field label="Commencement Date" k="commencement_date" type="date" />
                <Field label="Completion Days" k="completion_days" type="number" />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Commercials</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Sub Total (₹)" k="sub_total" type="number" />
                <Field label="Discount (₹)" k="discount" type="number" />
                <Field label="GST %" k="gst_pct" type="number" />
                <Field label="Grand Total (₹)" k="grand_total" type="number" />
                <Field label="Retention %" k="retention_pct" type="number" />
                <Field label="DLP (months)" k="dlp_months" type="number" />
                <Field label="Delay damages %/week" k="delay_damages_pct_per_week" type="number" />
                <Field label="Delay damages cap %" k="delay_damages_cap_pct" type="number" />
                <Field label="Material advance % (1)" k="material_advance_pct_1" type="number" />
                <Field label="Material advance % (2)" k="material_advance_pct_2" type="number" />
                <Field label="Advance disbursed (₹)" k="advance_disbursed" type="number" />
                <Field label="Advance recovered (₹)" k="advance_recovered_to_date" type="number" />
                <Field label="Advance recovery threshold %" k="advance_recovery_threshold_pct" type="number"
                  hint="Recovery flagged until cumulative billing reaches this % of grand total (EPC default 80%)." />
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Acceptance Statement <span className="normal-case font-normal">(signed by ALTREE, replaces Sale Agreement)</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Signing Platform" k="acceptance_platform" hint="e.g. Zoho Sign" />
                <Field label="Document ID" k="acceptance_document_id" />
                <Field label="Acceptance Date" k="acceptance_date" type="date" />
                <Field label="Our Signatory (ALTREE Director)" k="our_signatory" />
                <Field label="Witness Name" k="witness_name" />
                <Field label="Signed PDF URL" k="acceptance_pdf_url" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                All four of signatory, acceptance date, document ID and signed PDF are required before any project under
                this Work Order can be submitted.
              </p>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment Schedule</p>
                <span className="text-xs font-bold tabular-nums"
                  style={{ color: Math.abs(pctTotal - 100) < 0.01 ? "#006039" : "#F40009" }}>
                  {pctTotal}% / 100%
                </span>
              </div>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <Input className="col-span-4" placeholder="Stage name" value={s.stage_name}
                      onChange={(e) => setStages((p) => p.map((x, j) => j === i ? { ...x, stage_name: e.target.value } : x))} />
                    <Input className="col-span-2" type="number" placeholder="%" value={s.percentage}
                      onChange={(e) => setStages((p) => p.map((x, j) => j === i ? { ...x, percentage: Number(e.target.value) } : x))} />
                    <Input className="col-span-5" placeholder="Trigger description" value={s.trigger_description ?? ""}
                      onChange={(e) => setStages((p) => p.map((x, j) => j === i ? { ...x, trigger_description: e.target.value } : x))} />
                    <Button type="button" variant="ghost" size="icon" className="col-span-1"
                      onClick={() => setStages((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setStages((p) => [...p, { stage_order: p.length + 1, stage_name: "", percentage: 0, trigger_description: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add stage
              </Button>
            </section>

            <div className="space-y-1.5 pb-4">
              <Label className="text-xs">Notes</Label>
              <Textarea value={f.notes ?? ""} onChange={set("notes")} rows={2} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t bg-background px-4 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} style={{ backgroundColor: "#006039", color: "white" }}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {workOrder ? "Save Changes" : "Create Work Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
