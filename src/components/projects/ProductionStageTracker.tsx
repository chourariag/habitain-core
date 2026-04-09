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
  dryAssemblyRequired?: boolean;
}

export function ProductionStageTracker({ moduleId, projectId, currentStage, productionStatus, canAdvance, onAdvanced, dryAssemblyRequired }: Props) {
  const currentIdx = currentStage ? PRODUCTION_STAGES.indexOf(currentStage as any) : -1;
  const isCompleted = productionStatus === "completed";
  const isOnHold = productionStatus === "hold";

  const [openNCRCount, setOpenNCRCount] = useState(0);
  const [qcWizardOpen, setQcWizardOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

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

  const canStartInspection = ["qc_inspector", "production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");
  const isBlocked = isOnHold && openNCRCount > 0;
  // Block advancing from Stage 1 to Stage 2 if dry assembly check not done
  const isDryAssemblyBlocked = dryAssemblyRequired && currentStage === "Sub-Frame";
  const isBlocked = isOnHold && openNCRCount > 0;

  const handleAdvance = async () => {
    if (isBlocked) {
      toast.error("Module is locked. Close all open NCRs before advancing.");
      return;
    }
    if (isDryAssemblyBlocked) {
      toast.error("Dry Assembly Check must be completed before advancing to Stage 2.");
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
          <Button size="sm" variant="outline" onClick={handleAdvance} disabled={isBlocked || isDryAssemblyBlocked} className="text-xs">
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
