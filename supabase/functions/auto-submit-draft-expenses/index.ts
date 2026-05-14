import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only run on the 5th and 20th of the month (IST). Cron is configured to
    // fire only on those days, but we double-check here to make manual
    // invocations safe.
    const today = new Date();
    const istDay = Number(
      new Intl.DateTimeFormat("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" }).format(today),
    );
    if (istDay !== 5 && istDay !== 20) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Today (IST day ${istDay}) is not a submission window open date` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data, error } = await supabase
      .from("expense_entries")
      .update({ status: "pending_hr" })
      .eq("status", "draft")
      .select("id, submitted_by");

    if (error) throw error;

    return new Response(
      JSON.stringify({ submitted: data?.length ?? 0, day: istDay }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
