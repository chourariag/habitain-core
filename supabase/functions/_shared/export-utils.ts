export const LINK_SECONDS = 300;
export const RETENTION_DAYS = 60;
const sensitive = /salary|payroll|compensation|bank|aadhaar|aadhar|pan_number|pan_no|token|password|secret/i;
export function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitive.test(key)).map(([key, item]) => [key, sanitize(item)]));
  return value;
}
export function csvCell(value: unknown): string {
  const cleaned = sanitize(value);
  const text = cleaned == null ? '' : typeof cleaned === 'object' ? JSON.stringify(cleaned) : String(cleaned);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function toCsv(columns: readonly string[], rows: Record<string, unknown>[]): string {
  return [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n') + '\r\n';
}
export function istDate(now = new Date()): string { return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10); }
export function expiredFolder(name: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(name) && name < new Date(Date.parse(today) - RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
}
export async function hashToken(token: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), byte => byte.toString(16).padStart(2, '0')).join('');
}