// Production system definitions and hybrid-specific stage list

export type ProductionSystem = "modular" | "panelised" | "hybrid";

export const MODULAR_STAGES = [
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

// Hybrid system stage list — replaces wall framing + concealed MEP with
// a Panel Bay dependency stage and a panel-installation stage.
export const HYBRID_STAGES = [
  "Sub-Frame",
  "Deck & Pour",
  "Awaiting Panels",       // BLOCKED until Panel Bay handover
  "Panel Installation",    // 3F-NEW: install panels from Panel Bay
  "MEP Inter-Panel",       // 3G-NEW: connect tails between panels
  "Waterproofing",
  "Tiling & Cladding",
  "Finishing",
  "QC Inspection",
  "Dispatch",
] as const;

export const PANELISED_STAGES = [
  "LGSF Receipt",
  "Frame Assembly",
  "Moisture Barrier",
  "Cera Board",
  "MEP Rough-In",
  "Pressure Test",
  "Insulation",
  "Habit Board",
  "Window/Door",
  "QC Sign-off",
] as const;

export function getStagesForSystem(system: ProductionSystem | string | null): readonly string[] {
  switch (system) {
    case "hybrid": return HYBRID_STAGES;
    case "panelised": return PANELISED_STAGES;
    default: return MODULAR_STAGES;
  }
}

export const PRODUCTION_SYSTEM_LABELS: Record<ProductionSystem, string> = {
  modular: "Modular",
  panelised: "Panelised",
  hybrid: "Hybrid",
};

// Tailwind-safe colour styles per system (semantic via inline style for badge consistency)
export const PRODUCTION_SYSTEM_BADGE: Record<ProductionSystem, { bg: string; fg: string }> = {
  modular: { bg: "hsl(155 100% 19% / 0.15)", fg: "hsl(155 100% 19%)" },     // green
  panelised: { bg: "hsl(210 80% 50% / 0.15)", fg: "hsl(210 80% 40%)" },      // blue
  hybrid: { bg: "hsl(270 60% 50% / 0.15)", fg: "hsl(270 60% 40%)" },         // purple
};
