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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
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

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("auth_user_id", callerId)
      .single();

    const directorRoles = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];
    if (!callerProfile || !directorRoles.includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: Director access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    // ── CREATE USER ──────────────────────────────────────────────
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

      // Use inviteUserByEmail for non-kiosk users, createUser for kiosk
      let userId: string;

      if (kioskRoles.includes(role)) {
        // Kiosk users get a random password (they use PIN login)
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
        userId = newUser.user.id;
      } else {
        // Non-kiosk users get an invite email with magic link
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
          redirectTo: `${req.headers.get("origin") || supabaseUrl}/welcome`,
        });
        if (inviteError) {
          return new Response(JSON.stringify({ error: inviteError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = inviteData.user.id;
      }

      const profilePayload = {
        auth_user_id: userId,
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
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });

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
        entity_id: userId,
        new_value: {
          email: normalizedEmail,
          role,
          login_type: effectiveLoginType,
          phone: profilePayload.phone,
          kiosk_pin_set: Boolean(profilePayload.kiosk_pin),
        },
      });

      return new Response(
        JSON.stringify({
          success: true,
          user_id: userId,
          invite_sent: !kioskRoles.includes(role),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE USER WITH PASSWORD (approval flow) ────────────────
    if (action === "create_user_with_password") {
      const { email, role, password, display_name, phone, reporting_manager_id } = payload;
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!normalizedEmail || !role || !password) {
        return new Response(JSON.stringify({ error: "email, role, password required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: display_name || null },
      });
      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = newUser.user.id;
      await supabaseAdmin.from("profiles").upsert({
        auth_user_id: userId,
        email: normalizedEmail,
        display_name: display_name || null,
        phone: phone || null,
        role,
        login_type: "email",
        reporting_manager_id: reporting_manager_id || null,
        is_active: true,
        is_archived: false,
      }, { onConflict: "auth_user_id" });
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "create_user_with_password",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: userId,
        new_value: { email: normalizedEmail, role, display_name },
      });
      return new Response(JSON.stringify({ success: true, user_id: userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── REASSIGN AND DEACTIVATE (approval flow) ──────────────────
    if (action === "reassign_and_deactivate") {
      const { user_id, reassign_to } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Best-effort task reassignment (table may or may not exist)
      if (reassign_to) {
        try {
          await supabaseAdmin.from("project_tasks")
            .update({ assigned_to: reassign_to })
            .eq("assigned_to", user_id)
            .in("status", ["Upcoming", "In Progress", "Blocked"]);
        } catch (_) { /* ignore */ }
      }
      const { data: oldProfile } = await supabaseAdmin.from("profiles").select("*").eq("auth_user_id", user_id).single();
      await supabaseAdmin.from("profiles").update({ is_active: false, is_archived: true }).eq("auth_user_id", user_id);
      await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "reassign_and_deactivate",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        old_value: oldProfile,
        new_value: { is_active: false, reassign_to: reassign_to || null },
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DEACTIVATE USER ──────────────────────────────────────────
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

    // ── REACTIVATE USER ──────────────────────────────────────────
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

    // ── UPDATE ROLE ──────────────────────────────────────────────
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
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
