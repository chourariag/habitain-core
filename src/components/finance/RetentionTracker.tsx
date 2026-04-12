import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Shield, Bell } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

const RETENTION_RATE = 0.025; // 2.5%

export function RetentionTracker() {
  const [records, setRecords] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", contract_value: "", release_date: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: recs }, { data: projs }] = await Promise.all([
      (supabase.from("retention_records" as any) as any)
        .select("*, projects(name, client_name)")
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name, client_name, project_type").eq("is_archived", false).order("name"),
    ]);
    setRecords(recs ?? []);
    setProjects(projs ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.project_id || !form.contract_value) { toast.error("Project and contract value required"); return; }
    setSaving(true);
    const amount = parseFloat(form.contract_value) * RETENTION_RATE;
    const { error } = await (supabase.from("retention_records" as any) as any).insert({
      project_id: form.project_id,
      contract_value: parseFloat(form.contract_value),
      retention_amount: amount,
      retention_rate: RETENTION_RATE,
      release_date: form.release_date || null,
      status: "held",
    });
    if (error) { toast.error(error.message); } else {
      toast.success(`Retention of ₹${amount.toLocaleString("en-IN")} added (2.5% B2B)`);
      setAddOpen(false);
      setForm({ project_id: "", contract_value: "", release_date: "" });
      fetchData();
    }
    setSaving(false);
  };

  const handleRelease = async (id: string) => {
    await (supabase.from("retention_records" as any) as any).update({ status: "released", released_at: new Date().toISOString() }).eq("id", id);
    toast.success("Retention released");
    fetchData();
  };

  const handleSendReminder = async (rec: any) => {
    // Notify Mary (finance) + Suraj (managing director)
    const { data: notifyUsers } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", ["finance_director", "managing_director"] as any)
      .eq("is_active", true);
    for (const u of notifyUsers ?? []) {
      await insertNotifications({
        recipient_id: u.auth_user_id,
        title: "Retention Release Due",
        body: `Retention of ₹${Number(rec.retention_amount).toLocaleString("en-IN")} for ${rec.projects?.name} is due for release on ${format(parseISO(rec.release_date), "dd/MM/yyyy")}.`,
        category: "finance",
        related_table: "retention_records",
        related_id: rec.id,
      });
    }
    toast.success("Reminder sent to Finance Director and MD");
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const totalHeld = records.filter((r) => r.status === "held").reduce((s: number, r: any) => s + Number(r.retention_amount), 0);

  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "#666" }}>Retention at 2.5% — B2B contracts only. 30-day release reminders sent to Finance Director & MD.</p>
          <p className="text-xs mt-0.5 font-medium" style={{ color: "#D4860A" }}>Total Held: ₹{totalHeld.toLocaleString("en-IN")}</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Retention
        </Button>
      </div>

      {records.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm" style={{ color: "#999" }}>No retention records.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {records.map((rec: any) => {
            const isHeld = rec.status === "held";
            const daysToRelease = rec.release_date ? differenceInDays(parseISO(rec.release_date), new Date()) : null;
            const dueSoon = daysToRelease !== null && daysToRelease <= 30 && daysToRelease >= 0;
            return (
              <Card key={rec.id} style={{ borderColor: dueSoon ? "#D4860A" : undefined }}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{rec.projects?.name}</p>
                      <p className="text-xs" style={{ color: "#666" }}>{rec.projects?.client_name}</p>
                      <p className="text-xs mt-0.5">
                        <span style={{ color: "#666" }}>Retention:</span>
                        <span className="font-mono font-bold ml-1" style={{ color: "#006039" }}>₹{Number(rec.retention_amount).toLocaleString("en-IN")}</span>
                        <span className="text-[10px] ml-1" style={{ color: "#999" }}>(2.5% of ₹{Number(rec.contract_value).toLocaleString("en-IN")})</span>
                      </p>
                      {rec.release_date && (
                        <p className="text-xs mt-0.5" style={{ color: dueSoon ? "#D4860A" : "#999" }}>
                          Release date: {format(parseISO(rec.release_date), "dd/MM/yyyy")}
                          {daysToRelease !== null && ` (${daysToRelease}d)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: isHeld ? "#D4860A" : "#006039",
                        borderColor: isHeld ? "#D4860A" : "#006039",
                        backgroundColor: isHeld ? "#FFF8E8" : "#E8F2ED",
                      }}>
                        {isHeld ? "Held" : "Released"}
                      </Badge>
                      {isHeld && dueSoon && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleSendReminder(rec)}>
                          <Bell className="h-3 w-3 mr-1" /> Remind
                        </Button>
                      )}
                      {isHeld && (
                        <Button size="sm" className="h-6 text-[10px] text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleRelease(rec.id)}>
                          Release
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Retention Record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs rounded-md p-2" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              Retention applies to B2B contracts only at 2.5% of contract value.
            </p>
            <div>
              <Label className="text-xs">Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Contract Value (₹) *</Label>
              <Input type="number" value={form.contract_value} onChange={(e) => setForm((f) => ({ ...f, contract_value: e.target.value }))} className="mt-1" />
              {form.contract_value && (
                <p className="text-xs mt-1" style={{ color: "#006039" }}>
                  Retention amount: ₹{(parseFloat(form.contract_value || "0") * RETENTION_RATE).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Expected Release Date</Label>
              <Input type="date" value={form.release_date} onChange={(e) => setForm((f) => ({ ...f, release_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
