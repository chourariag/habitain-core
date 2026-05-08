import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { FACTORY_STAGES } from "@/lib/hstack-stages";

type Task = {
  id: string;
  task_name: string;
  task_id_in_schedule: string;
  stage_name: string | null;
  status: string;
  is_qc_gate: boolean;
  is_payment_milestone: boolean;
  task_type: string;
  special_note: string | null;
  display_order: number | null;
  responsible_role: string | null;
  escalation_role: string | null;
  qc_requested_at: string | null;
  completion_percentage: number;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  projectName?: string;
  moduleLabel?: string;
  initialStageName?: string;
  userRole: string | null;
  userId: string | null;
}

const RAKESH_ROLES = new Set([
  "factory_floor_supervisor", "production_head", "fabrication_foreman",
  "super_admin", "managing_director",
]);

export function StageChecklistDrawer({
  open, onOpenChange, projectId, projectName, moduleLabel, initialStageName,
  userRole, userId,
}: Props) {
  const [stageName, setStageName] = useState<string>(initialStageName || FACTORY_STAGES[0].name);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [stageNa, setStageNa] = useState(false);

  useEffect(() => {
    if (initialStageName) setStageName(initialStageName);
  }, [initialStageName, open]);

  const stageMeta = useMemo(() => FACTORY_STAGES.find(s => s.name === stageName), [stageName]);
  const canEdit = !!userRole && RAKESH_ROLES.has(userRole);

  async function load() {
    if (!open || !projectId || !stageName) return;
    setLoading(true);
    const [{ data: t }, { data: ps }] = await Promise.all([
      (supabase.from("project_tasks") as any)
        .select("id, task_name, task_id_in_schedule, stage_name, status, is_qc_gate, is_payment_milestone, task_type, special_note, display_order, responsible_role, escalation_role, qc_requested_at, completion_percentage")
        .eq("project_id", projectId)
        .eq("stage_name", stageName)
        .order("display_order", { ascending: true }),
      (supabase.from("project_stages") as any)
        .select("is_na, status")
        .eq("project_id", projectId)
        .eq("stage_name", stageName)
        .limit(1)
        .maybeSingle(),
    ]);
    setTasks((t as Task[]) || []);
    setStageNa(!!ps?.is_na);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [open, projectId, stageName]);

  async function toggleComplete(task: Task, complete: boolean) {
    if (!canEdit) { toast.error("Only Rakesh / Production Head can update the checklist"); return; }
    setSaving(task.id);
    const updates: any = {
      status: complete ? "Completed" : "In Progress",
      completion_percentage: complete ? 100 : 50,
      actual_finish_date: complete ? new Date().toISOString().slice(0, 10) : null,
    };
    const { error } = await (supabase.from("project_tasks") as any).update(updates).eq("id", task.id);
    setSaving(null);
    if (error) { toast.error(error.message); return; }

    // Payment milestone notification
    if (complete && task.is_payment_milestone) {
      try {
        await (supabase.from("notifications") as any).insert({
          user_id: userId,
          title: `Payment milestone reached`,
          body: `${task.task_id_in_schedule} ${task.task_name} on ${projectName ?? "project"} marked complete by ${userRole}. Trigger payment workflow.`,
          link: `/finance`,
        });
      } catch {}
    }
    load();
  }

  const nonQcItems = tasks.filter(t => !t.is_qc_gate && t.task_type !== "qc_gate");
  const qcGate = tasks.find(t => t.is_qc_gate || t.task_type === "qc_gate");
  const allNonQcDone = nonQcItems.length > 0 && nonQcItems.every(t => t.status === "Completed");
  const qcRequested = !!qcGate?.qc_requested_at;
  const qcDone = qcGate?.status === "Completed";

  async function requestQc() {
    if (!qcGate || !canEdit) return;
    setSaving(qcGate.id);
    const now = new Date().toISOString();
    const { error } = await (supabase.from("project_tasks") as any)
      .update({ qc_requested_at: now, status: "QC Pending" })
      .eq("id", qcGate.id);
    if (!error) {
      // Notify QC inspectors
      const { data: qcs } = await (supabase.from("profiles") as any)
        .select("auth_user_id")
        .eq("role", "qc_inspector")
        .eq("is_active", true);
      const rows = (qcs || []).map((q: any) => ({
        user_id: q.auth_user_id,
        title: `QC Inspection requested — ${stageName}`,
        body: `${moduleLabel ? moduleLabel + " · " : ""}${projectName ?? "Project"} is ready for QC at "${stageName}".`,
        link: `/qc`,
      }));
      if (rows.length) await (supabase.from("notifications") as any).insert(rows);
      toast.success("QC inspector notified");
    } else {
      toast.error(error.message);
    }
    setSaving(null);
    load();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle style={{ fontFamily: "var(--font-heading)" }}>Stage Checklist</SheetTitle>
          <SheetDescription>
            {moduleLabel ? <span className="font-semibold">{moduleLabel} · </span> : null}
            {projectName ?? "Project"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: "#666" }}>STAGE</label>
            <Select value={stageName} onValueChange={setStageName}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-80">
                {FACTORY_STAGES.map(s => (
                  <SelectItem key={s.number} value={s.name}>
                    {s.number}. {s.name}{s.parallel ? ` (∥ ${s.parallel})` : ""}{s.na_eligible ? " · N/A eligible" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stageMeta && (
              <p className="text-[11px] mt-1" style={{ color: "#888" }}>
                {stageMeta.task_summary}
              </p>
            )}
          </div>

          {stageNa && (
            <div className="rounded-md p-3 flex items-start gap-2" style={{ backgroundColor: "#F7F7F7", border: "1px solid #E0E0E0" }}>
              <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-semibold">Stage marked N/A</p>
                <p className="text-xs text-muted-foreground">Karthik marked this stage out of scope at template fill time.</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <div className="rounded-md p-4 text-center text-sm text-muted-foreground border border-dashed">
              No tasks cloned for this stage on this project yet.
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const isNote = !!t.special_note && t.task_type === "task" && /note|keep|caution|warning/i.test(t.task_name);
                const isQc = t.is_qc_gate || t.task_type === "qc_gate";
                const isPayment = t.is_payment_milestone || t.task_type === "payment";
                const done = t.status === "Completed";
                return (
                  <div
                    key={t.id}
                    className="rounded-md p-3 border flex items-start gap-3"
                    style={{
                      backgroundColor: isQc ? "hsl(0 80% 97%)" : isPayment ? "hsl(45 90% 96%)" : done ? "#F0F8F4" : "#FFFFFF",
                      borderColor: isQc ? "hsl(0 80% 70%)" : isPayment ? "hsl(45 90% 60%)" : "#E0E0E0",
                    }}
                  >
                    {!isQc && (
                      <Checkbox
                        checked={done}
                        disabled={!canEdit || stageNa || saving === t.id}
                        onCheckedChange={(v) => toggleComplete(t, !!v)}
                        className="mt-0.5"
                      />
                    )}
                    {isQc && <ShieldCheck className="h-4 w-4 mt-0.5" style={{ color: "hsl(0 80% 45%)" }} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F0F0F0", color: "#666" }}>
                          {t.task_id_in_schedule}
                        </span>
                        <span className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`} style={{ color: done ? undefined : "#1A1A1A" }}>
                          {t.task_name}
                        </span>
                        {isQc && <Badge variant="outline" className="text-[9px]" style={{ borderColor: "hsl(0 80% 45%)", color: "hsl(0 80% 35%)" }}>QC GATE</Badge>}
                        {isPayment && <Badge variant="outline" className="text-[9px]" style={{ borderColor: "hsl(45 90% 40%)", color: "hsl(45 90% 30%)" }}>PAYMENT</Badge>}
                      </div>
                      {t.special_note && (
                        <div className="mt-2 rounded p-2 flex items-start gap-1.5" style={{ backgroundColor: "hsl(45 95% 95%)", border: "1px solid hsl(45 90% 70%)" }}>
                          <AlertTriangle className="h-3 w-3 mt-0.5" style={{ color: "hsl(35 90% 35%)" }} />
                          <p className="text-[11px]" style={{ color: "hsl(35 90% 25%)" }}>{t.special_note}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: "#999" }}>
                        {t.responsible_role && <span>Owner: {t.responsible_role.replace(/_/g, " ")}</span>}
                        {t.escalation_role && <span>· Escalates to: {t.escalation_role.replace(/_/g, " ")}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {qcGate && !stageNa && (
            <div className="border-t pt-3">
              {qcDone ? (
                <Badge variant="outline" className="text-xs" style={{ borderColor: "#006039", color: "#006039" }}>
                  ✓ QC Passed — stage complete
                </Badge>
              ) : qcRequested ? (
                <Badge variant="outline" className="text-xs" style={{ borderColor: "hsl(35 90% 50%)", color: "hsl(35 90% 35%)" }}>
                  QC requested — waiting for inspector
                </Badge>
              ) : (
                <Button
                  className="w-full"
                  disabled={!canEdit || !allNonQcDone || saving === qcGate.id}
                  onClick={requestQc}
                  style={{ backgroundColor: "#006039", color: "#fff" }}
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Request QC Inspection
                </Button>
              )}
              {!allNonQcDone && !qcRequested && !qcDone && (
                <p className="text-[11px] mt-1" style={{ color: "#999" }}>
                  Tick all checklist items to enable QC request.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
