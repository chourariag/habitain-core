// Helpers for distinguishing Habitainer vs ADS (Altree Design Studio) projects.
// Reads either `project_type` ('habitainer' | 'ads') or legacy `division` ("Habitainer" | "ADS").

export function isAdsProject(project: { project_type?: string | null; division?: string | null } | null | undefined): boolean {
  const pt = String(project?.project_type ?? "").trim().toLowerCase();
  if (pt) return pt === "ads";
  return String(project?.division ?? "").trim().toLowerCase() === "ads";
}

export function isAdsDivision(division: string | null | undefined): boolean {
  return String(division ?? "").trim().toLowerCase() === "ads";
}

// ADS-specific pre-production gates (from the ADS design pipeline A-1..A-14)
export const ADS_REQUIRED_GATES = [
  { code: "A-1", label: "Design Agreement signed" },
  { code: "A-3", label: "Design Brief completed" },
  { code: "A-10", label: "Schematic Design Report done" },
  { code: "A-11", label: "GFC Architecture drawings issued" },
] as const;
