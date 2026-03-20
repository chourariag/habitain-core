import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban, Factory, AlertTriangle, Truck, Activity,
  Loader2, ClipboardCheck, ArrowUpRight, ArrowDownRight,
  Plus, Shield, Wrench, FileText, DollarSign, BarChart3,
  Compass, Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface KPI {
  label: string;
  value: number;
  delta: number;
  icon: any;
  href: string;
  health?: "good" | "warning" | "alert";
}

const STAGES = ["Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint", "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch"];
const stageColors = STAGES.map((_, i) => {
  const ratio = i / (STAGES.length - 1);
  const r = Math.round(232 - ratio * 232);
  const g = Math.round(242 - ratio * (242 - 96));
  const b = Math.round(237 - ratio * (237 - 57));
  return `rgb(${r},${g},${b})`;
});

const HEALTH_BORDER: Record<string, string> = {
  good: "#006039",
  warning: "#D4860A",
  alert: "#F40009",
};

export function Tier1Dashboard({ today }: { today: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [strips, setStrips] = useState<{ label: string; tiles: KPI[] }[]>([]);
  const [healthData, setHealthData] = useState<{ project: string; stages: Record<string, number> }[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString();
      const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

      const [projRes, projLastRes, modRes, modLastRes, ncrRes, ncrLastRes, dispatchRes, modulesAll, dispatchLogRes, schedRes, rmRes, amcRes, dqRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false).lt("created_at", weekAgo),
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "not_started"]),
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "not_started"]).lt("created_at", weekAgo),
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]),
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]).lt("created_at", weekAgo),
        supabase.from("dispatch_log").select("id", { count: "exact", head: true }).gte("dispatch_date", weekStart.toISOString().split("T")[0]).lte("dispatch_date", weekEnd.toISOString().split("T")[0]),
        supabase.from("modules").select("id,name,module_code,current_stage,project_id,production_status,projects(name)").eq("is_archived", false),
        supabase.from("dispatch_log").select("id,dispatch_date,module_id,modules(name,module_code,projects(name))").order("dispatch_date", { ascending: true }).limit(5),
        supabase.from("module_schedule").select("id,module_id,target_end,stage_name").not("target_end", "is", null),
        supabase.from("rm_tickets").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "open").eq("priority", "urgent"),
        supabase.from("amc_contracts").select("id,end_date").eq("is_archived", false).eq("status", "active"),
        supabase.from("design_queries").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);

      const activeNow = projRes.count ?? 0;
      const activeThen = projLastRes.count ?? 0;
      const modNow = modRes.count ?? 0;
      const modThen = modLastRes.count ?? 0;
      const ncrNow = ncrRes.count ?? 0;
      const ncrThen = ncrLastRes.count ?? 0;
      const dispNow = dispatchRes.count ?? 0;

      // Calculate delayed modules
      const todayStr = new Date().toISOString().split("T")[0];
      const delayedCount = (schedRes.data ?? []).filter((s: any) => s.target_end && s.target_end < todayStr).length;

      // Site readiness pending
      const siteReadyRes = await supabase.from("site_readiness").select("id,is_complete").eq("is_complete", false);
      const siteReadyPending = siteReadyRes.data?.length ?? 0;

      // AMC renewals within 30 days
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const amcRenewals = (amcRes.data ?? []).filter((c: any) => new Date(c.end_date) <= in30).length;

      // Inventory low stock
      const lowStockRes = await supabase.from("inventory_items").select("id,current_stock,reorder_level").eq("is_archived", false);
      const lowStock = (lowStockRes.data ?? []).filter((i: any) => i.current_stock <= i.reorder_level).length;

      setStrips([
        {
          label: "PRODUCTION",
          tiles: [
            { label: "Active Projects", value: activeNow, delta: activeNow - activeThen, icon: FolderKanban, href: "/projects", health: "good" },
            { label: "Panels In Production", value: modNow, delta: modNow - modThen, icon: Factory, href: "/production", health: "good" },
            { label: "Production Delays", value: delayedCount, delta: 0, icon: AlertTriangle, href: "/production", health: delayedCount > 0 ? "alert" : "good" },
            { label: "Open NCRs", value: ncrNow, delta: ncrNow - ncrThen, icon: ClipboardCheck, href: "/qc", health: ncrNow > 0 ? "alert" : "good" },
          ],
        },
        {
          label: "SITE & DISPATCH",
          tiles: [
            { label: "Dispatches This Week", value: dispNow, delta: 0, icon: Truck, href: "/site-hub", health: "good" },
            { label: "Active Site Installations", value: 0, delta: 0, icon: Wrench, href: "/site-hub", health: "good" },
            { label: "Site Readiness Pending", value: siteReadyPending, delta: 0, icon: Shield, href: "/site-hub", health: siteReadyPending > 0 ? "warning" : "good" },
          ],
        },
        {
          label: "SALES",
          tiles: [
            // PHASE 5: populate with real sales pipeline data
            { label: "Total Pipeline Value", value: 0, delta: 0, icon: BarChart3, href: "/sales", health: "good" },
            { label: "Hot Deals 🔥", value: 0, delta: 0, icon: Activity, href: "/sales", health: "good" },
            { label: "Proposals Pending", value: 0, delta: 0, icon: FileText, href: "/sales", health: "good" },
            { label: "Won This Month", value: 0, delta: 0, icon: DollarSign, href: "/sales", health: "good" },
          ],
        },
        {
          label: "FINANCE",
          tiles: [
            // PHASE 5: populate with real finance data
            { label: "Revenue MTD", value: 0, delta: 0, icon: DollarSign, href: "/finance", health: "good" },
            { label: "Overdue Payments", value: 0, delta: 0, icon: Calendar, href: "/finance", health: "good" },
            { label: "Low Stock Alerts", value: lowStock, delta: 0, icon: AlertTriangle, href: "/inventory", health: lowStock > 0 ? "warning" : "good" },
          ],
        },
        {
          label: "DESIGN & AMC",
          tiles: [
            { label: "Design Delays", value: 0, delta: 0, icon: Compass, href: "/design", health: "good" },
            { label: "GFC Issued This Month", value: 0, delta: 0, icon: FileText, href: "/design", health: "good" },
            { label: "AMC Renewals Due", value: amcRenewals, delta: 0, icon: Calendar, href: "/amc", health: amcRenewals > 0 ? "warning" : "good" },
            { label: "Open Design Queries", value: dqRes.count ?? 0, delta: 0, icon: Compass, href: "/design", health: (dqRes.count ?? 0) > 0 ? "warning" : "good" },
          ],
        },
      ]);

      // Health data
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

      // Dispatches
      setDispatches((dispatchLogRes.data ?? []).map((d: any) => ({
        id: d.id, project: d.modules?.projects?.name ?? "—",
        moduleId: d.modules?.module_code ?? d.modules?.name ?? "—",
        date: d.dispatch_date, status: "Scheduled",
      })));

      // Activity
      const acts: any[] = [];
      const [recentLogs, recentNCRs, recentMR] = await Promise.all([
        supabase.from("daily_production_logs").select("id,stage_worked,status,created_at,modules(name,module_code,projects(name))").order("created_at", { ascending: false }).limit(4),
        supabase.from("ncr_register").select("id,ncr_number,status,created_at").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("material_requests").select("id,material_name,status,created_at").order("created_at", { ascending: false }).limit(3),
      ]);
      (recentLogs.data ?? []).forEach((l: any) => acts.push({ id: `log-${l.id}`, type: "log", description: `Daily log ${l.status === "approved" ? "approved" : "submitted"} — ${l.stage_worked}`, project: l.modules?.projects?.name, timestamp: l.created_at }));
      (recentNCRs.data ?? []).forEach((n) => acts.push({ id: `ncr-${n.id}`, type: "ncr", description: `NCR ${n.ncr_number} (${n.status})`, timestamp: n.created_at }));
      (recentMR.data ?? []).forEach((m) => acts.push({ id: `mr-${m.id}`, type: "material", description: `Material request: ${m.material_name} — ${m.status}`, timestamp: m.created_at }));
      acts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivity(acts.slice(0, 10));
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "log": return <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} />;
      case "ncr": return <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />;
      case "material": return <Plus className="h-4 w-4" style={{ color: "#D4860A" }} />;
      default: return <Activity className="h-4 w-4" style={{ color: "#666666" }} />;
    }
  };

  return (
    <>
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Command Centre</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>{today}</p>
      </div>

      {/* 5 strips */}
      {strips.map((strip) => (
        <div key={strip.label}>
          <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: "#999999" }}>{strip.label}</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {strip.tiles.map((tile) => {
              const Icon = tile.icon;
              const borderColor = HEALTH_BORDER[tile.health ?? "good"];
              return (
                <button
                  key={tile.label}
                  onClick={() => navigate(tile.href)}
                  className="rounded-lg border p-4 text-left w-full hover:ring-2 hover:ring-primary/30 transition-all cursor-pointer"
                  style={{ backgroundColor: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderColor: "#E0E0E0", borderLeftWidth: 3, borderLeftColor: borderColor }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#666666" }}>{tile.label}</span>
                    <Icon className="h-4 w-4" style={{ color: "#006039" }} />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : tile.value}
                    </span>
                    {!loading && tile.delta !== 0 && (
                      <span className="flex items-center text-xs font-medium mb-0.5" style={{ color: tile.delta > 0 ? "#006039" : "#F40009" }}>
                        {tile.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(tile.delta)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Production Health + Upcoming Dispatches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>Production Stage Distribution</h2>
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
                          <div key={stage} title={`${stage}: ${count}`}
                            className="flex items-center justify-center text-[9px] font-semibold text-white"
                            style={{ width: `${pct}%`, backgroundColor: stageColors[si], minWidth: count > 0 ? 16 : 0 }}
                          >{pct > 8 ? count : ""}</div>
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

        <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h2 className="font-display text-base font-semibold mb-4" style={{ color: "#1A1A1A" }}>Recent Activity</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : activity.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "#666666" }}>No activity yet.</p>
          ) : (
            <div className="space-y-1">
              {activity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                  <div className="mt-0.5 shrink-0">{getIcon(a.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "#1A1A1A" }}>{a.description}</p>
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
    </>
  );
}
