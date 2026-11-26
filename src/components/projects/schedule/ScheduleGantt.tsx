import { forwardRef, useMemo, useState } from "react";
import { differenceInCalendarDays, eachDayOfInterval, format, isSunday, parseISO, startOfDay } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activityDisplayName, compareCodes, unitLabel, type LibraryActivity, type LibraryTask, type ScheduleHoliday, type ScheduleTask, type ScheduleUnit } from "./schedule-types";

interface Props {
  tasks: ScheduleTask[];
  holidays: ScheduleHoliday[];
  units?: ScheduleUnit[];
  activities?: LibraryActivity[];
  libraryTasks?: LibraryTask[];
}

const DAY_WIDTH = 28;
const LABEL_WIDTH = 320;
const ROW = 32;
const LABEL_INSIDE_MIN = 96;

/** Draws bars only from stored planned dates; it never works out a date itself. */
export const ScheduleGantt = forwardRef<HTMLDivElement, Props>(function ScheduleGantt({ tasks, holidays, units = [], activities = [], libraryTasks = [] }, ref) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const datedTasks = useMemo(() => tasks.filter((task) => !task.is_removed && task.planned_start_date && task.planned_finish_date), [tasks]);
  const range = useMemo(() => {
    if (!datedTasks.length) return null;
    const start = new Date(Math.min(...datedTasks.map((task) => parseISO(task.planned_start_date!).getTime())));
    const end = new Date(Math.max(...datedTasks.map((task) => parseISO(task.planned_finish_date!).getTime())));
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [datedTasks]);
  const holidayMap = useMemo(() => new Map(holidays.filter((holiday) => holiday.is_active).map((holiday) => [holiday.holiday_date, holiday.label])), [holidays]);
  const activityOf = useMemo(() => {
    const names = new Map(activities.map((activity) => [activity.id, activity.name]));
    const byLibrary = new Map(libraryTasks.map((task) => [task.id, names.get(task.activity_id) ?? null]));
    return (task: ScheduleTask) => activityDisplayName((task.library_task_id && byLibrary.get(task.library_task_id)) || task.phase);
  }, [activities, libraryTasks]);
  const groups = useMemo(() => {
    const order = units.map((unit) => unit.unit_label);
    const map = new Map<string, { title: string; activities: Map<string, ScheduleTask[]> }>();
    for (const task of datedTasks) {
      const key = task.unit_label ?? "__none";
      const entry = map.get(key) ?? { title: task.unit_label ? `${task.unit_label} · ${unitLabel(task.unit_kind)}` : "No unit (legacy)", activities: new Map() };
      const activity = activityOf(task);
      entry.activities.set(activity, [...(entry.activities.get(activity) ?? []), task]);
      map.set(key, entry);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999))
      .map(([key, entry]) => ({ key, title: entry.title, activities: [...entry.activities.entries()].map(([name, list]) => ({ name, tasks: list.sort((x, y) => (x.planned_start_date ?? "").localeCompare(y.planned_start_date ?? "") || compareCodes(x.task_id_in_schedule, y.task_id_in_schedule)) })) }));
  }, [datedTasks, units, activityOf]);

  const today = startOfDay(new Date());
  const todayInside = !!range && today >= range.start && today <= range.end;
  const width = range ? range.days.length * DAY_WIDTH : 0;
  // Labels take any width the timeline does not need, so the chart never leaves blank space.
  const labelW = `max(${LABEL_WIDTH}px, calc(100% - ${width}px))`;
  const offDays = useMemo(() => range ? range.days.map((day, index) => ({ index, key: format(day, "yyyy-MM-dd"), sunday: isSunday(day) })).filter((day) => day.sunday || holidayMap.has(day.key)) : [], [range, holidayMap]);
  const months = useMemo(() => {
    if (!range) return [] as Array<{ label: string; left: number; width: number }>;
    const out: Array<{ label: string; left: number; width: number }> = [];
    range.days.forEach((day, index) => {
      const label = format(day, "MMM yyyy");
      const last = out[out.length - 1];
      if (last && last.label === label) last.width += DAY_WIDTH; else out.push({ label, left: index * DAY_WIDTH, width: DAY_WIDTH });
    });
    return out;
  }, [range]);
  const toggle = (key: string) => setCollapsed((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  return (
    <Card className="min-w-0" ref={ref}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">4. Gantt</CardTitle>
        <p className="text-sm text-muted-foreground">Bars follow the worked-out start and finish dates, grouped by unit and activity.</p>
        <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground" aria-label="Gantt legend">
          <span className="flex items-center gap-1.5"><span className="h-3 w-6 rounded bg-primary" />Task</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-4 border border-border bg-muted" />Sunday or holiday</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-destructive" />Today</span>
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        {!range ? (
          <p className="py-6 text-sm text-muted-foreground">No task dates yet. Set Day 1 for a unit and add tasks to see bars here.</p>
        ) : (
          <>
            <div className="max-h-[70vh] max-w-full overflow-auto rounded-md border border-border" aria-label="Schedule Gantt chart">
              <div className="relative" style={{ width: LABEL_WIDTH + width, minWidth: "100%" }}>
                <div className="sticky top-0 z-30 flex border-b border-border bg-card">
                  <div className="sticky left-0 z-40 flex shrink-0 items-end border-r border-border bg-card px-3 pb-1 text-xs font-medium" style={{ width: labelW, minWidth: LABEL_WIDTH }}>Unit / activity / task</div>
                  <div className="relative shrink-0" style={{ width, height: 44 }}>
                    {months.map((month) => <div key={month.label + month.left} className="absolute top-0 h-5 overflow-hidden whitespace-nowrap border-l border-border px-1 text-[11px] font-medium" style={{ left: month.left, width: month.width }} title={month.label}>{month.width >= 70 ? month.label : month.width >= 28 ? month.label.slice(0, 3) : ""}</div>)}
                    {range.days.map((day, index) => {
                      const key = format(day, "yyyy-MM-dd");
                      const off = isSunday(day) || holidayMap.has(key);
                      return <div key={key} className={`absolute bottom-0 h-6 border-l border-border/60 text-center text-[10px] leading-6 ${off ? "bg-muted text-muted-foreground" : ""}`} style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} title={holidayMap.get(key) ?? format(day, "EEE dd/MM/yyyy")}>{format(day, "dd")}</div>;
                    })}
                  </div>
                </div>
                <div className="relative">
                  {/* One shading layer for the whole chart instead of a cell per task per day. */}
                  <div className="pointer-events-none absolute inset-y-0" style={{ left: labelW, width }} aria-hidden="true">
                    {offDays.map((day) => <div key={day.key} className="absolute inset-y-0 bg-muted" style={{ left: day.index * DAY_WIDTH, width: DAY_WIDTH }} />)}
                    {todayInside && <div className="absolute inset-y-0 z-10 w-0.5 bg-destructive" style={{ left: differenceInCalendarDays(today, range.start) * DAY_WIDTH + DAY_WIDTH / 2 }} />}
                  </div>
                  {groups.map((group) => (
                    <div key={group.key}>
                      <button type="button" onClick={() => toggle(group.key)} className="relative z-20 flex h-8 w-full items-center border-b border-border bg-muted/80 text-left" aria-expanded={!collapsed.has(group.key)}>
                        <span className="sticky left-0 flex items-center gap-1.5 px-3 text-xs font-semibold">{collapsed.has(group.key) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{group.title}</span>
                      </button>
                      {!collapsed.has(group.key) && group.activities.map((activity) => (
                        <div key={activity.name}>
                          <div className="relative z-20 flex h-7 border-b border-border/60">
                            <div className="sticky left-0 shrink-0 truncate border-r border-border bg-card pl-7 pr-2 text-[11px] font-medium leading-7 text-muted-foreground" style={{ width: labelW, minWidth: LABEL_WIDTH }} title={activity.name}>{activity.name}</div>
                          </div>
                          {activity.tasks.map((task) => {
                            const start = parseISO(task.planned_start_date!);
                            const finish = parseISO(task.planned_finish_date!);
                            const left = differenceInCalendarDays(start, range.start) * DAY_WIDTH;
                            const barWidth = Math.max((differenceInCalendarDays(finish, start) + 1) * DAY_WIDTH - 4, 8);
                            const tooltip = `${task.task_id_in_schedule} — ${task.task_name}\n${format(start, "dd/MM/yyyy")} to ${format(finish, "dd/MM/yyyy")}`;
                            const inside = barWidth >= LABEL_INSIDE_MIN;
                            return (
                              <div key={task.id} className="relative flex border-b border-border/40" style={{ height: ROW }}>
                                <div className="sticky left-0 z-20 shrink-0 truncate border-r border-border bg-card pl-7 pr-2 text-xs" style={{ width: labelW, minWidth: LABEL_WIDTH, lineHeight: `${ROW}px` }} title={tooltip}>
                                  <span className="mr-2 font-mono text-[11px] text-muted-foreground">{task.task_id_in_schedule}</span>{task.task_name}
                                </div>
                                <div className="relative shrink-0" style={{ width }}>
                                  <div className="absolute top-1.5 flex h-5 items-center overflow-hidden rounded bg-primary px-1.5 text-[10px] text-primary-foreground" style={{ left: left + 2, width: barWidth }} title={tooltip}>
                                    {inside && <span className="truncate">{task.task_name}</span>}
                                  </div>
                                  {!inside && <span className="absolute top-1.5 whitespace-nowrap text-[10px] leading-5 text-foreground" style={{ left: left + barWidth + 6 }} title={tooltip}>{task.task_id_in_schedule}</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Timeline: {format(range.start, "dd/MM/yyyy")} – {format(range.end, "dd/MM/yyyy")}. {todayInside ? "Today is marked with a vertical line." : `Today (${format(today, "dd/MM/yyyy")}) is outside this timeline.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
});
