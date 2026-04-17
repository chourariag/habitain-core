import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertTriangle, Info, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// Roles that get a Phase-1 brief
const SUPPORTED: AppRole[] = [
  "production_head", "factory_floor_supervisor", "fabrication_foreman",
  "electrical_installer", "elec_plumbing_installer",
  "site_installation_mgr", "site_engineer", "delivery_rm_lead",
  "planning_engineer",
  "procurement", "stores_executive",
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
    supabase.from("ncrs" as any).select("id, status").eq("status", "Open"),
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

async function buildBriefForRole(role: AppRole, uid: string): Promise<BriefLine[]> {
  try {
    if (["production_head", "factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer"].includes(role)) {
      return await buildProductionBrief();
    }
    if (["site_installation_mgr", "site_engineer", "delivery_rm_lead"].includes(role)) {
      return await buildSiteBrief(uid);
    }
    if (role === "planning_engineer") return await buildPlanningBrief();
    if (["procurement", "stores_executive"].includes(role)) return await buildProcurementBrief();
  } catch (e) {
    console.warn("Daily brief fetch error", e);
  }
  return [];
}

export function DailyReadinessBrief({ userRole, userId, displayName }: Props) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<BriefLine[] | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!userRole || !userId) return;
    if (!SUPPORTED.includes(userRole)) return;
    if (!isBeforeCutoff()) return;
    if (localStorage.getItem(dismissKey(userId))) return;
    setVisible(true);
    buildBriefForRole(userRole, userId).then(setLines);
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
            Good morning{displayName ? ` ${displayName}` : ""} — here is your day
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
