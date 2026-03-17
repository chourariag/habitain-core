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
      const { email, role, login_type, phone, kiosk_pin } = payload;
      const kioskRoles = ["fabrication_foreman", "electrical_installer", "elec_plumbing_installer"];
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      const normalizedPhone = typeof phone === "string" ? phone.replace(/\D/g, "").slice(-10) : "";
      const normalizedPin = typeof kiosk_pin === "string" ? kiosk_pin.replace(/\D/g, "").slice(0, 4) : "";
      const effectiveLoginType = login_type || (kioskRoles.includes(role) ? "otp" : "email");

      if (!normalizedEmail || !role) {
        return new Response(JSON.stringify({ error: "Email and role are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (kioskRoles.includes(role) && normalizedPhone.length !== 10) {
        return new Response(JSON.stringify({ error: "Kiosk users require a valid 10-digit phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (kioskRoles.includes(role) && normalizedPin.length !== 4) {
        return new Response(JSON.stringify({ error: "Kiosk users require a 4-digit PIN" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tempPassword = crypto.randomUUID().slice(0, 16) + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const profilePayload = {
        auth_user_id: newUser.user.id,
        email: normalizedEmail,
        role,
        login_type: effectiveLoginType,
        phone: normalizedPhone ? `+91${normalizedPhone}` : null,
        kiosk_pin: normalizedPin || null,
        is_active: true,
        is_archived: false,
      };

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert(profilePayload, { onConflict: "auth_user_id" });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "create_user",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: newUser.user.id,
        new_value: {
          email: normalizedEmail,
          role,
          login_type: effectiveLoginType,
          phone: profilePayload.phone,
          kiosk_pin_set: Boolean(profilePayload.kiosk_pin),
        },
      });

      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
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
