import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Upload } from "lucide-react";

const PAYMENT_TERMS = ["40-40-20", "50-30-20", "Custom"];

export function HandoverChecklist({ dealId, dealName, contractValue, onComplete }: {
  dealId: string;
  dealName: string;
  contractValue: number;
  onComplete: () => void;
}) {
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sow_uploaded: false,
    floor_plans_uploaded: false,
    visualization_uploaded: false,
    design_preferences: "",
    special_requirements: "",
    payment_terms: "40-40-20",
    delivery_address: "",
    within_350km: false,
    ads_to_habitainer: false,
  });

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("sales_handover_checklists")
        .select("*")
        .eq("deal_id", dealId)
        .maybeSingle();
      if (data) {
        setChecklist(data);
        setForm({
          sow_uploaded: data.sow_uploaded || false,
          floor_plans_uploaded: data.floor_plans_uploaded || false,
          visualization_uploaded: data.visualization_uploaded || false,
          design_preferences: data.design_preferences || "",
          special_requirements: data.special_requirements || "",
          payment_terms: data.payment_terms || "40-40-20",
          delivery_address: data.delivery_address || "",
          within_350km: data.within_350km || false,
          ads_to_habitainer: data.ads_to_habitainer || false,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [dealId]);

  const handleSave = async (complete = false) => {
    if (complete) {
      if (!form.sow_uploaded || !form.floor_plans_uploaded || !form.visualization_uploaded) {
        toast.error("All documents must be uploaded");
        return;
      }
      if (form.design_preferences.length < 30) {
        toast.error("Design preferences must be at least 30 characters");
        return;
      }
      if (!form.delivery_address) {
        toast.error("Delivery address is required");
        return;
      }
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      ...form,
      special_requirements: form.special_requirements || "None",
      completed: complete,
      completed_at: complete ? new Date().toISOString() : null,
      completed_by: complete ? user?.id : null,
    };

    if (checklist) {
      const { error } = await supabase.from("sales_handover_checklists").update(payload).eq("id", checklist.id);
      if (error) toast.error(error.message);
      else { toast.success(complete ? "Handover complete!" : "Saved"); if (complete) onComplete(); }
    } else {
      payload.deal_id = dealId;
      const { error } = await supabase.from("sales_handover_checklists").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success(complete ? "Handover complete!" : "Saved"); if (complete) onComplete(); }
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center py-8 text-xs" style={{ color: "#999" }}>Loading…</div>;

  if (checklist?.completed) {
    return (
      <div className="text-center py-8 space-y-2">
        <CheckCircle2 className="h-10 w-10 mx-auto" style={{ color: "#006039" }} />
        <p className="font-bold" style={{ color: "#006039" }}>Handover Complete</p>
        <p className="text-xs" style={{ color: "#666" }}>All items confirmed and submitted.</p>
      </div>
    );
  }

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-3 mt-2">
      <p className="text-xs" style={{ color: "#666" }}>Complete all items before the deal can be fully closed.</p>

      <CheckItem label="Signed Scope of Work document uploaded" checked={form.sow_uploaded} onChange={v => set("sow_uploaded", v)} />
      <CheckItem label="2D floor plans uploaded" checked={form.floor_plans_uploaded} onChange={v => set("floor_plans_uploaded", v)} />
      <CheckItem label="3D visualisation uploaded" checked={form.visualization_uploaded} onChange={v => set("visualization_uploaded", v)} />

      <div>
        <Label className="text-xs">Client Design Preferences * (min 30 chars)</Label>
        <Textarea value={form.design_preferences} onChange={e => set("design_preferences", e.target.value)} rows={2} placeholder="Describe client's design preferences…" />
        <span className="text-[10px]" style={{ color: form.design_preferences.length >= 30 ? "#006039" : "#999" }}>
          {form.design_preferences.length}/30 min
        </span>
      </div>

      <div>
        <Label className="text-xs">Special Requirements</Label>
        <Textarea value={form.special_requirements} onChange={e => set("special_requirements", e.target.value)} rows={2} placeholder="Enter special requirements or 'None'" />
      </div>

      <div>
        <Label className="text-xs">Payment Terms</Label>
        <Select value={form.payment_terms} onValueChange={v => set("payment_terms", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs">Delivery Location *</Label>
        <Input value={form.delivery_address} onChange={e => set("delivery_address", e.target.value)} placeholder="Full address" />
        <div className="flex items-center gap-2 mt-1">
          <input type="checkbox" checked={form.within_350km} onChange={e => set("within_350km", e.target.checked)} id="hc350" />
          <Label htmlFor="hc350" className="text-xs">Confirm within 350km of Bangalore</Label>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.ads_to_habitainer} onChange={e => set("ads_to_habitainer", e.target.checked)} id="adsH" />
        <Label htmlFor="adsH" className="text-xs">ADS to Habitainer handover?</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="flex-1">
          Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1" style={{ background: "#006039", color: "#fff" }}>
          {saving ? "Saving…" : "Complete Handover"}
        </Button>
      </div>
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded" style={{ background: checked ? "#E8F2ED" : "#F7F7F7" }}>
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <span className="text-xs" style={{ color: checked ? "#006039" : "#1A1A1A" }}>{label}</span>
    </div>
  );
}
