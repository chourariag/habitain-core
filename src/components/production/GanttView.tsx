import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch",
];

const STAGE_DAYS: Record<string, number> = {
  "Sub-Frame": 7, "MEP Rough-In": 5, "Insulation": 3, "Drywall": 5,
  "Paint": 4, "MEP Final": 4, "Windows & Doors": 5, "Finishing": 4,
  "QC Inspection": 2, "Dispatch": 1,
};

const STAGE_COLORS = [
  "#006039", "#D4860A", "#4F46E5", "#F40009", "#059669",
  "#D4860A", "#2563EB", "#9333EA", "#B45309", "#16A34A",
];

export function GanttView() {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const startDate = addDays(today, -7);
  const totalDays = 60;

  useEffect(() => { fetchModules(); }, []);

  const fetchModules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("modules")
      .select("id, module_code, name, current_stage, production_start_date, projects(name)")
      .eq("is_archived", false)
      .in("production_status", ["not_started", "in_progress"])
      .order("created_at");
    setModules(data ?? []);
    setLoading(false);
  };

  const getStageStart = (module: any, stageName: string): Date | null => {
    const moduleStart = module.production_start_date
      ? parseISO(module.production_start_date)
      : addDays(today, -14);
    const currentIdx = PRODUCTION_STAGES.indexOf(module.current_stage);
    const targetIdx = PRODUCTION_STAGES.indexOf(stageName);
    if (targetIdx < 0) return null;

    // Calculate cumulative days from start to reach this stage
    let days = 0;
    for (let i = 0; i < targetIdx; i++) {
      days += STAGE_DAYS[PRODUCTION_STAGES[i]] || 3;
    }
    return addDays(moduleStart, days);
  };

  const getDayOffset = (date: Date) => differenceInDays(date, startDate);

  const dayWidth = 18; // px per day
  const rowHeight = 40;
  const labelWidth = 140;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="hidden lg:block">
      <div className="overflow-x-auto rounded-lg border border-border">
        {/* Header */}
        <div className="flex sticky top-0 z-10 bg-white border-b border-border">
          <div style={{ minWidth: labelWidth, width: labelWidth }} className="px-3 py-2 text-xs font-semibold" style2={{ color: "#666" }}>Module</div>
          <div className="flex">
            {Array.from({ length: totalDays }, (_, i) => {
              const d = addDays(startDate, i);
              const isToday = differenceInDays(d, today) === 0;
              return (
                <div
                  key={i}
                  style={{ width: dayWidth, minWidth: dayWidth }}
                  className={`text-center border-l border-border py-2 text-[8px] ${isToday ? "bg-primary/10 font-bold" : ""}`}
                >
                  {d.getDate() === 1 || i === 0 ? format(d, "d MMM") : d.getDate() % 7 === 0 ? String(d.getDate()) : ""}
                </div>
              );
            })}
          </div>
        </div>

        {/* Today line */}
        <div className="relative">
          {modules.map((module, rowIdx) => (
            <div key={module.id} className="flex border-b border-border" style={{ height: rowHeight }}>
              {/* Label */}
              <div
                style={{ minWidth: labelWidth, width: labelWidth }}
                className="px-3 flex flex-col justify-center border-r border-border bg-muted/20"
              >
                <p className="text-xs font-medium truncate" style={{ color: "#1A1A1A" }}>{module.module_code || module.name}</p>
                <p className="text-[9px] truncate" style={{ color: "#999" }}>{module.projects?.name}</p>
              </div>

              {/* Bars */}
              <div className="relative flex-1" style={{ height: rowHeight }}>
                {/* Today marker */}
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed z-10"
                  style={{ left: getDayOffset(today) * dayWidth, borderColor: "#F40009", opacity: 0.5 }}
                />

                {PRODUCTION_STAGES.map((stage, si) => {
                  const stageStart = getStageStart(module, stage);
                  if (!stageStart) return null;
                  const stageDuration = STAGE_DAYS[stage] || 3;
                  const offsetX = getDayOffset(stageStart) * dayWidth;
                  const width = stageDuration * dayWidth - 2;
                  const currentIdx = PRODUCTION_STAGES.indexOf(module.current_stage);
                  const isCompleted = si < currentIdx;
                  const isCurrent = si === currentIdx;

                  if (offsetX + width < 0 || offsetX > totalDays * dayWidth) return null;

                  return (
                    <div
                      key={stage}
                      className="absolute rounded-sm flex items-center justify-center text-[7px] font-semibold overflow-hidden"
                      title={stage}
                      style={{
                        left: Math.max(0, offsetX),
                        top: 6,
                        height: rowHeight - 12,
                        width: Math.max(2, width),
                        backgroundColor: STAGE_COLORS[si] + (isCompleted ? "60" : isCurrent ? "E0" : "30"),
                        color: isCompleted ? "#fff" : STAGE_COLORS[si],
                        border: isCurrent ? `1.5px solid ${STAGE_COLORS[si]}` : "none",
                        opacity: si > currentIdx + 2 ? 0.3 : 1,
                      }}
                    >
                      {width > 30 ? stage.split(" ")[0] : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] mt-2 text-center" style={{ color: "#999" }}>
        Gantt view — desktop only. Bars show estimated stage durations based on production start date.
      </p>
    </div>
  );
}
