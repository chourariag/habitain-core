import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Creates an authenticated Supabase client using the current session token.
 * Use this for inserts/updates that need RLS to see the user's role.
 */
export async function getAuthedClient() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !session.user) {
    throw new Error("Not authenticated");
  }

  const client = createClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  return { client, session };
}
