import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  // Find pending claims past 4h that haven't been escalated yet
  const { data: breached } = await supabase
    .from("labour_claims")
    .select("id, worker_name_snapshot, submitted_at, sla_breached, escalated_at")
    .eq("status", "pending")
    .lt("submitted_at", fourHoursAgo)
    .is("escalated_at", null);

  if (!breached?.length) {
    return new Response(JSON.stringify({ escalated: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find Azad-equivalent escalation recipients (production_head + head_operations + MD)
  const { data: recipients } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .in("role", ["super_admin", "managing_director", "production_head", "head_operations"])
    .eq("is_active", true);

  const now = new Date().toISOString();
  for (const c of breached) {
    await supabase
      .from("labour_claims")
      .update({ sla_breached: true, escalated_at: now })
      .eq("id", c.id);

    if (recipients?.length) {
      const rows = recipients.map((r: any) => ({
        recipient_id: r.auth_user_id,
        title: "Labour claim — SLA breached",
        body: `Claim from ${c.worker_name_snapshot} has been pending Rakesh's approval for 4 hours. Please review.`,
        category: "labour_claim_escalation",
        type: "labour_claim_escalation",
        content: `Claim from ${c.worker_name_snapshot} has been pending Rakesh's approval for 4 hours.`,
        related_table: "labour_claims",
        related_id: c.id,
        navigate_to: "/attendance?tab=claims",
      }));
      await supabase.from("notifications").insert(rows);
    }
  }

  return new Response(JSON.stringify({ escalated: breached.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
