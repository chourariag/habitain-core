/**
 * Convert a human label into the camelCase i18n key used under `dashboard.tiles.*`.
 * "Open NCRs" -> "openNcrs", "Revenue MTD" -> "revenueMtd", "Hot Deals 🔥" -> "hotDeals"
 */
export function tileKey(label: string): string {
  const words = label
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "unknown";
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}
