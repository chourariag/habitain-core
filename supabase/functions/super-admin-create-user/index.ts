import { generatePassword, passwordPolicyError } from "../_shared/password-policy.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Verify caller is super_admin
    const { data: callerProfile } = await admin.from("profiles").select("is_active,must_change_password").eq("auth_user_id", userData.user.id).maybeSingle();
    const { data: superRole } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "super_admin").maybeSingle();
    if (!superRole || callerProfile?.is_active === false || callerProfile?.must_change_password !== false) {
      return new Response(JSON.stringify({ error: "Forbidden — super_admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const body = await req.json();
    const { email, full_name, role, department } = body ?? {};

    if (!email || !full_name || !role) {
      return new Response(JSON.stringify({ error: "email, full_name, role required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    if (!/^[^\s@]+@altree\.in$/i.test(email)) {
      return new Response(JSON.stringify({ error: "Email must be @altree.in" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    // Check if email already exists
    const { data: existingProfile } = await admin
      .from("profiles").select("auth_user_id").eq("email", email).maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "Already exists", already_exists: true }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const password = body.password === undefined || body.password === "" ? generatePassword() : body.password;
    const policyError = await passwordPolicyError(password);
    if (policyError) return new Response(JSON.stringify({ error: policyError }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "create failed";
      return new Response(JSON.stringify({ error: msg, already_exists: msg.toLowerCase().includes("already") }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    // Update profile (handle_new_user trigger creates a row; update role + name + dept)
    const { error: profileErr } = await admin.from("profiles").update({
      display_name: full_name,
      department: department ?? null,
      is_active: true,
      must_change_password: true,
    }).eq("auth_user_id", created.user.id);

    if (profileErr) {
      // Roll back auth user
      await admin.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: `Profile update failed: ${profileErr.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const { error: roleError } = await admin.rpc("admin_set_account_access", { _caller: userData.user.id, _target: created.user.id, _role: role, _active: null });
    if (roleError) return new Response(JSON.stringify({ error: roleError.message }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
    return new Response(JSON.stringify({
      success: true,
      user_id: created.user.id,
      email,
      full_name,
      role,
      temporary_password: password,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
});
