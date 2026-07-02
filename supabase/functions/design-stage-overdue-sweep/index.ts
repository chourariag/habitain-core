// Daily sweep: notifies architects when design stages are overdue.
// Trigger via pg_cron http_post; see README for the schedule SQL.
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

  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await supabase
    .from("design_stages")
    .select("id, project_id, stage_name, planned_end_date, status, overdue_alerted_day1, overdue_alerted_day2")
    .lt("planned_end_date", today)
    .not("status", "in", "(client_approved,complete)");

  if (!overdue?.length) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const projectIds = Array.from(new Set(overdue.map((s) => s.project_id)));
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const nameById = new Map((projects ?? []).map((p) => [p.id, p.name as string]));

  const roleAuthIds = async (roles: string[]) => {
    const { data } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", roles as any)
      .eq("is_active", true);
    return (data ?? []).map((p: any) => p.auth_user_id as string).filter(Boolean);
  };

  const day1Recipients = await roleAuthIds(["project_architect", "operations_architect"]);
  const day2Recipients = await roleAuthIds(["principal_architect", "operations_architect"]);

  let processed = 0;
  for (const s of overdue) {
    const daysOverdue = Math.floor(
      (Date.now() - new Date(s.planned_end_date as string).getTime()) / 86_400_000,
    );
    const projName = nameById.get(s.project_id) ?? "Project";

    if (daysOverdue >= 2) {
      const rows = day2Recipients.map((rid) => ({
        recipient_id: rid,
        title: `Design stage ${daysOverdue}d overdue`,
        body: `${projName} — ${s.stage_name} is ${daysOverdue} days overdue. Immediate action required.`,
        category: "overdue",
        type: "overdue",
        content: `${projName} — ${s.stage_name} is ${daysOverdue} days overdue.`,
        related_table: "design_stages",
        related_id: s.id,
        linked_entity_type: "design_stages",
        linked_entity_id: s.id,
        navigate_to: "/design",
        priority: "high",
      }));
      if (rows.length) await supabase.from("notifications").insert(rows);
      await supabase.from("design_stages").update({ overdue_alerted_day2: true, overdue_alerted_day1: true }).eq("id", s.id);
      processed++;
    } else if (daysOverdue >= 1 && !s.overdue_alerted_day1) {
      const rows = day1Recipients.map((rid) => ({
        recipient_id: rid,
        title: `Design stage 1d overdue`,
        body: `${projName} — ${s.stage_name} is 1 day overdue. Upload deliverable and mark complete.`,
        category: "overdue",
        type: "overdue",
        content: `${projName} — ${s.stage_name} is 1 day overdue.`,
        related_table: "design_stages",
        related_id: s.id,
        linked_entity_type: "design_stages",
        linked_entity_id: s.id,
        navigate_to: "/design",
        priority: "normal",
      }));
      if (rows.length) await supabase.from("notifications").insert(rows);
      await supabase.from("design_stages").update({ overdue_alerted_day1: true }).eq("id", s.id);
      processed++;
    }
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
