import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

// Panel Production Zone — 3 bays (ORANGE)
const PANEL_BAYS = ["Panel Bay 1", "Panel Bay 2", "Panel Bay 3"];
// Module Production Zone — 6 bays (GREEN)
const MODULE_BAYS = ["Module Bay 1", "Module Bay 2", "Module Bay 3", "Module Bay 4", "Module Bay 5", "Module Bay 6"];

const PANEL_STAGES = ["Cutting", "Framing", "Insulation", "Boarding", "Finishing", "QC", "Ready"];
const MODULE_STAGES = ["Subframe", "Decking", "Concrete", "Boarding", "Insulation", "Ceiling", "Flooring", "Painting", "MEP", "Openings", "Waterproofing", "QC Pre-Dispatch"];

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  Cutting: { bg: "#FFF8E8", color: "#D4860A" },
  Framing: { bg: "#EEF2FF", color: "#4F46E5" },
  Insulation: { bg: "#FDF4FF", color: "#9333EA" },
  Boarding: { bg: "#FFF0F0", color: "#F40009" },
  Finishing: { bg: "#F0FFF4", color: "#059669" },
  QC: { bg: "#FFFBEB", color: "#B45309" },
  Ready: { bg: "#E8F2ED", color: "#006039" },
  Subframe: { bg: "#E8F2ED", color: "#006039" },
  Decking: { bg: "#FFF8E8", color: "#D4860A" },
  Concrete: { bg: "#EEF2FF", color: "#4F46E5" },
  Painting: { bg: "#F0FDF4", color: "#16A34A" },
  MEP: { bg: "#EFF6FF", color: "#2563EB" },
  Openings: { bg: "#FDF4FF", color: "#9333EA" },
  Waterproofing: { bg: "#FFFBEB", color: "#B45309" },
  "QC Pre-Dispatch": { bg: "#E8F2ED", color: "#006039" },
  default: { bg: "#F7F7F7", color: "#666" },
};

interface BayAssignment {
  bayName: string;
  moduleId: string;
  moduleCode: string;
  projectName: string;
  currentStage: string | null;
  workerCount: number;
}

export function FactoryFloorMap() {
  const [assignments, setAssignments] = useState<BayAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAssignments(); }, []);

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  };

  const fetchAssignments = async () => {
    setLoading(true);
    const { data: modules } = await supabase
      .from("modules")
      .select("id, module_code, name, bay_number, current_stage, production_status, projects(name)")
      .eq("is_archived", false)
      .not("bay_number", "is", null)
      .in("production_status", ["not_started", "in_progress"]);

    const weekStart = getWeekStart();
    const { data: manpowerPlans } = await (supabase.from("weekly_manpower_plans" as any) as any)
      .select("module_id, actual_workers")
      .eq("week_start_date", weekStart);

    const workerMap: Record<string, number> = {};
    (manpowerPlans ?? []).forEach((p: any) => {
      workerMap[p.module_id] = (workerMap[p.module_id] || 0) + (p.actual_workers || 0);
    });

    const bayMap: Record<string, BayAssignment> = {};
    (modules ?? []).forEach((m: any) => {
      if (m.bay_number) {
        bayMap[m.bay_number] = {
          bayName: m.bay_number,
          moduleId: m.id,
          moduleCode: m.module_code || m.name,
          projectName: m.projects?.name || "—",
          currentStage: m.current_stage,
          workerCount: workerMap[m.id] || 0,
        };
      }
    });

    setAssignments(Object.values(bayMap));
    setLoading(false);
  };

  const getBayAssignment = (bay: string) => assignments.find((a) => a.bayName === bay);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const renderBay = (bay: string, zoneColor: string) => {
    const a = getBayAssignment(bay);
    const stageStyle = a?.currentStage ? (STAGE_COLORS[a.currentStage] ?? STAGE_COLORS.default) : STAGE_COLORS.default;

    return (
      <div
        key={bay}
        className="rounded-lg border-l-4 border border-border p-3 min-h-[100px] flex flex-col justify-between transition-all"
        style={{
          borderLeftColor: zoneColor,
          backgroundColor: a ? stageStyle.bg : "#F9F9F9",
          opacity: a ? 1 : 0.55,
        }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#999" }}>{bay}</p>
          {a ? (
            <>
              <p className="text-sm font-bold mt-0.5 truncate" style={{ color: "#1A1A1A" }}>{a.moduleCode}</p>
              <p className="text-[11px] truncate" style={{ color: "#666" }}>{a.projectName}</p>
              {a.currentStage && (
                <Badge variant="outline" className="text-[9px] mt-1 h-4" style={{ color: stageStyle.color, borderColor: stageStyle.color, backgroundColor: stageStyle.bg }}>
                  {a.currentStage}
                </Badge>
              )}
            </>
          ) : (
            <p className="text-xs mt-1" style={{ color: "#ccc" }}>Empty</p>
          )}
        </div>
        {a && a.workerCount > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {Array.from({ length: Math.min(a.workerCount, 4) }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold" style={{ backgroundColor: zoneColor }}>
                W
              </div>
            ))}
            {a.workerCount > 4 && (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold" style={{ backgroundColor: zoneColor }}>
                +{a.workerCount - 4}
              </div>
            )}
            <span className="text-[10px]" style={{ color: "#999" }}>{a.workerCount}</span>
          </div>
        )}
      </div>
    );
  };

  const panelOccupied = PANEL_BAYS.filter((b) => getBayAssignment(b)).length;
  const moduleOccupied = MODULE_BAYS.filter((b) => getBayAssignment(b)).length;

  return (
    <div className="space-y-6">
      {/* Panel Production Zone */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#D4860A" }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#D4860A" }}>Panel Production Zone</p>
          <span className="text-xs" style={{ color: "#999" }}>{panelOccupied}/{PANEL_BAYS.length} bays active</span>
        </div>
        <div className="text-[10px] mb-2 flex flex-wrap gap-1" style={{ color: "#999" }}>
          Stages: {PANEL_STAGES.join(" → ")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PANEL_BAYS.map((bay) => renderBay(bay, "#D4860A"))}
        </div>
      </div>

      {/* Module Production Zone */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#006039" }} />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#006039" }}>Module Production Zone</p>
          <span className="text-xs" style={{ color: "#999" }}>{moduleOccupied}/{MODULE_BAYS.length} bays active</span>
        </div>
        <div className="text-[10px] mb-2 flex flex-wrap gap-1" style={{ color: "#999" }}>
          Stages: {MODULE_STAGES.join(" → ")}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MODULE_BAYS.map((bay) => renderBay(bay, "#006039"))}
        </div>
      </div>

      <p className="text-[10px] text-center" style={{ color: "#bbb" }}>
        Assign bays to modules via the module edit screen. Workers shown from this week's manpower plan.
      </p>
    </div>
  );
}
