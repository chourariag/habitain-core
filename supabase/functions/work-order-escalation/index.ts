// Daily WO escalation: notify directors about WOs sitting >24h in pending stages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pending costing >24h
  const { data: pendCost } = await supabase
    .from("work_orders")
    .select("id,wo_number,project_id,total_value,raised_at,status,boq_category")
    .eq("is_archived", false)
    .eq("status", "pending_costing_approval")
    .lt("raised_at", cutoff);

  // Pending director approval >24h
  const { data: pendDir } = await supabase
    .from("work_orders")
    .select("id,wo_number,project_id,total_value,costing_approved_at,status,boq_category")
    .eq("is_archived", false)
    .eq("status", "pending_director_approval")
    .lt("costing_approved_at", cutoff);

  // Pending issue >24h
  const { data: pendIssue } = await supabase
    .from("work_orders")
    .select("id,wo_number,project_id,total_value,director_approved_at,costing_approved_at,status")
    .eq("is_archived", false)
    .eq("status", "approved_pending_issue")
    .or(`director_approved_at.lt.${cutoff},and(director_approved_at.is.null,costing_approved_at.lt.${cutoff})`);

  let sent = 0;

  const notifyRoles = async (roles: string[], rows: any[], stageLabel: string) => {
    if (!rows?.length) return;
    const { data: users } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", roles as any)
      .eq("is_active", true);
    if (!users?.length) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const wo of rows) {
      // Dedup: skip if a notif already exists today for same WO+stage
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("category", "work_order_escalation")
        .eq("related_id", wo.id)
        .gte("created_at", today)
        .limit(1);
      if (existing?.length) continue;

      const rows2 = users.map((u: any) => ({
        recipient_id: u.auth_user_id,
        title: `WO overdue: ${stageLabel}`,
        body: `${wo.wo_number} — ₹${Number(wo.total_value || 0).toLocaleString("en-IN")} pending >24h`,
        category: "work_order_escalation",
        type: "work_order_escalation",
        content: `${wo.wo_number} — pending >24h`,
        related_table: "work_orders",
        related_id: wo.id,
        linked_entity_type: "work_orders",
        linked_entity_id: wo.id,
      }));
      await supabase.from("notifications").insert(rows2 as any);
      sent += rows2.length;
    }
  };

  await notifyRoles(["planning_engineer", "costing_engineer", "managing_director"], pendCost ?? [], "Costing review");
  await notifyRoles(["managing_director", "finance_director", "sales_director", "architecture_director"], pendDir ?? [], "Director approval");
  await notifyRoles(["finance_manager", "accounts_executive", "managing_director"], pendIssue ?? [], "Issue WO PDF");

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
