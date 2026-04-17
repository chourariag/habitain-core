import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Factory, Target, AlertTriangle, TrendingUp, Save, Activity, Layers } from "lucide-react";
import { differenceInDays, startOfMonth, endOfMonth, addDays, subDays } from "date-fns";
import { toast } from "sonner";

const INDOOR_BAYS = 10;
const OUTDOOR_BAYS = 7;
const PANEL_BAYS = 3;
const MODULE_BAYS = 6;

// Map DELAY_CAUSES → bottleneck categories
const CAUSE_TO_CATEGORY: Record<string, string> = {
  "Internal — Material": "Material delays",
  "External — Vendor": "Material delays",
  "Internal — Manpower": "Manpower shortage",
  "Internal — Method": "Manpower shortage",
  "Internal — Equipment": "Equipment / tools",
  "External — Client": "Client decisions",
  "External — Approvals": "Design queries / GFC delays",
  "External — Payment": "Client decisions",
  "External — Weather": "External / weather",
};
const ALL_CATEGORIES = [
  "Material delays", "Manpower shortage", "Design queries / GFC delays",
  "Rework / NCR", "Equipment / tools", "Client decisions", "External / weather",
];

interface BottleneckRow {
  category: string;
  count: number;
  totalDays: number;
  avgDays: number;
}

interface BayRow {
  bay_type: string;
  bay_number: number;
  module_id: string | null;
  project_id: string | null;
  current_stage: string | null;
  project_name: string | null;
  assigned_at: string | null;
}

const ALLOWED = [
  "production_head", "head_operations", "managing_director", "super_admin",
  "finance_director", "sales_director", "architecture_director", "planning_engineer",
];

const EDITORS = [
  "production_head", "head_operations", "managing_director", "super_admin",
  "finance_director", "sales_director", "architecture_director",
];

type RiskLevel = "Low" | "Medium" | "High";
type RiskColor = "green" | "amber" | "red";

interface ProjectRisk {
  id: string;
  name: string;
  client_name: string | null;
  est_completion: string | null;
  daysRemaining: number | null;
  pctComplete: number;
  materialOverdue: number;
  openDQs: number;
  manpowerGap: number;
  overall: RiskLevel;
  overallColor: RiskColor;
}

export default function CapacityPlanning() {
  const { role, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [throughput, setThroughput] = useState({
    inProduction: 0,
    activeProjects: 0,
    completedThisMonth: 0,
    dispatchedThisMonth: 0,
    plannedNext30: 0,
    estCapacityPerMonth: 0,
  });
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckRow[]>([]);
  const [overdueMaterialCount, setOverdueMaterialCount] = useState(0);
  const [bays, setBays] = useState<BayRow[]>([]);
  const [settings, setSettings] = useState({
    panel_bay_cycle_days: 14,
    module_bay_stage_days: 5,
    active_days_per_week: 6,
    target_modules_per_month: 20,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const canEdit = EDITORS.includes(role ?? "");
  const canView = ALLOWED.includes(role ?? "");

  useEffect(() => {
    if (!roleLoading && canView) loadAll();
  }, [roleLoading, canView]);

  async function loadAll() {
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    const next30 = addDays(new Date(), 30).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [
      { data: settingsRow },
      { data: activeModules },
      { data: completedMods },
      { data: dispatchLogs },
      { data: plannedSchedule },
      { data: projects },
      { data: tasks },
      { data: dqs },
      { data: matReqs },
    ] = await Promise.all([
      supabase.from("capacity_forecast_settings").select("*").eq("singleton", true).maybeSingle(),
      supabase.from("modules").select("id, project_id, current_stage, production_status")
        .eq("is_archived", false).not("production_status", "in", "(completed,dispatched)"),
      supabase.from("modules").select("id, updated_at, production_status")
        .eq("is_archived", false).eq("production_status", "completed")
        .gte("updated_at", monthStart).lte("updated_at", monthEnd),
      supabase.from("dispatch_log").select("id, dispatch_date")
        .gte("dispatch_date", monthStart.slice(0, 10)).lte("dispatch_date", monthEnd.slice(0, 10)),
      supabase.from("module_schedule").select("id, target_end")
        .gte("target_end", today).lte("target_end", next30),
      supabase.from("projects").select("id, name, client_name, est_completion, status")
        .eq("is_archived", false).neq("status", "completed"),
      supabase.from("project_tasks").select("project_id, planned_finish_date, actual_finish_date, completion_percentage, status, delay_cause, delay_days"),
      supabase.from("design_queries").select("project_id, status, created_at, resolved_at").eq("is_archived", false),
      supabase.from("material_requests").select("project_id, status, urgency, created_at, received_at").eq("is_archived", false),
    ]);

    // Bay assignments — latest per bay (already ordered by assigned_at via subquery; we dedupe client-side)
    const { data: bayRows } = await supabase
      .from("bay_assignments")
      .select("bay_type, bay_number, module_id, project_id, assigned_at")
      .order("assigned_at", { ascending: false });

    // Pull module stage + project name for each unique bay
    const seen = new Set<string>();
    const latestBays: { bay_type: string; bay_number: number; module_id: string; project_id: string | null; assigned_at: string | null }[] = [];
    for (const b of bayRows ?? []) {
      const key = `${b.bay_type}-${b.bay_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      latestBays.push(b as any);
    }
    const moduleIds = latestBays.map(b => b.module_id).filter(Boolean);
    const projIds = latestBays.map(b => b.project_id).filter(Boolean) as string[];
    const [{ data: bayMods }, { data: bayProjs }, { data: ncrTasks }] = await Promise.all([
      moduleIds.length
        ? supabase.from("modules").select("id, current_stage, production_status").in("id", moduleIds)
        : Promise.resolve({ data: [] as any[] }),
      projIds.length
        ? supabase.from("projects").select("id, name").in("id", projIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("project_tasks").select("delay_days, delay_cause")
        .or("task_name.ilike.%rework%,task_name.ilike.%ncr%,delay_cause.ilike.%rework%"),
    ]);
    const modMap = new Map((bayMods ?? []).map((m: any) => [m.id, m]));
    const projMap = new Map((bayProjs ?? []).map((p: any) => [p.id, p.name]));
    const enrichedBays: BayRow[] = latestBays.map(b => {
      const mod: any = modMap.get(b.module_id);
      const isOccupied = mod && mod.production_status !== "completed" && mod.production_status !== "dispatched";
      return {
        bay_type: b.bay_type,
        bay_number: b.bay_number,
        module_id: isOccupied ? b.module_id : null,
        project_id: isOccupied ? b.project_id : null,
        current_stage: isOccupied ? mod?.current_stage ?? null : null,
        project_name: isOccupied ? (projMap.get(b.project_id ?? "") ?? null) : null,
        assigned_at: isOccupied ? b.assigned_at : null,
      };
    });
    setBays(enrichedBays);

    if (settingsRow) {
      setSettings({
        panel_bay_cycle_days: Number(settingsRow.panel_bay_cycle_days),
        module_bay_stage_days: Number(settingsRow.module_bay_stage_days),
        active_days_per_week: Number(settingsRow.active_days_per_week),
        target_modules_per_month: Number(settingsRow.target_modules_per_month),
      });
    }

    const inProduction = activeModules?.length ?? 0;
    const activeProjects = new Set((activeModules ?? []).map(m => m.project_id)).size;
    const completedThisMonth = completedMods?.length ?? 0;
    const dispatchedThisMonth = dispatchLogs?.length ?? 0;
    const plannedNext30 = plannedSchedule?.length ?? 0;

    // Estimated capacity = avg of last month dispatch + completed extrapolated
    const estCapacityPerMonth = Math.max(completedThisMonth, dispatchedThisMonth, Math.round(plannedNext30 * 0.7));

    setThroughput({
      inProduction, activeProjects, completedThisMonth, dispatchedThisMonth,
      plannedNext30, estCapacityPerMonth,
    });

    // Build risk matrix
    const tasksByProj = new Map<string, typeof tasks>();
    (tasks ?? []).forEach(t => {
      const arr = tasksByProj.get(t.project_id) ?? [];
      arr.push(t);
      tasksByProj.set(t.project_id, arr);
    });

    const dqByProj = new Map<string, number>();
    (dqs ?? []).forEach(d => {
      if (d.status !== "resolved" && d.status !== "closed") {
        dqByProj.set(d.project_id, (dqByProj.get(d.project_id) ?? 0) + 1);
      }
    });

    const matOverdueByProj = new Map<string, number>();
    const matPendingByProj = new Map<string, number>();
    (matReqs ?? []).forEach(m => {
      if (!m.project_id) return;
      const isPending = m.status !== "received" && m.status !== "rejected" && m.status !== "cancelled";
      if (isPending) {
        matPendingByProj.set(m.project_id, (matPendingByProj.get(m.project_id) ?? 0) + 1);
        // overdue = pending > 7 days
        if (m.created_at && differenceInDays(new Date(), new Date(m.created_at)) > 7) {
          matOverdueByProj.set(m.project_id, (matOverdueByProj.get(m.project_id) ?? 0) + 1);
        }
      }
    });

    const projectRisks: ProjectRisk[] = (projects ?? []).map(p => {
      const projTasks = tasksByProj.get(p.id) ?? [];
      const totalTasks = projTasks.length;
      const completedTasks = projTasks.filter(t => t.completion_percentage === 100).length;
      const pctComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const overdueTasks = projTasks.filter(t =>
        t.completion_percentage < 100 && t.planned_finish_date && new Date(t.planned_finish_date) < new Date()
      ).length;
      const manpowerGap = overdueTasks; // proxy: overdue tasks indicate manpower/scheduling gaps
      const materialOverdue = matOverdueByProj.get(p.id) ?? 0;
      const openDQs = dqByProj.get(p.id) ?? 0;
      const daysRemaining = p.est_completion
        ? differenceInDays(new Date(p.est_completion), new Date()) : null;

      // Risk scoring
      const matRisk = materialOverdue >= 3 ? "red" : materialOverdue >= 1 ? "amber" : "green";
      const dqRisk = openDQs >= 5 ? "red" : openDQs >= 2 ? "amber" : "green";
      const mpRisk = manpowerGap >= 5 ? "red" : manpowerGap >= 2 ? "amber" : "green";
      const dlRisk = daysRemaining !== null && daysRemaining < 7 && pctComplete < 90 ? "red"
        : daysRemaining !== null && daysRemaining < 30 && pctComplete < 70 ? "amber" : "green";

      const allRisks = [matRisk, dqRisk, mpRisk, dlRisk];
      const overallColor: RiskColor = allRisks.includes("red") ? "red"
        : allRisks.includes("amber") ? "amber" : "green";
      const overall: RiskLevel = overallColor === "red" ? "High" : overallColor === "amber" ? "Medium" : "Low";

      return {
        id: p.id, name: p.name, client_name: p.client_name,
        est_completion: p.est_completion, daysRemaining, pctComplete,
        materialOverdue, openDQs, manpowerGap, overall, overallColor,
      };
    }).sort((a, b) => {
      const order = { red: 0, amber: 1, green: 2 };
      return order[a.overallColor] - order[b.overallColor];
    });

    setRisks(projectRisks);

    // Bottleneck analysis — aggregate delay_cause from project_tasks (last 90 days of finished tasks)
    const cutoff = subDays(new Date(), 90);
    const buckets: Record<string, { count: number; days: number }> = {};
    ALL_CATEGORIES.forEach(c => { buckets[c] = { count: 0, days: 0 }; });

    (tasks ?? []).forEach((t: any) => {
      if (!t.delay_cause || !t.delay_days || t.delay_days <= 0) return;
      if (t.actual_finish_date && new Date(t.actual_finish_date) < cutoff) return;
      const cat = CAUSE_TO_CATEGORY[t.delay_cause];
      if (!cat) return;
      buckets[cat].count += 1;
      buckets[cat].days += Number(t.delay_days);
    });
    // Rework / NCR bucket from rework-keyword tasks
    (ncrTasks ?? []).forEach((t: any) => {
      if (!t.delay_days || t.delay_days <= 0) return;
      buckets["Rework / NCR"].count += 1;
      buckets["Rework / NCR"].days += Number(t.delay_days);
    });

    const bnRows: BottleneckRow[] = ALL_CATEGORIES.map(cat => ({
      category: cat,
      count: buckets[cat].count,
      totalDays: buckets[cat].days,
      avgDays: buckets[cat].count > 0 ? Math.round((buckets[cat].days / buckets[cat].count) * 10) / 10 : 0,
    })).sort((a, b) => b.totalDays - a.totalDays);
    setBottlenecks(bnRows);

    // Total overdue materials count for action insight
    let totalOverdue = 0;
    matOverdueByProj.forEach(v => { totalOverdue += v; });
    setOverdueMaterialCount(totalOverdue);

    setLoading(false);
  }

  async function saveSettings() {
    setSavingSettings(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("capacity_forecast_settings")
      .update({ ...settings, updated_by: userData.user?.id, updated_at: new Date().toISOString() })
      .eq("singleton", true);
    setSavingSettings(false);
    if (error) toast.error("Failed to save settings");
    else toast.success("Forecast settings saved");
  }

  // Capacity forecast calculation
  const forecast = useMemo(() => {
    const { module_bay_stage_days, active_days_per_week, target_modules_per_month } = settings;
    const STAGES = 10;
    const MODULE_BAYS = 6;
    const daysPerModule = module_bay_stage_days * STAGES;
    // throughput per bay per month: (active days/week * 4.33) / days per module
    const monthDays = active_days_per_week * 4.33;
    const modulesPerBayPerMonth = monthDays / daysPerModule;
    const achievable = Math.round(MODULE_BAYS * modulesPerBayPerMonth);
    const gap = achievable - target_modules_per_month;
    const extraBayDaysNeeded = gap < 0 ? Math.ceil((Math.abs(gap) * daysPerModule) / 4.33) : 0;
    return { achievable, gap, extraBayDaysNeeded };
  }, [settings]);

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#006039" }} />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          You don't have access to Capacity Planning.
        </CardContent></Card>
      </div>
    );
  }

  const riskBadge = (color: RiskColor, label: string) => {
    const styles = {
      red: { bg: "#FFF0F0", text: "#F40009", border: "#F40009" },
      amber: { bg: "#FFF8E8", text: "#D4860A", border: "#D4860A" },
      green: { bg: "#E8F2ED", text: "#006039", border: "#006039" },
    };
    const s = styles[color];
    return (
      <Badge className="text-xs font-bold" style={{
        backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}`,
      }}>{label}</Badge>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3">
        <Factory className="h-6 w-6" style={{ color: "#006039" }} />
        <h1 className="text-2xl font-display font-bold" style={{ color: "#1A1A1A" }}>Capacity Planning</h1>
      </div>

      {/* Throughput Panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: "#006039" }} />
            Current Throughput
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "In Production", value: throughput.inProduction, sub: `${throughput.activeProjects} projects` },
              { label: "Completed (this month)", value: throughput.completedThisMonth },
              { label: "Dispatched (this month)", value: throughput.dispatchedThisMonth },
              { label: "Planned Next 30 Days", value: throughput.plannedNext30 },
              { label: "Est. Capacity / Month", value: throughput.estCapacityPerMonth, highlight: true },
              { label: "Target / Month", value: settings.target_modules_per_month },
            ].map((s, i) => (
              <div key={i} className="rounded-md p-3 text-center" style={{
                backgroundColor: s.highlight ? "#E8F2ED" : "#F7F7F7",
                border: s.highlight ? "1px solid #006039" : "1px solid #E0E0E0",
              }}>
                <p className="text-2xl font-bold font-display" style={{ color: s.highlight ? "#006039" : "#1A1A1A" }}>
                  {s.value}
                </p>
                <p className="text-[10px] mt-1" style={{ color: "#666" }}>{s.label}</p>
                {s.sub && <p className="text-[10px]" style={{ color: "#999" }}>{s.sub}</p>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Capacity Forecast */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "#006039" }} />
            Capacity Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Panel bay cycle (days/batch)</Label>
              <Input type="number" min={1} disabled={!canEdit} value={settings.panel_bay_cycle_days}
                onChange={(e) => setSettings(s => ({ ...s, panel_bay_cycle_days: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Module bay days per stage</Label>
              <Input type="number" min={1} disabled={!canEdit} value={settings.module_bay_stage_days}
                onChange={(e) => setSettings(s => ({ ...s, module_bay_stage_days: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Active days per week</Label>
              <Input type="number" min={1} max={7} disabled={!canEdit} value={settings.active_days_per_week}
                onChange={(e) => setSettings(s => ({ ...s, active_days_per_week: Number(e.target.value) }))} />
            </div>
            <div>
              <Label className="text-xs">Target modules / month</Label>
              <Input type="number" min={1} disabled={!canEdit} value={settings.target_modules_per_month}
                onChange={(e) => setSettings(s => ({ ...s, target_modules_per_month: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-md p-3" style={{ backgroundColor: "#F7F7F7", border: "1px solid #E0E0E0" }}>
              <p className="text-[10px]" style={{ color: "#666" }}>Achievable / month</p>
              <p className="text-2xl font-bold font-display" style={{ color: "#1A1A1A" }}>{forecast.achievable}</p>
              <p className="text-[10px] mt-1" style={{ color: "#999" }}>at current cycle times, 6 module bays</p>
            </div>
            <div className="rounded-md p-3" style={{
              backgroundColor: forecast.gap >= 0 ? "#E8F2ED" : "#FFF0F0",
              border: `1px solid ${forecast.gap >= 0 ? "#006039" : "#F40009"}`,
            }}>
              <p className="text-[10px]" style={{ color: "#666" }}>Gap to target</p>
              <p className="text-2xl font-bold font-display" style={{ color: forecast.gap >= 0 ? "#006039" : "#F40009" }}>
                {forecast.gap >= 0 ? `+${forecast.gap}` : forecast.gap}
              </p>
              <p className="text-[10px] mt-1" style={{ color: "#999" }}>
                {forecast.gap >= 0 ? "over target" : "modules short"}
              </p>
            </div>
            <div className="rounded-md p-3" style={{ backgroundColor: "#FFF8E8", border: "1px solid #D4860A" }}>
              <p className="text-[10px]" style={{ color: "#666" }}>Recommendation</p>
              <p className="text-sm font-bold font-display mt-1" style={{ color: "#1A1A1A" }}>
                {forecast.gap >= 0
                  ? `On track. Spare capacity for ~${forecast.gap} extra modules.`
                  : `Add ~${forecast.extraBayDaysNeeded} bay-days/week to hit target.`}
              </p>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={saveSettings} disabled={savingSettings} size="sm" style={{ backgroundColor: "#006039", color: "white" }}>
                <Save className="h-4 w-4 mr-1" />
                {savingSettings ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#D4860A" }} />
            Project Delivery Risk Matrix
            <Badge variant="outline" className="ml-2 text-xs">{risks.length} active</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No active projects.</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Project</TableHead>
                    <TableHead className="w-28">Planned Delivery</TableHead>
                    <TableHead className="w-24 text-right">Days Left</TableHead>
                    <TableHead className="w-24 text-right">% Complete</TableHead>
                    <TableHead className="w-28 text-center">Material Risk</TableHead>
                    <TableHead className="w-28 text-center">Manpower Risk</TableHead>
                    <TableHead className="w-24 text-center">Design Risk</TableHead>
                    <TableHead className="w-28 text-center">Overall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risks.map(r => {
                    const matColor: RiskColor = r.materialOverdue >= 3 ? "red" : r.materialOverdue >= 1 ? "amber" : "green";
                    const mpColor: RiskColor = r.manpowerGap >= 5 ? "red" : r.manpowerGap >= 2 ? "amber" : "green";
                    const dqColor: RiskColor = r.openDQs >= 5 ? "red" : r.openDQs >= 2 ? "amber" : "green";
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.name}</div>
                          {r.client_name && <div className="text-xs text-muted-foreground">{r.client_name}</div>}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.est_completion ? new Date(r.est_completion).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium" style={{
                          color: r.daysRemaining !== null && r.daysRemaining < 7 ? "#F40009"
                            : r.daysRemaining !== null && r.daysRemaining < 30 ? "#D4860A" : "#1A1A1A",
                        }}>
                          {r.daysRemaining !== null ? `${r.daysRemaining}d` : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-right font-medium">{r.pctComplete}%</TableCell>
                        <TableCell className="text-center">{riskBadge(matColor, `${r.materialOverdue} overdue`)}</TableCell>
                        <TableCell className="text-center">{riskBadge(mpColor, `${r.manpowerGap} gaps`)}</TableCell>
                        <TableCell className="text-center">{riskBadge(dqColor, `${r.openDQs} open`)}</TableCell>
                        <TableCell className="text-center">{riskBadge(r.overallColor, r.overall)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
