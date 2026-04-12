import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Bell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface SubcontractorPanelProps {
  projectId: string;
}

export function SubcontractorPanel({ projectId }: SubcontractorPanelProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ contractor_name: "", scope_of_work: "", start_date: "", end_date: "", contract_value: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("subcontractor_assignments" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("end_date", { ascending: true });
    setAssignments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.contractor_name || !form.end_date) { toast.error("Contractor name and end date required"); return; }
    setSaving(true);
    const { error } = await (supabase.from("subcontractor_assignments" as any) as any).insert({
      project_id: projectId,
      contractor_name: form.contractor_name,
      scope_of_work: form.scope_of_work || null,
      start_date: form.start_date || null,
      end_date: form.end_date,
      contract_value: form.contract_value ? parseFloat(form.contract_value) : null,
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Subcontractor added");
      setAddOpen(false);
      setForm({ contractor_name: "", scope_of_work: "", start_date: "", end_date: "", contract_value: "" });
      fetchData();
    }
    setSaving(false);
  };

  const handleSendReminder = async (a: any) => {
    // Notify site_installation_mgr and head_operations
    const { data: notifyUsers } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", ["site_installation_mgr", "head_operations"] as any)
      .eq("is_active", true);
    for (const u of notifyUsers ?? []) {
      await insertNotifications({
        recipient_id: u.auth_user_id,
        title: "Subcontractor Deadline Approaching",
        body: `${a.contractor_name}'s deadline for "${a.scope_of_work || "work"}" is on ${format(parseISO(a.end_date), "dd/MM/yyyy")}.`,
        category: "production",
        related_table: "subcontractor_assignments",
        related_id: a.id,
      });
    }
    toast.success("Reminder sent to site team");
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Subcontractors</p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Subcontractor
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#999" }}>No subcontractors assigned.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map((a: any) => {
            const daysToEnd = differenceInDays(parseISO(a.end_date), new Date());
            const is14d = daysToEnd <= 14 && daysToEnd > 5;
            const is5d = daysToEnd <= 5 && daysToEnd > 1;
            const is1d = daysToEnd <= 1;
            const alertColor = is1d ? "#F40009" : is5d ? "#D4860A" : is14d ? "#B45309" : "#006039";

            return (
              <Card key={a.id} style={{ borderColor: (is1d || is5d) ? alertColor : undefined }}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{a.contractor_name}</p>
                      {a.scope_of_work && <p className="text-xs" style={{ color: "#666" }}>{a.scope_of_work}</p>}
                      {a.contract_value && <p className="text-xs" style={{ color: "#006039" }}>₹{Number(a.contract_value).toLocaleString("en-IN")}</p>}
                      <p className="text-xs mt-0.5" style={{ color: alertColor }}>
                        Deadline: {format(parseISO(a.end_date), "dd/MM/yyyy")}
                        {daysToEnd >= 0 ? ` (${daysToEnd}d)` : ` (${Math.abs(daysToEnd)}d overdue)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(is1d || is5d || is14d) && (
                        <Badge variant="outline" className="text-[10px]" style={{ color: alertColor, borderColor: alertColor }}>
                          {is1d ? "⚠ 1d" : is5d ? "5d" : "14d"}
                        </Badge>
                      )}
                      {(is1d || is5d || is14d) && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => handleSendReminder(a)}>
                          <Bell className="h-3 w-3 mr-1" /> Remind
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
          <DialogHeader><DialogTitle className="font-display">Add Subcontractor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Contractor Name *</Label><Input value={form.contractor_name} onChange={(e) => setForm((f) => ({ ...f, contractor_name: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Scope of Work</Label><Input value={form.scope_of_work} onChange={(e) => setForm((f) => ({ ...f, scope_of_work: e.target.value }))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1" /></div>
              <div><Label className="text-xs">End Date *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1" /></div>
            </div>
            <div><Label className="text-xs">Contract Value (₹)</Label><Input type="number" value={form.contract_value} onChange={(e) => setForm((f) => ({ ...f, contract_value: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
