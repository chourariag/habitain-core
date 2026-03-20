import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban, Factory, AlertTriangle, Truck, Activity, Plus, Shield,
  Loader2, ClipboardCheck, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KPI {
  label: string;
  value: number;
  delta: number; // positive = up
  icon: any;
  href: string;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  project?: string;
  timestamp: string;
  entityId?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [healthData, setHealthData] = useState<{ project: string; stages: Record<string, number> }[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const [projRes, projLastRes, modRes, modLastRes, ncrRes, ncrLastRes, dispatchRes, modulesAll, dispatchLogRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false).lt("created_at", weekAgo),
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "not_started"]),
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "not_started"]).lt("created_at", weekAgo),
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]),
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]).lt("created_at", weekAgo),
        supabase.from("dispatch_log").select("id", { count: "exact", head: true }).gte("dispatch_date", weekStart.toISOString().split("T")[0]).lte("dispatch_date", weekEnd.toISOString().split("T")[0]),
        supabase.from("modules").select("id,name,module_code,current_stage,project_id,production_status,projects(name)").eq("is_archived", false),
        supabase.from("dispatch_log").select("id,dispatch_date,module_id,modules(name,module_code,projects(name))").order("dispatch_date", { ascending: true }).limit(5),
      ]);

      const activeNow = projRes.count ?? 0;
      const activeThen = projLastRes.count ?? 0;
      const modNow = modRes.count ?? 0;
      const modThen = modLastRes.count ?? 0;
      const ncrNow = ncrRes.count ?? 0;
      const ncrThen = ncrLastRes.count ?? 0;
      const dispNow = dispatchRes.count ?? 0;

      setKpis([
        { label: "Active Projects", value: activeNow, delta: activeNow - activeThen, icon: FolderKanban, href: "/projects" },
        { label: "Panels In Production", value: modNow, delta: modNow - modThen, icon: Factory, href: "/production" },
        { label: "Dispatches This Week", value: dispNow, delta: 0, icon: Truck, href: "/site-hub" },
        { label: "Open NCRs", value: ncrNow, delta: ncrNow - ncrThen, icon: AlertTriangle, href: "/qc" },
      ]);

      // Production Health - group modules by project and stage
      const STAGES = ["Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint", "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch"];
      const projectMap: Record<string, { project: string; stages: Record<string, number> }> = {};
      (modulesAll.data ?? []).forEach((m: any) => {
        const pName = m.projects?.name ?? "Unknown";
        if (!projectMap[m.project_id]) {
          projectMap[m.project_id] = { project: pName, stages: {} };
          STAGES.forEach((s) => (projectMap[m.project_id].stages[s] = 0));
        }
        const stage = m.current_stage ?? "Sub-Frame";
        if (projectMap[m.project_id].stages[stage] !== undefined) {
          projectMap[m.project_id].stages[stage]++;
        }
      });
      setHealthData(Object.values(projectMap).filter((p) => Object.values(p.stages).some((v) => v > 0)));

      // Upcoming dispatches
      setDispatches((dispatchLogRes.data ?? []).map((d: any) => ({
        id: d.id,
        project: d.modules?.projects?.name ?? "—",
        moduleId: d.modules?.module_code ?? d.modules?.name ?? "—",
        date: d.dispatch_date,
        status: "Scheduled",
      })));

      // Recent activity
      const acts: ActivityItem[] = [];
      const [recentLogs, recentNCRs, recentMR] = await Promise.all([
        supabase.from("daily_production_logs").select("id,stage_worked,status,created_at,modules(name,module_code,projects(name))").order("created_at", { ascending: false }).limit(4),
        supabase.from("ncr_register").select("id,ncr_number,status,created_at").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("material_requests").select("id,material_name,status,created_at").order("created_at", { ascending: false }).limit(3),
      ]);
      (recentLogs.data ?? []).forEach((l: any) => acts.push({
        id: `log-${l.id}`, type: "log",
        description: `Daily log ${l.status === "approved" ? "approved" : "submitted"} — ${l.stage_worked}`,
        project: l.modules?.projects?.name, timestamp: l.created_at!,
      }));
      (recentNCRs.data ?? []).forEach((n) => acts.push({
        id: `ncr-${n.id}`, type: "ncr",
        description: `NCR ${n.ncr_number} (${n.status})`, timestamp: n.created_at!, entityId: n.id,
      }));
      (recentMR.data ?? []).forEach((m) => acts.push({
        id: `mr-${m.id}`, type: "material",
        description: `Material request: ${m.material_name} — ${m.status}`, timestamp: m.created_at!,
      }));
      acts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(acts.slice(0, 10));
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const STAGES = ["Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint", "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch"];
  const stageColors = STAGES.map((_, i) => {
    const ratio = i / (STAGES.length - 1);
    const r = Math.round(232 - ratio * (232 - 0));
    const g = Math.round(242 - ratio * (242 - 96));
    const b = Math.round(237 - ratio * (237 - 57));
    return `rgb(${r},${g},${b})`;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "log": return <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} />;
      case "ncr": return <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />;
      case "material": return <Plus className="h-4 w-4" style={{ color: "#D4860A" }} />;
      default: return <Activity className="h-4 w-4" style={{ color: "#666666" }} />;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Section A — KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              onClick={() => navigate(kpi.href)}
              className="rounded-lg border border-border p-4 text-left w-full hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer bg-background"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "#666666" }}>{kpi.label}</span>
                <Icon className="h-4 w-4" style={{ color: "#006039" }} />
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : kpi.value}
                </span>
                {!loading && kpi.delta !== 0 && (
                  <span className="flex items-center text-xs font-medium mb-0.5" style={{ color: kpi.delta > 0 ? "#006039" : "#F40009" }}>
                    {kpi.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(kpi.delta)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Section B — Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Production Health */}
        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold text-foreground mb-4">Production Health</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : healthData.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#666666" }}>No modules in production yet.</p>
          ) : (
            <div className="space-y-3">
              {healthData.map((row) => {
                const total = Object.values(row.stages).reduce((a, b) => a + b, 0);
                if (total === 0) return null;
                return (
                  <div key={row.project}>
                    <p className="text-xs font-medium mb-1" style={{ color: "#1A1A1A" }}>{row.project}</p>
                    <div className="flex h-5 rounded overflow-hidden">
                      {STAGES.map((stage, si) => {
                        const count = row.stages[stage] ?? 0;
                        if (count === 0) return null;
                        const pct = (count / total) * 100;
                        return (
                          <div
                            key={stage}
                            title={`${stage}: ${count}`}
                            className="flex items-center justify-center text-[9px] font-semibold text-white"
                            style={{ width: `${pct}%`, backgroundColor: stageColors[si], minWidth: count > 0 ? 16 : 0 }}
                          >
                            {pct > 8 ? count : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: stageColors[i] }} />
                    <span className="text-[9px]" style={{ color: "#666666" }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming Dispatches */}
        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold text-foreground mb-4">Upcoming Dispatches</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : dispatches.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#666666" }}>No upcoming dispatches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-xs font-medium" style={{ color: "#666666" }}>Project</th>
                    <th className="text-left py-2 text-xs font-medium" style={{ color: "#666666" }}>Module/Panel</th>
                    <th className="text-left py-2 text-xs font-medium" style={{ color: "#666666" }}>Date</th>
                    <th className="text-left py-2 text-xs font-medium" style={{ color: "#666666" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d) => (
                    <tr key={d.id} className="border-b border-border/40">
                      <td className="py-2 text-foreground">{d.project}</td>
                      <td className="py-2 text-foreground font-medium">{d.moduleId}</td>
                      <td className="py-2" style={{ color: "#666666" }}>{d.date}</td>
                      <td className="py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Section C — Recent Activity */}
      <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h2 className="font-display text-base font-semibold text-foreground mb-4">Recent Activity</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : activity.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "#666666" }}>No activity yet.</p>
        ) : (
          <div className="space-y-1">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                <div className="mt-0.5 shrink-0">{getIcon(a.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.description}</p>
                  {a.project && <p className="text-[11px]" style={{ color: "#999999" }}>{a.project}</p>}
                </div>
                <span className="text-[11px] shrink-0 mt-0.5" style={{ color: "#999999" }}>
                  {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
