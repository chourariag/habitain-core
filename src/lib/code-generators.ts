/**
 * Generates a short project code from the project name.
 * Takes up to 3 uppercase consonant-leading letters.
 * e.g. "Namma Dream Homes" → "NDH", "Altree Villas" → "ALV"
 */
export function projectCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return words.slice(0, 3).map(w => w[0].toUpperCase()).join("");
  }
  if (words.length === 2) {
    return (words[0][0] + words[1][0] + (words[1][1] ?? "X")).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase().padEnd(3, "X");
}

/** MOD-NDH-001 */
export function moduleCode(projCode: string, seq: number): string {
  return `MOD-${projCode}-${String(seq).padStart(3, "0")}`;
}

/** PNL-NDH-001-W1 */
export function panelCode(modCode: string, panelTypeShort: string, seq: number): string {
  // modCode is like "MOD-NDH-001" → strip "MOD-" prefix
  const suffix = modCode.replace(/^MOD-/, "");
  return `PNL-${suffix}-${panelTypeShort}${seq}`;
}

const PANEL_TYPE_SHORT: Record<string, string> = {
  wall: "W",
  floor: "F",
  ceiling: "C",
  partition: "P",
  facade: "X",
};

export function panelTypeShort(panelType: string): string {
  return PANEL_TYPE_SHORT[panelType] ?? panelType[0]?.toUpperCase() ?? "U";
}
