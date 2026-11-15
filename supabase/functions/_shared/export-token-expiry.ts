export const DEFAULT_TOKEN_DAYS = 180;
export const MAX_TOKEN_DAYS = 365;
export function tokenExpiry(created: Date, days = DEFAULT_TOKEN_DAYS): string {
  if (!Number.isInteger(days) || days < 1 || days > MAX_TOKEN_DAYS) throw new Error('Token expiry must be 1–365 days');
  return new Date(created.getTime() + days * 86400000).toISOString();
}
export function tokenExpired(expiresAt: string, now = new Date()): boolean {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now.getTime();
}