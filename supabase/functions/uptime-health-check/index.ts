// Periodic uptime probe: checks auth + database reachability and posts to
// #hstack-alerts on failure (and once again on recovery).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CHANNEL = "#hstack-alerts";

async function slackPost(token: string, text: string) {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ channel: CHANNEL, text }),
    });
    const json = await res.json();
    if (!json.ok) console.error("[uptime] slack error:", json.error);
    return json.ok as boolean;
  } catch (e) {
    console.error("[uptime] slack post failed:", e);
    return false;
  }
}

async function probe(url: string, headers: Record<string, string>) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const auth = await probe(`${url}/auth/v1/health`, headers);
  const db = await probe(`${url}/rest/v1/app_settings?select=id&limit=1`, headers);

  const failures: string[] = [];
  if (!auth.ok) failures.push(`Auth: HTTP ${auth.status || "no response"} after ${auth.ms}ms`);
  if (!db.ok) failures.push(`Database: HTTP ${db.status || "no response"} after ${db.ms}ms`);

  // Remember the previous state so we alert on transitions, not every run.
  let wasDown = false;
  try {
    const res = await fetch(`${url}/rest/v1/app_settings?setting_key=eq.uptime_last_state&select=setting_value`, { headers });
    const rows = await res.json();
    wasDown = rows?.[0]?.setting_value === "down";
  } catch { /* treat unknown as up */ }

  const isDown = failures.length > 0;

  if (slackToken) {
    if (isDown && !wasDown) {
      await slackPost(slackToken, `:rotating_light: *HStack backend is DOWN*\n${failures.map(f => `• ${f}`).join("\n")}\nChecked at ${new Date().toISOString()}`);
    } else if (!isDown && wasDown) {
      await slackPost(slackToken, `:white_check_mark: *HStack backend recovered* — auth ${auth.ms}ms, database ${db.ms}ms. ${new Date().toISOString()}`);
    }
  }

  try {
    await fetch(`${url}/rest/v1/app_settings?on_conflict=setting_key`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ setting_key: "uptime_last_state", setting_value: isDown ? "down" : "up" }),
    });
  } catch (e) {
    console.error("[uptime] state persist failed:", e);
  }

  return new Response(JSON.stringify({ healthy: !isDown, auth, db, failures }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
