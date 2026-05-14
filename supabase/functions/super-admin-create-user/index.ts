import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const sym = "@#$%&*";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  s += sym[Math.floor(Math.random() * sym.length)];
  s += Math.floor(Math.random() * 90 + 10);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verify caller is super_admin
    const { data: callerProfile } = await admin
      .from("profiles").select("role").eq("auth_user_id", userData.user.id).maybeSingle();
    if (callerProfile?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden — super_admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { email, full_name, role, department } = body ?? {};

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, full_name, role required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!/^[^\s@]+@altree\.in$/i.test(email)) {
      return new Response(JSON.stringify({ error: "Email must be @altree.in" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check if email already exists
    const { data: existingProfile } = await admin
      .from("profiles").select("auth_user_id").eq("email", email).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "Already exists", already_exists: true }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const password = genPassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "create failed";
      return new Response(JSON.stringify({ error: msg, already_exists: msg.toLowerCase().includes("already") }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update profile (handle_new_user trigger creates a row; update role + name + dept)
    const { error: profileErr } = await admin.from("profiles").update({
      display_name: full_name,
      role,
      department: department ?? null,
      is_active: true,
    }).eq("auth_user_id", created.user.id);

    if (profileErr) {
      // Roll back auth user
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: `Profile update failed: ${profileErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: created.user.id,
      email,
      full_name,
      role,
      temporary_password: password,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
