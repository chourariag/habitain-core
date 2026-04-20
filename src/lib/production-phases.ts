// Display-only phase names per production system. Database values are unchanged.
import { MODULAR_STAGES, HYBRID_STAGES, PANELISED_STAGES, type ProductionSystem } from "./production-systems";

export const SYSTEM_PHASES: Record<"modular" | "panelised" | "hybrid", string[]> = {
  modular: [
    "Design", "Procurement", "PEB Fabrication", "Factory Production",
    "QC + Dispatch", "Site Installation", "Finishing", "Handover",
  ],
  panelised: [
    "Design", "Procurement", "PEB Fabrication", "Panel Production",
    "Site Pre-check", "Site Erection", "Slab", "MEP + Finishing", "Handover",
  ],
  hybrid: [
    "Design", "Procurement", "Panel Production", "PEB Fabrication",
    "Factory Production", "QC + Dispatch", "Site Installation", "Finishing", "Handover",
  ],
};

export function getPhasesForSystem(system: string | null | undefined): string[] {
  if (system === "modular" || system === "panelised" || system === "hybrid") {
    return SYSTEM_PHASES[system];
  }
  // Legacy fallback (pre-template projects)
  return ["Pre-Production", "Civil Works", "Factory Production", "Delivery", "Site Installation", "Finishing", "Handover"];
}

export type TaskTemplateType = "task" | "sub-task" | "qc_gate" | "sign-off" | "payment";

export const TASK_TYPE_META: Record<TaskTemplateType, { icon: string; color: string; label: string }> = {
  task:       { icon: "",  color: "",         label: "Task" },
  "sub-task": { icon: "",  color: "",         label: "Sub-task" },
  qc_gate:    { icon: "🛡", color: "#F40009", label: "QC Gate" },
  "sign-off": { icon: "✓",  color: "#006039", label: "Sign-off" },
  payment:    { icon: "₹",  color: "#D4860A", label: "Payment" },
};

/**
 * Maps a low-level operational stage (e.g. "MEP Rough-In", "Awaiting Panels")
 * to its high-level phase label for the given production system.
 *
 * Used to label Kanban columns, Gantt row groupings, and Factory Floor bay headers
 * with the per-system phase names from the process documents — without changing
 * any database stage values.
 */
export function getPhaseForStage(
  stage: string | null | undefined,
  system: string | null | undefined,
): string {
  if (!stage) return "—";

  const sys: ProductionSystem =
    system === "panelised" || system === "hybrid" ? system : "modular";

  // MODULAR mapping
  if (sys === "modular") {
    if (["Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
         "MEP Final", "Windows & Doors", "Finishing"].includes(stage)) {
      return "Factory Production";
    }
    if (["QC Inspection", "Dispatch", "Dispatch Ready"].includes(stage)) {
      return "QC + Dispatch";
    }
    return stage;
  }

  // HYBRID mapping
  if (sys === "hybrid") {
    if (["Sub-Frame", "Deck & Pour", "Awaiting Panels", "Panel Installation",
         "MEP Inter-Panel", "Waterproofing", "Tiling & Cladding", "Finishing"].includes(stage)) {
      return "Factory Production";
    }
    if (["QC Inspection", "Dispatch", "Dispatch Ready"].includes(stage)) {
      return "QC + Dispatch";
    }
    return stage;
  }

  // PANELISED mapping
  if (["LGSF Receipt", "Frame Assembly", "Moisture Barrier", "Cera Board",
       "MEP Rough-In", "Pressure Test", "Insulation", "Habit Board",
       "Window/Door", "QC Sign-off"].includes(stage)) {
    return "Panel Production";
  }
  return stage;
}

/**
 * Given a list of operational stages and a production system, returns a
 * deduplicated, ordered list of phase labels — useful for grouping columns
 * (Kanban) or row sections (Gantt) by phase rather than raw stage.
 */
export function groupStagesByPhase(
  stages: readonly string[],
  system: string | null | undefined,
): { phase: string; stages: string[] }[] {
  const result: { phase: string; stages: string[] }[] = [];
  for (const stage of stages) {
    const phase = getPhaseForStage(stage, system);
    const existing = result.find((g) => g.phase === phase);
    if (existing) existing.stages.push(stage);
    else result.push({ phase, stages: [stage] });
  }
  return result;
}

// Re-export stage lists for convenience
export { MODULAR_STAGES, HYBRID_STAGES, PANELISED_STAGES };
