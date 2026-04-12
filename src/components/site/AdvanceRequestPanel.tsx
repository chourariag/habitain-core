import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Zap, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface AdvanceRequestPanelProps {
  projectId: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  settled: { color: "#666", bg: "#F7F7F7" },
};

export function AdvanceRequestPanel({ projectId }: AdvanceRequestPanelProps) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", purpose: "", is_emergency: false, repayment_date: "" });
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("advance_requests" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setRequests(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, [projectId]);

  const handleCreate = async () => {
    if (!form.amount || !form.purpose) { toast.error("Amount and purpose required"); return; }
    setSaving(true);
    const { error } = await (supabase.from("advance_requests" as any) as any).insert({
      project_id: projectId,
      requested_by: userId,
      amount: parseFloat(form.amount),
      purpose: form.purpose,
      is_emergency: form.is_emergency,
      expected_repayment_date: form.repayment_date || null,
      status: "pending",
    });
    if (error) { toast.error(error.message); setSaving(false); return; }

    // Notify: emergency → Gaurav (managing_director), normal → Suraj (head_operations)
    const targetRole = form.is_emergency ? "managing_director" : "head_operations";
    const { data: approvers } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("role", targetRole as any)
      .eq("is_active", true);
    for (const a of approvers ?? []) {
      await insertNotifications({
        recipient_id: a.auth_user_id,
        title: form.is_emergency ? "⚡ Emergency Advance Request" : "Advance Request",
        body: `₹${Number(form.amount).toLocaleString("en-IN")} advance requested for: ${form.purpose}`,
        category: "finance",
        related_table: "advance_requests",
      });
    }
    toast.success(form.is_emergency ? "Emergency advance sent directly to MD" : "Advance request submitted to Ops Head");
    setAddOpen(false);
    setForm({ amount: "", purpose: "", is_emergency: false, repayment_date: "" });
    fetchData();
    setSaving(false);
  };

  const handleApprove = async (id: string) => {
    await (supabase.from("advance_requests" as any) as any)
      .update({ status: "approved", approved_by: userId, approved_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Advance approved");
    fetchData();
  };

  const canApprove = ["head_operations", "managing_director", "super_admin"].includes(userRole ?? "");

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Advance Requests</p>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Request Advance
        </Button>
      </div>

      {requests.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#999" }}>No advance requests.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const sc = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
            return (
              <Card key={r.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        {r.is_emergency && <Zap className="h-3.5 w-3.5" style={{ color: "#F40009" }} />}
                        <p className="font-mono font-bold text-sm" style={{ color: "#006039" }}>₹{Number(r.amount).toLocaleString("en-IN")}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#1A1A1A" }}>{r.purpose}</p>
                      <p className="text-xs" style={{ color: "#999" }}>{format(new Date(r.created_at), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                        {r.is_emergency ? "⚡ " : ""}{r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                      {canApprove && r.status === "pending" && (
                        <Button size="sm" className="h-6 text-[10px] text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleApprove(r.id)}>
                          Approve
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
          <DialogHeader><DialogTitle className="font-display">Request Advance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="emergency"
                type="checkbox"
                checked={form.is_emergency}
                onChange={(e) => setForm((f) => ({ ...f, is_emergency: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="emergency" className="cursor-pointer flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" style={{ color: "#F40009" }} /> Emergency (bypasses Ops — goes direct to MD)
              </Label>
            </div>
            {form.is_emergency && (
              <div className="rounded-md p-2 flex items-center gap-2 text-xs" style={{ backgroundColor: "#FEE2E2", color: "#F40009" }}>
                <AlertTriangle className="h-3.5 w-3.5" /> Emergency advances are sent directly to the Managing Director.
              </div>
            )}
            <div>
              <Label className="text-xs">Amount (₹) *</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Purpose *</Label>
              <Textarea value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Expected Repayment Date</Label>
              <Input type="date" value={form.repayment_date} onChange={(e) => setForm((f) => ({ ...f, repayment_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: form.is_emergency ? "#F40009" : "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
