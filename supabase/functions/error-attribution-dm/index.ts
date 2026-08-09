// Technical Error Attribution DM — polls error_log for un-notified rows and DMs
// the affected user on Slack. Rows with user_id = NULL (cron jobs) are logged for
// visibility only and are marked notified without any DM. No retries by design.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_LABELS: Record<string, string> = {
  "scan-invoice": "Invoice scan",
  "photo-check": "Photo quality check",
  "site-photo-analyze": "Site photo analysis",
  "qc-analysis": "QC analysis",
  "rm-analysis": "R&M analysis",
};

async function slackDM(token: string, channel: string, text: string) {
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
      console.error(`[error-attribution-dm] Slack DM failed for ${channel} [${res.status}]:`, body?.error ?? body);
      return { ok: false, error: String(body?.error ?? res.status) };
    }
    return { ok: true as const, error: null };
  } catch (e) {
    console.error(`[error-attribution-dm] Slack DM threw for ${channel}:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const slackToken = Deno.env.get("SLACK_BOT_TOKEN");

  try {
    const { data: pending, error } = await supabase
      .from("error_log")
      .select("id, function_name, error_message, user_id, created_at")
      .eq("notified", false)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    const rows = pending ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, dms_sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Visibility-only rows (cron / service-role errors): mark notified, never DM.
    const systemRows = rows.filter((r) => !r.user_id);
    if (systemRows.length > 0) {
      await supabase
        .from("error_log")
        .update({ notified: true, notified_at: new Date().toISOString(), notify_error: "system_error_no_dm" })
        .in("id", systemRows.map((r) => r.id));
    }

    const userRows = rows.filter((r) => !!r.user_id);
    let dmsSent = 0;
    let dmsFailed = 0;
    let skipped = 0;

    if (userRows.length > 0) {
      const userIds = [...new Set(userRows.map((r) => r.user_id as string))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, slack_user_id")
        .in("id", userIds);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

      for (const row of userRows) {
        const profile = byId.get(row.user_id as string);
        const slackId = profile?.slack_user_id;
        let notifyError: string | null = null;

        if (!slackToken) {
          notifyError = "slack_token_missing";
          skipped++;
        } else if (!slackId) {
          notifyError = "no_slack_user_id";
          skipped++;
        } else {
          const label = FUNCTION_LABELS[row.function_name] ?? row.function_name;
          const when = new Date(row.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
          const text =
            `:warning: *${label} hit a technical error*\n` +
            `Time: ${when} IST\n` +
            `Details: ${String(row.error_message).slice(0, 500)}\n` +
            `Your action wasn't saved — please try again. If it keeps failing, share this message with the HStack team.`;
          const res = await slackDM(slackToken, slackId, text);
          if (res.ok) dmsSent++;
          else {
            dmsFailed++;
            notifyError = res.error;
          }
        }

        await supabase
          .from("error_log")
          .update({ notified: true, notified_at: new Date().toISOString(), notify_error: notifyError })
          .eq("id", row.id);
      }
    }

    const result = {
      processed: rows.length,
      system_only: systemRows.length,
      dms_sent: dmsSent,
      dms_failed: dmsFailed,
      skipped_no_slack: skipped,
    };
    console.log("[error-attribution-dm] run complete", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[error-attribution-dm] run failed:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
