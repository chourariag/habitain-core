import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Info, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import type { AppRole } from "@/lib/roles";

type LineKind = "done" | "action" | "info";
interface BriefLine {
  kind: LineKind;
  text: string;
  to?: string;
}

interface Props {
  userRole: AppRole | null;
  userId: string | null;
  displayName?: string;
}

// Roles supported by the brief
const SUPPORTED: AppRole[] = [
  "production_head", "factory_floor_supervisor", "fabrication_foreman",
  "electrical_installer", "elec_plumbing_installer",
  "site_installation_mgr", "site_engineer", "delivery_rm_lead",
  "planning_engineer",
  "procurement", "stores_executive",
  // Phase 2
  "finance_director", "finance_manager", "accounts_executive",
  "sales_director",
  "qc_inspector",
  "principal_architect", "project_architect", "structural_architect", "architecture_director",
  "super_admin", "managing_director",
  // New roles
  "procurement_assistant" as AppRole,
  "hr_admin" as AppRole, "hr_executive",
  "marketing" as AppRole,
  "sales_executive" as AppRole,
  "head_of_projects" as AppRole,
  "planning_head" as AppRole,
];

const dismissKey = (uid: string) => `daily-brief-dismissed:${uid}:${new Date().toISOString().slice(0, 10)}`;

function isBeforeCutoff() {
  return new Date().getHours() < 10;
}

async function buildProductionBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [modulesRes, baysRes, tasksRes, ncrsRes, materialsRes] = await Promise.all([
    supabase.from("modules").select("id, current_stage").not("current_stage", "in", "(Dispatched,Installed)"),
    supabase.from("bay_assignments").select("bay_number"),
    supabase.from("project_tasks").select("id, planned_finish_date, status").lte("planned_finish_date", today).neq("status", "Completed"),
    supabase.from("ncr_register").select("id, status").eq("status", "Open"),
    supabase.from("material_requests" as any).select("id, project_id, projects(name)").eq("expected_delivery_date", today),
  ]);
  const overdue = (tasksRes.data || []).filter((t: any) => t.planned_finish_date < today).length;
  const dueToday = (tasksRes.data || []).filter((t: any) => t.planned_finish_date === today).length;
  const projectNames = Array.from(new Set((materialsRes.data || []).map((m: any) => m.projects?.name).filter(Boolean))).slice(0, 2).join(", ");
  return [
    { kind: "info", text: `Factory today: ${modulesRes.data?.length || 0} modules in progress across ${baysRes.data?.length || 0} bays`, to: "/factory/floor-map" },
    { kind: dueToday > 0 ? "action" : "done", text: `Your tasks due today: ${dueToday}`, to: "/dashboard" },
    { kind: overdue > 0 ? "action" : "done", text: `Overdue from yesterday: ${overdue} ${overdue === 1 ? "task" : "tasks"}`, to: "/production" },
    { kind: "info", text: `Materials arriving today: ${materialsRes.data?.length || 0}${projectNames ? ` for ${projectNames}` : ""}`, to: "/procurement" },
    { kind: (ncrsRes.data?.length || 0) > 0 ? "action" : "done", text: `NCRs pending your action: ${ncrsRes.data?.length || 0}`, to: "/qc" },
  ];
}

async function buildSiteBrief(uid: string): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, punchRes, materialsRes] = await Promise.all([
    supabase.from("project_tasks").select("id, task_name, planned_finish_date, status, projects(name)").lte("planned_finish_date", today).neq("status", "Completed"),
    supabase.from("punch_list_items" as any).select("id, status").neq("status", "Closed"),
    supabase.from("material_requests" as any).select("id").eq("expected_delivery_date", today),
  ]);
  const overdue = (tasksRes.data || []).filter((t: any) => t.planned_finish_date < today).length;
  const todayTasks = (tasksRes.data || []).filter((t: any) => t.planned_finish_date === today);
  const projectName = (todayTasks[0] as any)?.projects?.name || "—";
  const taskNames = todayTasks.slice(0, 2).map((t: any) => t.task_name).join(", ") || "no tasks";
  return [
    { kind: "info", text: `Site today: ${projectName} — ${taskNames}`, to: "/site-hub" },
    { kind: overdue > 0 ? "action" : "done", text: `Overdue tasks from yesterday: ${overdue}`, to: "/site-hub" },
    { kind: "info", text: `Materials expected on site today: ${materialsRes.data?.length || 0}`, to: "/site-hub" },
    { kind: (punchRes.data?.length || 0) > 0 ? "action" : "done", text: `Pending punch list items: ${punchRes.data?.length || 0}`, to: "/site-hub" },
    { kind: "action", text: "Submit site diary by 7pm", to: "/site-hub" },
  ];
}

async function buildPlanningBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [projectsRes, tasksRes, materialsRes, dispatchRes] = await Promise.all([
    supabase.from("projects").select("id").neq("status", "Completed"),
    supabase.from("project_tasks").select("id, planned_finish_date, status, delay_days").neq("status", "Completed"),
    supabase.from("material_requests" as any).select("id, expected_delivery_date").lt("expected_delivery_date", today).neq("status", "Delivered"),
    supabase.from("dispatch_packs").select("id, dispatch_date").gte("dispatch_date", today).lte("dispatch_date", in7),
  ]);
  const dueToday = (tasksRes.data || []).filter((t: any) => t.planned_finish_date === today).length;
  const redFlags = (tasksRes.data || []).filter((t: any) => (t.delay_days || 0) > 2).length;
  const yestIncomplete = (tasksRes.data || []).filter((t: any) => t.planned_finish_date < today).length;
  return [
    { kind: "info", text: `Projects active: ${projectsRes.data?.length || 0} — ${dueToday} tasks due today`, to: "/projects" },
    { kind: redFlags > 0 ? "action" : "done", text: `Schedule red flags: ${redFlags} tasks running over benchmark`, to: "/production" },
    { kind: (materialsRes.data?.length || 0) > 0 ? "action" : "done", text: `Materials at risk: ${materialsRes.data?.length || 0} items overdue delivery`, to: "/procurement" },
    { kind: "info", text: `Dispatch planned: ${dispatchRes.data?.length || 0} dispatches in next 7 days`, to: "/site-hub" },
    { kind: yestIncomplete > 0 ? "action" : "done", text: `Delays to log from yesterday: ${yestIncomplete} incomplete tasks`, to: "/production" },
  ];
}

async function buildProcurementBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [overdueRes, todayRes, posRes, weekRes] = await Promise.all([
    supabase.from("material_requests" as any).select("id").lt("expected_delivery_date", today).neq("status", "Delivered"),
    supabase.from("material_requests" as any).select("id").eq("expected_delivery_date", today),
    supabase.from("purchase_orders" as any).select("id, status").eq("status", "Pending Approval"),
    supabase.from("material_requests" as any).select("id").gte("expected_delivery_date", today).lte("expected_delivery_date", in7),
  ]);
  return [
    { kind: (overdueRes.data?.length || 0) > 0 ? "action" : "done", text: `Materials overdue: ${overdueRes.data?.length || 0} items — action needed today`, to: "/procurement" },
    { kind: "info", text: `Materials arriving today: ${todayRes.data?.length || 0} — confirm receipt`, to: "/procurement" },
    { kind: (posRes.data?.length || 0) > 0 ? "action" : "done", text: `POs pending approval: ${posRes.data?.length || 0}`, to: "/procurement" },
    { kind: "info", text: `This week: ${weekRes.data?.length || 0} deliveries expected`, to: "/procurement" },
  ];
}

async function buildFinanceBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [statRes, invRaiseRes, overdueInvRes, bankRes, expRes, poRes] = await Promise.all([
    supabase.from("finance_statutory").select("filing_type, due_date").gte("due_date", today).lte("due_date", in7).neq("status", "Filed").order("due_date").limit(1),
    supabase.from("project_invoices").select("id").eq("status", "Pending").eq("raised_date", today),
    supabase.from("project_invoices").select("amount_outstanding, due_date").lt("due_date", today).gt("amount_outstanding", 0),
    supabase.from("bank_ledger_entries").select("balance, entry_date").order("entry_date", { ascending: false }).limit(1),
    supabase.from("expense_reports").select("id").eq("status", "Pending"),
    supabase.from("purchase_orders" as any).select("id").eq("status", "Pending Approval"),
  ]);
  const stat = statRes.data?.[0] as any;
  const overdueCount = (overdueInvRes.data || []).length;
  const overdueTotal = (overdueInvRes.data || []).reduce((s: number, r: any) => s + Number(r.amount_outstanding || 0), 0);
  const bal = (bankRes.data?.[0] as any)?.balance ?? 0;
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  return [
    { kind: stat ? "action" : "done", text: stat ? `Statutory due this week: ${stat.filing_type} on ${stat.due_date}` : "No statutory filings due this week", to: "/finance" },
    { kind: (invRaiseRes.data?.length || 0) > 0 ? "action" : "info", text: `Invoices to raise today: ${invRaiseRes.data?.length || 0} milestones triggered`, to: "/finance" },
    { kind: overdueCount > 0 ? "action" : "done", text: `Overdue collections: ${overdueCount} invoices, ${inr(overdueTotal)}`, to: "/finance" },
    { kind: "info", text: `Bank balance (last uploaded): ${inr(Number(bal))}`, to: "/finance" },
    { kind: ((expRes.data?.length || 0) + (poRes.data?.length || 0)) > 0 ? "action" : "done", text: `Pending approvals: ${expRes.data?.length || 0} expense reports, ${poRes.data?.length || 0} POs`, to: "/finance" },
  ];
}

async function buildSalesBrief(_uid: string): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const stagnantCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const [activeRes, stagnantRes, followupRes, wonRes, leadsRes] = await Promise.all([
    supabase.from("sales_deals").select("id").not("stage", "in", "(Won,Lost)").eq("is_archived", false),
    supabase.from("sales_deals").select("id").not("stage", "in", "(Won,Lost)").lt("updated_at", stagnantCutoff).eq("is_archived", false),
    supabase.from("sales_deals").select("client_name").eq("next_followup_date", today).eq("is_archived", false),
    supabase.from("sales_deals").select("id").eq("stage", "Won").gte("updated_at", monthStart.toISOString()),
    supabase.from("sales_deals").select("id").gte("created_at", weekStart),
  ]);
  const followupNames = (followupRes.data || []).slice(0, 3).map((d: any) => d.client_name).join(", ") || "none";
  return [
    { kind: "info", text: `Pipeline today: ${activeRes.data?.length || 0} deals active`, to: "/sales" },
    { kind: (stagnantRes.data?.length || 0) > 0 ? "action" : "done", text: `Stagnant deals needing action: ${stagnantRes.data?.length || 0}`, to: "/sales" },
    { kind: (followupRes.data?.length || 0) > 0 ? "action" : "info", text: `Follow-ups due today: ${followupNames}`, to: "/sales" },
    { kind: "info", text: `Deals won this month: ${wonRes.data?.length || 0}`, to: "/sales" },
    { kind: "info", text: `New leads this week: ${leadsRes.data?.length || 0}`, to: "/sales" },
  ];
}

async function buildQCBrief(): Promise<BriefLine[]> {
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [pendingRes, reinspectRes, weekDoneRes, openRes] = await Promise.all([
    supabase.from("qc_inspections").select("id, module_id, modules(module_id)").eq("status", "Pending"),
    supabase.from("ncr_register").select("id").eq("status", "Open").not("fix_timeline_due_date", "is", null),
    supabase.from("qc_inspections").select("id").eq("status", "Passed").gte("submitted_at", weekStart),
    supabase.from("ncr_register").select("id, regression_to_stage").eq("status", "Open"),
  ]);
  const moduleIds = (pendingRes.data || []).slice(0, 3).map((q: any) => q.modules?.module_id || (q.module_id || "").slice(0, 6)).filter(Boolean).join(", ") || "none";
  const stageBreakdown: Record<string, number> = {};
  (openRes.data || []).forEach((n: any) => {
    const k = `Stage ${n.regression_to_stage ?? "?"}`;
    stageBreakdown[k] = (stageBreakdown[k] || 0) + 1;
  });
  const stageList = Object.entries(stageBreakdown).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(", ") || "none";
  return [
    { kind: (pendingRes.data?.length || 0) > 0 ? "action" : "done", text: `Inspections due today: ${pendingRes.data?.length || 0} (${moduleIds})`, to: "/qc" },
    { kind: (reinspectRes.data?.length || 0) > 0 ? "action" : "done", text: `NCRs awaiting re-inspection: ${reinspectRes.data?.length || 0}`, to: "/qc" },
    { kind: "info", text: `Completed inspections this week: ${weekDoneRes.data?.length || 0}`, to: "/qc" },
    { kind: (openRes.data?.length || 0) > 0 ? "action" : "done", text: `Outstanding NCRs by stage: ${stageList}`, to: "/qc" },
  ];
}

async function buildDesignBrief(uid: string): Promise<BriefLine[]> {
  const [dqRes, drawRes, gfcRes] = await Promise.all([
    supabase.from("design_queries").select("id").eq("status", "Open").or(`assigned_architect_id.eq.${uid},assigned_architect_id.is.null`),
    supabase.from("drawings").select("id").eq("status", "Pending Review").eq("is_archived", false),
    supabase.from("gfc_records").select("project_id, projects(name)").is("issued_at", null),
  ]);
  const gfcProjects = Array.from(new Set((gfcRes.data || []).map((g: any) => g.projects?.name).filter(Boolean))).slice(0, 3).join(", ") || "none";
  return [
    { kind: (dqRes.data?.length || 0) > 0 ? "action" : "done", text: `Open DQs requiring your input: ${dqRes.data?.length || 0}`, to: "/design" },
    { kind: (drawRes.data?.length || 0) > 0 ? "action" : "done", text: `Drawings due for review: ${drawRes.data?.length || 0}`, to: "/drawings" },
    { kind: (gfcRes.data?.length || 0) > 0 ? "action" : "done", text: `GFC sign-off pending: ${gfcProjects}`, to: "/design" },
  ];
}

async function buildDirectorBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [projectsRes, ncrsRes, overdueInvRes, escalatedRes, dispatchRes] = await Promise.all([
    supabase.from("projects").select("id").neq("status", "Completed"),
    supabase.from("ncr_register").select("id").eq("status", "Open"),
    supabase.from("project_invoices").select("amount_outstanding").lt("due_date", today).gt("amount_outstanding", 0),
    supabase.from("project_tasks").select("id, delay_days").gt("delay_days", 5).neq("status", "Completed"),
    supabase.from("dispatch_packs").select("id").eq("dispatch_date", today),
  ]);
  const overdueTotal = (overdueInvRes.data || []).reduce((s: number, r: any) => s + Number(r.amount_outstanding || 0), 0);
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  return [
    { kind: "info", text: `Active projects: ${projectsRes.data?.length || 0}`, to: "/projects" },
    { kind: (dispatchRes.data?.length || 0) > 0 ? "info" : "done", text: `Dispatches today: ${dispatchRes.data?.length || 0}`, to: "/site-hub" },
    { kind: (ncrsRes.data?.length || 0) > 0 ? "action" : "done", text: `Open NCRs across factory: ${ncrsRes.data?.length || 0}`, to: "/qc" },
    { kind: overdueTotal > 0 ? "action" : "done", text: `Overdue receivables: ${inr(overdueTotal)}`, to: "/finance" },
    { kind: (escalatedRes.data?.length || 0) > 0 ? "action" : "done", text: `Level 3 escalations: ${escalatedRes.data?.length || 0} — review needed`, to: "/alerts" },
  ];
}

async function buildHRBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [leaveRes, userReqRes, attRes] = await Promise.all([
    supabase.from("leave_requests" as any).select("id").eq("status", "Pending"),
    supabase.from("approval_requests" as any).select("id").in("request_type", ["add_user", "deactivate_user"]).eq("status", "pending"),
    supabase.from("attendance_records" as any).select("id, status").eq("date", today).in("status", ["Absent", "Late"]),
  ]);
  return [
    { kind: (leaveRes.data?.length || 0) > 0 ? "action" : "done", text: `Leave requests pending: ${leaveRes.data?.length || 0}`, to: "/attendance" },
    { kind: (userReqRes.data?.length || 0) > 0 ? "action" : "done", text: `User access requests pending: ${userReqRes.data?.length || 0}`, to: "/admin/users" },
    { kind: (attRes.data?.length || 0) > 0 ? "action" : "done", text: `Attendance exceptions today: ${attRes.data?.length || 0}`, to: "/attendance" },
  ];
}

async function buildMarketingBrief(): Promise<BriefLine[]> {
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [leadsRes, activeRes] = await Promise.all([
    supabase.from("sales_deals").select("id").gte("created_at", weekStart),
    supabase.from("sales_deals").select("id").not("stage", "in", "(Won,Lost)").eq("is_archived", false),
  ]);
  return [
    { kind: "info", text: `Pipeline leads added this week: ${leadsRes.data?.length || 0}`, to: "/sales" },
    { kind: "info", text: `Active deals in pipeline: ${activeRes.data?.length || 0}`, to: "/sales" },
    { kind: "info", text: "Marketing campaign status — review active campaigns", to: "/sales" },
  ];
}

async function buildSalesExecBrief(uid: string): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const stagnantCutoff = new Date(Date.now() - 14 * 86400000).toISOString();
  const [todayRes, followupRes, stagnantRes] = await Promise.all([
    (supabase.from("sales_deals") as any).select("id").eq("owner_id", uid).eq("next_followup_date", today).eq("is_archived", false),
    (supabase.from("sales_deals") as any).select("client_name").eq("owner_id", uid).eq("next_followup_date", today).eq("is_archived", false),
    (supabase.from("sales_deals") as any).select("id").eq("owner_id", uid).not("stage", "in", "(Won,Lost)").lt("updated_at", stagnantCutoff).eq("is_archived", false),
  ]);
  const followupNames = (followupRes.data || []).slice(0, 3).map((d: any) => d.client_name).join(", ") || "none";
  return [
    { kind: (todayRes.data?.length || 0) > 0 ? "action" : "done", text: `Your deals due today: ${todayRes.data?.length || 0}`, to: "/sales" },
    { kind: "info", text: `Follow-ups today: ${followupNames}`, to: "/sales" },
    { kind: (stagnantRes.data?.length || 0) > 0 ? "action" : "done", text: `Your stagnant deals (>14 days): ${stagnantRes.data?.length || 0}`, to: "/sales" },
  ];
}

async function buildHeadOfProjectsBrief(): Promise<BriefLine[]> {
  const today = new Date().toISOString().slice(0, 10);
  const [projectsRes, delaysRes, milestonesRes] = await Promise.all([
    supabase.from("projects").select("id, name, status").neq("status", "Completed"),
    supabase.from("project_tasks").select("id, delay_days").gt("delay_days", 2).neq("status", "Completed"),
    supabase.from("project_tasks").select("id").eq("planned_finish_date", today).neq("status", "Completed"),
  ]);
  return [
    { kind: "info", text: `Active projects under oversight: ${projectsRes.data?.length || 0}`, to: "/projects" },
    { kind: (delaysRes.data?.length || 0) > 0 ? "action" : "done", text: `Tasks delayed >2 days: ${delaysRes.data?.length || 0}`, to: "/production" },
    { kind: "info", text: `Milestones due today: ${milestonesRes.data?.length || 0}`, to: "/projects" },
  ];
}

async function buildSuperAdminBrief(): Promise<BriefLine[]> {
  const [pendingRes, auditRes] = await Promise.all([
    supabase.from("approval_requests" as any).select("id").eq("status", "pending"),
    supabase.from("super_admin_audit_log" as any).select("id").gte("created_at", new Date(Date.now() - 86400000).toISOString()),
  ]);
  return [
    { kind: "info", text: "System health — all services operational", to: "/super-admin" },
    { kind: (pendingRes.data?.length || 0) > 0 ? "action" : "done", text: `Pending Super Admin approvals: ${pendingRes.data?.length || 0}`, to: "/admin/super-admin" },
    { kind: "info", text: `Audit events in last 24h: ${auditRes.data?.length || 0}`, to: "/admin/super-admin" },
  ];
}

async function buildBriefForRole(role: AppRole, uid: string): Promise<BriefLine[]> {
  try {
    if (["production_head", "factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer"].includes(role)) {
      return await buildProductionBrief();
    }
    if (["site_installation_mgr", "site_engineer", "delivery_rm_lead"].includes(role)) {
      return await buildSiteBrief(uid);
    }
    if (role === "planning_engineer" || (role as string) === "planning_head") return await buildPlanningBrief();
    if (["procurement", "stores_executive"].includes(role) || (role as string) === "procurement_assistant") return await buildProcurementBrief();
    if (["finance_director", "finance_manager", "accounts_executive"].includes(role)) return await buildFinanceBrief();
    if (role === "sales_director") return await buildSalesBrief(uid);
    if ((role as string) === "sales_executive") return await buildSalesExecBrief(uid);
    if ((role as string) === "marketing") return await buildMarketingBrief();
    if (["hr_executive"].includes(role) || (role as string) === "hr_admin") return await buildHRBrief();
    if ((role as string) === "head_of_projects") return await buildHeadOfProjectsBrief();
    if (role === "qc_inspector") return await buildQCBrief();
    if (["principal_architect", "project_architect", "structural_architect", "architecture_director"].includes(role)) return await buildDesignBrief(uid);
    if (role === "super_admin") return await buildSuperAdminBrief();
    if (role === "managing_director") return await buildDirectorBrief();
  } catch (e) {
    console.warn("Daily brief fetch error", e);
  }
  return [];
}

export function DailyReadinessBrief({ userRole, userId }: Props) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<BriefLine[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    if (!userRole || !userId) return;
    if (!SUPPORTED.includes(userRole)) return;
    if (!isBeforeCutoff()) return;
    if (localStorage.getItem(dismissKey(userId))) return;
    setVisible(true);
    buildBriefForRole(userRole, userId).then(setLines);
    supabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const raw = data?.display_name || "";
        const first = raw.trim().split(/\s+/)[0] || "";
        setFirstName(first);
      });
  }, [userRole, userId]);

  if (!visible) return null;

  const dismiss = () => {
    if (userId) localStorage.setItem(dismissKey(userId), "1");
    setVisible(false);
  };

  const iconFor = (k: LineKind) =>
    k === "done" ? <CheckCircle2 className="h-4 w-4 text-[#006039] shrink-0" /> :
    k === "action" ? <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> :
    <Info className="h-4 w-4 text-blue-600 shrink-0" />;

  return (
    <Card className="overflow-hidden border-[#006039]/20">
      <div className="bg-[#006039] text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5" />
          <h2 className="text-base font-semibold">
            Good morning{firstName ? ` ${firstName}` : ""} — here is your day
          </h2>
        </div>
        <Button size="icon" variant="ghost" onClick={dismiss} className="h-7 w-7 text-white hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4 space-y-2">
        {lines === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing your brief…
          </div>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No brief items today. Have a great day!</p>
        ) : (
          lines.slice(0, 6).map((l, i) => (
            <button
              key={i}
              onClick={() => l.to && navigate(l.to)}
              className="w-full flex items-start gap-2 text-left text-sm py-1.5 px-2 -mx-2 rounded hover:bg-muted/50 transition-colors"
            >
              {iconFor(l.kind)}
              <span className="flex-1">{l.text}</span>
            </button>
          ))
        )}
      </div>
    </Card>
  );
}
