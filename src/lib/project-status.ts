import type { Tables } from "@/integrations/supabase/types";

export type DynamicProjectStatus = "not_started" | "in_production" | "dispatching" | "dispatched" | "handed_over";

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection",
];

/**
 * Compute a project's status dynamically from its modules.
 * - No modules → "Not Started"
 * - Any module in Sub-Frame…Finishing → "In Production"
 * - Any module at Dispatch stage → "Dispatching"
 * - All modules dispatched → "Dispatched"
 * - Handover pack submitted → "Handed Over"
 */
export function computeProjectStatus(
  modules: Pick<Tables<"modules">, "current_stage" | "production_status">[],
  hasHandover: boolean
): DynamicProjectStatus {
  if (hasHandover) return "handed_over";
  if (modules.length === 0) return "not_started";

  const allDispatched = modules.every((m) => m.production_status === "dispatched" || m.current_stage === "Dispatch");
  if (allDispatched) return "dispatched";

  const anyDispatching = modules.some((m) => m.current_stage === "Dispatch" || m.production_status === "dispatched");
  if (anyDispatching) return "dispatching";

  const anyInProduction = modules.some((m) =>
    PRODUCTION_STAGES.includes(m.current_stage ?? "") ||
    m.production_status === "in_progress"
  );
  if (anyInProduction) return "in_production";

  return "not_started";
}

export const PROJECT_STATUS_CONFIG: Record<DynamicProjectStatus, { label: string; badgeClass: string }> = {
  not_started: { label: "Not Started", badgeClass: "bg-muted text-muted-foreground" },
  in_production: { label: "In Production", badgeClass: "bg-primary text-primary-foreground" },
  dispatching: { label: "Dispatching", badgeClass: "bg-warning text-warning-foreground" },
  dispatched: { label: "Dispatched", badgeClass: "bg-primary text-primary-foreground" },
  handed_over: { label: "Handed Over", badgeClass: "bg-muted text-muted-foreground" },
};
