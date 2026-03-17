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

    const { phone, pin } = await req.json();

    if (!phone || !pin) {
      return new Response(JSON.stringify({ error: "Phone and PIN are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone: strip non-digits, take last 10
    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up profile by phone (try multiple formats)
    const phoneVariants = [
      normalizedPhone,
      `+91${normalizedPhone}`,
      `91${normalizedPhone}`,
    ];

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("auth_user_id, kiosk_pin, email, is_active, role")
      .or(phoneVariants.map(p => `phone.eq.${p}`).join(","))
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Phone number not registered" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.is_active) {
      return new Response(JSON.stringify({ error: "Account is deactivated" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.kiosk_pin) {
      return new Response(JSON.stringify({ error: "No PIN set for this account. Contact your admin." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.kiosk_pin !== pin) {
      return new Response(JSON.stringify({ error: "Incorrect PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a magic link token for this user
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: "Failed to generate session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract the token hash from the action link
    const actionLink = linkData?.properties?.action_link;
    const url = new URL(actionLink);
    const tokenHash = url.searchParams.get("token") || url.hash?.match(/token=([^&]+)/)?.[1];

    return new Response(
      JSON.stringify({
        success: true,
        email: profile.email,
        token_hash: linkData.properties?.hashed_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
