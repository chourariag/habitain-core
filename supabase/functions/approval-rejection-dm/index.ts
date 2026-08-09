// Approval Rejection DM — polls approval_requests for newly rejected rows and
// sends a personal Slack DM to the submitter. No channel fallback, no retries.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function slackDM(token: string, channel: string, text: string) {
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
      console.error(`[approval-rejection-dm] Slack DM failed for ${channel} [${res.status}]:`, body?.error ?? body);
      return { ok: false, error: String(body?.error ?? res.status) };
    }
    return { ok: true as const, error: null };
  } catch (e) {
    console.error(`[approval-rejection-dm] Slack DM threw for ${channel}:`, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
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

    const { data: rejected, error } = await supabase
      .from("approval_requests")
      .select("id, request_type, requested_by, requested_by_name, rejected_reason, updated_at")
      .eq("status", "rejected")
      .order("updated_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    const rows = rejected ?? [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, dms_sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip anything already logged (includes the pre-existing baseline rows).
    const { data: logged, error: logErr } = await supabase
      .from("approval_rejection_dm_log")
      .select("approval_request_id")
      .in("approval_request_id", rows.map((r: any) => r.id));
    if (logErr) throw logErr;
    const seen = new Set((logged ?? []).map((l: any) => l.approval_request_id));

    const pending = rows.filter((r: any) => !seen.has(r.id));

    let dmsSent = 0;
    let dmsFailed = 0;
    let skipped = 0;

    for (const r of pending) {
      let slackId: string | null = null;
      let displayName: string | null = r.requested_by_name ?? null;

      if (r.requested_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, slack_user_id")
          .eq("auth_user_id", r.requested_by)
          .maybeSingle();
        slackId = profile?.slack_user_id ?? null;
        displayName = profile?.display_name ?? displayName;
      }

      let sent = false;
      let skipReason: string | null = null;

      if (!slackId) {
        skipReason = r.requested_by ? "no_slack_user_id" : "no_requested_by";
        skipped++;
      } else {
        const reason = r.rejected_reason?.trim() || "no reason provided";
        const result = await slackDM(
          slackToken,
          slackId,
          `Hey ${displayName ?? "there"}, your request was rejected: ${reason}. Check HStack for details.`,
        );
        sent = result.ok;
        if (sent) dmsSent++;
        else {
          dmsFailed++;
          skipReason = `slack_error:${result.error}`;
        }
      }

      // Log regardless of outcome so we never retry / re-notify.
      const { error: insErr } = await supabase.from("approval_rejection_dm_log").insert({
        approval_request_id: r.id,
        recipient_user_id: r.requested_by,
        slack_user_id: slackId,
        dm_sent: sent,
        skip_reason: skipReason,
      });
      if (insErr) console.error("[approval-rejection-dm] log insert failed:", insErr.message);
    }

    const result = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      processed: pending.length,
      dms_sent: dmsSent,
      dms_failed: dmsFailed,
      skipped_no_slack: skipped,
    };
    console.log("[approval-rejection-dm] run complete", JSON.stringify(result));

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[approval-rejection-dm] run failed:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
