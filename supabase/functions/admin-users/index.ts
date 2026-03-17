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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller identity using anon client with user's auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Use anon key client with the user's auth header to verify identity
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check caller is director using service role client (bypasses RLS)
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("auth_user_id", callerId)
      .single();

    const directorRoles = ["managing_director", "finance_director", "sales_director", "architecture_director"];
    if (!callerProfile || !directorRoles.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: Director access required", debug_role: callerProfile?.role || "no_profile_found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    if (action === "create_user") {
      const { email, role, login_type, phone } = payload;

      if (!email || !role) {
        return new Response(JSON.stringify({ error: "Email and role are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("profiles")
        .update({ role, login_type: login_type || "email", phone: phone || null })
        .eq("auth_user_id", newUser.user.id);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "create_user",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: newUser.user.id,
        new_value: { email, role, login_type },
      });

      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUser.user.id,
          invite_link: resetData?.properties?.action_link || null,
          temp_password: tempPassword,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate_user") {
      const { user_id } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: oldProfile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user_id)
        .single();

      await supabaseAdmin
        .from("profiles")
        .update({ is_active: false, is_archived: true })
        .eq("auth_user_id", user_id);

      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "deactivate_user",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        old_value: oldProfile,
        new_value: { is_active: false, is_archived: true },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reactivate_user") {
      const { user_id } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("profiles")
        .update({ is_active: true, is_archived: false })
        .eq("auth_user_id", user_id);

      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "reactivate_user",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        new_value: { is_active: true },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const { user_id, role } = payload;
      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id and role required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: oldProfile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("auth_user_id", user_id)
        .single();

      await supabaseAdmin
        .from("profiles")
        .update({ role })
        .eq("auth_user_id", user_id);

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id, role }, { onConflict: "user_id,role" });

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "update_role",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        old_value: { role: oldProfile?.role },
        new_value: { role },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
