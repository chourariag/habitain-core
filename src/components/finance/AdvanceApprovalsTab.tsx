import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import { insertNotifications } from "@/lib/notifications";

interface AdvanceRow {
  id: string;
  advance_id: string | null;
  employee_id: string;
  employee_name: string | null;
  project_name: string | null;
  amount: number;
  purpose: string | null;
  status: string;
  is_emergency: boolean | null;
  created_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  settlement_method: string | null;
  settled_amount: number | null;
}

const APPROVER_ROLES = ["managing_director", "super_admin", "finance_director"];

export function AdvanceApprovalsTab() {
  const { role } = useUserRole();
  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "settled" | "all">("pending");
  const [actioning, setActioning] = useState<AdvanceRow | null>(null);
  const [rejecting, setRejecting] = useState<AdvanceRow | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const canApprove = !!role && APPROVER_ROLES.includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("advance_requests") as any)
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as AdvanceRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    if (filter === "settled") return r.status === "settled";
    return r.status === filter;
  });

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function handleApprove(r: AdvanceRow) {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("advance_requests") as any).update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id,
      }).eq("id", r.id);
      if (error) throw error;

      if (r.employee_id) {
        await insertNotifications({
          recipient_id: r.employee_id,
          title: "Advance Approved",
          body: `Your advance request of ₹${Number(r.amount).toLocaleString("en-IN")}${r.project_name ? ` for ${r.project_name}` : ""} has been approved.`,
          category: "Finance",
          related_table: "advance_requests",
          related_id: r.id,
          navigate_to: "/finance",
        });
      }

      toast.success("Advance approved");
      setActioning(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(r: AdvanceRow) {
    if (!comment.trim()) { toast.error("Reason required"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { client } = await getAuthedClient();
      const { error } = await (client.from("advance_requests") as any).update({
        status: "rejected",
        rejection_reason: comment.trim(),
        rejected_at: new Date().toISOString(),
        rejected_by: user?.id,
      }).eq("id", r.id);
      if (error) throw error;

      if (r.employee_id) {
        await insertNotifications({
          recipient_id: r.employee_id,
          title: "Advance Rejected",
          body: `Your advance request of ₹${Number(r.amount).toLocaleString("en-IN")} was rejected. Reason: ${comment.trim()}`,
          category: "Finance",
          related_table: "advance_requests",
          related_id: r.id,
          navigate_to: "/finance",
        });
      }

      toast.success("Advance rejected");
      setRejecting(null); setComment("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setBusy(false);
    }
  }

  function statusBadge(s: string) {
    const map: Record<string, { bg: string; fg: string; label: string }> = {
      pending: { bg: "#FFF8E8", fg: "#D4860A", label: "Pending" },
      approved: { bg: "#E8F2ED", fg: "#006039", label: "Approved" },
      rejected: { bg: "#FDE8E8", fg: "#F40009", label: "Rejected" },
      settled: { bg: "#EAEAEA", fg: "#1A1A1A", label: "Settled" },
    };
    const m = map[s] || { bg: "#EAEAEA", fg: "#1A1A1A", label: s };
    return <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: m.bg, color: m.fg, border: "none" }}>{m.label}</Badge>;
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <Wallet className="h-4 w-4" style={{ color: "#006039" }} />
            Advance Requests
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-md font-bold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
                {pendingCount} pending
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="settled">Settled</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <p className="text-xs text-center py-6" style={{ color: "#999" }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "#999" }}>No advance requests in this view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ color: "#666" }}>
                  <th className="text-left py-2 font-display">Employee</th>
                  <th className="text-left py-2 font-display">Project</th>
                  <th className="text-right py-2 font-display">Amount ₹</th>
                  <th className="text-left py-2 font-display">Purpose</th>
                  <th className="text-left py-2 font-display">Requested</th>
                  <th className="text-center py-2 font-display">Status</th>
                  <th className="text-right py-2 font-display">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="py-2">
                      {r.employee_name || "—"}
                      {r.is_emergency && (
                        <Badge variant="outline" className="ml-1 text-[9px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>EMERGENCY</Badge>
                      )}
                    </td>
                    <td className="py-2">{r.project_name || "—"}</td>
                    <td className="text-right py-2 font-mono">₹{Number(r.amount).toLocaleString("en-IN")}</td>
                    <td className="py-2 max-w-[260px] truncate" title={r.purpose || ""}>{r.purpose || "—"}</td>
                    <td className="py-2">{r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy") : "—"}</td>
                    <td className="text-center py-2">{statusBadge(r.status)}</td>
                    <td className="text-right py-2">
                      {r.status === "pending" && canApprove ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="h-7 text-[10px]"
                            onClick={() => setActioning(r)}
                            style={{ color: "#006039", borderColor: "#006039" }}>
                            <Check className="h-3 w-3 mr-0.5" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive"
                            onClick={() => { setRejecting(r); setComment(""); }}>
                            <X className="h-3 w-3 mr-0.5" /> Reject
                          </Button>
                        </div>
                      ) : r.status === "rejected" && r.rejection_reason ? (
                        <span className="text-[10px]" style={{ color: "#F40009" }} title={r.rejection_reason}>
                          {r.rejection_reason.length > 30 ? r.rejection_reason.slice(0, 30) + "…" : r.rejection_reason}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!canApprove && pendingCount > 0 && (
          <p className="text-[11px]" style={{ color: "#666" }}>Only Finance Director or MD can approve advance requests.</p>
        )}
      </CardContent>

      {/* Approve confirm */}
      <Dialog open={!!actioning} onOpenChange={(o) => !o && setActioning(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve advance request?</DialogTitle></DialogHeader>
          {actioning && (
            <div className="text-sm space-y-1">
              <div><strong>{actioning.employee_name}</strong> — ₹{Number(actioning.amount).toLocaleString("en-IN")}</div>
              <div className="text-xs text-muted-foreground">Project: {actioning.project_name || "—"}</div>
              <div className="text-xs text-muted-foreground">Purpose: {actioning.purpose || "—"}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActioning(null)}>Cancel</Button>
            <Button onClick={() => actioning && handleApprove(actioning)} disabled={busy} style={{ background: "#006039", color: "#fff" }}>
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason */}
      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setComment(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject advance request</DialogTitle></DialogHeader>
          {rejecting && (
            <div className="text-sm space-y-2">
              <div><strong>{rejecting.employee_name}</strong> — ₹{Number(rejecting.amount).toLocaleString("en-IN")}</div>
              <Textarea autoFocus placeholder="Reason for rejection (required)" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setComment(""); }}>Cancel</Button>
            <Button variant="destructive" disabled={!comment.trim() || busy}
              onClick={() => rejecting && handleReject(rejecting)}>
              {busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
