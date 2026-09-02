import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the active person(s) currently holding an app_role.
 * Role-based lookup only — never hardcode a person's name in the UI.
 * Uses the open directory SELECT policy on `profiles`, so every
 * authenticated user gets a name.
 */
const cache = new Map<string, string>();

export function useRoleHolderName(role: string, fallback = "unassigned") {
  const [name, setName] = useState<string>(cache.get(role) ?? fallback);

  useEffect(() => {
    if (!role) return;
    if (cache.has(role)) { setName(cache.get(role)!); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from("profiles") as any)
        .select("display_name")
        .eq("role", role)
        .eq("is_active", true)
        .order("display_name");
      const names = ((data ?? []) as any[])
        .map((p) => p.display_name)
        .filter(Boolean);
      const joined = names.length ? names.join(", ") : fallback;
      cache.set(role, joined);
      if (!cancelled) setName(joined);
    })();
    return () => { cancelled = true; };
  }, [role, fallback]);

  return name;
}

/** Non-hook variant for exports / one-off reads. */
export async function fetchRoleHolderName(role: string, fallback = ""): Promise<string> {
  const { data } = await (supabase.from("profiles") as any)
    .select("display_name")
    .eq("role", role)
    .eq("is_active", true)
    .order("display_name");
  const names = ((data ?? []) as any[]).map((p) => p.display_name).filter(Boolean);
  return names.length ? names.join(", ") : fallback;
}
