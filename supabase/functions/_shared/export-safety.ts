/** Apply before CSV quoting or Excel string-cell serialization; numbers stay numbers. */
export function neutralizeCell<T>(value: T): T | string {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function safeCsvCell(value: unknown, alwaysQuote = false): string {
  const safe = neutralizeCell(value);
  const text = safe == null ? "" : typeof safe === "object" ? JSON.stringify(safe) : String(safe);
  return alwaysQuote || /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** Escape data, never the trusted HTML template. */
export function escapeHtmlValues(value: unknown): any {
  if (typeof value === "string") return escapeHtml(value);
  if (Array.isArray(value)) return value.map(escapeHtmlValues);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, escapeHtmlValues(item)]));
  return value;
}