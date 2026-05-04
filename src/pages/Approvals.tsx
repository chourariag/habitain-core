import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { listApprovalRequests, type ApprovalRequest } from "@/lib/approval-requests";
import { approveRequest, rejectRequest, APPROVAL_TYPE_META, summarizeRequest } from "@/lib/approval-actions";
import { cn } from "@/lib/utils";

const APPROVER_ROLES = ["managing_director", "super_admin", "sales_director", "principal_architect"];

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function groupOf(type: string): "project"|"user"|"financial"|"other" {
  return APPROVAL_TYPE_META[type]?.group ?? "other";
}

export default function Approvals() {
  const { role } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "pending");
  const [filter, setFilter] = useState<"all"|"project"|"user"|"financial"|"overdue">("all");
  const [reviewing, setReviewing] = useState<ApprovalRequest | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [tempPw, setTempPw] = useState<string | null>(null);

  const canApprove = !!role && APPROVER_ROLES.includes(role);

  const { data: requests, refetch, isLoading } = useQuery({
    queryKey: ["all-approval-requests"],
    queryFn: () => listApprovalRequests(),
  });

  // Auto-open from deep-link ?id=
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && requests) {
      const found = requests.find(r => r.id === id);
      if (found) setReviewing(found);
    }
  }, [searchParams, requests]);

  const pending = useMemo(() => (requests || [])
    .filter(r => r.status === "pending")
    .filter(r => {
      if (filter === "all") return true;
      if (filter === "overdue") return daysSince(r.requested_at) >= 2;
      return groupOf(r.request_type) === filter;
    })
    .sort((a,b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()),
    [requests, filter]);

  async function handleApprove(req: ApprovalRequest) {
    try {
      const res = await approveRequest(req);
      if (res.tempPassword) setTempPw(res.tempPassword);
      toast.success("Approved");
      setReviewing(null);
      refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function handleReject(req: ApprovalRequest) {
    if (!rejectReason.trim()) { toast.error("Reason required"); return; }
    try {
      await rejectRequest(req, rejectReason);
      toast.success("Rejected");
      setReviewing(null); setShowReject(false); setRejectReason("");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
  }

  function changeTab(v: string) {
    setTab(v);
    const next = new URLSearchParams(searchParams);
    next.set("tab", v); next.delete("id");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" style={{ color: "#006039" }} />
          Approvals & Escalations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Single place for everything that needs your action or attention.
        </p>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending Approvals
            {(requests?.filter(r => r.status === "pending").length ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-md font-bold"
                style={{ background: "#FEE2E2", color: "#991B1B" }}>
                {requests?.filter(r => r.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="escalations">Escalations</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(["all","project","user","financial","overdue"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                  filter === f ? "text-white" : "bg-muted text-muted-foreground hover:bg-muted/80")}
                style={filter === f ? { background: "#006039" } : undefined}>
                {f}
              </button>
            ))}
          </div>

          {pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card rounded-lg border">
              <CheckCircle2 className="h-12 w-12" style={{ color: "#006039" }} />
              <p className="text-sm font-semibold">All caught up — no approvals pending</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested On</TableHead>
                    <TableHead>Days Waiting</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map(r => {
                    const meta = APPROVAL_TYPE_META[r.request_type] ?? { label: r.request_type, pill: { bg: "#F3F4F6", fg: "#374151" } };
                    const days = daysSince(r.requested_at);
                    return (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setReviewing(r)}>
                        <TableCell>
                          <Badge style={{ background: meta.pill.bg, color: meta.pill.fg }}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[320px]">{summarizeRequest(r)}</TableCell>
                        <TableCell className="text-xs">{r.requested_by_name}</TableCell>
                        <TableCell className="text-xs">{new Date(r.requested_at).toLocaleDateString("en-GB")}</TableCell>
                        <TableCell className="text-xs">
                          <span className={days >= 2 ? "font-bold" : ""} style={days >= 2 ? { color: "#F40009" } : undefined}>
                            {days}d
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          {canApprove ? (
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="outline" className="h-7 gap-1"
                                onClick={() => handleApprove(r)}>
                                <Check className="h-3 w-3" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive"
                                onClick={() => { setReviewing(r); setShowReject(true); }}>
                                <X className="h-3 w-3" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setReviewing(r)}>View</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        </TabsContent>

        <TabsContent value="escalations" className="mt-4 space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3 text-sm font-medium">
            0 escalations active &nbsp;|&nbsp; 0 overdue &gt;24hrs
          </div>
          <div className="flex flex-col items-center justify-center py-16 gap-3 bg-card rounded-lg border">
            <CheckCircle2 className="h-12 w-12" style={{ color: "#006039" }} />
            <p className="text-sm font-semibold">No Level-3 escalations active</p>
            <p className="text-xs text-muted-foreground">Escalated alerts will appear here when they reach MD level.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Review / Reject dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => { if (!o) { setReviewing(null); setShowReject(false); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing && (APPROVAL_TYPE_META[reviewing.request_type]?.label || "Approval Request")}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
              {Object.entries(reviewing.payload as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2 py-1 border-b last:border-0">
                  <div className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, " ")}</div>
                  <div className="col-span-2 break-words text-xs">{String(v ?? "—")}</div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 py-1 text-xs text-muted-foreground">
                <div>Requested by</div>
                <div className="col-span-2">{reviewing.requested_by_name} · {new Date(reviewing.requested_at).toLocaleString("en-GB")}</div>
              </div>
              {reviewing.status !== "pending" && (
                <div className="rounded-md p-2 mt-2" style={{ background: "#F7F7F7" }}>
                  <div className="text-xs">
                    <strong>{reviewing.status === "approved" ? "Approved" : "Rejected"}</strong>
                    {reviewing.approved_by_name ? ` by ${reviewing.approved_by_name}` : ""}
                    {reviewing.approved_at ? ` on ${new Date(reviewing.approved_at).toLocaleString("en-GB")}` : ""}
                  </div>
                  {reviewing.rejected_reason && <div className="text-xs mt-1">Reason: {reviewing.rejected_reason}</div>}
                </div>
              )}
              {showReject && reviewing.status === "pending" && (
                <Textarea autoFocus className="mt-2" placeholder="Reason for rejection (required)"
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              )}
            </div>
          )}
          <DialogFooter>
            {reviewing && reviewing.status === "pending" && canApprove && !showReject && (
              <>
                <Button variant="outline" onClick={() => setShowReject(true)} className="gap-1.5">
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button onClick={() => handleApprove(reviewing)} className="gap-1.5" style={{ background: "#006039" }}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              </>
            )}
            {reviewing && showReject && (
              <>
                <Button variant="outline" onClick={() => { setShowReject(false); setRejectReason(""); }}>Cancel</Button>
                <Button variant="destructive" disabled={!rejectReason.trim()}
                  onClick={() => handleReject(reviewing)}>Confirm Reject</Button>
              </>
            )}
            {(!reviewing || reviewing.status !== "pending" || !canApprove) && !showReject && (
              <Button onClick={() => setReviewing(null)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempPw} onOpenChange={o => !o && setTempPw(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>User created</DialogTitle></DialogHeader>
          <p className="text-sm">Temporary password:</p>
          <div className="font-mono text-lg font-bold rounded-md border p-3" style={{ background: "#F7F7F7" }}>{tempPw}</div>
          <DialogFooter><Button onClick={() => setTempPw(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
