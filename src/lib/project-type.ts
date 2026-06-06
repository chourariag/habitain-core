// Helpers for distinguishing Habitainer vs ADS (Altree Design Studio) projects.
// The canonical field on `projects` is `division` ("Habitainer" | "ADS").

export function isAdsProject(project: { division?: string | null } | null | undefined): boolean {
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
