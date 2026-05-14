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
      .select("id, submitted_by, amount");

    if (error) throw error;

    const submitted = data ?? [];

    // Notify Sindhu (and any other HR Admins) once that new reports are awaiting HR review.
    if (submitted.length > 0) {
      const { data: hrRecips } = await supabase
        .from("profiles")
        .select("auth_user_id")
        .eq("role", "hr_admin")
        .eq("is_active", true);

      if (hrRecips && hrRecips.length > 0) {
        const totalAmt = submitted.reduce((s, e: any) => s + Number(e.amount || 0), 0);
        const uniqueEmployees = new Set(submitted.map((e: any) => e.submitted_by)).size;
        const notes = hrRecips.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Expense Reports Awaiting HR Review",
          body: `${submitted.length} expense entr${submitted.length === 1 ? "y" : "ies"} from ${uniqueEmployees} employee${uniqueEmployees === 1 ? "" : "s"} (₹${totalAmt.toLocaleString("en-IN")} total) auto-submitted today and need your review. Open HR Management → Expense Reports.`,
          category: "Finance",
          related_table: "expense_entries",
          navigate_to: "/admin/hr",
        }));
        await supabase.from("notifications").insert(notes);
      }
    }

    return new Response(
      JSON.stringify({ submitted: submitted.length, day: istDay }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
