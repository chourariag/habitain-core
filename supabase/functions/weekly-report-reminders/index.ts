// Weekly Reports — Reminders & Escalations
// Runs every 15 minutes via pg_cron.
// - 2h before deadline → notify submitter
// - 30min after deadline (missed and unsubmitted) → notify reviewer
// - 2 consecutive weeks missed → notify MD + Directors
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay() === 0 ? 6 : x.getDay() - 1; // Mon=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function deadlineFor(cfg: any, ref: Date) {
  const monday = startOfWeekMonday(ref);
  const d = new Date(monday);
  d.setDate(d.getDate() + (cfg.deadline_day - 1));
  const [h, m] = String(cfg.deadline_time).split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
async function authIdsForRole(sb: any, role: string) {
  const { data } = await sb.from("profiles").select("auth_user_id").eq("role", role).eq("is_active", true);
  return (data || []).map((d: any) => d.auth_user_id).filter(Boolean);
}
async function authIdForProfile(sb: any, profileId: string) {
  const { data } = await sb.from("profiles").select("auth_user_id").eq("id", profileId).maybeSingle();
  return data?.auth_user_id || null;
}
async function notify(sb: any, recipients: string[], title: string, body: string, dedupeKey: string) {
  if (recipients.length === 0) return;
  // Dedupe: skip if same recipient + dedupeKey already sent today
  const today = new Date().toISOString().slice(0, 10);
  const rows: any[] = [];
  for (const r of recipients) {
    const { data: existing } = await sb.from("notifications").select("id")
      .eq("recipient_id", r).eq("category", "weekly_report")
      .ilike("body", `%${dedupeKey}%`)
      .gte("created_at", `${today}T00:00:00Z`).limit(1);
    if (existing && existing.length > 0) continue;
    rows.push({
      recipient_id: r, title, body: `${body}\n[${dedupeKey}]`,
      category: "weekly_report", type: "weekly_report", content: body,
      navigate_to: "/attendance",
    });
  }
  if (rows.length) await sb.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();

    const { data: cfgs } = await sb.from("weekly_report_configs").select("*").eq("active", true);
    const { data: profs } = await sb.from("profiles").select("id,role,auth_user_id,display_name").eq("is_active", true);

    const summary = { remindersSent: 0, missedAlerts: 0, escalations: 0 };

    for (const c of cfgs || []) {
      const deadline = deadlineFor(c, now);
      const monday = startOfWeekMonday(now);
      const periodStart = monday.toISOString().slice(0, 10);

      const assignees = c.assigned_user_id
        ? (profs || []).filter((p: any) => p.id === c.assigned_user_id)
        : (profs || []).filter((p: any) => p.role === c.assigned_role);

      const { data: subs } = await sb.from("weekly_report_submissions").select("submitted_by")
        .eq("config_id", c.id).eq("report_period_start", periodStart);
      const submittedSet = new Set((subs || []).map((s: any) => s.submitted_by));

      const minsToDeadline = (deadline.getTime() - now.getTime()) / 60000;
      const minsAfter = -minsToDeadline;

      // 2h before deadline reminder
      if (minsToDeadline > 0 && minsToDeadline <= 120) {
        for (const a of assignees) {
          if (submittedSet.has(a.id) || !a.auth_user_id) continue;
          await notify(sb, [a.auth_user_id],
            "Weekly report due soon",
            `Your ${c.report_name} is due in about 2 hours.`,
            `wr-2h-${c.id}-${periodStart}-${a.id}`);
          summary.remindersSent++;
        }
      }

      // 30min after missed deadline → reviewer alert (and only for unsubmitted)
      if (minsAfter >= 30 && minsAfter <= 24 * 60) {
        const missing = assignees.filter((a: any) => !submittedSet.has(a.id));
        if (missing.length > 0) {
          let reviewerAuthIds: string[] = [];
          if (c.reviewer_user_id) {
            const aid = await authIdForProfile(sb, c.reviewer_user_id);
            if (aid) reviewerAuthIds = [aid];
          } else if (c.reviewer_role) {
            reviewerAuthIds = await authIdsForRole(sb, c.reviewer_role);
          }
          for (const a of missing) {
            await notify(sb, reviewerAuthIds,
              "Weekly report missed",
              `${a.display_name} has not submitted ${c.report_name}. Deadline was ${deadline.toLocaleString("en-IN")}. This affects their KPI score.`,
              `wr-missed-${c.id}-${periodStart}-${a.id}`);
            summary.missedAlerts++;
          }
        }
      }

      // 2 consecutive missed weeks → escalate to MD + Directors
      // Only check on/after end of current week
      const lastWeekStart = new Date(monday); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lwStart = lastWeekStart.toISOString().slice(0, 10);
      const endOfThisWeek = new Date(monday); endOfThisWeek.setDate(endOfThisWeek.getDate() + 6); endOfThisWeek.setHours(23, 59, 59, 999);
      if (now > endOfThisWeek) {
        for (const a of assignees) {
          const { data: last2 } = await sb.from("weekly_report_submissions").select("status, report_period_start")
            .eq("config_id", c.id).eq("submitted_by", a.id).in("report_period_start", [periodStart, lwStart]);
          const thisWeek = (last2 || []).find((s: any) => s.report_period_start === periodStart);
          const lastWeek = (last2 || []).find((s: any) => s.report_period_start === lwStart);
          const thisMissed = !thisWeek || thisWeek.status === "missed";
          const lastMissed = !lastWeek || lastWeek.status === "missed";
          if (thisMissed && lastMissed) {
            const directors = [
              ...(await authIdsForRole(sb, "managing_director")),
              ...(await authIdsForRole(sb, "finance_director")),
              ...(await authIdsForRole(sb, "sales_director")),
              ...(await authIdsForRole(sb, "architecture_director")),
            ];
            await notify(sb, Array.from(new Set(directors)),
              "Weekly report — 2 weeks missed",
              `${a.display_name} has missed ${c.report_name} for 2 consecutive weeks. KPI impact: 15-20% of their monthly score.`,
              `wr-esc-${c.id}-${periodStart}-${a.id}`);
            summary.escalations++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
