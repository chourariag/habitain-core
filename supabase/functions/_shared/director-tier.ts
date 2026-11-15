// Mirrors src/lib/roles.ts; Edge deployments cannot import application source.
export const TIER1_ROLES = ["managing_director", "finance_director", "sales_director", "architecture_director"] as const;
export function isTier1(role: string | null | undefined): boolean {
  return TIER1_ROLES.some(candidate => candidate === role);
}
export function uniqueRecipientIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}
export function uniqueByAuthUser<T extends { auth_user_id?: string | null }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row.auth_user_id || seen.has(row.auth_user_id)) return false;
    seen.add(row.auth_user_id);
    return true;
  });
}