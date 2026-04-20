// Display-only phase names per production system. Database values are unchanged.
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
