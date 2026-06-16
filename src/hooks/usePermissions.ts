import { useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import type { AppRole } from "@/lib/roles";
import {
  getAccessLevel,
  canAccessAdminPanel,
  type ModuleKey,
  type AccessLevel,
} from "@/lib/rbac-matrix";

/**
 * Module-level RBAC hook backed by the role × module matrix.
 *
 *   canView(m)    → FULL | VIEW | MANAGE
 *   canEdit(m)    → FULL only
 *   canManage(m)  → MANAGE | FULL  (manage own team / reportees)
 *   canAdmin()    → super_admin | managing_director | head_of_projects
 *   getLevel(m)   → raw access level
 */
export function usePermissions() {
  const { role, loading } = useUserRole();
  const appRole = (role as AppRole | null) ?? null;

  return useMemo(() => {
    const getLevel = (mod: ModuleKey): AccessLevel => getAccessLevel(appRole, mod);
    const canView = (mod: ModuleKey) => {
      const lvl = getLevel(mod);
      return lvl === "FULL" || lvl === "VIEW" || lvl === "MANAGE";
    };
    const canEdit = (mod: ModuleKey) => getLevel(mod) === "FULL";
    const canManage = (mod: ModuleKey) => {
      const lvl = getLevel(mod);
      return lvl === "FULL" || lvl === "MANAGE";
    };
    const canAdmin = () =>
      appRole === ("super_admin" as AppRole) ||
      appRole === ("managing_director" as AppRole);

    return {
      role: appRole,
      loading,
      getLevel,
      canView,
      canEdit,
      canManage,
      canAdmin,
      canAccessAdminPanel: () => canAccessAdminPanel(appRole),
    };
  }, [appRole, loading]);
}
