/**
 * Single source of truth for Site Readiness Checklist permissions.
 *
 * These roles mirror the `site_readiness` RLS insert/update policy in the
 * database. Keep both in sync — UI gating must never be wider or narrower
 * than what the database allows.
 */
export const SITE_READINESS_SUBMIT_ROLES = [
  "site_engineer",
  "site_installation_mgr",
  "delivery_rm_lead",
  "head_operations",
  "super_admin",
  "managing_director",
] as const;

export type SiteReadinessSubmitRole = (typeof SITE_READINESS_SUBMIT_ROLES)[number];

/** Whether a role may fill in and submit the Site Readiness Checklist. */
export function canSubmitSiteReadiness(role: string | null | undefined): boolean {
  if (!role) return false;
  return (SITE_READINESS_SUBMIT_ROLES as readonly string[]).includes(role);
}
