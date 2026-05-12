// Daily cron: find projects whose planned dispatch is exactly 14 days away,
// then notify Karthik (planning_engineer) to fill Site Schedule and
// Awaiz (site_installation_mgr) to fill Installation Sequence.
// Idempotent: skips if a matching notification was inserted in the last 25 hours.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  target.setUTCDate(target.getUTCDate() + 14);
  const targetISO = target.toISOString().slice(0, 10);

  // Find Stage 15 (Dispatch) rows whose planned_end == today + 14 days.
  const { data: dueStages, error: stagesErr } = await sb
    .from("project_stages")
    .select("project_id, planned_end, projects!inner(id,name,is_archived)")
    .eq("stage_number", 15)
    .eq("planned_end", targetISO);

  if (stagesErr) {
    return new Response(JSON.stringify({ error: stagesErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const projects = (dueStages ?? [])
    .map((r: any) => r.projects)
    .filter((p: any) => p && !p.is_archived);

  if (projects.length === 0) {
    return new Response(JSON.stringify({ ok: true, triggered: 0, target: targetISO }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: planners } = await sb.from("profiles").select("auth_user_id")
    .eq("role", "planning_engineer").eq("is_active", true);
  const { data: sims } = await sb.from("profiles").select("auth_user_id")
    .eq("role", "site_installation_mgr").eq("is_active", true);

  const cutoff = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  let inserted = 0;

  for (const p of projects) {
    // Karthik — Site Schedule
    for (const r of planners ?? []) {
      const { data: existing } = await sb.from("notifications")
        .select("id").eq("recipient_id", r.auth_user_id)
        .eq("related_table", "project_stages").eq("related_id", p.id)
        .gte("created_at", cutoff).limit(1);
      if (existing?.length) continue;
      await sb.from("notifications").insert({
        recipient_id: r.auth_user_id,
        title: "Fill Site Schedule — dispatch in 14 days",
        body: `Open Site Hub → Schedule for ${p.name} and enter the 8 site stage dates.`,
        category: "Production",
        related_table: "project_stages",
        related_id: p.id,
        navigate_to: "/site-hub",
      });
      inserted++;
    }

    // Awaiz — Installation Sequence
    for (const r of sims ?? []) {
      const { data: existing } = await sb.from("notifications")
        .select("id").eq("recipient_id", r.auth_user_id)
        .eq("related_table", "installation_sequence_docs").eq("related_id", p.id)
        .gte("created_at", cutoff).limit(1);
      if (existing?.length) continue;
      await sb.from("notifications").insert({
        recipient_id: r.auth_user_id,
        title: "Fill Installation Sequence — dispatch in 14 days",
        body: `Open Site Hub → Installation Sequence for ${p.name} and enter the module erection order.`,
        category: "Production",
        related_table: "installation_sequence_docs",
        related_id: p.id,
        navigate_to: "/dispatch-delivery",
      });
      inserted++;
    }
  }

  return new Response(JSON.stringify({ ok: true, projects: projects.length, inserted, target: targetISO }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
