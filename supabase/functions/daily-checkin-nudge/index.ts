// Daily Check-In Nudge — Slack DM to users who haven't signed in today (IST),
// plus one rollup post to #hstack-alert (C0BND0SSMAL).
// Scheduled twice daily at 13:00 and 17:00 IST via pg_cron (07:30 / 11:30 UTC).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { logTechnicalError } from "../_shared/error-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_CHANNEL = "C0BND0SSMAL";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/** Start of today in IST, expressed as a UTC timestamp (ms). */
function istMidnightUtcMs() {
  const ist = istNow();
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();
  return Date.UTC(y, m, d) - IST_OFFSET_MS;
}

function istTimeLabel() {
  const ist = istNow();
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

async function slackPost(token: string, channel: string, text: string) {
  // No retries by design — log the failure and move on.
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.ok) {
      console.error(`[daily-checkin-nudge] Slack post failed for ${channel} [${res.status}]:`, body?.error ?? body);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[daily-checkin-nudge] Slack post threw for ${channel}:`, e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startedAt = new Date().toISOString();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const slackToken = Deno.env.get("SLACK_BOT_TOKEN");

  try {
    if (!slackToken) throw new Error("SLACK_BOT_TOKEN is not configured");

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("auth_user_id, display_name, slack_user_id, is_active, is_archived")
      .eq("is_active", true)
      .eq("is_archived", false);
    if (error) throw error;

    const active = (profiles ?? []).filter((p: any) => p.auth_user_id);
    const cutoff = istMidnightUtcMs();

    // Map auth user id -> last_sign_in_at via the Admin Auth API (server-side only).
    const lastSignIn = new Map<string, string | null>();
    let page = 1;
    // perPage max 1000; loop defensively for small orgs
    while (page <= 10) {
      const { data, error: authErr } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (authErr) throw authErr;
      const users = data?.users ?? [];
      for (const u of users) lastSignIn.set(u.id, (u as any).last_sign_in_at ?? null);
      if (users.length < 200) break;
      page++;
    }

    const flagged = active.filter((p: any) => {
      const ts = lastSignIn.get(p.auth_user_id);
      if (!ts) return true;
      return new Date(ts).getTime() < cutoff;
    });

    let dmsSent = 0;
    let dmsFailed = 0;
    for (const p of flagged) {
      if (!p.slack_user_id) continue; // no DM — they only appear in the rollup
      const name = p.display_name ?? "there";
      const ok = await slackPost(
        slackToken,
        p.slack_user_id,
        `Hey ${name}, haven't seen you in HStack today — anything blocking you?`,
      );
      ok ? dmsSent++ : dmsFailed++;
    }

    const time = istTimeLabel();
    const names = flagged.map((p: any) => p.display_name ?? "Unknown").sort();
    const summary = names.length
      ? `Outstanding as of ${time} IST: ${names.join(", ")}`
      : `No one outstanding as of ${time} IST`;
    const summaryOk = await slackPost(slackToken, ALERT_CHANNEL, summary);

    const result = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      active_profiles: active.length,
      flagged: flagged.length,
      dms_sent: dmsSent,
      dms_failed: dmsFailed,
      summary_posted: summaryOk,
    };
    console.log("[daily-checkin-nudge] run complete", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[daily-checkin-nudge] run failed:", e);
    await logTechnicalError({ functionName: "daily-checkin-nudge", error: e, userId: null, req });
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
