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
  const R = 6371000; // metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
