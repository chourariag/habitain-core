import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Monitor } from "lucide-react";
import { format, parseISO, differenceInDays, addDays, startOfWeek, startOfMonth, startOfQuarter, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { PRODUCTION_STAGES } from "@/components/projects/ProductionStageTracker";
import { getPhaseForStage } from "@/lib/production-phases";

interface ModuleRow {
  id: string;
  name: string;
  module_code: string | null;
  current_stage: string | null;
  production_status: string | null;
}

interface ScheduleEntry {
  module_id: string;
  stage_name: string;
  target_start: string | null;
  target_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
}

interface Dependency {
  id: string;
  predecessor_module_id: string;
  predecessor_stage: number;
  successor_module_id: string;
  successor_stage: number;
}

type ZoomLevel = "week" | "month" | "quarter";
type FilterMode = "all" | "behind" | "ontrack" | "complete";
type ScheduleMode = "forward" | "backward";

const ALLOWED_ROLES = ["planning_engineer", "production_head", "managing_director", "super_admin",
  "finance_director", "sales_director", "architecture_director"];

const DAY_WIDTH: Record<ZoomLevel, number> = { week: 28, month: 10, quarter: 3 };
const MODULE_ROW_HEIGHT = 44;
const HEADER_HEIGHT = 50;
const LEFT_PANEL_WIDTH = 180;

function dateToDayOffset(date: Date, origin: Date): number {
  return differenceInDays(date, origin);
}

function getBarColor(scheduleRows: ScheduleEntry[]): string {
  const now = new Date();
  for (const r of scheduleRows) {
    if (r.target_end && !r.actual_end) {
      const targetEnd = parseISO(r.target_end);
      if (now > targetEnd) return "#D4860A"; // behind
    }
  }
  return "#006039"; // on track or ahead
}

function getPlannedRange(rows: ScheduleEntry[]): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const r of rows) {
    if (r.target_start) {
      const d = parseISO(r.target_start);
      if (!start || d < start) start = d;
    }
    if (r.target_end) {
      const d = parseISO(r.target_end);
      if (!end || d > end) end = d;
    }
  }
  return { start, end };
}

function getActualRange(rows: ScheduleEntry[]): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;
  for (const r of rows) {
    if (r.actual_start) {
      const d = parseISO(r.actual_start);
      if (!start || d < start) start = d;
    }
    if (r.actual_end) {
      const d = parseISO(r.actual_end);
      if (!end || d > end) end = d;
    }
  }
  // If actual started but no end yet, end = today
  if (start && !end) end = new Date();
  return { start, end };
}

interface Props {
  projectId: string;
  modules: ModuleRow[];
  userRole: string | null;
  productionSystem?: "modular" | "panelised" | "hybrid" | null;
}

export function GanttChart({ projectId, modules, userRole, productionSystem }: Props) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState<ZoomLevel>("month");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [schedMode, setSchedMode] = useState<ScheduleMode>("forward");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canView = ALLOWED_ROLES.includes(userRole || "");

  useEffect(() => {
    if (!canView || !projectId) return;
    loadData();
  }, [projectId, canView]);

  async function loadData() {
    setLoading(true);
    const moduleIds = modules.map((m) => m.id);
    const [schedRes, depRes] = await Promise.all([
      supabase.from("module_schedule").select("*").in("module_id", moduleIds),
      supabase.from("activity_dependencies").select("*").or(
        `predecessor_module_id.in.(${moduleIds.join(",")}),successor_module_id.in.(${moduleIds.join(",")})`
      ),
    ]);
    setSchedules((schedRes.data as any) || []);
    setDependencies((depRes.data as any) || []);
    setLoading(false);
  }

  // Compute module status for filtering
  const moduleStatus = useMemo(() => {
    const result: Record<string, "behind" | "ontrack" | "complete"> = {};
    for (const m of modules) {
      const mSched = schedules.filter((s) => s.module_id === m.id);
      if (m.production_status === "completed" || m.production_status === "dispatched") {
        result[m.id] = "complete";
      } else if (getBarColor(mSched) === "#D4860A") {
        result[m.id] = "behind";
      } else {
        result[m.id] = "ontrack";
      }
    }
    return result;
  }, [modules, schedules]);

  const filteredModules = useMemo(() => {
    if (filter === "all") return modules;
    return modules.filter((m) => moduleStatus[m.id] === filter);
  }, [modules, filter, moduleStatus]);

  // Compute timeline bounds
  const { origin, totalDays } = useMemo(() => {
    const allDates: Date[] = [new Date()];
    for (const s of schedules) {
      if (s.target_start) allDates.push(parseISO(s.target_start));
      if (s.target_end) allDates.push(parseISO(s.target_end));
      if (s.actual_start) allDates.push(parseISO(s.actual_start));
      if (s.actual_end) allDates.push(parseISO(s.actual_end));
    }
    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    const o = addDays(min, -7);
    const days = differenceInDays(addDays(max, 14), o);
    return { origin: o, totalDays: Math.max(days, 60) };
  }, [schedules]);

  const dayWidth = DAY_WIDTH[zoom];
  const chartWidth = totalDays * dayWidth;
  const todayOffset = dateToDayOffset(new Date(), origin);

  // Generate date headers
  const dateHeaders = useMemo(() => {
    const end = addDays(origin, totalDays);
    if (zoom === "week") {
      return eachWeekOfInterval({ start: origin, end }).map((d) => ({
        date: d, label: format(d, "dd MMM"), offset: dateToDayOffset(d, origin),
      }));
    }
    if (zoom === "month") {
      return eachMonthOfInterval({ start: origin, end }).map((d) => ({
        date: d, label: format(d, "MMM yyyy"), offset: dateToDayOffset(d, origin),
      }));
    }
    // quarter
    const months = eachMonthOfInterval({ start: origin, end });
    return months.filter((_, i) => i % 3 === 0).map((d) => ({
      date: d, label: `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`, offset: dateToDayOffset(d, origin),
    }));
  }, [origin, totalDays, zoom]);

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Monitor className="h-8 w-8 mb-2" />
        <p className="text-sm">You do not have access to the Gantt chart.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-3">
      {/* Desktop-only guard */}
      <div className="block lg:hidden">
        <Card><CardContent className="p-8 text-center">
          <Monitor className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">View available on desktop only.</p>
        </CardContent></Card>
      </div>

      <div className="hidden lg:block space-y-3">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              <SelectItem value="behind">Behind Schedule</SelectItem>
              <SelectItem value="ontrack">On Track</SelectItem>
              <SelectItem value="complete">Complete</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
            {(["week", "month", "quarter"] as ZoomLevel[]).map((z) => (
              <Button key={z} variant="ghost" size="sm" className={`text-xs h-7 px-3 ${zoom === z ? "bg-background shadow-sm" : ""}`} onClick={() => setZoom(z)}>
                {z.charAt(0).toUpperCase() + z.slice(1)}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-muted/30 ml-auto">
            <Button variant="ghost" size="sm" className={`text-xs h-7 px-3 ${schedMode === "forward" ? "bg-background shadow-sm" : ""}`} onClick={() => setSchedMode("forward")}>
              Forward
            </Button>
            <Button variant="ghost" size="sm" className={`text-xs h-7 px-3 ${schedMode === "backward" ? "bg-background shadow-sm" : ""}`} onClick={() => setSchedMode("backward")}>
              Backward
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded" style={{ backgroundColor: "#C5DDD1" }} /> Planned</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded" style={{ backgroundColor: "#006039" }} /> Actual (On Track)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded" style={{ backgroundColor: "#D4860A" }} /> Actual (Behind)</span>
          <span className="flex items-center gap-1"><span className="w-0.5 h-3" style={{ backgroundColor: "#F40009" }} /> Today</span>
        </div>

        {/* Gantt body */}
        <Card className="overflow-hidden">
          <div className="flex">
            {/* Left panel: module names + phase */}
            <div className="shrink-0 border-r border-border" style={{ width: LEFT_PANEL_WIDTH }}>
              <div className="border-b border-border px-3 flex items-center justify-between text-xs font-medium text-muted-foreground" style={{ height: HEADER_HEIGHT }}>
                <span>Module</span>
                <span className="text-[10px] uppercase tracking-wide">Phase</span>
              </div>
              {filteredModules.map((m) => (
                <div key={m.id} className="border-b border-border px-3 flex items-center justify-between gap-2" style={{ height: MODULE_ROW_HEIGHT }}>
                  <span className="text-xs font-medium truncate" style={{ color: "#1A1A1A" }}>
                    {m.module_code || m.name}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                    {getPhaseForStage(m.current_stage, productionSystem ?? null)}
                  </span>
                </div>
              ))}
            </div>

            {/* Right panel: scrollable chart */}
            <div className="flex-1 overflow-x-auto" ref={scrollRef}>
              <div className="relative" style={{ width: chartWidth, minHeight: HEADER_HEIGHT + filteredModules.length * MODULE_ROW_HEIGHT }}>
                {/* Date headers */}
                <div className="border-b border-border flex" style={{ height: HEADER_HEIGHT }}>
                  {dateHeaders.map((h, i) => (
                    <div key={i} className="absolute text-[10px] text-muted-foreground px-1 flex items-end pb-1" style={{ left: h.offset * dayWidth, height: HEADER_HEIGHT, borderLeft: "1px solid hsl(var(--border))" }}>
                      {h.label}
                    </div>
                  ))}
                </div>

                {/* Today line */}
                <div className="absolute top-0 bottom-0" style={{ left: todayOffset * dayWidth, width: 2, backgroundColor: "#F40009", zIndex: 10 }} />

                {/* Module rows */}
                {filteredModules.map((m, rowIdx) => {
                  const mSchedule = schedules.filter((s) => s.module_id === m.id);
                  const planned = getPlannedRange(mSchedule);
                  const actual = getActualRange(mSchedule);
                  const barColor = getBarColor(mSchedule);
                  const topY = HEADER_HEIGHT + rowIdx * MODULE_ROW_HEIGHT;

                  // Stage boundary markers (dotted lines on planned bar)
                  const stageMarkers: number[] = [];
                  if (planned.start && planned.end) {
                    for (const s of mSchedule) {
                      if (s.target_end) {
                        stageMarkers.push(dateToDayOffset(parseISO(s.target_end), origin));
                      }
                    }
                  }

                  // Variance calculation
                  const variance = (() => {
                    if (!planned.end || !actual.end) return null;
                    return differenceInDays(planned.end, actual.end);
                  })();

                  // Schedule conflict flag (>2 days behind)
                  const conflictStage = mSchedule.find((s) => {
                    if (s.target_end && !s.actual_end) {
                      const tEnd = parseISO(s.target_end);
                      return differenceInDays(new Date(), tEnd) > 2;
                    }
                    if (s.target_end && s.actual_end) {
                      return differenceInDays(parseISO(s.actual_end), parseISO(s.target_end)) > 2;
                    }
                    return false;
                  });
                  const hasConflict = !!conflictStage;
                  const conflictDays = conflictStage
                    ? conflictStage.actual_end
                      ? differenceInDays(parseISO(conflictStage.actual_end), parseISO(conflictStage.target_end!))
                      : differenceInDays(new Date(), parseISO(conflictStage.target_end!))
                    : 0;

                  return (
                    <div key={m.id} className="absolute w-full border-b border-border/30" style={{ top: topY, height: MODULE_ROW_HEIGHT }}>
                      {/* Planned bar */}
                      {planned.start && planned.end && (
                        <div
                          className="absolute rounded-sm cursor-pointer"
                          style={{
                            left: dateToDayOffset(planned.start, origin) * dayWidth,
                            width: Math.max(differenceInDays(planned.end, planned.start) * dayWidth, 4),
                            top: 8,
                            height: 12,
                            backgroundColor: "#C5DDD1",
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top - 10,
                              content: `${m.module_code || m.name} — Planned: ${format(planned.start!, "dd/MM/yyyy")} → ${format(planned.end!, "dd/MM/yyyy")}${variance != null ? ` | Variance: ${variance > 0 ? "+" : ""}${variance}d` : ""}`,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {/* Stage boundary dotted lines */}
                          {stageMarkers.map((offset, i) => (
                            <div key={i} className="absolute top-0 bottom-0" style={{
                              left: (offset - dateToDayOffset(planned.start!, origin)) * dayWidth,
                              width: 1,
                              borderLeft: "1px dotted rgba(0,0,0,0.3)",
                            }} />
                          ))}
                        </div>
                      )}

                      {/* Actual bar */}
                      {actual.start && actual.end && (
                        <div
                          className="absolute rounded-sm cursor-pointer"
                          style={{
                            left: dateToDayOffset(actual.start, origin) * dayWidth,
                            width: Math.max(differenceInDays(actual.end, actual.start) * dayWidth, 4),
                            top: 22,
                            height: 12,
                            backgroundColor: barColor,
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const currentStageIdx = m.current_stage ? PRODUCTION_STAGES.indexOf(m.current_stage as any) : -1;
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top - 10,
                              content: `${m.module_code || m.name} — Actual: ${format(actual.start!, "dd/MM/yyyy")} → ${format(actual.end!, "dd/MM/yyyy")} | Stage: ${m.current_stage || "—"}${variance != null ? ` | Variance: ${variance > 0 ? "+" : ""}${variance}d` : ""}`,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      )}

                      {/* Conflict flag */}
                      {hasConflict && (
                        <div
                          className="absolute text-[9px] font-bold rounded px-1 cursor-pointer"
                          style={{ right: 4, top: 14, backgroundColor: "#FFF3CD", color: "#D4860A" }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.top - 10,
                              content: `${m.module_code || m.name} is ${conflictDays} days behind plan. Planned completion: ${conflictStage?.target_end ? format(parseISO(conflictStage.target_end), "dd/MM/yyyy") : "—"}.`,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          ⚠ {conflictDays}d behind
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Dependency arrows */}
                <svg className="absolute inset-0 pointer-events-none" style={{ width: chartWidth, height: HEADER_HEIGHT + filteredModules.length * MODULE_ROW_HEIGHT }}>
                  {dependencies.map((dep) => {
                    const predIdx = filteredModules.findIndex((m) => m.id === dep.predecessor_module_id);
                    const succIdx = filteredModules.findIndex((m) => m.id === dep.successor_module_id);
                    if (predIdx === -1 || succIdx === -1) return null;

                    const predSched = schedules.find((s) => s.module_id === dep.predecessor_module_id && s.stage_name === PRODUCTION_STAGES[dep.predecessor_stage]);
                    const succSched = schedules.find((s) => s.module_id === dep.successor_module_id && s.stage_name === PRODUCTION_STAGES[dep.successor_stage]);
                    if (!predSched?.target_end || !succSched?.target_start) return null;

                    const x1 = dateToDayOffset(parseISO(predSched.target_end), origin) * dayWidth;
                    const y1 = HEADER_HEIGHT + predIdx * MODULE_ROW_HEIGHT + MODULE_ROW_HEIGHT / 2;
                    const x2 = dateToDayOffset(parseISO(succSched.target_start), origin) * dayWidth;
                    const y2 = HEADER_HEIGHT + succIdx * MODULE_ROW_HEIGHT + MODULE_ROW_HEIGHT / 2;

                    return (
                      <g key={dep.id}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1.5} strokeDasharray="4 2" markerEnd="url(#arrowhead)" />
                      </g>
                    );
                  })}
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#999" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          </div>
        </Card>

        {/* Tooltip */}
        {tooltip && (
          <div className="fixed z-50 rounded px-3 py-1.5 text-xs shadow-lg pointer-events-none" style={{
            left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)",
            backgroundColor: "#1A1A1A", color: "#fff", maxWidth: 400,
          }}>
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}
