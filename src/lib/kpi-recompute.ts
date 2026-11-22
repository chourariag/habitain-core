import { supabase } from "@/integrations/supabase/client";
import { isTier1OrSuper } from "@/lib/roles";

/** Background refresh is limited to the same business tier as the checked endpoint. */
export async function refreshKpiForRole(role: string | null | undefined): Promise<void> {
  if (!isTier1OrSuper(role)) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await supabase.functions.invoke("kpi-recompute", {
    body: null,
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  });
}
