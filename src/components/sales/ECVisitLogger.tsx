import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, MapPin, ThumbsUp, Minus, ThumbsDown } from "lucide-react";

const OUTCOMES = [
  { value: "positive", label: "Positive", icon: ThumbsUp, color: "#006039" },
  { value: "neutral", label: "Neutral", icon: Minus, color: "#D4860A" },
  { value: "negative", label: "Negative", icon: ThumbsDown, color: "#F40009" },
];

export function ECVisitLogger({ dealId, clientName }: { dealId: string; clientName: string }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ notes: "", outcome: "neutral", hosted_by_name: "" });
  const [saving, setSaving] = useState(false);

  const fetchVisits = async () => {
    const { data } = await supabase
      .from("experience_centre_visits")
      .select("*")
      .eq("deal_id", dealId)
      .order("visit_date", { ascending: false });
    setVisits(data || []);
  };

  useEffect(() => { fetchVisits(); }, [dealId]);

  const handleAdd = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("experience_centre_visits").insert({
      deal_id: dealId,
      client_name: clientName,
      hosted_by: user?.id,
      hosted_by_name: form.hosted_by_name || null,
      notes: form.notes || null,
      outcome: form.outcome,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("EC visit logged");
      setAdding(false);
      setForm({ notes: "", outcome: "neutral", hosted_by_name: "" });
      fetchVisits();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Experience Centre Visits</span>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} style={{ borderColor: "#006039", color: "#006039" }}>
          <Plus className="h-3 w-3 mr-1" /> Log Visit
        </Button>
      </div>

      {visits.map(v => {
        const oc = OUTCOMES.find(o => o.value === v.outcome) || OUTCOMES[1];
        return (
          <div key={v.id} className="rounded-lg p-3" style={{ background: "#F7F7F7", border: "1px solid #E5E7EB" }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>
                <MapPin className="h-3 w-3 inline mr-1" />
                {format(new Date(v.visit_date), "dd/MM/yyyy")}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: oc.color, color: "#fff" }}>
                {oc.label}
              </span>
            </div>
            {v.hosted_by_name && <div className="text-xs" style={{ color: "#666" }}>Hosted by: {v.hosted_by_name}</div>}
            {v.notes && <div className="text-xs mt-1" style={{ color: "#666" }}>{v.notes}</div>}
          </div>
        );
      })}

      {visits.length === 0 && !adding && (
        <div className="text-center py-8 text-xs" style={{ color: "#999" }}>No EC visits logged</div>
      )}

      {adding && (
        <div className="rounded-lg p-3 space-y-2" style={{ background: "#F7F7F7", border: "1px solid #006039" }}>
          <div><Label className="text-xs">Hosted By</Label><Input value={form.hosted_by_name} onChange={e => setForm(f => ({ ...f, hosted_by_name: e.target.value }))} placeholder="Sales rep name" /></div>
          <div><Label className="text-xs">Outcome</Label>
            <Select value={form.outcome} onValueChange={v => setForm(f => ({ ...f, outcome: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OUTCOMES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
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
