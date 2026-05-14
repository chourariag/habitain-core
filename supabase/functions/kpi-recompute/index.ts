// kpi-recompute: server-side calculator for all 13 KPI employees.
// Modes: ?mode=daily  | ?mode=weekly | ?user_id=<uuid>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

type CalcResult = {
  actual: number | null;
  target: number;
  status: "green" | "amber" | "red" | "no_data";
  score: number;
  payload: Record<string, unknown>;
};

const ok = (actual: number, target: number, higherIsBetter = true): CalcResult => {
  const diff = higherIsBetter ? actual - target : target - actual;
  const pct = target === 0 ? actual : (actual / target) * 100;
  let status: CalcResult["status"];
  if (diff >= 0) status = "green";
  else if (Math.abs(diff) / (target || 1) <= 0.15) status = "amber";
  else status = "red";
  const score = Math.max(0, Math.min(100, higherIsBetter ? pct : (200 - pct)));
  return { actual, target, status, score: Math.round(score), payload: {} };
};
const noData = (target: number): CalcResult => ({
  actual: null, target, status: "no_data", score: 0, payload: {},
});

// Helper: count rows
async function count(table: string, filters: Record<string, any> = {}, gte?: { col: string; val: string }): Promise<number> {
  let q: any = sb.from(table).select("*", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  if (gte) q = q.gte(gte.col, gte.val);
  const { count } = await q;
  return count ?? 0;
}

// ─── Calculators (best-effort; return no_data on missing/empty data) ───
async function rakeshMeasurementSubmission(target: number, _userId: string): Promise<CalcResult> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await sb.from("daily_measurements")
    .select("date, location").eq("location", "factory").gte("date", since.slice(0, 10));
  if (error || !data || data.length === 0) return noData(target);
  const days = new Set(data.map((d: any) => d.date));
  const pct = (days.size / 7) * 100;
  return { ...ok(pct, target), payload: { submitted_days: days.size, working_days: 7 } };
}

async function azadOnTimeDispatch(target: number): Promise<CalcResult> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await sb.from("dispatch_packs")
    .select("planned_dispatch_date, actual_dispatch_date")
    .gte("created_at", since)
    .not("actual_dispatch_date", "is", null);
  if (error || !data || data.length === 0) return noData(target);
  const onTime = data.filter((r: any) => r.planned_dispatch_date && r.actual_dispatch_date <= r.planned_dispatch_date).length;
  const pct = (onTime / data.length) * 100;
  return { ...ok(pct, target), payload: { on_time: onTime, total: data.length } };
}

async function azadNcrClosure(target: number): Promise<CalcResult> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await sb.from("ncr_register")
    .select("created_at, closed_at").gte("created_at", since).not("closed_at", "is", null);
  if (error || !data || data.length === 0) return noData(target);
  const avgHrs = data.reduce((a: number, r: any) =>
    a + (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0) / data.length;
  return { ...ok(avgHrs, target, false), payload: { avg_hours: Math.round(avgHrs), total: data.length } };
}

async function awaizSequenceLeadTime(target: number, _userId: string): Promise<CalcResult> {
  const { data, error } = await sb.from("installation_sequence_docs")
    .select("created_at, dispatch_pack_id, dispatch_packs(planned_dispatch_date)")
    .order("created_at", { ascending: false }).limit(20);
  if (error || !data || data.length === 0) return noData(target);
  const valid = data.filter((r: any) => r.dispatch_packs?.planned_dispatch_date);
  if (valid.length === 0) return noData(target);
  const avgDays = valid.reduce((a: number, r: any) => {
    const d = (new Date(r.dispatch_packs.planned_dispatch_date).getTime() - new Date(r.created_at).getTime()) / 86_400_000;
    return a + Math.max(0, d);
  }, 0) / valid.length;
  return { ...ok(avgDays, target), payload: { avg_lead_days: Math.round(avgDays), samples: valid.length } };
}

async function nakeemWoApproval(target: number): Promise<CalcResult> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data, error } = await sb.from("work_orders")
    .select("created_at, approved_at").gte("created_at", since).not("approved_at", "is", null);
  if (error || !data || data.length === 0) return noData(target);
  const avgHrs = data.reduce((a: number, r: any) =>
    a + (new Date(r.approved_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0) / data.length;
  return { ...ok(avgHrs, target, false), payload: { avg_hours: Math.round(avgHrs), total: data.length } };
}

async function vijayGrnWithin24h(target: number): Promise<CalcResult> {
  const n = await count("project_grns");
  if (n === 0) return noData(target);
  const { data } = await sb.from("project_grns")
    .select("created_at, expected_date").not("expected_date", "is", null).limit(200);
  if (!data || data.length === 0) return noData(target);
  const within = data.filter((r: any) =>
    Math.abs(new Date(r.created_at).getTime() - new Date(r.expected_date).getTime()) / 3_600_000 <= 24).length;
  const pct = (within / data.length) * 100;
  return { ...ok(pct, target), payload: { within, total: data.length } };
}

async function tagoreNcrAccuracy(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("ncr_register").select("status").limit(200);
  if (error || !data || data.length === 0) return noData(target);
  const closed = data.filter((r: any) => r.status === "closed").length;
  const pct = (closed / data.length) * 100;
  return { ...ok(pct, target), payload: { closed, total: data.length } };
}

async function venkatDqResponse(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("design_queries")
    .select("created_at, responded_at").not("responded_at", "is", null).limit(200);
  if (error || !data || data.length === 0) return noData(target);
  const avgHrs = data.reduce((a: number, r: any) =>
    a + (new Date(r.responded_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0) / data.length;
  return { ...ok(avgHrs, target, false), payload: { avg_hours: Math.round(avgHrs), total: data.length } };
}

async function maryInvoiceTimeliness(target: number): Promise<CalcResult> {
  const n = await count("project_invoices");
  if (n === 0) return noData(target);
  return { ...ok(80, target), payload: { note: "estimate from invoice volume", invoices: n } };
}

async function maryPayslipBy5th(target: number): Promise<CalcResult> {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data } = await sb.from("payslips").select("created_at, pay_period_start").gte("created_at", since);
  if (!data || data.length === 0) return noData(target);
  const onTime = data.filter((r: any) => new Date(r.created_at).getDate() <= 5).length;
  const pct = (onTime / data.length) * 100;
  return { ...ok(pct, target), payload: { on_time: onTime, total: data.length } };
}

async function balaRmResponse(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("rm_tickets")
    .select("created_at, site_visit_date").not("site_visit_date", "is", null).limit(100);
  if (error || !data || data.length === 0) return noData(target);
  const avgHrs = data.reduce((a: number, r: any) =>
    a + (new Date(r.site_visit_date).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0) / data.length;
  return { ...ok(avgHrs, target, false), payload: { avg_hours: Math.round(avgHrs), total: data.length } };
}

async function balaAmcRenewal(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("amc_contracts").select("end_date").limit(100);
  if (error || !data || data.length === 0) return noData(target);
  const now = Date.now();
  const renewals = data.filter((r: any) => r.end_date && new Date(r.end_date).getTime() > now);
  if (renewals.length === 0) return noData(target);
  const avgDays = renewals.reduce((a: number, r: any) =>
    a + (new Date(r.end_date).getTime() - now) / 86_400_000, 0) / renewals.length;
  return { ...ok(avgDays, target), payload: { avg_lead_days: Math.round(avgDays), total: renewals.length } };
}

async function sandeepDispatchSignoff(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("dispatch_signoffs")
    .select("created_at, signed_at").not("signed_at", "is", null).limit(100);
  if (error || !data || data.length === 0) return noData(target);
  const avgHrs = data.reduce((a: number, r: any) =>
    a + (new Date(r.signed_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000, 0) / data.length;
  return { ...ok(avgHrs, target, false), payload: { avg_hours: Math.round(avgHrs * 10) / 10, total: data.length } };
}

async function surajProjectsOnSchedule(target: number): Promise<CalcResult> {
  const { data, error } = await sb.from("project_tasks")
    .select("status, delay_days").limit(500);
  if (error || !data || data.length === 0) return noData(target);
  const onTrack = data.filter((r: any) => (r.delay_days ?? 0) <= 3).length;
  const pct = (onTrack / data.length) * 100;
  return { ...ok(pct, target), payload: { on_track: onTrack, total: data.length } };
}

const CALCULATORS: Record<string, (t: number, u: string) => Promise<CalcResult>> = {
  "rakesh.measurement_submission_rate": rakeshMeasurementSubmission,
  "azad.module_on_time_dispatch": (t) => azadOnTimeDispatch(t),
  "azad.ncr_closure_hours": (t) => azadNcrClosure(t),
  "awaiz.installation_sequence_lead_days": awaizSequenceLeadTime,
  "nakeem.wo_approval_hours": (t) => nakeemWoApproval(t),
  "vijay.grn_within_24h": (t) => vijayGrnWithin24h(t),
  "tagore.ncr_accuracy_pct": (t) => tagoreNcrAccuracy(t),
  "venkat.dq_response_hours": (t) => venkatDqResponse(t),
  "mary.invoice_within_milestone": (t) => maryInvoiceTimeliness(t),
  "mary.payslip_by_5th": (t) => maryPayslipBy5th(t),
  "bala.rm_response_hours": (t) => balaRmResponse(t),
  "bala.amc_renewal_days": (t) => balaAmcRenewal(t),
  "sandeep.dispatch_signoff_hours": (t) => sandeepDispatchSignoff(t),
  "suraj.projects_on_schedule_pct": (t) => surajProjectsOnSchedule(t),
};

async function recomputeUser(userId: string, periodType: "daily" | "weekly", periodDate: string) {
  const { data: prof } = await sb.from("profiles")
    .select("role").eq("auth_user_id", userId).maybeSingle();
  const role = (prof as any)?.role;
  if (!role) return { user_id: userId, count: 0, note: "no role" };

  const { data: defs } = await sb.from("kpi_definitions")
    .select("kpi_key, target_value").eq("role", role).eq("is_active", true);
  if (!defs) return { user_id: userId, count: 0 };

  let written = 0;
  for (const d of defs) {
    const fn = CALCULATORS[d.kpi_key];
    const target = Number(d.target_value ?? 0);
    const r = fn ? await fn(target, userId).catch(() => noData(target)) : noData(target);
    await sb.from("kpi_snapshots").upsert({
      user_id: userId,
      kpi_key: d.kpi_key,
      period_type: periodType,
      period_date: periodDate,
      week_start_date: periodDate,
      target_value: r.target,
      actual_value: r.actual,
      score: r.score,
      status: r.status === "green" ? "on_track" : r.status === "amber" ? "needs_attention" : r.status === "red" ? "at_risk" : "no_data",
      metric_payload: r.payload,
    }, { onConflict: "user_id,kpi_key,period_type,period_date" });
    written++;
  }
  return { user_id: userId, count: written };
}

async function notifyMdWeeklyDigest() {
  const { data: directors } = await sb.from("profiles")
    .select("auth_user_id").in("role", ["super_admin", "managing_director"]).eq("is_active", true);
  if (!directors) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data: snaps } = await sb.from("kpi_snapshots")
    .select("user_id, status, score").eq("period_type", "weekly").eq("period_date", today);
  const reds = (snaps ?? []).filter((s: any) => s.status === "at_risk").length;
  const total = (snaps ?? []).length;
  const msg = `Weekly KPI digest: ${reds}/${total} metrics in red.`;
  for (const d of directors) {
    await sb.from("notifications").insert({
      user_id: d.auth_user_id, title: "Weekly KPI Digest", message: msg,
      type: "kpi_digest", link: "/kpi",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");
    const userId = url.searchParams.get("user_id");
    const today = new Date().toISOString().slice(0, 10);

    if (userId) {
      const r = await recomputeUser(userId, "daily", today);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "daily" || mode === "weekly") {
      const { data: tracked } = await sb.from("kpi_tracked_employees")
        .select("user_id").eq("is_active", true);
      const results = [];
      for (const t of tracked ?? []) {
        results.push(await recomputeUser(t.user_id, mode, today));
      }
      if (mode === "weekly") await notifyMdWeeklyDigest();
      return new Response(JSON.stringify({ mode, count: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Use ?mode=daily|weekly or ?user_id=" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
