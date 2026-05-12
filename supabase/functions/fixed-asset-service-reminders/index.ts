import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const { data: assets, error } = await supabase
      .from("fixed_assets")
      .select("id, asset_name, asset_tag, next_service_due")
      .eq("is_archived", false)
      .not("next_service_due", "is", null);
    if (error) throw error;

    // Recipients: Azad (procurement), Suraj (head_operations) — looked up by role
    const { data: procurementUsers } = await supabase
      .from("profiles").select("auth_user_id").eq("role", "procurement").eq("is_active", true);
    const { data: opsUsers } = await supabase
      .from("profiles").select("auth_user_id").eq("role", "head_operations").eq("is_active", true);

    const dueSoon = (assets || []).filter(a => a.next_service_due === in7);
    const overdue = (assets || []).filter(a => a.next_service_due && a.next_service_due < todayStr);

    const notifications: any[] = [];
    for (const a of dueSoon) {
      for (const u of procurementUsers || []) {
        notifications.push({
          recipient_id: u.auth_user_id,
          title: `Service due in 7 days: ${a.asset_name}`,
          message: `Asset ${a.asset_tag} requires service on ${a.next_service_due}`,
          type: "info",
        });
      }
    }
    for (const a of overdue) {
      for (const u of opsUsers || []) {
        notifications.push({
          recipient_id: u.auth_user_id,
          title: `OVERDUE service: ${a.asset_name}`,
          message: `Asset ${a.asset_tag} was due on ${a.next_service_due} — escalation`,
          type: "alert",
        });
      }
    }

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }

    return new Response(JSON.stringify({ ok: true, due_soon: dueSoon.length, overdue: overdue.length, sent: notifications.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
