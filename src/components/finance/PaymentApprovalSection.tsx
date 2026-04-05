import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Check, Clock, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface PaymentApproval {
  id: string;
  description: string;
  amount: number;
  category: string;
  approver_id: string | null;
  approver_name: string | null;
  status: string;
  escalation_sent: boolean;
  submitted_by: string;
  submitted_at: string;
  approved_at: string | null;
}

interface Props {
  canUpload: boolean;
}

export function PaymentApprovalSection({ canUpload }: Props) {
  const [approvals, setApprovals] = useState<PaymentApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "general", approver: "" });
  const [directors, setDirectors] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: dirData }] = await Promise.all([
      (supabase.from("payment_approvals") as any).select("*").order("submitted_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name, role")
        .in("role", ["finance_director", "managing_director", "super_admin"] as any)
        .eq("is_active", true),
    ]);
    setApprovals((data ?? []) as PaymentApproval[]);
    setDirectors(dirData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Check for escalations on load
  useEffect(() => {
    const checkEscalations = async () => {
      const now = new Date();
      for (const a of approvals) {
        if (a.status !== "pending" || a.escalation_sent) continue;
        const hoursAgo = differenceInHours(now, new Date(a.submitted_at));
        const threshold = a.category === "statutory" ? 12 : 24;

        if (hoursAgo >= threshold) {
          // Send escalation to all directors + MD
          const { data: allDirectors } = await supabase
            .from("profiles")
            .select("auth_user_id, display_name")
            .in("role", ["finance_director", "managing_director", "super_admin"] as any)
            .eq("is_active", true);

          if (allDirectors?.length) {
            const statutoryWarning = a.category === "statutory"
              ? " This is a statutory payment with a legal deadline. Delayed approval may result in penalties."
              : "";

            await insertNotifications(allDirectors.map((r: any) => ({
              recipient_id: r.auth_user_id,
              title: "URGENT: Payment Approval Overdue",
              body: `URGENT: Payment of ₹${Number(a.amount).toLocaleString("en-IN")} for ${a.description} has been pending approval for ${hoursAgo} hours.${a.approver_name ? ` ${a.approver_name} has not yet approved.` : ""} Please action immediately.${statutoryWarning}`,
              category: "Finance",
              related_table: "payment_approvals",
              related_id: a.id,
              navigate_to: "/finance",
            })));
          }

          // Mark escalation sent
          const { client } = await getAuthedClient();
          await (client.from("payment_approvals") as any).update({
            escalation_sent: true,
            escalation_sent_at: new Date().toISOString(),
            status: "escalated",
          }).eq("id", a.id);
        }
      }
      load();
    };

    if (approvals.some((a) => a.status === "pending" && !a.escalation_sent)) {
      checkEscalations();
    }
  }, [approvals.length]);

  const handleSubmit = async () => {
    if (!form.description.trim() || !form.amount) { toast.error("Description and amount required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const approverDir = directors.find((d) => d.auth_user_id === form.approver);
      const { client } = await getAuthedClient();
      const { error } = await (client.from("payment_approvals") as any).insert({
        description: form.description.trim(),
        amount: Number(form.amount),
        category: form.category,
        approver_id: form.approver || null,
        approver_name: approverDir?.display_name || null,
        submitted_by: user.id,
      });
      if (error) throw error;

      // Notify approver
      if (form.approver) {
        await insertNotifications({
          recipient_id: form.approver,
          title: "Payment Approval Required",
          body: `Payment approval required: ${form.description.trim()} ₹${Number(form.amount).toLocaleString("en-IN")}. Please approve in HStack.`,
          category: "Finance",
          related_table: "payment_approvals",
          navigate_to: "/finance",
        });
      }

      toast.success("Payment sent for approval");
      setForm({ description: "", amount: "", category: "general", approver: "" });
      setShowAdd(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setAdding(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { client } = await getAuthedClient();
      await (client.from("payment_approvals") as any).update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      }).eq("id", id);

      const approval = approvals.find((a) => a.id === id);
      if (approval) {
        await insertNotifications({
          recipient_id: approval.submitted_by,
          title: "Payment Approved",
          body: `Payment of ₹${Number(approval.amount).toLocaleString("en-IN")} for ${approval.description} has been approved.`,
          category: "Finance",
          related_table: "payment_approvals",
          related_id: id,
          navigate_to: "/finance",
        });
      }

      toast.success("Payment approved");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
  };

  const statusBadge = (a: PaymentApproval) => {
    if (a.status === "approved") return <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>Approved</Badge>;
    if (a.status === "escalated") return <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>Escalated</Badge>;
    return <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>Pending</Badge>;
  };

  const isDirector = directors.length > 0; // simplified — user role checked at parent

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <Shield className="h-4 w-4" style={{ color: "#006039" }} />
            Payment Approvals
          </CardTitle>
          {canUpload && (
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)} className="text-xs h-6">
              <Plus className="h-3 w-3 mr-1" /> Send for Approval
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-3">
        {showAdd && (
          <div className="border rounded-md p-3 space-y-2" style={{ borderColor: "#E5E5E5", backgroundColor: "#FAFAFA" }}>
            <Input placeholder="Payment description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="text-sm" />
            <div className="flex gap-2">
              <Input type="number" placeholder="Amount ₹" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="text-sm flex-1" />
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="text-sm w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="statutory">Statutory</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={form.approver} onValueChange={(v) => setForm((p) => ({ ...p, approver: v }))}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select approving Director..." /></SelectTrigger>
              <SelectContent>
                {directors.map((d) => (
                  <SelectItem key={d.auth_user_id} value={d.auth_user_id}>{d.display_name} ({d.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={adding} className="flex-1" style={{ backgroundColor: "#006039", color: "#fff" }}>
                {adding && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Send
              </Button>
            </div>
            {form.category === "statutory" && (
              <p className="text-[10px] flex items-center gap-1" style={{ color: "#D4860A" }}>
                <AlertTriangle className="h-3 w-3" /> Statutory payments escalate after 12 hours (vs 24 for general)
              </p>
            )}
          </div>
        )}

        {loading ? null : approvals.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: "#999" }}>No payment approvals yet.</p>
        ) : (
          <div className="space-y-1.5">
            {approvals.slice(0, 10).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" style={{ borderColor: "#F0F0F0" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate" style={{ color: "#1A1A1A" }}>{a.description}</p>
                    {a.category === "statutory" && (
                      <span className="text-[9px] px-1 py-0 rounded" style={{ backgroundColor: "#FDE8E8", color: "#F40009" }}>Statutory</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "#666" }}>
                    <span className="font-mono">₹{Number(a.amount).toLocaleString("en-IN")}</span>
                    <span>→ {a.approver_name || "Unassigned"}</span>
                    <span>{format(new Date(a.submitted_at), "dd/MM HH:mm")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(a)}
                  {a.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleApprove(a.id)}
                      style={{ color: "#006039", borderColor: "#006039" }}>
                      <Check className="h-3 w-3 mr-0.5" /> Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
