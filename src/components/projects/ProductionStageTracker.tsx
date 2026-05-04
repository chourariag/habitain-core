import { useState, useEffect, useMemo } from "react";
import { Check, Lock, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getAuthedClient } from "@/lib/auth-client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QCInspectionWizard } from "@/components/qc/QCInspectionWizard";
import { getStagesForSystem, type ProductionSystem, MODULAR_STAGES } from "@/lib/production-systems";

// Backwards-compat export — defaults to Modular stage list (other modules import this).
export const PRODUCTION_STAGES = MODULAR_STAGES;

const HYBRID_AWAITING_STAGE = "Awaiting Panels";
const OVERRIDE_ROLES = ["planning_engineer", "production_head", "head_operations", "super_admin", "managing_director"];

interface Props {
  moduleId: string;
  projectId: string;
  currentStage: string | null;
  productionStatus: string | null;
  canAdvance: boolean;
  onAdvanced: () => void;
  dryAssemblyRequired?: boolean;
  productionSystem?: ProductionSystem | null;
}

interface HandoverRow {
  handover_id: string;
  status: string;
  source_panel_bay: number | null;
  ready_at: string | null;
  received_at: string | null;
  override_reason: string | null;
}

export function ProductionStageTracker({
  moduleId, projectId, currentStage, productionStatus, canAdvance, onAdvanced,
  dryAssemblyRequired, productionSystem,
}: Props) {
  const stages = useMemo(() => getStagesForSystem(productionSystem ?? "modular") as readonly string[], [productionSystem]);
  const isHybrid = productionSystem === "hybrid";

  const currentIdx = currentStage ? stages.indexOf(currentStage as any) : -1;
  const isCompleted = productionStatus === "completed";
  const isOnHold = productionStatus === "hold";

  const [openNCRCount, setOpenNCRCount] = useState(0);
  const [qcWizardOpen, setQcWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Hybrid panel handover state
  const [handover, setHandover] = useState<HandoverRow | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  useEffect(() => {
    const checkNCRs = async () => {
      const { data: inspections } = await supabase
        .from("qc_inspections")
        .select("id")
        .eq("module_id", moduleId);
      const inspectionIds = inspections?.map((i) => i.id) ?? [];
      if (inspectionIds.length === 0) { setOpenNCRCount(0); return; }
      const { count } = await supabase
        .from("ncr_register")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .in("status", ["open", "critical_open"])
        .in("inspection_id", inspectionIds);
      setOpenNCRCount(count ?? 0);
    };
    checkNCRs();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, [moduleId]);

  // Hybrid: load latest panel handover for this project
  useEffect(() => {
    if (!isHybrid || !projectId) { setHandover(null); return; }
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("v_latest_panel_handover")
        .select("handover_id, status, source_panel_bay, ready_at, received_at, override_reason")
        .eq("project_id", projectId)
        .maybeSingle();
      if (active) setHandover((data as HandoverRow | null) ?? null);
    })();
    return () => { active = false; };
  }, [isHybrid, projectId, currentStage]);

  const canStartInspection = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");
  const canOverride = OVERRIDE_ROLES.includes(userRole ?? "");
  const isBlocked = isOnHold && openNCRCount > 0;
  // Block advancing from Stage 1 to Stage 2 if dry assembly check not done
  const isDryAssemblyBlocked = dryAssemblyRequired && currentStage === "Sub-Frame";

  // Hybrid lock: at "Awaiting Panels", advancement is blocked unless handover received OR overridden
  const isAtAwaitingPanels = isHybrid && currentStage === HYBRID_AWAITING_STAGE;
  const handoverReceived = handover?.status === "received";
  const handoverOverridden = !!handover?.override_reason;
  const isPanelLocked = isAtAwaitingPanels && !handoverReceived && !handoverOverridden;

  const handleAdvance = async () => {
    if (isBlocked) {
      toast.error("Module is locked. Close all open NCRs before advancing.");
      return;
    }
    if (isDryAssemblyBlocked) {
      toast.error("Dry Assembly Check must be completed before advancing to Stage 2.");
      return;
    }
    if (isPanelLocked) {
      toast.error("Awaiting LGSF panels from Panel Bay. Override required to bypass.");
      return;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx >= stages.length) {
      try {
        const { client } = await getAuthedClient();
        const { error } = await client.from("modules").update({
          production_status: "completed",
          current_stage: stages[stages.length - 1],
        } as any).eq("id", moduleId);
        if (error) throw error;
        toast.success("Module production completed!");
        onAdvanced();
      } catch (err: any) {
        toast.error(err.message || "Failed to update");
      }
      return;
    }

    try {
      const { client } = await getAuthedClient();
      const { error } = await client.from("modules").update({
        current_stage: stages[nextIdx],
        production_status: "in_progress",
      } as any).eq("id", moduleId);
      if (error) throw error;
      toast.success(`Advanced to ${stages[nextIdx]}`);
      onAdvanced();
    } catch (err: any) {
      toast.error(err.message || "Failed to advance stage");
    }
  };

  const submitOverride = async () => {
    if (!overrideReason.trim() || overrideReason.trim().length < 10) {
      toast.error("Override reason must be at least 10 characters.");
      return;
    }
    setOverrideSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Log override in audit table (do NOT touch panel_handovers — that's only for real handovers)
      let userName: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        userName = (profile as any)?.display_name ?? null;
      }
      const { error: logError } = await (supabase as any).from("task_lock_overrides").insert({
        project_id: projectId,
        module_id: moduleId,
        task_id: null,
        override_type: "panel_bay_handover",
        reason: overrideReason.trim(),
        user_id: user?.id ?? null,
        user_name: userName,
      });
      if (logError) throw logError;

      // 2. Bypass the lock by advancing the module bay stage directly
      const nextIdx = currentIdx + 1;
      if (nextIdx < stages.length) {
        const { client } = await getAuthedClient();
        const { error: advErr } = await client.from("modules").update({
          current_stage: stages[nextIdx],
          production_status: "in_progress",
        } as any).eq("id", moduleId);
        if (advErr) throw advErr;
      }

      // 3. Reflect override locally so the lock UI clears immediately
      setHandover((prev) => prev
        ? { ...prev, override_reason: overrideReason.trim(), status: "received" }
        : { handover_id: "", status: "received", source_panel_bay: null, ready_at: null, received_at: new Date().toISOString(), override_reason: overrideReason.trim() });

      toast.success("Override recorded — module advanced.");
      setOverrideOpen(false);
      setOverrideReason("");
      onAdvanced();
    } catch (err: any) {
      toast.error(err.message || "Failed to record override");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {stages.map((stage, idx) => {
          const isComplete = idx < currentIdx || isCompleted;
          const isCurrent = idx === currentIdx && !isCompleted;
          const isLocked = idx > currentIdx && !isCompleted;

          return (
            <div key={stage} className="flex items-center shrink-0">
              {idx > 0 && (
                <div className={cn(
                  "w-4 h-0.5 mx-0.5",
                  isComplete ? "bg-primary" : isCurrent ? "bg-primary" : "bg-border"
                )} />
              )}
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
                  isComplete && "bg-primary/20 text-primary border-primary/30",
                  isCurrent && "bg-primary/20 text-primary border-primary/30 ring-2 ring-primary/20",
                  isLocked && "bg-muted text-muted-foreground border-border opacity-50"
                )}
                title={stage}
              >
                {isComplete && <Check className="h-3 w-3" />}
                {isLocked && <Lock className="h-2.5 w-2.5" />}
                <span className="whitespace-nowrap">{stage}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hybrid full-card amber overlay when awaiting panels */}
      {isPanelLocked && (
        <div
          className="rounded-md p-4 space-y-3"
          style={{
            backgroundColor: "hsl(35 95% 95%)",
            border: "2px solid hsl(35 90% 50%)",
            boxShadow: "inset 0 0 0 1px hsl(35 90% 70%)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-full p-2 shrink-0" style={{ backgroundColor: "hsl(35 90% 50% / 0.2)" }}>
              <Lock className="h-5 w-5" style={{ color: "hsl(35 90% 35%)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: "hsl(35 90% 25%)" }}>
                Awaiting LGSF panels from Panel Bay
              </p>
              <p className="text-xs mt-1" style={{ color: "hsl(35 70% 30%)" }}>
                {handover
                  ? `Panel Bay ${handover.source_panel_bay ?? "—"} — current status: ${handover.status.replace(/_/g, " ")}${handover.ready_at ? ` · ready ${new Date(handover.ready_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}` : ""}`
                  : "No handover recorded yet — Panel Bay has not signalled panels ready."}
              </p>
              <p className="text-[11px] mt-2" style={{ color: "hsl(35 60% 40%)" }}>
                Module Bay cannot start panel installation until handover is confirmed received in Factory Floor Map.
              </p>
            </div>
          </div>
          {canOverride && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOverrideOpen(true)}
              className="w-full text-xs"
              style={{ borderColor: "hsl(35 90% 50%)", color: "hsl(35 90% 25%)" }}
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1" />
              Override lock with reason
            </Button>
          )}
        </div>
      )}

      {isBlocked && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Module locked — {openNCRCount} open NCR(s). Production Head must close all NCRs before advancing.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {canAdvance && !isCompleted && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdvance}
            disabled={isBlocked || isDryAssemblyBlocked || isPanelLocked}
            className="text-xs"
          >
            {currentIdx === -1
              ? `Start → ${stages[0]}`
              : currentIdx + 1 < stages.length
                ? `Advance → ${stages[currentIdx + 1]}`
                : "Mark Completed"}
          </Button>
        )}

        {canStartInspection && currentStage === "QC Inspection" && !isCompleted && (
          <Button size="sm" variant="secondary" onClick={() => setQcWizardOpen(true)} className="text-xs">
            Start QC Inspection
          </Button>
        )}
      </div>

      <QCInspectionWizard
        open={qcWizardOpen}
        onOpenChange={setQcWizardOpen}
        onCompleted={onAdvanced}
        preselectedProjectId={projectId}
        preselectedModuleId={moduleId}
      />

      {/* Override modal */}
      <Dialog open={overrideOpen} onOpenChange={(o) => { if (!overrideSubmitting) setOverrideOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Override Panel Bay Lock
            </DialogTitle>
            <DialogDescription>
              You are bypassing the Panel Bay → Module Bay dependency. This will be logged with your name and visible in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium">Reason (required, min 10 chars)</label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Karthik approved early start using existing site-stocked panels for Module Bay 3."
              rows={4}
              disabled={overrideSubmitting}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)} disabled={overrideSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={submitOverride}
              disabled={overrideSubmitting || overrideReason.trim().length < 10}
              variant="destructive"
            >
              {overrideSubmitting ? "Recording..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
