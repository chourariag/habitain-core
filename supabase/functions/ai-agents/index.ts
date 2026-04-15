import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { agent } = await req.json();

  try {
    let result: string;
    switch (agent) {
      case "qc_pattern":
        result = await runQCPatternAnalyst(supabase);
        break;
      case "daily_readiness":
        result = await runDailyReadinessBrief(supabase);
        break;
      case "labour_cost":
        result = await runLabourCostVariance(supabase);
        break;
      case "dispatch_risk":
        result = await runDispatchRiskPredictor(supabase);
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown agent" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ─── Helpers ───

async function getProfilesByRoles(supabase: any, roles: string[]) {
  const { data } = await supabase.from("profiles").select("id, auth_user_id, role, display_name").in("role", roles).eq("is_active", true);
  return data ?? [];
}

async function notify(supabase: any, recipientIds: string[], title: string, body: string, category: string, navigateTo?: string) {
  if (recipientIds.length === 0) return;
  const rows = recipientIds.map((rid) => ({
    recipient_id: rid,
    title,
    body,
    category,
    type: category,
    content: body,
    navigate_to: navigateTo ?? null,
  }));
  await supabase.from("notifications").insert(rows);
}

// ─── AGENT 1: QC Pattern Analyst ───

async function runQCPatternAnalyst(supabase: any) {
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();

  // Get NCRs from last 4 weeks
  const { data: ncrs } = await supabase
    .from("qc_inspections")
    .select("id, module_id, failed_items, notes, inspector_name, created_at")
    .gte("created_at", fourWeeksAgo)
    .eq("result", "fail");

  if (!ncrs || ncrs.length === 0) return "No NCR failures in last 4 weeks";

  // Count failed item occurrences
  const itemCounts: Record<string, { count: number; modules: Set<string>; causes: string[] }> = {};
  for (const ncr of ncrs) {
    const items = Array.isArray(ncr.failed_items) ? ncr.failed_items : [];
    for (const item of items) {
      const name = typeof item === "string" ? item : (item as any)?.item ?? "Unknown";
      if (!itemCounts[name]) itemCounts[name] = { count: 0, modules: new Set(), causes: [] };
      itemCounts[name].count++;
      itemCounts[name].modules.add(ncr.module_id);
      if (ncr.notes) itemCounts[name].causes.push(ncr.notes);
    }
  }

  // Find patterns (>3 times)
  const patterns = Object.entries(itemCounts).filter(([, v]) => v.count > 3);
  if (patterns.length === 0) return "No recurring QC patterns detected";

  // Notify production_head, factory_supervisor, managing_director
  const recipients = await getProfilesByRoles(supabase, ["production_head", "factory_supervisor", "managing_director"]);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);

  for (const [itemName, data] of patterns) {
    const mostCommonCause = data.causes.length > 0
      ? getMostFrequent(data.causes)
      : "Not specified";
    const body = `QC Pattern Alert — "${itemName}" has failed ${data.count} times in 4 weeks across ${data.modules.size} module(s). Recurring cause: ${mostCommonCause}. Recommended action: process or material review.`;
    await notify(supabase, recipientIds, "QC Pattern Alert", body, "qc_pattern", "/quality-control");
  }

  return `${patterns.length} pattern(s) flagged`;
}

function getMostFrequent(arr: string[]): string {
  const freq: Record<string, number> = {};
  for (const s of arr) { const k = s.trim().toLowerCase(); freq[k] = (freq[k] || 0) + 1; }
  let max = 0, result = arr[0];
  for (const [k, v] of Object.entries(freq)) { if (v > max) { max = v; result = k; } }
  return result;
}

// ─── AGENT 2: Daily Readiness Brief ───

async function runDailyReadinessBrief(supabase: any) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // 1. Production: modules at each stage
  const { data: modules } = await supabase.from("modules").select("id, current_stage, production_status").eq("is_archived", false);
  const stageCounts: Record<string, number> = {};
  for (const m of modules ?? []) {
    const stage = m.production_status || `Stage ${m.current_stage}`;
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  }

  // 2. Dispatches planned today
  const { data: dispatches } = await supabase.from("dispatch_packs").select("id, status, project_id").eq("dispatch_date", today);
  const dispatchCount = dispatches?.length ?? 0;

  // 3. NCRs opened yesterday
  const { data: newNcrs } = await supabase.from("qc_inspections").select("id").gte("created_at", yesterday + "T00:00:00").lte("created_at", yesterday + "T23:59:59").eq("result", "fail");
  const ncrCount = newNcrs?.length ?? 0;

  // 4. Pending re-inspections
  const { data: pendingNcrs } = await supabase.from("qc_inspections").select("id").eq("result", "fail").is("reinspection_result", null);
  const pendingCount = pendingNcrs?.length ?? 0;

  // 5. Invoices due this week
  const { data: invoices } = await supabase.from("finance_payments").select("id").gte("due_date", today).lte("due_date", weekEnd).eq("status", "pending");
  const invoiceCount = invoices?.length ?? 0;

  // 6. Overdue materials
  const { data: overdueMats } = await supabase.from("project_material_plan_items").select("id").eq("status", "Overdue");
  const overdueMatCount = overdueMats?.length ?? 0;

  // 7. Tasks overdue yesterday
  const { data: overdueTasks } = await supabase.from("project_tasks").select("id").lte("planned_end", yesterday).neq("status", "Complete");
  const overdueTaskCount = overdueTasks?.length ?? 0;

  const lines = [
    `📊 Production: ${Object.entries(stageCounts).map(([k, v]) => `${v} at ${k}`).join(", ") || "No active modules"}`,
    `🚚 ${dispatchCount} dispatch(es) planned today`,
    `🔍 ${ncrCount} NCR(s) opened yesterday, ${pendingCount} pending re-inspection`,
    `💰 ${invoiceCount} invoice(s) due for collection this week`,
    `📦 ${overdueMatCount} material(s) overdue or at risk`,
    `⏰ ${overdueTaskCount} task(s) became overdue yesterday`,
  ];

  const body = lines.join("\n");

  // Send to MD
  const mdProfiles = await getProfilesByRoles(supabase, ["managing_director"]);
  const mdIds = mdProfiles.map((p: any) => p.auth_user_id);
  await notify(supabase, mdIds, `Daily Readiness Brief — ${today}`, body, "daily_brief", "/dashboard");

  return "Daily brief sent";
}

// ─── AGENT 3: Labour Cost Variance ───

async function runLabourCostVariance(supabase: any) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // Get tasks completed this week
  const { data: tasks } = await supabase
    .from("project_tasks")
    .select("id, task_name, project_id, actual_hours")
    .eq("status", "Complete")
    .gte("actual_end", weekAgo)
    .lte("actual_end", today);

  if (!tasks || tasks.length === 0) return "No tasks completed this week";

  // Get projects for these tasks
  const projectIds = [...new Set(tasks.map((t: any) => t.project_id))];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const projectMap: Record<string, string> = {};
  for (const p of projects ?? []) projectMap[p.id] = p.name;

  // Get daily actuals for the week
  const { data: actuals } = await supabase
    .from("daily_actuals")
    .select("project_id, hours_worked")
    .gte("date", weekAgo)
    .lte("date", today);

  // Aggregate actual hours per project
  const projectHours: Record<string, number> = {};
  for (const a of actuals ?? []) {
    if (a.project_id) projectHours[a.project_id] = (projectHours[a.project_id] || 0) + (a.hours_worked || 0);
  }

  // Get measurement sheet for BOQ labour costs
  const { data: measurements } = await supabase
    .from("project_measurement_items")
    .select("project_id, boq_labour_cost")
    .in("project_id", projectIds);

  const boqByProject: Record<string, number> = {};
  for (const m of measurements ?? []) {
    if (m.project_id) boqByProject[m.project_id] = (boqByProject[m.project_id] || 0) + (Number(m.boq_labour_cost) || 0);
  }

  // Find variances > 15%
  const alerts: string[] = [];
  const recipientRoles = ["finance_director", "managing_director"];
  const recipients = await getProfilesByRoles(supabase, recipientRoles);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);

  for (const pid of projectIds) {
    const actualHrs = projectHours[pid] || 0;
    const boqCost = boqByProject[pid] || 0;
    if (boqCost === 0) continue;

    // Simplified: use actual hours * assumed rate vs BOQ
    const actualCost = actualHrs * 500; // Approximate daily rate per worker
    const variance = ((actualCost - boqCost) / boqCost) * 100;

    if (variance > 15) {
      const projectName = projectMap[pid] || pid;
      const body = `Labour Cost Variance — ${projectName}: BOQ estimated ₹${Math.round(boqCost).toLocaleString()} for tasks completed this week. Actual labour cost was ₹${Math.round(actualCost).toLocaleString()} — ${Math.round(variance)}% over budget.`;
      await notify(supabase, recipientIds, "Labour Cost Variance Alert", body, "labour_variance", `/projects/${pid}`);
      alerts.push(projectName);
    }
  }

  return alerts.length > 0 ? `${alerts.length} project(s) flagged` : "No variances above threshold";
}

// ─── AGENT 4: Dispatch Risk Predictor ───

async function runDispatchRiskPredictor(supabase: any) {
  const today = new Date();
  const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  // Get dispatches planned in next 7 days
  const { data: dispatches } = await supabase
    .from("dispatch_packs")
    .select("id, dispatch_pack_id, project_id, dispatch_date, status")
    .gte("dispatch_date", todayStr)
    .lte("dispatch_date", sevenDaysOut)
    .neq("status", "dispatched");

  if (!dispatches || dispatches.length === 0) return "No upcoming dispatches";

  const projectIds = [...new Set(dispatches.map((d: any) => d.project_id))];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const projectMap: Record<string, string> = {};
  for (const p of projects ?? []) projectMap[p.id] = p.name;

  // Check gates for each dispatch's project
  const [siteReadiness, deliveryChecklists, installSeqDocs] = await Promise.all([
    supabase.from("site_readiness_checklist").select("project_id, is_complete").in("project_id", projectIds),
    supabase.from("delivery_checklists").select("project_id, status, modules_signed_by, tools_signed_by, additional_signed_by").in("project_id", projectIds),
    supabase.from("installation_sequence_docs").select("project_id, factory_head_signed_at, site_lead_signed_at, planning_engineer_signed_at").in("project_id", projectIds),
  ]);

  const siteReady: Record<string, boolean> = {};
  for (const s of siteReadiness.data ?? []) siteReady[s.project_id] = !!s.is_complete;

  const deliveryOk: Record<string, boolean> = {};
  for (const d of deliveryChecklists.data ?? []) {
    deliveryOk[d.project_id] = !!(d.modules_signed_by && d.tools_signed_by && d.additional_signed_by);
  }

  const installOk: Record<string, boolean> = {};
  for (const i of installSeqDocs.data ?? []) {
    installOk[i.project_id] = !!(i.factory_head_signed_at && i.site_lead_signed_at && i.planning_engineer_signed_at);
  }

  // Check open NCRs on modules
  const { data: openNcrs } = await supabase
    .from("qc_inspections")
    .select("module_id")
    .eq("result", "fail")
    .is("reinspection_result", null);
  const ncrModuleIds = new Set((openNcrs ?? []).map((n: any) => n.module_id));

  // Overdue materials
  const { data: overdueMats } = await supabase
    .from("project_material_plan_items")
    .select("plan_id, material_description")
    .eq("status", "Overdue")
    .in("plan_id", projectIds); // approximate — plan_id may differ

  const recipientRoles = ["production_head", "site_installation_manager", "planning_engineer", "managing_director"];
  const recipients = await getProfilesByRoles(supabase, recipientRoles);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);

  let alertCount = 0;
  for (const dispatch of dispatches) {
    const pid = dispatch.project_id;
    const daysLeft = Math.ceil((new Date(dispatch.dispatch_date).getTime() - today.getTime()) / 86400000);
    if (daysLeft > 3) continue; // only alert if < 3 days

    const blockers: string[] = [];
    let gatesCleared = 4;
    if (!siteReady[pid]) { blockers.push("Site readiness checklist incomplete"); gatesCleared--; }
    if (!deliveryOk[pid]) { blockers.push("Delivery checklist sign-offs pending"); gatesCleared--; }
    if (!installOk[pid]) { blockers.push("Installation sequence sign-offs pending"); gatesCleared--; }

    // Check for open NCRs (simplified — check project modules)
    const { data: projModules } = await supabase.from("modules").select("id").eq("project_id", pid);
    const hasOpenNcr = (projModules ?? []).some((m: any) => ncrModuleIds.has(m.id));
    if (hasOpenNcr) { blockers.push("Open NCRs on modules"); gatesCleared--; }

    if (blockers.length === 0) continue;

    const projectName = projectMap[pid] || pid;
    const body = `Dispatch Risk — ${projectName} dispatch in ${daysLeft} day(s). ${4 - gatesCleared} of 4 gates not cleared. Blockers: ${blockers.join("; ")}. Action needed immediately.`;
    await notify(supabase, recipientIds, "Dispatch Risk Alert", body, "dispatch_risk", `/projects/${pid}`);
    alertCount++;
  }

  return `${alertCount} dispatch risk(s) flagged`;
}
