import { useState, useEffect } from "react";
import { Check, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getAuthedClient } from "@/lib/auth-client";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QCInspectionWizard } from "@/components/qc/QCInspectionWizard";

export const PRODUCTION_STAGES = [
  "Sub-Frame",
  "MEP Rough-In",
  "Insulation",
  "Drywall",
  "Paint",
  "MEP Final",
  "Windows & Doors",
  "Finishing",
  "QC Inspection",
  "Dispatch",
] as const;

interface Props {
  moduleId: string;
  projectId: string;
  currentStage: string | null;
  productionStatus: string | null;
  canAdvance: boolean;
  onAdvanced: () => void;
}

export function ProductionStageTracker({ moduleId, projectId, currentStage, productionStatus, canAdvance, onAdvanced }: Props) {
  const currentIdx = currentStage ? PRODUCTION_STAGES.indexOf(currentStage as any) : -1;
  const isCompleted = productionStatus === "completed";
  const isOnHold = productionStatus === "hold";

  const [openNCRCount, setOpenNCRCount] = useState(0);
  const [qcWizardOpen, setQcWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [gfcH1Approved, setGfcH1Approved] = useState<boolean | null>(null);
  const [gfcH2Approved, setGfcH2Approved] = useState<boolean | null>(null);

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

    const checkGFC = async () => {
      const { data } = await supabase
        .from("modules")
        .select("gfc_h1_approved, gfc_h2_approved")
        .eq("id", moduleId)
        .maybeSingle();
      setGfcH1Approved(!!(data as any)?.gfc_h1_approved);
      setGfcH2Approved(!!(data as any)?.gfc_h2_approved);
    };

    checkNCRs();
    checkGFC();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, [moduleId]);

  const canStartInspection = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");
  const canApproveGFC = ["managing_director", "architecture_director", "super_admin", "principal_architect"].includes(userRole ?? "");
  const isBlocked = isOnHold && openNCRCount > 0;

  // GFC gates: Stage 0 (Sub-Frame) requires H1, Stage 1 (MEP Rough-In) requires H2
  const isGfcH1Blocked = currentIdx === -1 && gfcH1Approved === false;
  const isGfcH2Blocked = currentIdx === 0 && gfcH2Approved === false;

  const handleApproveGFC = async (half: "h1" | "h2") => {
    const field = half === "h1" ? "gfc_h1_approved" : "gfc_h2_approved";
    const { error } = await supabase.from("modules").update({ [field]: true } as any).eq("id", moduleId);
    if (error) { toast.error(error.message); return; }
    if (half === "h1") setGfcH1Approved(true);
    else setGfcH2Approved(true);
    toast.success(`GFC ${half.toUpperCase()} approved — production gate cleared`);
  };

  const handleAdvance = async () => {
    if (isBlocked) {
      toast.error("Module is locked. Close all open NCRs before advancing.");
      return;
    }
    if (isGfcH1Blocked) {
      toast.error("GFC H1 drawings must be approved before starting production.");
      return;
    }
    if (isGfcH2Blocked) {
      toast.error("GFC H2 drawings must be approved before MEP Rough-In.");
      return;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx >= PRODUCTION_STAGES.length) {
      try {
        const { client } = await getAuthedClient();
        const { error } = await client.from("modules").update({
          production_status: "completed",
          current_stage: PRODUCTION_STAGES[PRODUCTION_STAGES.length - 1],
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
        current_stage: PRODUCTION_STAGES[nextIdx],
        production_status: "in_progress",
      } as any).eq("id", moduleId);
      if (error) throw error;
      toast.success(`Advanced to ${PRODUCTION_STAGES[nextIdx]}`);
      onAdvanced();
    } catch (err: any) {
      toast.error(err.message || "Failed to advance stage");
    }
  };

  return (
    <div className="space-y-3">
      {/* GFC gates */}
      {gfcH1Approved === false && (
        <div className="rounded-md p-2 flex items-center justify-between gap-2 text-xs" style={{ backgroundColor: "#FFF8E8", border: "1px solid #F5C842" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#D4860A" }} />
            <span style={{ color: "#D4860A" }}>GFC H1 not approved — production blocked</span>
          </div>
          {canApproveGFC && (
            <Button size="sm" className="h-6 text-[10px] text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleApproveGFC("h1")}>
              Approve H1
            </Button>
          )}
        </div>
      )}
      {gfcH1Approved === true && gfcH2Approved === false && currentIdx >= 0 && (
        <div className="rounded-md p-2 flex items-center justify-between gap-2 text-xs" style={{ backgroundColor: "#FFF8E8", border: "1px solid #F5C842" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "#D4860A" }} />
            <span style={{ color: "#D4860A" }}>GFC H2 not approved — MEP Rough-In blocked</span>
          </div>
          {canApproveGFC && (
            <Button size="sm" className="h-6 text-[10px] text-white" style={{ backgroundColor: "#006039" }} onClick={() => handleApproveGFC("h2")}>
              Approve H2
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PRODUCTION_STAGES.map((stage, idx) => {
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

      {isBlocked && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Module locked — {openNCRCount} open NCR(s). Production Head must close all NCRs before advancing.
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {canAdvance && !isCompleted && (
          <Button size="sm" variant="outline" onClick={handleAdvance} disabled={isBlocked || isGfcH1Blocked || isGfcH2Blocked} className="text-xs">
            {currentIdx === -1
              ? `Start → ${PRODUCTION_STAGES[0]}`
              : currentIdx + 1 < PRODUCTION_STAGES.length
                ? `Advance → ${PRODUCTION_STAGES[currentIdx + 1]}`
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
    </div>
  );
}
