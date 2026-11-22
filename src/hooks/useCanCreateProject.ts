import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

export const PROJECT_CREATOR_ACCESS_CHANGED = "hstack:project-creator-access-changed";

/** Screen visibility follows the authenticated caller's server entitlement, never a role/persona list. */
export function useCanCreateProject() {
  const { userId } = useUserRole();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    if (!userId) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("can_create_project", { _uid: userId });
      if (!cancelled) { setAllowed(!error && data === true); setLoading(false); }
    };
    void load();
    window.addEventListener("focus", load);
    window.addEventListener(PROJECT_CREATOR_ACCESS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
      window.removeEventListener(PROJECT_CREATOR_ACCESS_CHANGED, load);
    };
  }, [userId]);
  return { allowed, loading };
}