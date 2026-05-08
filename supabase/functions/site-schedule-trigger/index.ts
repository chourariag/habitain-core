// Daily cron — fires the site-schedule unlock notification when a project's
// earliest planned dispatch date is exactly 14 days away, and escalates to
// Planning Head if the SIM hasn't filled the site schedule within 48 hours.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_STAGES = [
  "Erection","Marriage Line","On Site External Finishing","Steel Extensions",
  "On Site MEP","On Site Internal Finishing","Snagging","Handover",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const target = new Date(today); target.setUTCDate(target.getUTCDate() + 14);
  const targetIso = target.toISOString().slice(0, 10);

  // Find SIM(s) and Planning Head(s)
  const { data: roleUsers } = await supabase
    .from("profiles")
    .select("auth_user_id, role")
    .in("role", ["site_installation_mgr", "planning_head"])
    .eq("is_active", true);
  const sims = (roleUsers ?? []).filter((u) => u.role === "site_installation_mgr").map((u) => u.auth_user_id);
  const planningHeads = (roleUsers ?? []).filter((u) => u.role === "planning_head").map((u) => u.auth_user_id);

  // 1) Trigger unlock for projects with a Dispatch stage on target date
  const { data: dispatchStages } = await supabase
    .from("project_stages")
    .select("project_id, planned_end, projects:project_id(id,name,site_schedule_unlocked_at)")
    .eq("stage_name", "Dispatch")
    .eq("planned_end", targetIso);

  const triggered: string[] = [];
  for (const row of dispatchStages ?? []) {
    const proj: any = (row as any).projects;
    if (!proj || proj.site_schedule_unlocked_at) continue;
    await supabase.from("projects").update({
      site_schedule_unlocked_at: new Date().toISOString(),
      site_schedule_notified_at: new Date().toISOString(),
    }).eq("id", proj.id);

    const notes = sims.map((uid) => ({
      recipient_id: uid,
      title: "⏰ Site schedule required",
      body: `${proj.name} — dispatch is in 14 days on ${targetIso}. Please set up the site installation schedule now so the site is ready to receive.`,
      category: "site_schedule",
      type: "site_schedule",
      content: `${proj.name} dispatch in 14 days. Set up site schedule.`,
      related_table: "projects",
      related_id: proj.id,
      navigate_to: `/site-hub?project=${proj.id}`,
    }));
    if (notes.length) await supabase.from("notifications").insert(notes as any);
    triggered.push(proj.id);
  }

  // 2) Escalate to Planning Head if 48h+ has passed since notification and
  //    no site stage dates have been filled.
  const cutoff = new Date(); cutoff.setUTCHours(cutoff.getUTCHours() - 48);
  const { data: pending } = await supabase
    .from("projects")
    .select("id,name,site_schedule_notified_at,site_schedule_escalated_at")
    .not("site_schedule_notified_at", "is", null)
    .is("site_schedule_escalated_at", null)
    .lt("site_schedule_notified_at", cutoff.toISOString());

  const escalated: string[] = [];
  for (const proj of pending ?? []) {
    // Has any site stage been filled?
    const { count } = await supabase
      .from("project_stages")
      .select("id", { count: "exact", head: true })
      .eq("project_id", proj.id)
      .in("stage_name", SITE_STAGES)
      .not("planned_start", "is", null);
    if ((count ?? 0) > 0) continue;

    // Days until dispatch
    const { data: dispatch } = await supabase
      .from("project_stages")
      .select("planned_end")
      .eq("project_id", proj.id)
      .eq("stage_name", "Dispatch")
      .order("planned_end", { ascending: true })
      .limit(1)
      .maybeSingle();
    const days = dispatch?.planned_end
      ? Math.ceil((new Date(dispatch.planned_end).getTime() - today.getTime()) / 86400000)
      : null;

    const notes = planningHeads.map((uid) => ({
      recipient_id: uid,
      title: "Site schedule overdue",
      body: `Site schedule for ${proj.name} has not been set up.${days != null ? ` Dispatch is in ${days} days.` : ""}`,
      category: "site_schedule_escalation",
      type: "site_schedule_escalation",
      content: `Site schedule overdue for ${proj.name}.`,
      related_table: "projects",
      related_id: proj.id,
      navigate_to: `/site-hub?project=${proj.id}`,
    }));
    if (notes.length) await supabase.from("notifications").insert(notes as any);
    await supabase.from("projects").update({ site_schedule_escalated_at: new Date().toISOString() }).eq("id", proj.id);
    escalated.push(proj.id);
  }

  return new Response(JSON.stringify({ triggered, escalated, target_date: targetIso }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
