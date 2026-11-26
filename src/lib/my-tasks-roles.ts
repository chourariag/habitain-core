import { isTier1 } from "@/lib/roles";

/**
 * Screen role -> responsible_role values on project_tasks that person should see.
 * Real app roles only; legacy template keys (site_installation_manager, site_manager)
 * are kept as extra matches so existing legacy rows keep showing.
 */
export const MY_TASK_ROLE_MAP: Record<string, string[]> = {
  production_head: ["production_head", "factory_supervisor"],
  factory_supervisor: ["factory_supervisor"],
  factory_floor_supervisor: ["factory_supervisor", "factory_floor_supervisor"],
  fabrication_foreman: ["factory_supervisor", "fabrication_foreman"],
  site_installation_mgr: ["site_installation_mgr", "site_installation_manager"],
  site_engineer: ["site_installation_mgr", "site_engineer", "site_installation_manager"],
  planning_engineer: ["planning_engineer"],
  // legacy screen keys (not app roles) kept so older callers keep working
  site_installation_manager: ["site_installation_mgr", "site_installation_manager"],
  site_manager: ["site_manager"],
};

export type MyTaskRoles = "all" | string[] | null;

/** "all" for Tier 1 / super_admin, a list for mapped roles, null when the person has no task list. */
export function responsibleRolesFor(role: string | null | undefined): MyTaskRoles {
  if (!role) return null;
  if (role === "super_admin" || isTier1(role)) return "all";
  return MY_TASK_ROLE_MAP[role] ?? null;
}

/** Mirrors the project_tasks UPDATE policy roles so the sheet is read-only for others (database still decides). */
export const TASK_UPDATE_ROLES = [
  "super_admin", "managing_director", "chairman", "head_operations", "production_head", "planning_head",
  "planning_engineer", "site_installation_mgr", "factory_floor_supervisor", "factory_supervisor",
  "finance_director", "sales_director", "architecture_director", "site_engineer",
];
