import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TM_KEY = "hstack_testing_mode";

export interface TestingModeData {
  overrideRole: string;
  overrideName: string;
  realRole: string;
  realRoleName: string;
}

export function getTestingModeData(): TestingModeData | null {
  try {
    const s = sessionStorage.getItem(TM_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function setTestingMode(data: TestingModeData) {
  try { sessionStorage.setItem(TM_KEY, JSON.stringify(data)); } catch {}
  window.location.reload();
}

export function clearTestingMode() {
  try { sessionStorage.removeItem(TM_KEY); } catch {}
  window.location.reload();
}

export function useUserRole() {
  const tm = getTestingModeData();
  const [role, setRole] = useState<string | null>(tm?.overrideRole ?? null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!tm);

  useEffect(() => {
    const override = getTestingModeData();
    if (override) {
      setRole(override.overrideRole);
      setLoading(false);
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
      return;
    }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setRole(data as string | null);
      setLoading(false);
    })();
  }, []);

  return { role, userId, loading };
}
