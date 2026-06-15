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

      if (normalizedPin) {
        await supabaseAdmin
          .from("profile_kiosk_pins")
          .upsert({ auth_user_id: userId, kiosk_pin: normalizedPin }, { onConflict: "auth_user_id" });
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
          kiosk_pin_set: Boolean(normalizedPin),
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

    // ── CREATE EMPLOYEE (full panel) ─────────────────────────────
    if (action === "create_employee") {
      // Only super_admin / managing_director may use this endpoint
      if (!["super_admin", "managing_director"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: super_admin or managing_director only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { full_name, email, phone, role, department, reporting_manager_id, secondary_manager_id, temp_password } = payload;
      const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
      const password = (typeof temp_password === "string" && temp_password.length >= 8) ? temp_password : "Altree@1234";
      if (!normalizedEmail || !role || !full_name) {
        return new Response(JSON.stringify({ error: "full_name, email and role are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Privilege escalation guard
      if (["super_admin", "managing_director"].includes(role) && callerProfile.role !== "super_admin" && callerProfile.role !== "managing_director") {
        return new Response(JSON.stringify({ error: "Only super_admin/managing_director can assign that role" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { display_name: full_name },
      });
      let userId: string | undefined = newUser?.user?.id;
      let alreadyExisted = false;
      if (createErr || !userId) {
        const msg = createErr?.message || "";
        const isDuplicate = /already|exists|registered/i.test(msg);
        if (!isDuplicate) {
          return new Response(JSON.stringify({ error: msg || "Create failed" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Email already registered — locate existing auth user and link / refresh profile
        let foundId: string | undefined;
        for (let page = 1; page <= 20 && !foundId; page++) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
          if (listErr) break;
          foundId = list?.users?.find((u: any) => (u.email || "").toLowerCase() === normalizedEmail)?.id;
          if (!list || list.users.length < 200) break;
        }
        if (!foundId) {
          return new Response(JSON.stringify({ error: msg, already_exists: true }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = foundId;
        alreadyExisted = true;
      }
      const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
        auth_user_id: userId,
        email: normalizedEmail,
        display_name: full_name,
        phone: phone || null,
        role,
        department: department || null,
        reporting_manager_id: reporting_manager_id || null,
        login_type: "email",
        is_active: true,
        is_archived: false,
      }, { onConflict: "auth_user_id" });
      if (profileErr) {
        if (!alreadyExisted) await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      await supabaseAdmin.from("admin_audit_log").insert({
        action: alreadyExisted ? "link_existing_employee" : "create_employee",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: userId,
        new_value: { email: normalizedEmail, full_name, role, department, phone, reporting_manager_id, already_existed: alreadyExisted },
      });
      return new Response(JSON.stringify({ success: true, user_id: userId, email: normalizedEmail, temp_password: alreadyExisted ? null : password, already_existed: alreadyExisted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── UPDATE EMPLOYEE (role, dept, manager, active) ────────────
    if (action === "update_employee") {
      if (!["super_admin", "managing_director"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id, role, department, reporting_manager_id, is_active, display_name, phone } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: oldProfile } = await supabaseAdmin.from("profiles").select("*").eq("auth_user_id", user_id).single();
      const patch: Record<string, unknown> = {};
      if (role !== undefined) patch.role = role;
      if (department !== undefined) patch.department = department;
      if (reporting_manager_id !== undefined) patch.reporting_manager_id = reporting_manager_id || null;
      if (is_active !== undefined) { patch.is_active = is_active; patch.is_archived = !is_active; }
      if (display_name !== undefined) patch.display_name = display_name;
      if (phone !== undefined) patch.phone = phone;

      const { error: updErr } = await supabaseAdmin.from("profiles").update(patch).eq("auth_user_id", user_id);
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (role) {
        await supabaseAdmin.from("user_roles").upsert({ user_id, role }, { onConflict: "user_id,role" });
      }
      if (is_active === false) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });
      } else if (is_active === true) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "none" });
      }
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "update_employee",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        old_value: oldProfile,
        new_value: patch,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET PASSWORD ───────────────────────────────────────────
    if (action === "reset_password") {
      if (!["super_admin", "managing_director"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id, temp_password } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const newPwd = (typeof temp_password === "string" && temp_password.length >= 8)
        ? temp_password
        : ("Altree@" + Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 90 + 10));
      const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: newPwd });
      if (pwdErr) {
        return new Response(JSON.stringify({ error: pwdErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "reset_password",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        new_value: { reset_at: new Date().toISOString() },
      });
      return new Response(JSON.stringify({ success: true, temp_password: newPwd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE EMPLOYEE (hard delete) ────────────────────────────
    if (action === "delete_employee") {
      if (!["super_admin", "managing_director"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === callerId) {
        return new Response(JSON.stringify({ error: "Cannot delete self" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: oldProfile } = await supabaseAdmin.from("profiles").select("*").eq("auth_user_id", user_id).maybeSingle();
      // Remove profile-side records first, then soft-delete auth user to avoid FK blocks from historical records.
      await supabaseAdmin.from("profile_kiosk_pins").delete().eq("auth_user_id", user_id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      const { error: delProfileErr } = await supabaseAdmin.from("profiles").delete().eq("auth_user_id", user_id);
      if (delProfileErr) {
        return new Response(JSON.stringify({ error: delProfileErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(user_id, true);
      if (delAuthErr) {
        const message = delAuthErr.message || "Database error deleting user";
        const isAlreadyGone = /not found|does not exist|no user/i.test(message);
        if (!isAlreadyGone) {
          await supabaseAdmin.from("admin_audit_log").insert({
            action: "delete_employee_auth_failed",
            performed_by: callerId,
            entity_type: "profile",
            entity_id: user_id,
            old_value: oldProfile,
            new_value: { error: message },
          });
          return new Response(JSON.stringify({ error: message }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      await supabaseAdmin.from("admin_audit_log").insert({
        action: "delete_employee",
        performed_by: callerId,
        entity_type: "profile",
        entity_id: user_id,
        old_value: oldProfile,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BULK DELETE ALL EMPLOYEES (super_admin only) ─────────────
    if (action === "bulk_delete_all_employees") {
      if (!["super_admin", "managing_director"].includes(callerProfile.role)) {
        return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profiles, error: listErr } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .not("auth_user_id", "is", null);

      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let deleted = 0;
      let failed = 0;
      let skipped = 0;
      const deletedItems: Array<{ user_id: string; email?: string | null; display_name?: string | null }> = [];
      const skippedItems: Array<{ user_id: string; email?: string | null; display_name?: string | null; reason: string }> = [];
      const failures: Array<{ user_id: string; email?: string | null; error: string }> = [];

      for (const profile of profiles || []) {
        const targetId = profile.auth_user_id as string;
        if (targetId === callerId) {
          skipped++;
          skippedItems.push({ user_id: targetId, email: profile.email, display_name: profile.display_name, reason: "current user" });
          continue;
        }

        await supabaseAdmin.from("profile_kiosk_pins").delete().eq("auth_user_id", targetId);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId);
        const { error: profileErr } = await supabaseAdmin.from("profiles").delete().eq("auth_user_id", targetId);
        if (profileErr) {
          failed++;
          failures.push({ user_id: targetId, email: profile.email, error: profileErr.message });
          continue;
        }

        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(targetId, true);
        if (authErr && !/not found|does not exist|no user/i.test(authErr.message || "")) {
          failed++;
          failures.push({ user_id: targetId, email: profile.email, error: authErr.message });
          await supabaseAdmin.from("admin_audit_log").insert({
            action: "delete_employee_auth_failed",
            performed_by: callerId,
            entity_type: "profile",
            entity_id: targetId,
            old_value: profile,
            new_value: { error: authErr.message },
          });
          continue;
        }

        deleted++;
        deletedItems.push({ user_id: targetId, email: profile.email, display_name: profile.display_name });
      }

      await supabaseAdmin.from("admin_audit_log").insert({
        action: "bulk_delete_all_employees",
        performed_by: callerId,
        entity_type: "profile",
        new_value: { deleted, failed, skipped, deleted_items: deletedItems, skipped_items: skippedItems, failures, completed_at: new Date().toISOString() },
      });
      return new Response(JSON.stringify({ success: true, deleted, failed, skipped, deleted_items: deletedItems, skipped_items: skippedItems, failures }), {
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
