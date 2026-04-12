import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Factory } from "lucide-react";

const INDOOR_BAYS = Array.from({ length: 10 }, (_, i) => `Bay ${i + 1}`);
const OUTDOOR_BAYS = Array.from({ length: 7 }, (_, i) => `Outdoor ${i + 1}`);
const ALL_BAYS = [...INDOOR_BAYS, ...OUTDOOR_BAYS];

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Sub-Frame": { bg: "#E8F2ED", color: "#006039" },
  "MEP Rough-In": { bg: "#FFF8E8", color: "#D4860A" },
  "Insulation": { bg: "#EEF2FF", color: "#4F46E5" },
  "Drywall": { bg: "#FFF0F0", color: "#F40009" },
  "Paint": { bg: "#F0FFF4", color: "#059669" },
  "MEP Final": { bg: "#FFF8E8", color: "#D4860A" },
  "Windows & Doors": { bg: "#EFF6FF", color: "#2563EB" },
  "Finishing": { bg: "#FDF4FF", color: "#9333EA" },
  "QC Inspection": { bg: "#FFFBEB", color: "#B45309" },
  "Dispatch": { bg: "#F0FDF4", color: "#16A34A" },
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

  const fetchAssignments = async () => {
    setLoading(true);
    // Fetch modules that have a bay_number set and are in progress
    const { data: modules } = await supabase
      .from("modules")
      .select("id, module_code, name, bay_number, current_stage, production_status, projects(name)")
      .eq("is_archived", false)
      .not("bay_number", "is", null)
      .in("production_status", ["not_started", "in_progress"]);

    // Get worker counts from weekly_manpower_plans for this week
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

  const getWeekStart = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  };

  const getBayAssignment = (bay: string) => assignments.find((a) => a.bayName === bay);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const renderBay = (bay: string, isIndoor: boolean) => {
    const a = getBayAssignment(bay);
    const stageStyle = a?.currentStage ? (STAGE_COLORS[a.currentStage] ?? STAGE_COLORS.default) : STAGE_COLORS.default;

    return (
      <div
        key={bay}
        className="rounded-lg border p-3 min-h-[90px] flex flex-col justify-between transition-all"
        style={{
          backgroundColor: a ? stageStyle.bg : "#F7F7F7",
          borderColor: a ? stageStyle.color + "40" : "#E0E0E0",
          opacity: a ? 1 : 0.5,
        }}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#999" }}>{bay}</p>
          {a ? (
            <>
              <p className="text-sm font-bold mt-0.5" style={{ color: "#1A1A1A" }}>{a.moduleCode}</p>
              <p className="text-[11px] truncate" style={{ color: "#666" }}>{a.projectName}</p>
              {a.currentStage && (
                <Badge variant="outline" className="text-[9px] mt-1 h-4" style={{ color: stageStyle.color, borderColor: stageStyle.color, backgroundColor: stageStyle.bg }}>
                  {a.currentStage}
                </Badge>
              )}
            </>
          ) : (
            <p className="text-xs mt-1" style={{ color: "#bbb" }}>Empty</p>
          )}
        </div>
        {a && a.workerCount > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {Array.from({ length: Math.min(a.workerCount, 5) }).map((_, i) => (
              <div key={i} className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold" style={{ backgroundColor: stageStyle.color }}>
                {i === 4 && a.workerCount > 5 ? `+${a.workerCount - 4}` : "W"}
              </div>
            ))}
            <span className="text-[10px]" style={{ color: "#999" }}>{a.workerCount} workers</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Factory className="h-4 w-4" style={{ color: "#006039" }} />
        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Factory Floor Map</p>
        <span className="text-xs" style={{ color: "#999" }}>{assignments.length} of {ALL_BAYS.length} bays occupied</span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#666" }}>Indoor Bays (10)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {INDOOR_BAYS.map((bay) => renderBay(bay, true))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#666" }}>Outdoor Bays (7)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {OUTDOOR_BAYS.map((bay) => renderBay(bay, false))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {Object.entries(STAGE_COLORS).filter(([k]) => k !== "default").map(([stage, style]) => (
          <div key={stage} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />
            <span className="text-[10px]" style={{ color: "#666" }}>{stage}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
