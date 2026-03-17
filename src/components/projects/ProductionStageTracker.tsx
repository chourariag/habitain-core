import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";

export const PRODUCTION_STAGES = [
  "Sub-Frame",
  "Insulation",
  "MEP Rough-In",
  "Drywall",
  "MEP Final",
  "Finishing",
  "Paint",
  "QC Inspection",
  "Dispatch",
] as const;

interface Props {
  moduleId: string;
  currentStage: string | null;
  productionStatus: string | null;
  canAdvance: boolean;
  onAdvanced: () => void;
}

export function ProductionStageTracker({ moduleId, currentStage, productionStatus, canAdvance, onAdvanced }: Props) {
  const currentIdx = currentStage ? PRODUCTION_STAGES.indexOf(currentStage as any) : -1;
  const isCompleted = productionStatus === "completed";

  const handleAdvance = async () => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= PRODUCTION_STAGES.length) {
      // Mark completed
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
                  isComplete ? "bg-success" : isCurrent ? "bg-primary" : "bg-border"
                )} />
              )}
              <div
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
                  isComplete && "bg-success/20 text-success-foreground border-success/30",
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

      {canAdvance && !isCompleted && (
        <Button size="sm" variant="outline" onClick={handleAdvance} className="text-xs">
          {currentIdx === -1
            ? `Start → ${PRODUCTION_STAGES[0]}`
            : currentIdx + 1 < PRODUCTION_STAGES.length
              ? `Advance → ${PRODUCTION_STAGES[currentIdx + 1]}`
              : "Mark Completed"}
        </Button>
      )}
    </div>
  );
}
