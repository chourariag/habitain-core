import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

const PAYMENT_TERMS = ["40-40-20", "50-30-20", "30-40-30", "Custom"];

export function QuotationVersionsPanel({ dealId }: { dealId: string }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    total_value: "",
    scope_changes: "No change",
    payment_terms: "40-40-20",
    timeline: "",
    sent_to: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchVersions = async () => {
    const { data } = await supabase
      .from("quotation_versions")
      .select("*")
      .eq("deal_id", dealId)
      .order("version_number", { ascending: true });
    setVersions(data || []);
  };

  useEffect(() => { fetchVersions(); }, [dealId]);

  const handleAdd = async () => {
    if (!form.total_value) { toast.error("Total value required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const nextVersion = versions.length + 1;
    const prevValue = versions.length > 0 ? versions[versions.length - 1].total_value : null;

    const { error } = await supabase.from("quotation_versions").insert({
      deal_id: dealId,
      version_number: nextVersion,
      total_value: Number(form.total_value),
      prev_value: prevValue,
      scope_changes: form.scope_changes || "No change",
      payment_terms: form.payment_terms,
      timeline: form.timeline || null,
      sent_to: form.sent_to || null,
      created_by: user?.id,
    } as any);

    if (error) toast.error(error.message);
    else {
      toast.success(`V${nextVersion} added`);
      setAdding(false);
      setForm({ total_value: "", scope_changes: "No change", payment_terms: "40-40-20", timeline: "", sent_to: "" });
      fetchVersions();
    }
    setSaving(false);
  };

  const fmt = (v: number) => {
    if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`;
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    return `₹${v?.toLocaleString() || 0}`;
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Quotation Versions</span>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} style={{ borderColor: "#006039", color: "#006039" }}>
          <Plus className="h-3 w-3 mr-1" /> Add Version
        </Button>
      </div>

      {versions.map(v => (
        <div key={v.id} className="rounded-lg p-3 space-y-1" style={{ background: "#F7F7F7", border: "1px solid #E5E7EB" }}>
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm" style={{ color: "#006039" }}>V{v.version_number}</span>
            <span className="text-xs" style={{ color: "#666" }}>{format(new Date(v.date_sent || v.created_at), "dd/MM/yyyy")}</span>
          </div>
          <div className="text-lg font-bold" style={{ color: "#1A1A1A" }}>{fmt(v.total_value)}</div>
          {v.price_change_amount !== 0 && v.price_change_amount != null && (
            <div className="flex items-center gap-1 text-xs">
              {v.price_change_amount > 0 ? (
                <TrendingUp className="h-3 w-3" style={{ color: "#006039" }} />
              ) : (
                <TrendingDown className="h-3 w-3" style={{ color: "#F40009" }} />
              )}
              <span style={{ color: v.price_change_amount > 0 ? "#006039" : "#F40009" }}>
                {fmt(Math.abs(v.price_change_amount))} ({v.price_change_pct > 0 ? "+" : ""}{v.price_change_pct}%)
              </span>
            </div>
          )}
          <div className="text-xs" style={{ color: "#666" }}>
            <span className="font-medium">Terms:</span> {v.payment_terms}
            {v.sent_to && <> · <span className="font-medium">Sent to:</span> {v.sent_to}</>}
          </div>
          {v.scope_changes !== "No change" && (
            <div className="text-xs" style={{ color: "#666" }}>
              <span className="font-medium">Scope:</span> {v.scope_changes}
            </div>
          )}
        </div>
      ))}

      {versions.length === 0 && !adding && (
        <div className="text-center py-8 text-xs" style={{ color: "#999" }}>No quotations logged yet</div>
      )}

      {adding && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "#F7F7F7", border: "1px solid #006039" }}>
          <span className="text-xs font-semibold" style={{ color: "#006039" }}>New Version (V{versions.length + 1})</span>
          <div><Label className="text-xs">Total Value ₹ *</Label><Input type="number" value={form.total_value} onChange={e => setForm(f => ({ ...f, total_value: e.target.value }))} /></div>
          <div><Label className="text-xs">Scope Changes</Label><Textarea value={form.scope_changes} onChange={e => setForm(f => ({ ...f, scope_changes: e.target.value }))} rows={2} /></div>
          <div><Label className="text-xs">Payment Terms</Label>
            <Select value={form.payment_terms} onValueChange={v => setForm(f => ({ ...f, payment_terms: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Timeline (optional)</Label><Input value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))} /></div>
          <div><Label className="text-xs">Sent To</Label><Input value={form.sent_to} onChange={e => setForm(f => ({ ...f, sent_to: e.target.value }))} /></div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving} style={{ background: "#006039", color: "#fff" }}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
