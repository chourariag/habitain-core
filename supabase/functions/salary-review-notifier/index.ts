// Daily cron: notify Azad/Awaiz + HR (Mary) about workers whose salary review
// is due within 30 days. Fires once per worker per cycle (uses notifications table).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const today = new Date();
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // Workers due within 30 days (or overdue) and still active
    const { data: workers, error } = await supabase
      .from("labour_workers")
      .select("id, name, skill_type, monthly_salary, date_joined, salary_review_due, department, contractor_id, labour_contractors(company_name)")
      .eq("status", "active")
      .lte("salary_review_due", in30Str);

    if (error) throw error;

    // Recipients
    const { data: recipients } = await supabase
      .from("profiles")
      .select("auth_user_id, role")
      .in("role", ["production_head", "site_installation_mgr", "hr_executive", "managing_director", "super_admin"])
      .eq("is_active", true);

    let queued = 0;
    for (const w of workers ?? []) {
      const company = (w as any).labour_contractors?.company_name ?? "—";
      const dueStr = (w as any).salary_review_due;
      const overdue = dueStr < todayStr;
      const title = overdue
        ? `Overdue: salary review for ${w.name}`
        : `Salary review due in 30 days — ${w.name}`;
      const body = `${w.name} (${w.skill_type}, ${company}). Current salary: ₹${Number(w.monthly_salary).toLocaleString("en-IN")}/month. Joined: ${w.date_joined}. Review by ${dueStr}.`;

      // Filter by department: production_head -> Factory, site_installation_mgr -> Site
      const dept = (w as any).department as string;
      const targets = (recipients ?? []).filter((r) => {
        if (r.role === "hr_executive" || r.role === "managing_director" || r.role === "super_admin") return true;
        if (r.role === "production_head") return dept === "Factory" || dept === "Both";
        if (r.role === "site_installation_mgr") return dept === "Site" || dept === "Both";
        return false;
      });

      for (const t of targets) {
        // Dedupe: skip if a notification for this worker+day already exists
        const dedupeKey = `salary_review:${w.id}:${todayStr}`;
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", t.auth_user_id)
          .eq("link", dedupeKey)
          .maybeSingle();
        if (existing) continue;

        const { error: insErr } = await supabase.from("notifications").insert({
          user_id: t.auth_user_id,
          title,
          body,
          link: dedupeKey,
          type: overdue ? "warning" : "info",
        });
        if (!insErr) queued++;
      }
    }

    return new Response(JSON.stringify({ ok: true, workers_due: workers?.length ?? 0, notifications_queued: queued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
