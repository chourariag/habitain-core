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

  const { agent, payload } = await req.json();

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
      case "subcontractor_monitor":
        result = await runSubcontractorMonitor(supabase);
        break;
      case "dq_consequence":
        result = await runDQConsequence(supabase, payload);
        break;
      case "client_approval_chaser":
        result = await runClientApprovalChaser(supabase);
        break;
      case "site_diary_verify":
        result = await runSiteDiaryVerify(supabase, payload);
        break;
      case "reorder_alert":
        result = await runReorderAlert(supabase);
        break;
      case "po_anomaly":
        result = await runPOAnomalyDetector(supabase, payload);
        break;
      case "cashflow_predictor":
        result = await runCashFlowPredictor(supabase);
        break;
      case "statutory_reminder":
        result = await runStatutoryReminder(supabase);
        break;
      case "lost_deal_pattern":
        result = await runLostDealPatternAnalyst(supabase);
        break;
      case "deal_stagnation":
        result = await runDealStagnationAlert(supabase);
        break;
      case "weekly_coaching":
        result = await runWeeklyCoachingDigest(supabase);
        break;
      case "long_leave_warning":
        result = await runLongLeaveEarlyWarning(supabase);
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

function getMostFrequent(arr: string[]): string {
  const freq: Record<string, number> = {};
  for (const s of arr) { const k = s.trim().toLowerCase(); freq[k] = (freq[k] || 0) + 1; }
  let max = 0, result = arr[0];
  for (const [k, v] of Object.entries(freq)) { if (v > max) { max = v; result = k; } }
  return result;
}

function daysBetween(d1: string, d2: string): number {
  return Math.ceil((new Date(d1).getTime() - new Date(d2).getTime()) / 86400000);
}

// ─── AGENT 1: QC Pattern Analyst ───

async function runQCPatternAnalyst(supabase: any) {
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();
  const { data: ncrs } = await supabase
    .from("qc_inspections").select("id, module_id, failed_items, notes, inspector_name, created_at")
    .gte("created_at", fourWeeksAgo).eq("result", "fail");

  if (!ncrs || ncrs.length === 0) return "No NCR failures in last 4 weeks";

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

  const patterns = Object.entries(itemCounts).filter(([, v]) => v.count > 3);
  if (patterns.length === 0) return "No recurring QC patterns detected";

  const recipients = await getProfilesByRoles(supabase, ["production_head", "factory_supervisor", "managing_director"]);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);

  for (const [itemName, data] of patterns) {
    const mostCommonCause = data.causes.length > 0 ? getMostFrequent(data.causes) : "Not specified";
    const body = `QC Pattern Alert — "${itemName}" has failed ${data.count} times in 4 weeks across ${data.modules.size} module(s). Recurring cause: ${mostCommonCause}. Recommended action: process or material review.`;
    await notify(supabase, recipientIds, "QC Pattern Alert", body, "qc_pattern", "/quality-control");
  }
  return `${patterns.length} pattern(s) flagged`;
}

// ─── AGENT 2: Daily Readiness Brief ───

async function runDailyReadinessBrief(supabase: any) {
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const { data: modules } = await supabase.from("modules").select("id, current_stage, production_status").eq("is_archived", false);
  const stageCounts: Record<string, number> = {};
  for (const m of modules ?? []) { const s = m.production_status || `Stage ${m.current_stage}`; stageCounts[s] = (stageCounts[s] || 0) + 1; }

  const { data: dispatches } = await supabase.from("dispatch_packs").select("id").eq("dispatch_date", today);
  const { data: newNcrs } = await supabase.from("qc_inspections").select("id").gte("created_at", yesterday + "T00:00:00").lte("created_at", yesterday + "T23:59:59").eq("result", "fail");
  const { data: pendingNcrs } = await supabase.from("qc_inspections").select("id").eq("result", "fail").is("reinspection_result", null);
  const { data: invoices } = await supabase.from("finance_payments").select("id").gte("due_date", today).lte("due_date", weekEnd).eq("status", "pending");
  const { data: overdueMats } = await supabase.from("project_material_plan_items").select("id").eq("status", "Overdue");
  const { data: overdueTasks } = await supabase.from("project_tasks").select("id").lte("planned_end", yesterday).neq("status", "Complete");

  const lines = [
    `📊 Production: ${Object.entries(stageCounts).map(([k, v]) => `${v} at ${k}`).join(", ") || "No active modules"}`,
    `🚚 ${dispatches?.length ?? 0} dispatch(es) planned today`,
    `🔍 ${newNcrs?.length ?? 0} NCR(s) opened yesterday, ${pendingNcrs?.length ?? 0} pending re-inspection`,
    `💰 ${invoices?.length ?? 0} invoice(s) due for collection this week`,
    `📦 ${overdueMats?.length ?? 0} material(s) overdue or at risk`,
    `⏰ ${overdueTasks?.length ?? 0} task(s) became overdue yesterday`,
  ];

  const mdProfiles = await getProfilesByRoles(supabase, ["managing_director"]);
  await notify(supabase, mdProfiles.map((p: any) => p.auth_user_id), `Daily Readiness Brief — ${today}`, lines.join("\n"), "daily_brief", "/dashboard");
  return "Daily brief sent";
}

// ─── AGENT 3: Labour Cost Variance ───

async function runLabourCostVariance(supabase: any) {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await supabase.from("project_tasks").select("id, task_name, project_id, actual_hours").eq("status", "Complete").gte("actual_end", weekAgo).lte("actual_end", today);
  if (!tasks || tasks.length === 0) return "No tasks completed this week";

  const projectIds = [...new Set(tasks.map((t: any) => t.project_id))];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const projectMap: Record<string, string> = {};
  for (const p of projects ?? []) projectMap[p.id] = p.name;

  const { data: actuals } = await supabase.from("daily_actuals").select("project_id, hours_worked").gte("date", weekAgo).lte("date", today);
  const projectHours: Record<string, number> = {};
  for (const a of actuals ?? []) { if (a.project_id) projectHours[a.project_id] = (projectHours[a.project_id] || 0) + (a.hours_worked || 0); }

  const { data: measurements } = await supabase.from("project_measurement_items").select("project_id, boq_labour_cost").in("project_id", projectIds);
  const boqByProject: Record<string, number> = {};
  for (const m of measurements ?? []) { if (m.project_id) boqByProject[m.project_id] = (boqByProject[m.project_id] || 0) + (Number(m.boq_labour_cost) || 0); }

  const recipients = await getProfilesByRoles(supabase, ["finance_director", "managing_director"]);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);
  const alerts: string[] = [];

  for (const pid of projectIds) {
    const actualCost = (projectHours[pid] || 0) * 500;
    const boqCost = boqByProject[pid] || 0;
    if (boqCost === 0) continue;
    const variance = ((actualCost - boqCost) / boqCost) * 100;
    if (variance > 15) {
      const name = projectMap[pid] || pid;
      await notify(supabase, recipientIds, "Labour Cost Variance Alert", `Labour Cost Variance — ${name}: BOQ estimated ₹${Math.round(boqCost).toLocaleString()}. Actual ₹${Math.round(actualCost).toLocaleString()} — ${Math.round(variance)}% over budget.`, "labour_variance", `/projects/${pid}`);
      alerts.push(name);
    }
  }
  return alerts.length > 0 ? `${alerts.length} project(s) flagged` : "No variances above threshold";
}

// ─── AGENT 4: Dispatch Risk Predictor ───

async function runDispatchRiskPredictor(supabase: any) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const sevenOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data: dispatches } = await supabase.from("dispatch_packs").select("id, dispatch_pack_id, project_id, dispatch_date, status").gte("dispatch_date", todayStr).lte("dispatch_date", sevenOut).neq("status", "dispatched");
  if (!dispatches || dispatches.length === 0) return "No upcoming dispatches";

  const projectIds = [...new Set(dispatches.map((d: any) => d.project_id))];
  const { data: projects } = await supabase.from("projects").select("id, name").in("id", projectIds);
  const projectMap: Record<string, string> = {};
  for (const p of projects ?? []) projectMap[p.id] = p.name;

  const [siteRes, delRes, instRes] = await Promise.all([
    supabase.from("site_readiness_checklist").select("project_id, is_complete").in("project_id", projectIds),
    supabase.from("delivery_checklists").select("project_id, modules_signed_by, tools_signed_by, additional_signed_by").in("project_id", projectIds),
    supabase.from("installation_sequence_docs").select("project_id, factory_head_signed_at, site_lead_signed_at, planning_engineer_signed_at").in("project_id", projectIds),
  ]);

  const siteReady: Record<string, boolean> = {};
  for (const s of siteRes.data ?? []) siteReady[s.project_id] = !!s.is_complete;
  const deliveryOk: Record<string, boolean> = {};
  for (const d of delRes.data ?? []) deliveryOk[d.project_id] = !!(d.modules_signed_by && d.tools_signed_by && d.additional_signed_by);
  const installOk: Record<string, boolean> = {};
  for (const i of instRes.data ?? []) installOk[i.project_id] = !!(i.factory_head_signed_at && i.site_lead_signed_at && i.planning_engineer_signed_at);

  const { data: openNcrs } = await supabase.from("qc_inspections").select("module_id").eq("result", "fail").is("reinspection_result", null);
  const ncrModuleIds = new Set((openNcrs ?? []).map((n: any) => n.module_id));

  const recipients = await getProfilesByRoles(supabase, ["production_head", "site_installation_manager", "planning_engineer", "managing_director"]);
  const recipientIds = recipients.map((r: any) => r.auth_user_id);

  let alertCount = 0;
  for (const dispatch of dispatches) {
    const pid = dispatch.project_id;
    const daysLeft = Math.ceil((new Date(dispatch.dispatch_date).getTime() - today.getTime()) / 86400000);
    if (daysLeft > 3) continue;

    const blockers: string[] = [];
    if (!siteReady[pid]) blockers.push("Site readiness incomplete");
    if (!deliveryOk[pid]) blockers.push("Delivery sign-offs pending");
    if (!installOk[pid]) blockers.push("Installation sequence pending");

    const { data: projModules } = await supabase.from("modules").select("id").eq("project_id", pid);
    if ((projModules ?? []).some((m: any) => ncrModuleIds.has(m.id))) blockers.push("Open NCRs on modules");

    if (blockers.length === 0) continue;
    const projectName = projectMap[pid] || pid;
    await notify(supabase, recipientIds, "Dispatch Risk Alert", `Dispatch Risk — ${projectName} in ${daysLeft} day(s). Blockers: ${blockers.join("; ")}. Action needed immediately.`, "dispatch_risk", `/projects/${pid}`);
    alertCount++;
  }
  return `${alertCount} dispatch risk(s) flagged`;
}

// ─── AGENT 5: Sub-Contractor Commitment Monitor ───

async function runSubcontractorMonitor(supabase: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);

  const { data: assignments } = await supabase
    .from("subcontractor_assignments")
    .select("id, project_id, company_name, work_type, contact_person, phone, scheduled_start, status, created_by, reminder_14d_sent, reminder_5d_sent, reminder_1d_sent, escalation_sent, actual_start")
    .eq("status", "Active");

  if (!assignments || assignments.length === 0) return "No active subcontractor assignments";

  const { data: projects } = await supabase.from("projects").select("id, name");
  const projectMap: Record<string, string> = {};
  for (const p of projects ?? []) projectMap[p.id] = p.name;

  let alertCount = 0;

  for (const a of assignments) {
    if (!a.scheduled_start) continue;
    const startDate = new Date(a.scheduled_start);
    const daysUntilStart = daysBetween(a.scheduled_start, todayStr);
    const projectName = projectMap[a.project_id] || a.project_id;
    const contactInfo = a.phone ? ` Contact: ${a.phone}` : "";
    const recipientIds = a.created_by ? [a.created_by] : [];

    // 14 days before
    if (daysUntilStart <= 14 && daysUntilStart > 5 && !a.reminder_14d_sent) {
      await notify(supabase, recipientIds, "Sub-Contractor Reminder (14 days)",
        `${a.company_name} is scheduled to start "${a.work_type}" on ${a.scheduled_start} at ${projectName}. Confirm they are ready.${contactInfo}`,
        "subcontractor_reminder", `/site-hub`);
      await supabase.from("subcontractor_assignments").update({ reminder_14d_sent: true }).eq("id", a.id);
      alertCount++;
    }

    // 5 days before
    if (daysUntilStart <= 5 && daysUntilStart > 1 && !a.reminder_5d_sent) {
      await notify(supabase, recipientIds, "Sub-Contractor Confirmation (5 days)",
        `${a.company_name} starts "${a.work_type}" in ${daysUntilStart} day(s) at ${projectName}. Confirm manpower and materials are ready.${contactInfo}`,
        "subcontractor_reminder", `/site-hub`);
      await supabase.from("subcontractor_assignments").update({ reminder_5d_sent: true }).eq("id", a.id);
      alertCount++;
    }

    // 1 day before
    if (daysUntilStart === 1 && !a.reminder_1d_sent) {
      await notify(supabase, recipientIds, "Sub-Contractor Final Check (Tomorrow)",
        `${a.company_name} starts "${a.work_type}" TOMORROW at ${projectName}. Final confirmation required.${contactInfo}`,
        "subcontractor_reminder", `/site-hub`);
      await supabase.from("subcontractor_assignments").update({ reminder_1d_sent: true }).eq("id", a.id);
      alertCount++;
    }

    // Escalation: start date passed, no actual start
    if (daysUntilStart < 0 && !a.actual_start && !a.escalation_sent) {
      const escalationRecipients = await getProfilesByRoles(supabase, ["planning_engineer", "production_head"]);
      const escalationIds = [...new Set([...recipientIds, ...escalationRecipients.map((r: any) => r.auth_user_id)])];
      await notify(supabase, escalationIds, "Sub-Contractor Milestone Missed",
        `⚠️ ${a.company_name} was scheduled to start "${a.work_type}" on ${a.scheduled_start} at ${projectName} but has not started. ${Math.abs(daysUntilStart)} day(s) overdue. Escalation required.${contactInfo}`,
        "subcontractor_escalation", `/site-hub`);
      await supabase.from("subcontractor_assignments").update({ escalation_sent: true }).eq("id", a.id);
      alertCount++;
    }
  }

  return `${alertCount} subcontractor alert(s) sent`;
}

// ─── AGENT 6: DQ Consequence Statement ───

async function runDQConsequence(supabase: any, payload?: any) {
  const dqId = payload?.dq_id;
  if (!dqId) return "No DQ ID provided";

  const { data: dq } = await supabase.from("design_queries").select("*").eq("id", dqId).single();
  if (!dq) return "DQ not found";

  const { data: project } = await supabase.from("projects").select("id, name").eq("id", dq.project_id).single();
  const projectName = project?.name || dq.project_id;

  // Find tasks that depend on this drawing type / affected area
  const { data: tasks } = await supabase
    .from("project_tasks")
    .select("id, task_name, planned_start, planned_end, status")
    .eq("project_id", dq.project_id)
    .neq("status", "Complete")
    .order("planned_start", { ascending: true });

  // Match tasks by section/category overlap (simplified: match by affected_area keyword)
  const affectedArea = (dq.affected_area || dq.dq_category || "").toLowerCase();
  const blockedTasks = (tasks ?? []).filter((t: any) =>
    t.task_name && t.task_name.toLowerCase().includes(affectedArea.split(" ")[0])
  );

  // Calculate dispatch delay impact
  let delayDays = 0;
  if (blockedTasks.length > 0) {
    const earliestTask = blockedTasks[0];
    if (earliestTask.planned_start) {
      const taskStart = new Date(earliestTask.planned_start);
      const today = new Date();
      delayDays = Math.max(0, Math.ceil((taskStart.getTime() - today.getTime()) / 86400000));
    }
  }

  // Determine priority based on impact
  const priority = blockedTasks.length >= 3 || delayDays <= 3 ? "Critical" : "High";

  // Auto-set DQ urgency
  const newUrgency = priority === "Critical" ? "critical" : "high";
  if (dq.urgency !== newUrgency) {
    await supabase.from("design_queries").update({ urgency: newUrgency }).eq("id", dqId);
  }

  const blockedList = blockedTasks.length > 0
    ? blockedTasks.slice(0, 5).map((t: any) => t.task_name).join(", ")
    : "No directly linked tasks identified";

  const body = `DQ Consequence — ${dq.dq_code}: This DQ is blocking: ${blockedList}. If not resolved within ${delayDays > 0 ? delayDays + " days" : "immediately"}, dispatch will be impacted. Priority: ${priority}.`;

  // Notify principal architect + DQ raiser
  const architects = await getProfilesByRoles(supabase, ["principal_architect", "architecture_director"]);
  const recipientIds = [...new Set([
    ...architects.map((a: any) => a.auth_user_id),
    dq.raised_by,
  ].filter(Boolean))];

  await notify(supabase, recipientIds, `DQ Consequence — ${dq.dq_code}`, body, "dq_consequence", `/design`);

  return `DQ consequence statement sent for ${dq.dq_code}, priority: ${priority}`;
}

// ─── AGENT 7: Client Approval Chaser ───

async function runClientApprovalChaser(supabase: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr);

  // Find drawings pending client approval
  const { data: drawings } = await supabase
    .from("drawings")
    .select("id, drawing_id_code, drawing_title, project_id, approval_status, created_at, uploaded_by")
    .eq("approval_status", "pending_client")
    .eq("is_archived", false);

  if (!drawings || drawings.length === 0) return "No drawings pending client approval";

  const { data: projects } = await supabase.from("projects").select("id, name, client_name, client_email");
  const projectMap: Record<string, any> = {};
  for (const p of projects ?? []) projectMap[p.id] = p;

  // Get sales role (John) for escalation
  const salesProfiles = await getProfilesByRoles(supabase, ["sales_head", "sales_director"]);
  const salesIds = salesProfiles.map((s: any) => s.auth_user_id);

  let alertCount = 0;

  for (const drawing of drawings) {
    const daysPending = daysBetween(todayStr, drawing.created_at.slice(0, 10));
    const project = projectMap[drawing.project_id];
    const projectName = project?.name || drawing.project_id;
    const clientName = project?.client_name || "Client";
    const drawingRef = drawing.drawing_title || drawing.drawing_id_code;

    if (daysPending === 3) {
      // Day 3: First reminder to uploader
      const recipientIds = drawing.uploaded_by ? [drawing.uploaded_by] : [];
      await notify(supabase, recipientIds, "Client Approval Reminder",
        `Friendly reminder: ${clientName} has not yet responded to "${drawingRef}" for ${projectName}. Submitted 3 days ago via the Habitainer client portal. Consider a follow-up.`,
        "client_approval_reminder", `/drawings`);
      alertCount++;
    } else if (daysPending === 7) {
      // Day 7: Second reminder + copy John
      const recipientIds = [...new Set([drawing.uploaded_by, ...salesIds].filter(Boolean))];
      await notify(supabase, recipientIds, "Client Approval — 7 Day Follow-up",
        `${clientName} has not responded to "${drawingRef}" for ${projectName} — now 7 days pending. Please follow up through the Habitainer client portal or directly.`,
        "client_approval_reminder", `/drawings`);
      alertCount++;
    } else if (daysPending >= 14 && daysPending % 7 === 0) {
      // Day 14+: Escalation to sales
      await notify(supabase, salesIds, "Client Approval Escalation",
        `⚠️ ${clientName} has not responded to "${drawingRef}" for ${projectName} for ${daysPending} days. This is impacting the project timeline. Please follow up directly with the client.`,
        "client_approval_escalation", `/drawings`);
      alertCount++;
    }
  }

  return `${alertCount} client approval reminder(s) sent`;
}

// ─── AGENT 8: Site Diary Location Photo Verify ───

async function runSiteDiaryVerify(supabase: any, payload?: any) {
  const diaryId = payload?.diary_id;
  if (!diaryId) return "No diary ID provided";

  const { data: diary } = await supabase
    .from("site_diary")
    .select("id, project_id, entry_date, photo_urls, gps_location, submitted_by")
    .eq("id", diaryId)
    .single();

  if (!diary) return "Site diary not found";

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, site_lat, site_lng")
    .eq("id", diary.project_id)
    .single();

  const projectName = project?.name || diary.project_id;
  const photos = diary.photo_urls ?? [];

  // Check 1: No photos
  if (photos.length === 0) {
    // Notify site_installation_manager (Awaiz)
    const siteManagers = await getProfilesByRoles(supabase, ["site_installation_manager"]);
    const recipientIds = [...new Set([diary.submitted_by, ...siteManagers.map((s: any) => s.auth_user_id)].filter(Boolean))];
    await notify(supabase, recipientIds, "Site Diary — Photos Missing",
      `Today's site diary for ${projectName} (${diary.entry_date}) has no photos. Please add at least 1 photo to confirm site activity.`,
      "site_diary_photo", `/site-hub`);
    return "Photo missing alert sent";
  }

  // Check 2: GPS verification
  if (diary.gps_location && project?.site_lat && project?.site_lng) {
    let diaryLat: number | null = null;
    let diaryLng: number | null = null;

    // Parse gps_location — could be "lat,lng" string or JSON
    if (typeof diary.gps_location === "string") {
      const parts = diary.gps_location.split(",").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        diaryLat = parts[0];
        diaryLng = parts[1];
      }
    } else if (typeof diary.gps_location === "object") {
      diaryLat = diary.gps_location.lat ?? diary.gps_location.latitude;
      diaryLng = diary.gps_location.lng ?? diary.gps_location.longitude;
    }

    if (diaryLat !== null && diaryLng !== null) {
      const distance = haversineDistance(diaryLat, diaryLng, Number(project.site_lat), Number(project.site_lng));

      if (distance > 500) {
        // Flag to MD (Gaurav)
        const mdProfiles = await getProfilesByRoles(supabase, ["managing_director"]);
        await notify(supabase, mdProfiles.map((p: any) => p.auth_user_id), "Site Diary — GPS Mismatch",
          `⚠️ Site diary for ${projectName} on ${diary.entry_date} — photo GPS is ${Math.round(distance)}m from site location. Possible off-site submission. Review required.`,
          "site_diary_gps", `/site-hub`);
        return `GPS mismatch flagged (${Math.round(distance)}m away)`;
      }
    }
  }

  return "Site diary verified — no issues";
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ───────────── AGENT 9 — REORDER ALERT ───────────── */
async function runReorderAlert(supabase: any): Promise<string> {
  // Get inventory items with current stock
  const { data: inventory } = await supabase
    .from("opening_inventory")
    .select("id, material_name, current_stock, unit")
    .gt("current_stock", 0);

  if (!inventory?.length) return "No inventory items to check";

  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000).toISOString();
  const alerts: string[] = [];

  for (const item of inventory) {
    // Calculate consumption from GRNs / material usage in last 4 weeks
    const { data: usage } = await supabase
      .from("grn_entries")
      .select("quantity_received")
      .eq("material_name", item.material_name)
      .gte("received_date", fourWeeksAgo);

    // Approximate weekly consumption from dispatched materials
    const { data: dispatched } = await supabase
      .from("dispatch_material_log")
      .select("qty_dispatched")
      .eq("material_name", item.material_name)
      .gte("created_at", fourWeeksAgo);

    const totalDispatched = (dispatched || []).reduce((s: number, d: any) => s + (d.qty_dispatched || 0), 0);
    const weeklyConsumption = totalDispatched / 4;

    if (weeklyConsumption <= 0) continue;

    const daysRemaining = (item.current_stock / weeklyConsumption) * 7;

    if (daysRemaining < 21) {
      const suggestedReorder = Math.ceil(weeklyConsumption * 6); // 6-week buffer

      // Find last vendor from PO register
      const { data: lastPO } = await supabase
        .from("purchase_orders")
        .select("vendor_name")
        .eq("item_description", item.material_name)
        .order("po_date", { ascending: false })
        .limit(1);

      const vendor = lastPO?.[0]?.vendor_name || "Unknown";

      // Notify Vijay (procurement roles)
      const { data: procUsers } = await supabase
        .from("profiles")
        .select("auth_user_id")
        .in("role", ["procurement_manager", "stores_manager"])
        .eq("is_active", true);

      for (const u of procUsers || []) {
        await supabase.from("notifications").insert({
          recipient_id: u.auth_user_id,
          title: `Reorder Required — ${item.material_name}`,
          body: `Current stock: ${item.current_stock} ${item.unit || "units"}. At current consumption, stock runs out in ${Math.round(daysRemaining)} days. Suggested reorder qty: ${suggestedReorder} (6-week buffer). Last ordered from: ${vendor}.`,
          category: "reorder_alert",
          type: "reorder_alert",
          content: `Stock runs out in ${Math.round(daysRemaining)} days`,
        });
      }
      alerts.push(item.material_name);
    }
  }

  return alerts.length ? `Reorder alerts sent for: ${alerts.join(", ")}` : "All stock levels healthy";
}

/* ───────────── AGENT 10 — PO ANOMALY DETECTOR ───────────── */
async function runPOAnomalyDetector(supabase: any, payload?: any): Promise<string> {
  // Get recently uploaded POs (or specific batch if payload provided)
  const query = supabase
    .from("purchase_orders")
    .select("id, po_number, vendor_name, item_description, amount, po_date, grn_date")
    .order("created_at", { ascending: false })
    .limit(50);

  if (payload?.since) {
    query.gte("created_at", payload.since);
  } else {
    // Default: last 24 hours
    query.gte("created_at", new Date(Date.now() - 86400000).toISOString());
  }

  const { data: newPOs } = await query;
  if (!newPOs?.length) return "No new POs to analyse";

  const anomalies: string[] = [];

  // Get procurement + MD users for notifications
  const { data: notifyUsers } = await supabase
    .from("profiles")
    .select("auth_user_id, role")
    .in("role", ["procurement_manager", "stores_manager", "managing_director"])
    .eq("is_active", true);

  const vijayIds = (notifyUsers || []).filter((u: any) => ["procurement_manager", "stores_manager"].includes(u.role)).map((u: any) => u.auth_user_id);
  const mdIds = (notifyUsers || []).filter((u: any) => u.role === "managing_director").map((u: any) => u.auth_user_id);

  for (const po of newPOs) {
    const flags: string[] = [];

    // Check 1: Amount >50% higher than historical average for same vendor
    const { data: historicalPOs } = await supabase
      .from("purchase_orders")
      .select("amount")
      .eq("vendor_name", po.vendor_name)
      .neq("id", po.id);

    if (historicalPOs?.length) {
      const avgAmount = historicalPOs.reduce((s: number, p: any) => s + (p.amount || 0), 0) / historicalPOs.length;
      if (avgAmount > 0 && po.amount > avgAmount * 1.5) {
        const pctOver = Math.round(((po.amount - avgAmount) / avgAmount) * 100);
        flags.push(`Amount is ${pctOver}% higher than average (₹${Math.round(avgAmount).toLocaleString()}) for this vendor`);
      }
    } else if (po.amount > 50000) {
      // Check 2: New vendor above ₹50K
      flags.push(`New vendor with PO above ₹50,000 (₹${po.amount.toLocaleString()})`);
    }

    // Check 3: PO >₹50K without GRN for 30+ days
    if (po.amount > 50000 && !po.grn_date) {
      const poDate = new Date(po.po_date).getTime();
      const daysSince = (Date.now() - poDate) / 86400000;
      if (daysSince > 30) {
        flags.push(`₹${po.amount.toLocaleString()} PO undelivered for ${Math.round(daysSince)} days — no GRN linked`);
      }
    }

    if (flags.length) {
      const body = `PO Anomaly — ${po.po_number} [${po.vendor_name}]: ${flags.join(". ")}. Please verify before GRN is accepted.`;
      const recipients = [...vijayIds];
      // Escalate new vendor >50K or large anomaly to MD
      if (flags.some(f => f.includes("New vendor") || f.includes("higher than average"))) {
        recipients.push(...mdIds);
      }
      const unique = [...new Set(recipients)];
      for (const rid of unique) {
        await supabase.from("notifications").insert({
          recipient_id: rid,
          title: `PO Anomaly — ${po.po_number}`,
          body,
          category: "po_anomaly",
          type: "po_anomaly",
          content: body,
        });
      }
      anomalies.push(po.po_number);
    }
  }

  return anomalies.length ? `Anomalies flagged: ${anomalies.join(", ")}` : "No PO anomalies detected";
}

/* ───────────── AGENT 11 — CASH FLOW PREDICTOR ───────────── */
async function runCashFlowPredictor(supabase: any): Promise<string> {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  // Inflows: billing milestones due in next 30 days
  const { data: milestones } = await supabase
    .from("finance_payments")
    .select("amount, due_date, milestone_description, project_name")
    .in("status", ["pending", "overdue"])
    .gte("due_date", today)
    .lte("due_date", thirtyDaysLater);

  const totalInflows = (milestones || []).reduce((s: number, m: any) => s + (m.amount || 0), 0);

  // Outflows: unpaid POs
  const { data: unpaidPOs } = await supabase
    .from("purchase_orders")
    .select("amount")
    .is("grn_date", null)
    .gt("amount", 0);

  const poOutflow = (unpaidPOs || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);

  // Outflows: statutory dues in next 30 days
  const { data: statutory } = await supabase
    .from("finance_statutory")
    .select("filing_type, due_date, notes")
    .in("status", ["upcoming", "pending"])
    .gte("due_date", today)
    .lte("due_date", thirtyDaysLater);

  const statutoryOutflow = 0; // Statutory table doesn't store amounts directly

  // Outflows: estimated labour (from weekly manpower × 4 weeks)
  const { data: manpower } = await supabase
    .from("weekly_manpower_plans")
    .select("total_workers")
    .order("week_start", { ascending: false })
    .limit(1);

  const weeklyWorkers = manpower?.[0]?.total_workers || 0;
  const labourOutflow = weeklyWorkers * 500 * 6 * 4; // ₹500/day × 6 days × 4 weeks

  const totalOutflows = poOutflow + statutoryOutflow + labourOutflow;
  const netPosition = totalInflows - totalOutflows;

  const status = netPosition > 0 ? "Healthy ✅" : netPosition > -500000 ? "Watch ⚠️" : "Critical 🔴";

  // Find next large outflow
  const nextLargeOutflow = (milestones || [])
    .sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0))[0];

  const weekLabel = `${now.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;

  const body = `30-Day Cash Flow Forecast — Week of ${weekLabel}:
Expected inflows: ₹${Math.round(totalInflows).toLocaleString()} (from ${(milestones || []).length} billing milestones)
Expected outflows: ₹${Math.round(totalOutflows).toLocaleString()} (POs: ₹${Math.round(poOutflow).toLocaleString()} | Statutory: TBD | Labour: ₹${Math.round(labourOutflow).toLocaleString()})
Net position: ₹${Math.round(netPosition).toLocaleString()} — ${status}${nextLargeOutflow ? `\nNext large inflow: ₹${Math.round(nextLargeOutflow.amount).toLocaleString()} due ${nextLargeOutflow.due_date} (${nextLargeOutflow.milestone_description})` : ""}`;

  // Send to Finance Director + MD
  const { data: recipients } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .in("role", ["finance_director", "managing_director"])
    .eq("is_active", true);

  for (const u of recipients || []) {
    await supabase.from("notifications").insert({
      recipient_id: u.auth_user_id,
      title: "30-Day Cash Flow Forecast",
      body,
      category: "cashflow_forecast",
      type: "cashflow_forecast",
      content: body,
    });
  }

  return `Cash flow forecast sent — net: ₹${Math.round(netPosition).toLocaleString()} (${status})`;
}

/* ───────────── AGENT 12 — STATUTORY COMPLIANCE REMINDER ───────────── */
async function runStatutoryReminder(supabase: any): Promise<string> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Get all upcoming/pending statutory items
  const { data: items } = await supabase
    .from("finance_statutory")
    .select("id, filing_type, due_date, status, notes")
    .in("status", ["upcoming", "pending"])
    .gte("due_date", today);

  if (!items?.length) return "No upcoming statutory deadlines";

  // Get finance/accounts users
  const { data: recipients } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .in("role", ["finance_director", "accounts_manager"])
    .eq("is_active", true);

  const alerts: string[] = [];

  for (const item of items) {
    const dueDate = new Date(item.due_date);
    const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

    // Determine reminder thresholds based on filing type
    let shouldAlert = false;
    if (item.filing_type.toLowerCase().includes("annual") || 
        item.filing_type.toLowerCase().includes("factory act") || 
        item.filing_type.toLowerCase().includes("shops")) {
      // Annual/renewal: alert at 30 days and 7 days
      shouldAlert = daysRemaining === 30 || daysRemaining === 7;
    } else if (item.filing_type.toLowerCase().includes("quarterly")) {
      // Quarterly: alert at 15 days and 7 days
      shouldAlert = daysRemaining === 15 || daysRemaining === 7;
    } else {
      // Monthly (TDS, GSTR-1, GSTR-3B): alert at 7 days and 2 days
      shouldAlert = daysRemaining === 7 || daysRemaining === 2;
    }

    if (shouldAlert) {
      const dueDateStr = dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      const body = `Statutory Reminder — ${item.filing_type} is due on ${dueDateStr} (${daysRemaining} days remaining).${item.notes ? ` Notes: ${item.notes}` : ""} Last status: ${item.status}.`;

      for (const u of recipients || []) {
        await supabase.from("notifications").insert({
          recipient_id: u.auth_user_id,
          title: `Statutory Reminder — ${item.filing_type}`,
          body,
          category: "statutory_reminder",
          type: "statutory_reminder",
          content: body,
        });
      }
      alerts.push(item.filing_type);
    }
  }

  return alerts.length ? `Reminders sent for: ${alerts.join(", ")}` : "No statutory reminders due today";
}

/* ───────────── AGENT 13 — LOST DEAL PATTERN ANALYST ───────────── */
async function runLostDealPatternAnalyst(supabase: any): Promise<string> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data: lostDeals } = await supabase
    .from("sales_deals")
    .select("id, deal_name, stage, client_type, lead_source, deal_value, loss_reason, assigned_to, location, updated_at")
    .eq("status", "lost")
    .gte("updated_at", ninetyDaysAgo);

  if (!lostDeals?.length) return "No lost deals in the past 90 days";

  // Also get won deals for comparison
  const { data: wonDeals } = await supabase
    .from("sales_deals")
    .select("id, client_type, lead_source, deal_value")
    .eq("status", "won")
    .gte("updated_at", ninetyDaysAgo);

  const totalLost = lostDeals.length;
  const totalWon = (wonDeals || []).length;

  // Most common loss reason
  const reasonCounts: Record<string, number> = {};
  for (const d of lostDeals) {
    const r = d.loss_reason || "Not specified";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  }
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  const topReasonPct = Math.round((topReason[1] / totalLost) * 100);

  // Stage where most deals lost
  const stageCounts: Record<string, number> = {};
  for (const d of lostDeals) {
    const s = d.stage || "Unknown";
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  }
  const topStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0];

  // Client type win rates
  const clientTypeLost: Record<string, number> = {};
  const clientTypeWon: Record<string, number> = {};
  for (const d of lostDeals) { clientTypeLost[d.client_type || "Unknown"] = (clientTypeLost[d.client_type || "Unknown"] || 0) + 1; }
  for (const d of wonDeals || []) { clientTypeWon[d.client_type || "Unknown"] = (clientTypeWon[d.client_type || "Unknown"] || 0) + 1; }
  const allClientTypes = new Set([...Object.keys(clientTypeLost), ...Object.keys(clientTypeWon)]);
  let worstClientType = "";
  let worstWinRate = 100;
  for (const ct of allClientTypes) {
    const won = clientTypeWon[ct] || 0;
    const lost = clientTypeLost[ct] || 0;
    const rate = (won / (won + lost)) * 100;
    if (rate < worstWinRate) { worstWinRate = rate; worstClientType = ct; }
  }

  // Lead source conversion rates
  const srcLost: Record<string, number> = {};
  const srcWon: Record<string, number> = {};
  for (const d of lostDeals) { srcLost[d.lead_source || "Unknown"] = (srcLost[d.lead_source || "Unknown"] || 0) + 1; }
  for (const d of wonDeals || []) { srcWon[d.lead_source || "Unknown"] = (srcWon[d.lead_source || "Unknown"] || 0) + 1; }
  const allSrcs = new Set([...Object.keys(srcLost), ...Object.keys(srcWon)]);
  let worstSrc = "";
  let worstSrcRate = 100;
  for (const s of allSrcs) {
    const won = srcWon[s] || 0;
    const lost = srcLost[s] || 0;
    const rate = (won / (won + lost)) * 100;
    if (rate < worstSrcRate) { worstSrcRate = rate; worstSrc = s; }
  }

  // Average deal size comparison
  const avgLost = lostDeals.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) / totalLost;
  const avgWon = totalWon > 0 ? (wonDeals || []).reduce((s: number, d: any) => s + (d.deal_value || 0), 0) / totalWon : 0;

  const body = `Lost Deal Insights (past 90 days) — ${totalLost} deals lost:
• Most common reason: ${topReason[0]} (${topReasonPct}%)
• Most deals lost at: ${topStage[0]} stage (${topStage[1]} deals)
• ${worstClientType} has ${Math.round(worstWinRate)}% win rate — lowest in portfolio
• ${worstSrc} leads converting at ${Math.round(worstSrcRate)}% — consider reviewing investment
• Avg deal size: Lost ₹${Math.round(avgLost).toLocaleString()} vs Won ₹${Math.round(avgWon).toLocaleString()}`;

  const { data: recipients } = await supabase
    .from("profiles")
    .select("auth_user_id")
    .in("role", ["sales_director", "managing_director"])
    .eq("is_active", true);

  for (const u of recipients || []) {
    await supabase.from("notifications").insert({
      recipient_id: u.auth_user_id,
      title: "Lost Deal Insights — Fortnightly Report",
      body, category: "lost_deal_pattern", type: "lost_deal_pattern", content: body,
    });
  }

  return `Lost deal report sent — ${totalLost} deals analysed`;
}

/* ───────────── AGENT 14 — DEAL STAGNATION ALERT ───────────── */
async function runDealStagnationAlert(supabase: any): Promise<string> {
  const thresholds: Record<string, number> = {
    "B2B": 45, "Corporate": 45,
    "B2C": 90, "Residential": 90,
    "Resort": 180, "Hospitality": 180,
  };
  const defaultThreshold = 60;

  const { data: deals } = await supabase
    .from("sales_deals")
    .select("id, deal_name, stage, client_type, assigned_to, last_stage_change, updated_at")
    .not("status", "in", '("won","lost")');

  if (!deals?.length) return "No active deals to check";

  const now = Date.now();
  const alerts: string[] = [];

  const stageSuggestions: Record<string, string> = {
    "Inquiry": "Qualify the lead — schedule a discovery call.",
    "Site Visit": "Schedule experience centre visit.",
    "Proposal": "Follow up on quotation status.",
    "Negotiation": "Escalate pricing discussion to director.",
    "Closing": "Confirm final terms and prepare handover docs.",
  };

  const { data: salesUsers } = await supabase
    .from("profiles")
    .select("auth_user_id, role")
    .in("role", ["sales_director", "managing_director", "sales_executive"])
    .eq("is_active", true);

  const johnIds = (salesUsers || []).filter((u: any) => u.role === "sales_director").map((u: any) => u.auth_user_id);
  const mdIds = (salesUsers || []).filter((u: any) => u.role === "managing_director").map((u: any) => u.auth_user_id);

  for (const deal of deals) {
    const lastChange = deal.last_stage_change || deal.updated_at;
    if (!lastChange) continue;
    const daysSince = Math.floor((now - new Date(lastChange).getTime()) / 86400000);
    const threshold = thresholds[deal.client_type] || defaultThreshold;

    if (daysSince > threshold) {
      const suggestion = stageSuggestions[deal.stage] || "Review deal status and next steps.";
      const body = `${deal.deal_name} — ${deal.client_type || "Unknown"} has been in ${deal.stage} for ${daysSince} days (threshold: ${threshold} days). Last activity: ${new Date(lastChange).toLocaleDateString("en-IN")}. Recommended: ${suggestion}`;

      // Notify assigned salesperson + John
      const recipients = [...johnIds];
      if (deal.assigned_to) recipients.push(deal.assigned_to);

      // Escalate at 2× threshold
      if (daysSince > threshold * 2) {
        recipients.push(...mdIds);
      }

      const unique = [...new Set(recipients)];
      for (const rid of unique) {
        await supabase.from("notifications").insert({
          recipient_id: rid,
          title: `Deal Stagnation — ${deal.deal_name}`,
          body, category: "deal_stagnation", type: "deal_stagnation", content: body,
        });
      }
      alerts.push(deal.deal_name);
    }
  }

  return alerts.length ? `Stagnation alerts: ${alerts.join(", ")}` : "No stagnant deals";
}

/* ───────────── AGENT 15 — WEEKLY COACHING DIGEST ───────────── */
async function runWeeklyCoachingDigest(supabase: any): Promise<string> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Get all sales reps
  const { data: salesReps } = await supabase
    .from("profiles")
    .select("auth_user_id, full_name, role")
    .in("role", ["sales_executive", "sales_director"])
    .eq("is_active", true);

  if (!salesReps?.length) return "No sales reps found";

  const johnIds = (salesReps || []).filter((u: any) => u.role === "sales_director").map((u: any) => u.auth_user_id);

  const teamLines: string[] = [];
  let teamWon = 0, teamLost = 0, teamPipelineAdded = 0;

  for (const rep of salesReps) {
    // Deals won this week
    const { data: won } = await supabase.from("sales_deals").select("id, deal_value")
      .eq("assigned_to", rep.auth_user_id).eq("status", "won").gte("updated_at", weekAgo);
    // Deals lost this week
    const { data: lost } = await supabase.from("sales_deals").select("id")
      .eq("assigned_to", rep.auth_user_id).eq("status", "lost").gte("updated_at", weekAgo);
    // Stage changes this week (deals advanced)
    const { data: advanced } = await supabase.from("sales_deals").select("id")
      .eq("assigned_to", rep.auth_user_id).gte("last_stage_change", weekAgo)
      .not("status", "in", '("won","lost")');
    // New leads this week
    const { data: newLeads } = await supabase.from("sales_deals").select("id, deal_value")
      .eq("assigned_to", rep.auth_user_id).gte("created_at", weekAgo);
    // EC visits
    const { data: visits } = await supabase.from("experience_centre_visits").select("id")
      .eq("hosted_by", rep.auth_user_id).gte("visit_date", weekAgo);

    const wonCount = (won || []).length;
    const wonValue = (won || []).reduce((s: number, d: any) => s + (d.deal_value || 0), 0);
    const lostCount = (lost || []).length;
    const advancedCount = (advanced || []).length;
    const newLeadCount = (newLeads || []).length;
    const pipelineAdded = (newLeads || []).reduce((s: number, d: any) => s + (d.deal_value || 0), 0);
    const visitCount = (visits || []).length;

    teamWon += wonCount;
    teamLost += lostCount;
    teamPipelineAdded += pipelineAdded;

    const card = `${rep.full_name || "Rep"}:
🏆 Won: ${wonCount} (₹${wonValue.toLocaleString()}) | ❌ Lost: ${lostCount}
📊 Deals advanced: ${advancedCount} | 🆕 New leads: ${newLeadCount}
🏢 EC Visits: ${visitCount} | 💰 Pipeline added: ₹${pipelineAdded.toLocaleString()}`;

    teamLines.push(card);

    // Send individual card to each rep (except director who gets full summary)
    if (!johnIds.includes(rep.auth_user_id)) {
      await supabase.from("notifications").insert({
        recipient_id: rep.auth_user_id,
        title: "Your Weekly Sales Summary",
        body: card, category: "weekly_coaching", type: "weekly_coaching", content: card,
      });
    }
  }

  // Team summary for John
  const teamSummary = `Weekly Sales Digest — Team Summary:
🏆 Total Won: ${teamWon} | ❌ Total Lost: ${teamLost}
💰 Pipeline Added: ₹${teamPipelineAdded.toLocaleString()}
---
${teamLines.join("\n---\n")}`;

  for (const jid of johnIds) {
    await supabase.from("notifications").insert({
      recipient_id: jid,
      title: "Weekly Sales Team Digest",
      body: teamSummary, category: "weekly_coaching", type: "weekly_coaching", content: teamSummary,
    });
  }

  // Also send to MD
  const { data: mdUsers } = await supabase.from("profiles").select("auth_user_id")
    .eq("role", "managing_director").eq("is_active", true);
  for (const u of mdUsers || []) {
    await supabase.from("notifications").insert({
      recipient_id: u.auth_user_id,
      title: "Weekly Sales Team Digest",
      body: teamSummary, category: "weekly_coaching", type: "weekly_coaching", content: teamSummary,
    });
  }

  return `Coaching digest sent for ${salesReps.length} reps`;
}

/* ───────────── AGENT 16 — LONG LEAVE EARLY WARNING ───────────── */
async function runLongLeaveEarlyWarning(supabase: any): Promise<string> {
  const now = new Date();
  const twentyOneDaysLater = new Date(now.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  const alerts: string[] = [];

  // Get MD + Planning Engineer for notifications
  const { data: notifyUsers } = await supabase.from("profiles").select("auth_user_id, role")
    .in("role", ["managing_director", "planning_engineer"]).eq("is_active", true);
  const recipientIds = (notifyUsers || []).map((u: any) => u.auth_user_id);

  // Part 1: Approved leave requests for 5+ consecutive days starting within 21 days
  const { data: leaveRequests } = await supabase
    .from("leave_requests")
    .select("id, user_id, start_date, end_date, leave_type, status")
    .eq("status", "approved")
    .gte("start_date", today)
    .lte("start_date", twentyOneDaysLater);

  for (const leave of leaveRequests || []) {
    const startD = new Date(leave.start_date);
    const endD = new Date(leave.end_date);
    const days = Math.ceil((endD.getTime() - startD.getTime()) / 86400000) + 1;

    if (days >= 5) {
      // Get user details
      const { data: profile } = await supabase.from("profiles").select("full_name, role")
        .eq("auth_user_id", leave.user_id).single();

      // Check if they are primary responsible for any active project
      const { data: projectAssignments } = await supabase.from("projects").select("id, name")
        .or(`site_lead.eq.${leave.user_id},factory_supervisor.eq.${leave.user_id},project_manager.eq.${leave.user_id}`)
        .eq("status", "active");

      const projectList = (projectAssignments || []).map((p: any) => p.name).join(", ") || "No active project assignments";

      const body = `${profile?.full_name || "Employee"} (${profile?.role || "unknown role"}) will be on leave from ${leave.start_date} to ${leave.end_date} (${days} days). They are primary responsible for: ${projectList}. Arrange coverage before ${leave.start_date}.`;

      for (const rid of recipientIds) {
        await supabase.from("notifications").insert({
          recipient_id: rid,
          title: `Long Leave Warning — ${profile?.full_name || "Employee"}`,
          body, category: "long_leave_warning", type: "long_leave_warning", content: body,
        });
      }
      alerts.push(profile?.full_name || leave.user_id);
    }
  }

  // Part 2: Unplanned absence — 3+ days absent in past week without approved leave
  const { data: allActiveUsers } = await supabase.from("profiles").select("auth_user_id, full_name, role, reporting_manager_id")
    .eq("is_active", true);

  for (const user of allActiveUsers || []) {
    // Count attendance records in past 7 days
    const { data: attendance } = await supabase.from("attendance_records").select("id")
      .eq("user_id", user.auth_user_id)
      .gte("date", weekAgo)
      .lte("date", today);

    // Count approved leaves in same period
    const { data: approvedLeaves } = await supabase.from("leave_requests").select("id")
      .eq("user_id", user.auth_user_id).eq("status", "approved")
      .lte("start_date", today).gte("end_date", weekAgo);

    const workDays = 6; // 6-day work week
    const daysPresent = (attendance || []).length;
    const daysOnLeave = (approvedLeaves || []).length;
    const unaccountedAbsent = workDays - daysPresent - daysOnLeave;

    if (unaccountedAbsent >= 3) {
      // Check project responsibilities
      const { data: projects } = await supabase.from("projects").select("name")
        .or(`site_lead.eq.${user.auth_user_id},factory_supervisor.eq.${user.auth_user_id},project_manager.eq.${user.auth_user_id}`)
        .eq("status", "active");

      const projectList = (projects || []).map((p: any) => p.name).join(", ") || "None";
      const managerNote = user.reporting_manager_id ? ` Please clarify with their reporting manager.` : "";

      const body = `⚠️ ${user.full_name || "Employee"} has been absent ${unaccountedAbsent} days in the past week without approved leave. Responsibilities: ${projectList}.${managerNote}`;

      for (const rid of recipientIds) {
        await supabase.from("notifications").insert({
          recipient_id: rid,
          title: `Unplanned Absence — ${user.full_name || "Employee"}`,
          body, category: "long_leave_warning", type: "long_leave_warning", content: body,
        });
      }
      alerts.push(`${user.full_name} (unplanned)`);
    }
  }

  return alerts.length ? `Leave warnings sent: ${alerts.join(", ")}` : "No long leave concerns";
}
