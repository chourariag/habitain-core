// Daily measurement submission checks.
// Runs at 8pm IST via pg_cron. For each active project:
//   - If today has no factory measurement -> notify Azad (head_operations / production_head)
//   - If today has no site measurement    -> notify Awaiz (site_installation_mgr)
//   - If a supervisor has missed >= 2 consecutive working days -> notify Suraj + MD
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Profile = { auth_user_id: string; role: string; display_name: string | null };

function todayIso() {
  // IST date string (UTC+5:30) — good enough for daily cron at 8pm IST
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

async function notify(supabase: any, recipients: string[], title: string, body: string, category: string) {
  if (recipients.length === 0) return;
  const rows = recipients.map((r) => ({
    recipient_id: r,
    title,
    body,
    category,
    type: category,
    content: body,
    navigate_to: "/dashboard",
  }));
  await supabase.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const today = todayIso();

    // Active projects (not archived)
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, is_archived")
      .eq("is_archived", false);

    // Pull approver pools
    const { data: profiles } = await supabase
      .from("profiles")
      .select("auth_user_id, role, display_name")
      .eq("is_active", true);
    const all: Profile[] = (profiles ?? []) as Profile[];
    const byRole = (rs: string[]) => all.filter((p) => rs.includes(p.role)).map((p) => p.auth_user_id);

    const factoryApprovers = byRole(["production_head", "head_operations"]);
    const siteApprovers = byRole(["site_installation_mgr", "head_operations"]);
    const escalation = byRole(["super_admin", "managing_director", "head_operations"]);

    let factoryMissCount = 0;
    let siteMissCount = 0;

    for (const p of projects ?? []) {
      const { data: todays } = await supabase
        .from("daily_measurements")
        .select("id, location")
        .eq("project_id", p.id)
        .eq("measurement_date", today)
        .eq("is_archived", false);

      const hasFactory = (todays ?? []).some((r: any) => r.location === "factory");
      const hasSite = (todays ?? []).some((r: any) => r.location === "site");

      if (!hasFactory) {
        factoryMissCount++;
        await notify(
          supabase,
          factoryApprovers,
          "Factory measurement missing",
          `No factory measurement submitted today for ${p.name}.`,
          "measurement_missing"
        );
      }
      if (!hasSite) {
        siteMissCount++;
        await notify(
          supabase,
          siteApprovers,
          "Site measurement missing",
          `No site measurement submitted today for ${p.name}.`,
          "measurement_missing"
        );
      }
    }

    // 2 consecutive missed days -> escalate
    const yIso = (() => {
      const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const { data: yesterday } = await supabase
      .from("daily_measurements")
      .select("project_id, location")
      .eq("measurement_date", yIso)
      .eq("is_archived", false);

    const projectsMissingTwo: { id: string; name: string; locations: string[] }[] = [];
    for (const p of projects ?? []) {
      const yLocs = new Set((yesterday ?? []).filter((r: any) => r.project_id === p.id).map((r: any) => r.location));
      const { data: tLocs } = await supabase
        .from("daily_measurements")
        .select("location")
        .eq("project_id", p.id)
        .eq("measurement_date", today)
        .eq("is_archived", false);
      const tSet = new Set((tLocs ?? []).map((r: any) => r.location));
      const missingBoth: string[] = [];
      for (const loc of ["factory", "site"]) {
        if (!yLocs.has(loc) && !tSet.has(loc)) missingBoth.push(loc);
      }
      if (missingBoth.length > 0) projectsMissingTwo.push({ id: p.id, name: p.name, locations: missingBoth });
    }

    for (const p of projectsMissingTwo) {
      await notify(
        supabase,
        escalation,
        "Measurement gap (2 days)",
        `${p.name}: no ${p.locations.join(" + ")} measurement for 2 consecutive days.`,
        "measurement_escalation"
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        date: today,
        projects: (projects ?? []).length,
        factory_missing: factoryMissCount,
        site_missing: siteMissCount,
        escalations: projectsMissingTwo.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("measurement-submission-checks error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
