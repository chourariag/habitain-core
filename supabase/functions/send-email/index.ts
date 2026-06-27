// Send transactional email via Resend.
// Input: { to: string[], subject: string, html: string, text?: string, notification_id?: string }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("RESEND_FROM") || "HStack <notify@altree.in>";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const to: string[] = Array.isArray(body.to) ? body.to.filter(Boolean) : [];
    const subject = String(body.subject || "").slice(0, 200);
    const html = String(body.html || "");
    const text = String(body.text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    const notification_id = body.notification_id || null;

    if (!to.length || !subject || !html) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing to/subject/html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend error", res.status, payload);
      return new Response(
        JSON.stringify({ success: false, error: payload?.message || `Resend ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark notification as emailed (service role; bypasses RLS)
    if (notification_id) {
      try {
        const url = Deno.env.get("SUPABASE_URL")!;
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const admin = createClient(url, key);
        await admin.from("notifications")
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq("id", notification_id);
      } catch (e) { console.error("mark email_sent failed", e); }
    }

    return new Response(
      JSON.stringify({ success: true, id: payload?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-email error", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
