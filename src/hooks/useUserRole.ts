import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole() {
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      if (cancelled) return;
      setRole(data as string | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { role, userId, loading };
}
