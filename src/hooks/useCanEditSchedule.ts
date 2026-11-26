import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

/** Server entitlement only: role lists and View as User never decide schedule write access. */
export function useCanEditSchedule() {
  const { userId } = useUserRole();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setAllowed(false);
    if (!userId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("can_edit_schedule", { _uid: userId });
      if (!cancelled) {
        setAllowed(!error && data === true);
        setLoading(false);
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
    };
  }, [userId]);

  return { allowed, loading };
}
