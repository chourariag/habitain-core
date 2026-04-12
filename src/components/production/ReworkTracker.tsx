import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function ReworkTracker() {
  const [entries, setEntries] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    module_id: "", rework_type: "", hours_worked: "", rate_per_hour: "", description: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: ents }, { data: mods }] = await Promise.all([
      (supabase.from("rework_log_entries" as any) as any)
        .select("*, modules(module_code, name, projects(name))")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("modules").select("id, module_code, name").eq("is_archived", false).in("production_status", ["not_started", "in_progress"]),
    ]);
    setEntries(ents ?? []);
    setModules(mods ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.module_id || !form.hours_worked || !form.rate_per_hour) {
      toast.error("Module, hours and rate are required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("rework_log_entries" as any) as any).insert({
      module_id: form.module_id,
      rework_type: form.rework_type || "General",
      hours_worked: parseFloat(form.hours_worked),
      rate_per_hour: parseFloat(form.rate_per_hour),
      description: form.description || null,
      logged_by: user?.id,
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Rework entry logged");
      setAddOpen(false);
      setForm({ module_id: "", rework_type: "", hours_worked: "", rate_per_hour: "", description: "" });
      fetchData();
    }
    setSaving(false);
  };

  const totalReworkCost = entries.reduce((s: number, e: any) => s + (Number(e.rework_cost) || (Number(e.hours_worked) * Number(e.rate_per_hour))), 0);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "#666" }}>Rework cost = Contractor rate × Hours worked</p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: "#F40009" }}>Total Rework Cost: ₹{totalReworkCost.toLocaleString("en-IN")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Log Rework
        </Button>
      </div>

      {entries.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><RefreshCw className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm" style={{ color: "#999" }}>No rework entries yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e: any) => {
            const cost = Number(e.rework_cost) || (Number(e.hours_worked) * Number(e.rate_per_hour));
            return (
              <Card key={e.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>
                        {e.modules?.module_code || e.modules?.name} — {e.rework_type}
                      </p>
                      <p className="text-xs" style={{ color: "#666" }}>{e.modules?.projects?.name}</p>
                      {e.description && <p className="text-xs mt-0.5" style={{ color: "#999" }}>{e.description}</p>}
                      <p className="text-xs mt-0.5" style={{ color: "#999" }}>
                        {e.hours_worked}h × ₹{e.rate_per_hour}/h · {format(new Date(e.created_at), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-sm shrink-0" style={{ color: "#F40009" }}>
                      ₹{cost.toLocaleString("en-IN")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Log Rework</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Module *</Label>
              <Select value={form.module_id} onValueChange={(v) => setForm((f) => ({ ...f, module_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select module" /></SelectTrigger>
                <SelectContent>{modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.module_code || m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Rework Type</Label>
              <Select value={form.rework_type} onValueChange={(v) => setForm((f) => ({ ...f, rework_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["Welding", "Drywall", "MEP", "Paint", "Structural", "Finishing", "General"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Hours Worked *</Label>
                <Input type="number" step="0.5" value={form.hours_worked} onChange={(e) => setForm((f) => ({ ...f, hours_worked: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Rate/Hour (₹) *</Label>
                <Input type="number" value={form.rate_per_hour} onChange={(e) => setForm((f) => ({ ...f, rate_per_hour: e.target.value }))} className="mt-1" />
              </div>
            </div>
            {form.hours_worked && form.rate_per_hour && (
              <p className="text-xs font-medium" style={{ color: "#006039" }}>
                Rework cost: ₹{(parseFloat(form.hours_worked) * parseFloat(form.rate_per_hour)).toLocaleString("en-IN")}
              </p>
            )}
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
