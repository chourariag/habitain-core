import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { defaultPermission, type PermissionLevel, type PermissionRole } from "@/lib/role-permissions-catalog";

/**
 * Single source of truth for UI visibility.
 * Pages should opt in via usePagePermission(pageKey).
 * MD + super_admin always resolve to 'full'.
 * Missing rows resolve to the default from the catalog (typically 'hidden').
 */
export function useRolePermissions() {
  const { role } = useUserRole();
  const [map, setMap] = useState<Map<string, PermissionLevel>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!role) { setLoading(false); return; }
      const { data } = await supabase
        .from("role_permissions" as never)
        .select("page_key, permission_level")
        .eq("role_code", role);
      if (cancelled) return;
      const m = new Map<string, PermissionLevel>();
      ((data as unknown as { page_key: string; permission_level: PermissionLevel }[]) || [])
        .forEach(r => m.set(r.page_key, r.permission_level));
      setMap(m);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [role]);

  return { role, map, loading };
}

export function usePagePermission(pageKey: string): PermissionLevel {
  const { role, map, loading } = useRolePermissions();
  return useMemo(() => {
    if (loading || !role) return "hidden";
    if (role === "managing_director" || role === "super_admin" || role === "principal_architect") return "full";
    const explicit = map.get(pageKey);
    if (explicit) return explicit;
    return defaultPermission(role as PermissionRole, pageKey);
  }, [role, map, loading, pageKey]);
}
