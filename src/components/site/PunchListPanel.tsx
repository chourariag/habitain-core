import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, CheckSquare, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PunchListPanelProps {
  projectId: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  open: { color: "#F40009", bg: "#FEE2E2" },
  in_progress: { color: "#D4860A", bg: "#FFF8E8" },
  closed: { color: "#006039", bg: "#E8F2ED" },
  waived: { color: "#999", bg: "#F7F7F7" },
};

export function PunchListPanel({ projectId }: PunchListPanelProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ description: "", location: "", priority: "standard", assigned_to_name: "" });
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("punch_list_items" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, [projectId]);

  const handleCreate = async () => {
    if (!form.description) { toast.error("Description required"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("punch_list_items" as any) as any).insert({
      project_id: projectId,
      description: form.description,
      location: form.location || null,
      priority: form.priority,
      assigned_to_name: form.assigned_to_name || null,
      status: "open",
      raised_by: user?.id,
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Punch list item added");
      setAddOpen(false);
      setForm({ description: "", location: "", priority: "standard", assigned_to_name: "" });
      fetchData();
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await (supabase.from("punch_list_items" as any) as any).update({
      status,
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    fetchData();
  };

  const openItems = items.filter((i) => i.status === "open" || i.status === "in_progress");
  const handoverBlocked = openItems.length > 0;
  const canClose = ["site_installation_mgr", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" style={{ color: "#006039" }} />
          <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Punch List</p>
          {handoverBlocked && (
            <Badge variant="outline" className="text-[10px]" style={{ color: "#F40009", borderColor: "#F40009", backgroundColor: "#FEE2E2" }}>
              {openItems.length} open — handover blocked
            </Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
        </Button>
      </div>

      {handoverBlocked && (
        <div className="rounded-md p-2 flex items-center gap-2 text-xs" style={{ backgroundColor: "#FEE2E2", color: "#F40009" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Handover is blocked until all punch list items are resolved or waived.
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#999" }}>No punch list items.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => {
            const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.open;
            return (
              <Card key={item.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{item.description}</p>
                      {item.location && <p className="text-xs" style={{ color: "#666" }}>Location: {item.location}</p>}
                      {item.assigned_to_name && <p className="text-xs" style={{ color: "#666" }}>Assigned: {item.assigned_to_name}</p>}
                      <p className="text-xs" style={{ color: "#999" }}>{format(new Date(item.created_at), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Badge>
                      {canClose && item.status === "open" && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-5 text-[9px] text-white px-1.5" style={{ backgroundColor: "#D4860A" }} onClick={() => updateStatus(item.id, "in_progress")}>
                            Start
                          </Button>
                          <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5" style={{ color: "#999" }} onClick={() => updateStatus(item.id, "waived")}>
                            Waive
                          </Button>
                        </div>
                      )}
                      {canClose && item.status === "in_progress" && (
                        <Button size="sm" className="h-5 text-[9px] text-white px-1.5" style={{ backgroundColor: "#006039" }} onClick={() => updateStatus(item.id, "closed")}>
                          Close
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
          <DialogHeader><DialogTitle className="font-display">Add Punch List Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Location / Area</Label>
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="mt-1" placeholder="e.g. Bedroom 2 ceiling" />
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="cosmetic">Cosmetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Assigned To</Label>
              <Input value={form.assigned_to_name} onChange={(e) => setForm((f) => ({ ...f, assigned_to_name: e.target.value }))} className="mt-1" placeholder="Contractor / person responsible" />
            </div>
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
