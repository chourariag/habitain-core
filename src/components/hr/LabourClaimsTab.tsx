import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Check, X, Clock, AlertTriangle } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { getSlaInfo } from "@/lib/sla";
import { insertNotifications } from "@/lib/notifications";

const APPROVER_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"];
const ESCALATION_ROLES = ["super_admin", "managing_director", "head_operations", "production_head"]; // Azad-equivalent

export function LabourClaimsTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const canApprove = APPROVER_ROLES.includes(role ?? "");

  const [claims, setClaims] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "history" | "report">("pending");

  const [formOpen, setFormOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [now, setNow] = useState(Date.now());

  // Live timer (1 min refresh)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: w }, { data: p }] = await Promise.all([
      (supabase.from("labour_claims" as any).select("*").order("submitted_at", { ascending: false }).limit(500)) as any,
      (supabase.from("labour_workers" as any).select("id,name,department,status").eq("status", "active").order("name")) as any,
      supabase.from("projects").select("id,name").eq("is_archived", false).order("name"),
    ]);
    setClaims((c as any[]) ?? []);
    setWorkers((w as any[]) ?? []);
    setProjects(p ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-mark SLA-breached claims (client-side flag; escalation runs serverside via cron)
  useEffect(() => {
    const breached = claims.filter(
      (c: any) => c.status === "pending" && !c.sla_breached && getSlaInfo(c.submitted_at).breached,
    );
    if (breached.length === 0) return;
    (async () => {
      for (const c of breached) {
        await (supabase as any).from("labour_claims").update({ sla_breached: true }).eq("id", c.id);
      }
      load();
    })();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const pending = claims.filter((c: any) => c.status === "pending");
  const history = claims.filter((c: any) => c.status !== "pending");

  /* ── Submit ── */
  const handleSubmit = async (payload: any) => {
    if (!user) return;
    const worker = workers.find((w: any) => w.id === payload.worker_id);
    const { error } = await (supabase as any).from("labour_claims").insert({
      labour_worker_id: payload.worker_id || null,
      worker_name_snapshot: worker?.name || payload.worker_name || "Worker",
      work_date: payload.work_date,
      process_stage: payload.process_stage || null,
      hours: parseFloat(payload.hours) || 0,
      ot_hours: parseFloat(payload.ot_hours) || 0,
      project_id: payload.project_id || null,
      notes: payload.notes || null,
      submitted_by: user.id,
      created_by: user.id,
      // legacy required-then-nullable columns left null
    });
    if (error) { toast.error(error.message); return; }

    // Notify approvers (Rakesh)
    const { data: approvers } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", APPROVER_ROLES as any)
      .eq("is_active", true);
    if (approvers?.length) {
      await insertNotifications(approvers.map((a: any) => ({
        recipient_id: a.auth_user_id,
        title: "New labour claim — 4h SLA",
        body: `${worker?.name || "Worker"} · ${payload.hours}h${payload.ot_hours ? ` + ${payload.ot_hours}h OT` : ""}`,
        category: "labour_claim",
        related_table: "labour_claims",
        navigate_to: "/attendance?tab=claims",
      })));
    }

    toast.success("Claim submitted — SLA timer started");
    setFormOpen(false);
    load();
  };

  /* ── Approve / Reject ── */
  const handleApprove = async (id: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("labour_claims").update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Claim approved");
    load();
  };

  const handleReject = async () => {
    if (!user || !rejectId || !rejectReason.trim()) return;
    const { error } = await (supabase as any).from("labour_claims").update({
      status: "rejected",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      rejection_reason: rejectReason.trim(),
    }).eq("id", rejectId);
    if (error) { toast.error(error.message); return; }
    toast.success("Claim rejected");
    setRejectId(null); setRejectReason("");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(["pending", "history", "report"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              style={tab === t ? { backgroundColor: "#006039" } : {}}
              onClick={() => setTab(t)}
            >
              {t === "pending" ? `Pending (${pending.length})` : t === "history" ? "History" : "Monthly Report"}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-4 w-4 mr-1" /> New Claim
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : tab === "pending" ? (
        <PendingTable
          rows={pending}
          canApprove={canApprove}
          onApprove={handleApprove}
          onReject={(id) => setRejectId(id)}
          projects={projects}
        />
      ) : tab === "history" ? (
        <HistoryTable rows={history} projects={projects} />
      ) : (
        <MonthlyReport rows={claims} />
      )}

      {/* New claim dialog */}
      <NewClaimDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        workers={workers}
        projects={projects}
        onSubmit={handleSubmit}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Claim</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Reason — e.g. 'Hours claimed exceed what was observed'"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>Cancel</Button>
            <Button onClick={handleReject} disabled={!rejectReason.trim()} style={{ backgroundColor: "#F40009" }} className="text-white">
              Confirm Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Pending claims table with live SLA timer ─── */
function PendingTable({ rows, canApprove, onApprove, onReject, projects }: any) {
  if (rows.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        No pending claims. All caught up.
      </CardContent></Card>
    );
  }
  const projName = (id: string) => projects.find((p: any) => p.id === id)?.name ?? "—";
  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#F7F7F7" }}>
            {["Worker", "Date", "Stage", "Hours", "OT", "Project", "Submitted", "SLA", "Action"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((c: any) => {
            const sla = getSlaInfo(c.submitted_at);
            return (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{c.worker_name_snapshot || "—"}</td>
                <td className="px-3 py-2 font-inter text-xs">{format(new Date(c.work_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 text-xs">{c.process_stage || "—"}</td>
                <td className="px-3 py-2 font-inter text-xs">{Number(c.hours).toFixed(1)}h</td>
                <td className="px-3 py-2 font-inter text-xs">{Number(c.ot_hours).toFixed(1)}h</td>
                <td className="px-3 py-2 text-xs max-w-[160px] truncate">{c.project_id ? projName(c.project_id) : "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{sla.submittedLabel}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {sla.breached && <AlertTriangle className="h-3 w-3" style={{ color: "#F40009" }} />}
                    <span className="text-xs font-semibold" style={{ color: sla.color }}>
                      {sla.breached ? "SLA Breached" : sla.remainingLabel}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {canApprove ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onApprove(c.id)}>
                        <Check className="h-4 w-4" style={{ color: "#006039" }} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onReject(c.id)}>
                        <X className="h-4 w-4" style={{ color: "#F40009" }} />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistoryTable({ rows, projects }: any) {
  const projName = (id: string) => projects.find((p: any) => p.id === id)?.name ?? "—";
  if (rows.length === 0) {
    return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No history yet.</CardContent></Card>;
  }
  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#F7F7F7" }}>
            {["Worker", "Date", "Hours", "OT", "Project", "Decided", "Status", "Note"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((c: any) => {
            const sla = c.approved_at ? Math.round((new Date(c.approved_at).getTime() - new Date(c.submitted_at).getTime()) / 60000) : null;
            const breached = c.sla_breached || (sla != null && sla > 240);
            return (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{c.worker_name_snapshot || "—"}</td>
                <td className="px-3 py-2 text-xs font-inter">{format(new Date(c.work_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 text-xs font-inter">{Number(c.hours).toFixed(1)}h</td>
                <td className="px-3 py-2 text-xs font-inter">{Number(c.ot_hours).toFixed(1)}h</td>
                <td className="px-3 py-2 text-xs">{c.project_id ? projName(c.project_id) : "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {c.approved_at ? format(new Date(c.approved_at), "dd/MM hh:mm a") : "—"}
                  {sla != null && (
                    <span className="ml-2 text-[10px] text-muted-foreground">({Math.floor(sla / 60)}h {sla % 60}m)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: c.status === "approved" ? "#006039" : "#F40009",
                    borderColor: c.status === "approved" ? "#006039" : "#F40009",
                  }}>
                    {c.status}{breached ? " · SLA breached" : ""}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate">{c.rejection_reason || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Monthly KPI report ─── */
function MonthlyReport({ rows }: any) {
  const monthStart = startOfMonth(new Date());
  const monthRows = rows.filter((c: any) => new Date(c.submitted_at) >= monthStart);
  const total = monthRows.length;
  const approvedOnTime = monthRows.filter((c: any) =>
    c.status === "approved" && !c.sla_breached &&
    c.approved_at && (new Date(c.approved_at).getTime() - new Date(c.submitted_at).getTime()) <= 4 * 3600 * 1000,
  ).length;
  const rejected = monthRows.filter((c: any) => c.status === "rejected").length;
  const breached = monthRows.filter((c: any) => c.sla_breached).length;
  const pct = (n: number) => total ? Math.round((n / total) * 100) : 0;

  const onTimePct = pct(approvedOnTime);
  const rejectPct = pct(rejected);

  const onTimeColor = onTimePct >= 95 ? "#006039" : onTimePct < 90 ? "#F40009" : "#D4860A";
  const rejectNote = rejectPct < 5 ? "Possible rubber-stamping — review claim quality"
    : rejectPct > 15 ? "High reject rate — check instruction clarity" : "Healthy range";
  const rejectColor = rejectPct < 5 || rejectPct > 15 ? "#D4860A" : "#006039";

  const tiles = [
    { label: "Claims this month", value: total, color: "#1A1A1A" },
    { label: "Approved within 4h", value: `${approvedOnTime} (${onTimePct}%)`, color: onTimeColor, sub: "Target ≥ 95%" },
    { label: "Rejected", value: `${rejected} (${rejectPct}%)`, color: rejectColor, sub: `Target 5–15% · ${rejectNote}` },
    { label: "SLA breached", value: `${breached} (${pct(breached)}%)`, color: breached ? "#F40009" : "#006039" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: `3px solid ${t.color}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t.label}</p>
            <p className="text-2xl font-bold font-display mt-1" style={{ color: t.color }}>{t.value as any}</p>
            {t.sub && <p className="text-[10px] text-muted-foreground mt-1">{t.sub}</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" /> Auto-calculated for {format(new Date(), "MMMM yyyy")}.
      </p>
    </div>
  );
}

/* ─── New claim dialog ─── */
function NewClaimDialog({ open, onOpenChange, workers, projects, onSubmit }: any) {
  const [workerId, setWorkerId] = useState("");
  const [workDate, setWorkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [stage, setStage] = useState("");
  const [hours, setHours] = useState("8");
  const [ot, setOt] = useState("0");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setWorkerId(""); setStage(""); setHours("8"); setOt("0"); setProjectId(""); setNotes(""); };

  const submit = async () => {
    if (!workerId) { toast.error("Pick a worker"); return; }
    setBusy(true);
    await onSubmit({ worker_id: workerId, work_date: workDate, process_stage: stage, hours, ot_hours: ot, project_id: projectId || null, notes });
    setBusy(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Labour Claim</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Worker *</label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {workers.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name} · {w.department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date *</label>
              <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Process / Stage</label>
              <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="e.g. Drywall" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hours *</label>
              <Input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">OT Hours</label>
              <Input type="number" step="0.5" min="0" value={ot} onChange={(e) => setOt(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !workerId} style={{ backgroundColor: "#006039" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Submit Claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
