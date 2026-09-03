/**
 * Shared field-resolution logic for the Project Setup template export.
 *
 * Single source of truth for the "this role currently has no active holder"
 * condition: every role-resolved field renders the same NOT_TRACKED marker
 * (amber italic) instead of a silent blank cell.
 */

export const NOT_TRACKED = "Not yet tracked";

/** Font applied to any cell whose value is the NOT_TRACKED marker. */
export const NOT_TRACKED_FONT = {
  italic: true,
  color: { argb: "FFD4860A" },
} as const;

type RoleFetcher = (role: string, fallback?: string) => Promise<string>;

/**
 * Resolves the first role in `roles` that has at least one active holder.
 * Returns NOT_TRACKED when none of them do — never an empty string.
 */
export async function resolveRoleField(
  fetchRoleHolderName: RoleFetcher,
  ...roles: string[]
): Promise<string> {
  for (const role of roles) {
    const name = (await fetchRoleHolderName(role, "")) || "";
    if (name.trim()) return name;
  }
  return NOT_TRACKED;
}

/**
 * Sales Owner comes only from a real rep that arrived via the
 * sales_deals → sales_pipeline_leads Won bridge. No placeholder text:
 * if no lead for this project carries a real `sales_rep`, the field is
 * explicitly NOT_TRACKED.
 */
export async function resolveSalesOwner(
  client: any,
  projectId: string,
): Promise<string> {
  const { data: leadRows } = await client
    .from("sales_pipeline_leads")
    .select("sales_rep, sales_rep_name, ready_to_win_deal_id")
    .eq("project_id", projectId);

  const lead = ((leadRows || []) as any[]).find((l) => l.sales_rep);
  if (!lead?.sales_rep) return NOT_TRACKED;

  const { data: repProfile } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", lead.sales_rep)
    .maybeSingle();

  return repProfile?.display_name || NOT_TRACKED;
}

/** True when a resolved value should render with the amber italic marker style. */
export function isNotTracked(value: unknown): boolean {
  return value === NOT_TRACKED;
}
