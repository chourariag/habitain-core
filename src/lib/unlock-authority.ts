/**
 * Equal-tier unlock authority for locked/signed documents
 * (Scope of Work, Sale Agreement, GFC sign-offs).
 *
 * Role-based only — never a hardcoded person or a single "is this the MD" check.
 * Any role in this group can independently trigger an unlock; there is no
 * hierarchy or sequencing between them. Mirrors the database function
 * public.can_unlock_locked_document(uuid).
 */
export const UNLOCK_TIER_ROLES = [
  "super_admin",
  "managing_director",
  "chairman",
  "finance_director",
  "sales_director",
  "architecture_director",
  "principal_architect",
] as const;

export function canUnlockLockedDocument(role: string | null | undefined): boolean {
  return !!role && (UNLOCK_TIER_ROLES as readonly string[]).includes(role);
}

export const UNLOCK_TIER_LABEL =
  "Managing Director, Chairman, any Director or the Principal Architect";

/** A record is editable while its unlock window is still open. */
export function isUnlockWindowOpen(unlockedUntil: string | null | undefined): boolean {
  if (!unlockedUntil) return false;
  return new Date(unlockedUntil).getTime() > Date.now();
}
