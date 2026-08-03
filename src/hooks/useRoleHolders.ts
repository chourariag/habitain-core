import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

// Super Admin + MD only: resolve an app_role to the actual named people holding it.
const OVERSIGHT_ROLES = ["super_admin", "managing_director"];

let cache: Record<string, string[]> | null = null;
let inflight: Promise<Record<string, string[]>> | null = null;

async function loadHolders(): Promise<Record<string, string[]>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      const { data } = await (supabase as any).rpc("get_active_profiles_directory");
      const map: Record<string, string[]> = {};
      for (const p of (data ?? []) as any[]) {
        if (!p?.role) continue;
        (map[p.role] ??= []).push(p.display_name || "Unnamed user");
      }
      cache = map;
      return map;
    })();
  }
  return inflight;
}

export function useRoleHolders() {
  const { actualRole, loading } = useUserRole();
  // Deliberately keyed off actualRole (not the impersonated role) so oversight
  // users keep the visibility even while testing as someone else.
  const enabled = !!actualRole && OVERSIGHT_ROLES.includes(actualRole);
  const [holders, setHolders] = useState<Record<string, string[]> | null>(cache);

  useEffect(() => {
    if (!enabled || holders) return;
    let cancelled = false;
    loadHolders().then((m) => { if (!cancelled) setHolders(m); });
    return () => { cancelled = true; };
  }, [enabled, holders]);

  /** Returns "Ramesh Iyer" / "A, B" / "unassigned", or null when the viewer isn't allowed to see names. */
  const namesFor = (roles: string | string[] | null | undefined): string | null => {
    if (!enabled || !holders || !roles) return null;
    const list = Array.isArray(roles) ? roles : [roles];
    const names = Array.from(new Set(list.flatMap((r) => holders[r] ?? [])));
    return names.length ? names.join(", ") : "unassigned";
  };

  return { canSeeNames: enabled, namesFor, loading: loading || (enabled && !holders) };
}
