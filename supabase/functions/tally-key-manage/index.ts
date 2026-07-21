// Manage the Tally ingestion API key: status + rotate.
// Only Super Admin and Managing Director may rotate; Finance Manager can view status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `hstk_tally_${b64}`;
}

function jsonResp(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return jsonResp({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return jsonResp({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const roleList = (roles ?? []).map(r => r.role);
  const isAdmin = roleList.some(r => r === "super_admin" || r === "managing_director");
  const isViewer = isAdmin || roleList.includes("finance_manager");
  if (!isViewer) return jsonResp({ error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* GET-like status */ }
  const action = body?.action ?? "status";

  if (action === "status") {
    const { data: active } = await admin
      .from("tally_api_keys")
      .select("id, key_prefix, created_at, last_used_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return jsonResp({ configured: !!active, key: active ?? null }, 200);
  }

  if (action === "rotate") {
    if (!isAdmin) return jsonResp({ error: "Only Super Admin or Managing Director can rotate" }, 403);
    const plain = randomKey();
    const hash = await sha256Hex(plain);
    const prefix = "••••••••••••" + plain.slice(-4);
    // Revoke old
    await admin.from("tally_api_keys").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null);
    const { error } = await admin.from("tally_api_keys").insert({
      key_hash: hash, key_prefix: prefix, created_by: user.id,
    });
    if (error) return jsonResp({ error: error.message }, 500);
    return jsonResp({ status: "success", apiKey: plain, keyPrefix: prefix }, 200);
  }

  return jsonResp({ error: "Unknown action" }, 400);
});
