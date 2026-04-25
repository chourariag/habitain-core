import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password, display_name } = await req.json();

    if (action === "check") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true });

      return new Response(
        JSON.stringify({ has_users: (count ?? 0) > 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true });

      if ((count ?? 0) > 0) {
        return new Response(
          JSON.stringify({ error: "Setup already completed. Users exist." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile with super_admin role (has identical access to managing_director)
      await supabaseAdmin
        .from("profiles")
        .update({
          role: "super_admin",
          display_name: display_name || null,
          login_type: "email",
        })
        .eq("auth_user_id", newUser.user.id);

      // Insert into user_roles
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "super_admin" });

      // Audit log
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "bootstrap_admin",
        performed_by: newUser.user.id,
        entity_type: "profile",
        entity_id: newUser.user.id,
        new_value: { email, role: "super_admin", display_name },
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
