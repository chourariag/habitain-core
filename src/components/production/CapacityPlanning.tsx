import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, Package } from "lucide-react";

const PANEL_BAYS = ["Panel Bay 1", "Panel Bay 2", "Panel Bay 3"];
const MODULE_BAYS = ["Module Bay 1", "Module Bay 2", "Module Bay 3", "Module Bay 4", "Module Bay 5", "Module Bay 6"];

const BOTTLENECK_STAGES = ["Concrete", "MEP", "Waterproofing", "QC Pre-Dispatch"];

export function CapacityPlanning() {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<any[]>([]);
  const [manpower, setManpower] = useState<any[]>([]);

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    (async () => {
      const [{ data: mods }, { data: mp }] = await Promise.all([
        supabase.from("modules").select("id, module_code, current_stage, production_status, bay_number, projects(name)").eq("is_archived", false),
        (supabase.from("weekly_manpower_plans" as any) as any).select("module_id, planned_workers, actual_workers").eq("week_start_date", getWeekStart()),
      ]);
      setModules(mods ?? []);
      setManpower(mp ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const activeModules = modules.filter((m) => m.production_status === "in_progress");
  const panelOccupied = PANEL_BAYS.filter((b) => modules.some((m) => m.bay_number === b)).length;
  const moduleOccupied = MODULE_BAYS.filter((b) => modules.some((m) => m.bay_number === b)).length;
  const totalOccupied = panelOccupied + moduleOccupied;
  const totalBays = PANEL_BAYS.length + MODULE_BAYS.length;
  const utilPct = Math.round(totalOccupied / totalBays * 100);

  const totalPlanned = manpower.reduce((s: number, m: any) => s + (m.planned_workers ?? 0), 0);
  const totalActual = manpower.reduce((s: number, m: any) => s + (m.actual_workers ?? 0), 0);
  const manpowerUtilPct = totalPlanned > 0 ? Math.round(totalActual / totalPlanned * 100) : 0;

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  activeModules.forEach((m) => {
    if (m.current_stage) stageCounts[m.current_stage] = (stageCounts[m.current_stage] ?? 0) + 1;
  });

  // Bottleneck detection: stages with > 2 modules
  const bottlenecks = Object.entries(stageCounts)
    .filter(([stage, count]) => count >= 2 && BOTTLENECK_STAGES.includes(stage))
    .sort((a, b) => b[1] - a[1]);

  // Throughput: modules completed this month
  const completedThisMonth = modules.filter((m) =>
    m.production_status === "completed" || m.production_status === "dispatched"
  ).length;

  // Delivery risk: modules in_progress with no bay assigned
  const noBayRisk = modules.filter((m) => m.production_status === "in_progress" && !m.bay_number).length;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Bay Utilisation", value: `${utilPct}%`, sub: `${totalOccupied}/${totalBays} bays`, color: utilPct >= 80 ? "#006039" : "#D4860A" },
          { label: "Manpower Utilisation", value: `${manpowerUtilPct}%`, sub: `${totalActual}/${totalPlanned} workers`, color: manpowerUtilPct >= 80 ? "#006039" : "#D4860A" },
          { label: "Modules in Production", value: activeModules.length.toString(), sub: "currently active", color: "#1A1A1A" },
          { label: "Dispatched (All Time)", value: completedThisMonth.toString(), sub: "completed modules", color: "#006039" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border p-3" style={{ backgroundColor: "#F7F7F7" }}>
            <p className="text-xs" style={{ color: "#666" }}>{kpi.label}</p>
            <p className="text-2xl font-bold font-display mt-0.5" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-[10px]" style={{ color: "#999" }}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Bay utilisation bars */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Bay Utilisation</p>
        <div className="space-y-2">
          {[
            { label: "Panel Zone", occupied: panelOccupied, total: PANEL_BAYS.length, color: "#D4860A" },
            { label: "Module Zone", occupied: moduleOccupied, total: MODULE_BAYS.length, color: "#006039" },
          ].map((zone) => (
            <div key={zone.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: zone.color }} />
                  <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>{zone.label}</span>
                </div>
                <span className="text-xs" style={{ color: "#666" }}>{zone.occupied}/{zone.total} bays ({Math.round(zone.occupied / zone.total * 100)}%)</span>
              </div>
              <div className="w-full rounded-full h-3" style={{ backgroundColor: "#E0E0E0" }}>
                <div
                  className="h-3 rounded-full transition-all"
                  style={{ width: `${Math.round(zone.occupied / zone.total * 100)}%`, backgroundColor: zone.color }}
                />
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {Array.from({ length: zone.total }).map((_, i) => {
                  const bayName = zone.label === "Panel Zone" ? PANEL_BAYS[i] : MODULE_BAYS[i];
                  const occupied = modules.some((m) => m.bay_number === bayName);
                  return (
                    <div
                      key={i}
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: occupied ? zone.color : "#F0F0F0",
                        color: occupied ? "#fff" : "#999",
                      }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage distribution */}
      {Object.keys(stageCounts).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Stage Distribution</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(stageCounts).sort((a, b) => b[1] - a[1]).map(([stage, count]) => {
              const isBottleneck = BOTTLENECK_STAGES.includes(stage) && count >= 2;
              return (
                <div
                  key={stage}
                  className="rounded-lg border border-border p-2 flex items-center justify-between"
                  style={{ backgroundColor: isBottleneck ? "#FFF8E8" : "#F7F7F7" }}
                >
                  <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>{stage}</span>
                  <div className="flex items-center gap-1">
                    {isBottleneck && <AlertTriangle className="h-3 w-3" style={{ color: "#D4860A" }} />}
                    <span className="text-sm font-bold" style={{ color: isBottleneck ? "#D4860A" : "#006039" }}>{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottleneck alerts */}
      {bottlenecks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>Bottleneck Analysis</p>
          {bottlenecks.map(([stage, count]) => (
            <div key={stage} className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: "#FFF8E8" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D4860A" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#D4860A" }}>{stage} — {count} modules queued</p>
                <p className="text-xs" style={{ color: "#666" }}>
                  {stage === "Concrete" && "Consider scheduling concrete pours across multiple bays to prevent blocking."}
                  {stage === "MEP" && "MEP work may need additional sub-contractor capacity this week."}
                  {stage === "Waterproofing" && "Waterproofing queue — ensure adequate crew and materials."}
                  {stage === "QC Pre-Dispatch" && "QC backlog — prioritise inspector availability to avoid dispatch delays."}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delivery risk */}
      {noBayRisk > 0 && (
        <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: "#FEE2E2" }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F40009" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#F40009" }}>{noBayRisk} modules in production without a bay assigned</p>
            <p className="text-xs" style={{ color: "#666" }}>Assign bays via the module edit screen to enable factory floor tracking.</p>
          </div>
        </div>
      )}

      {bottlenecks.length === 0 && noBayRisk === 0 && (
        <div className="flex items-center gap-2 rounded-lg p-3" style={{ backgroundColor: "#E8F2ED" }}>
          <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} />
          <p className="text-sm" style={{ color: "#006039" }}>No bottlenecks detected — production flow is healthy.</p>
        </div>
      )}
    </div>
  );
}
