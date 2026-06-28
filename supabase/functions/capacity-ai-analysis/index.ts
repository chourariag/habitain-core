// AI Capacity Analysis — Gemini 2.5 Pro via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a factory capacity planner for Habitainer, a modular construction company. Analyse the factory load data below and identify: (1) weeks where factory is at or above capacity, (2) available capacity windows, (3) recommended start date for any new project, (4) specific production stage bottlenecks. Be specific with dates and module counts. Format response as JSON with keys: capacity_weeks (array of {week_start, week_end, utilisation_pct, status}), available_windows (array of {start, end, capacity_modules}), recommended_start (date string YYYY-MM-DD or null), bottlenecks (array of {stage, reason, impact}), summary (string).`;

const TOOL = {
  type: "function",
  function: {
    name: "emit_capacity_analysis",
    description: "Emit structured factory capacity analysis",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        recommended_start: { type: "string", description: "YYYY-MM-DD or empty string if not applicable" },
        capacity_weeks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              week_start: { type: "string" },
              week_end: { type: "string" },
              utilisation_pct: { type: "number" },
              status: { type: "string", description: "available | near_full | full" },
            },
            required: ["week_start", "week_end", "utilisation_pct", "status"],
          },
        },
        available_windows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start: { type: "string" },
              end: { type: "string" },
              capacity_modules: { type: "number" },
            },
            required: ["start", "end", "capacity_modules"],
          },
        },
        bottlenecks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              stage: { type: "string" },
              reason: { type: "string" },
              impact: { type: "string" },
            },
            required: ["stage", "reason", "impact"],
          },
        },
      },
      required: ["summary", "capacity_weeks", "available_windows", "bottlenecks", "recommended_start"],
      additionalProperties: false,
    },
  },
};

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    if (!LOVABLE_API_KEY) return err(500, "LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(401, "Missing auth");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return err(401, "Invalid user");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const newProject: { module_count?: number; target_start?: string } | undefined = body.new_project;
    const factoryDates: { start?: string; end?: string; modules?: number; project_name?: string } | undefined = body.factory_dates;

    const [{ data: projects }, { data: modules }, { data: settings }, { data: manpower }] = await Promise.all([
      admin.from("projects")
        .select("id, name, status, est_completion, created_at")
        .eq("is_archived", false).neq("status", "completed").limit(50),
      admin.from("modules")
        .select("id, project_id, current_stage, production_status")
        .eq("is_archived", false).not("production_status", "in", "(completed,dispatched)").limit(500),
      admin.from("capacity_forecast_settings").select("*").eq("singleton", true).maybeSingle(),
      admin.from("manpower_plans")
        .select("id, week_start, total_workers, created_at")
        .order("created_at", { ascending: false }).limit(4),
    ]);

    // Aggregate modules per project + per stage
    const modsByProject: Record<string, { count: number; stages: Record<string, number> }> = {};
    const stageCounts: Record<string, number> = {};
    for (const m of modules ?? []) {
      const pid = (m as any).project_id ?? "unassigned";
      const stage = (m as any).current_stage ?? "Unknown";
      if (!modsByProject[pid]) modsByProject[pid] = { count: 0, stages: {} };
      modsByProject[pid].count += 1;
      modsByProject[pid].stages[stage] = (modsByProject[pid].stages[stage] ?? 0) + 1;
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1;
    }
    const projectSummaries = (projects ?? []).map((p: any) => ({
      name: p.name,
      status: p.status,
      est_completion: p.est_completion,
      module_count: modsByProject[p.id]?.count ?? 0,
      stages: modsByProject[p.id]?.stages ?? {},
    }));

    const payload = {
      today: new Date().toISOString().slice(0, 10),
      bay_configuration: { PANEL_BAYS: 3, MODULE_BAYS: 12, INDOOR_MODULE_BAYS: 5, OUTDOOR_MODULE_BAYS: 7 },
      capacity_settings: settings ?? {},
      active_projects: projectSummaries,
      stage_distribution: stageCounts,
      manpower_plans: (manpower ?? []).map((m: any) => ({
        week_start: m.week_start, total_workers: m.total_workers,
      })),
      new_project_request: newProject ?? null,
      project_setup_check: factoryDates ?? null,
    };

    const userPrompt = `Factory load data:\n${JSON.stringify(payload, null, 2)}\n\nAnalyse and return the structured capacity analysis.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "emit_capacity_analysis" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) return err(429, "Rate limit exceeded, please retry shortly.");
      if (resp.status === 402) return err(402, "AI credits exhausted. Please top up.");
      return err(502, `AI gateway error ${resp.status}: ${txt.slice(0, 300)}`);
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return err(502, "No analysis returned");
    const analysis = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify({ analysis, input: payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return err(500, e?.message ?? "Unknown error");
  }
});
