// Usage nudge check.
// Flags profiles that are explicitly mapped to a Slack user (slack_user_id
// IS NOT NULL) whose auth last_sign_in_at is NULL or before today (IST).
// Each flagged person gets a Slack DM (best-effort, isolated per person),
// and an aggregate summary is always posted to the alerts channel — even
// when nobody is flagged. No cron/scheduling is configured here; this
// function is invoked externally.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN")!;

// Slack's chat.postMessage API requires a channel ID, not a "#name".
const ALERTS_CHANNEL = "C0BND0SSMAL";

type Profile = {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  email: string | null;
  slack_user_id: string;
};

type FlaggedUser = { id: string; display_name: string | null; email: string | null };
type PersonError = { profile: string; error: string };

function startOfTodayIst() {
  // IST is UTC+5:30. Shift "now" into IST, take its date, then anchor that
  // date's midnight back as a real UTC instant to compare timestamps against.
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const istDateStr = nowIst.toISOString().slice(0, 10);
  return new Date(`${istDateStr}T00:00:00.000+05:30`);
}

async function slackApi(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`slack ${method} failed: ${json.error}`);
  return json;
}

async function dmViaSlackUserId(slackUserId: string, text: string) {
  const opened = await slackApi("conversations.open", { users: slackUserId });
  await slackApi("chat.postMessage", { channel: opened.channel.id, text });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const todayStart = startOfTodayIst();

    const { data: profiles, error: profilesErr } = await sb
      .from("profiles")
      .select("id, auth_user_id, display_name, email, slack_user_id")
      .not("slack_user_id", "is", null);
    if (profilesErr) throw profilesErr;

    const flagged: FlaggedUser[] = [];
    const errors: PersonError[] = [];

    for (const p of (profiles || []) as Profile[]) {
      const who = p.display_name || p.email || p.id;

      let isFlagged = false;
      try {
        const { data: authData, error: authErr } = await sb.auth.admin.getUserById(p.auth_user_id);
        if (authErr) throw authErr;
        const lastSignInAt = authData?.user?.last_sign_in_at;
        isFlagged = !lastSignInAt || new Date(lastSignInAt) < todayStart;
      } catch (e: any) {
        errors.push({ profile: who, error: `flag check failed: ${e.message || String(e)}` });
        continue;
      }

      if (!isFlagged) continue;
      flagged.push({ id: p.id, display_name: p.display_name, email: p.email });

      try {
        await dmViaSlackUserId(
          p.slack_user_id,
          `Hi${p.display_name ? ` ${p.display_name}` : ""}, we noticed you haven't signed in today. Please log in when you get a chance.`
        );
      } catch (e: any) {
        errors.push({ profile: who, error: `DM failed: ${e.message || String(e)}` });
      }
    }

    const summaryLines = flagged.length
      ? flagged.map((f) => `• ${f.display_name || f.email || f.id}`).join("\n")
      : "No one flagged today — everyone has signed in.";
    const errorLines = errors.length
      ? `\n\n_Errors (${errors.length}):_\n` + errors.map((e) => `• ${e.profile}: ${e.error}`).join("\n")
      : "";

    let aggregatePostError: string | null = null;
    try {
      await slackApi("chat.postMessage", {
        channel: ALERTS_CHANNEL,
        text: `*Usage Nudge Check* — ${flagged.length} user(s) flagged for not signing in today.\n${summaryLines}${errorLines}`,
      });
    } catch (e: any) {
      aggregatePostError = e.message || String(e);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        flaggedCount: flagged.length,
        errorCount: errors.length,
        errors,
        aggregatePostError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
