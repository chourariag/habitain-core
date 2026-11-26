import { useMemo } from "react";
import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isSunday, isToday, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScheduleHoliday, ScheduleTask } from "./schedule-types";

interface Props {
  tasks: ScheduleTask[];
  holidays: ScheduleHoliday[];
}

const DAY_WIDTH = 34;
const LABEL_WIDTH = 224;

export function ScheduleGantt({ tasks, holidays }: Props) {
  const datedTasks = useMemo(() => tasks.filter((task) => !task.is_removed && task.planned_start_date && task.planned_finish_date), [tasks]);
  const range = useMemo(() => {
    if (!datedTasks.length) return null;
    const start = new Date(Math.min(...datedTasks.map((task) => parseISO(task.planned_start_date!).getTime())));
    const end = new Date(Math.max(...datedTasks.map((task) => parseISO(task.planned_finish_date!).getTime())));
    return { start, end, days: eachDayOfInterval({ start, end }) };
  }, [datedTasks]);
  const holidayDates = useMemo(() => new Set(holidays.filter((holiday) => holiday.is_active).map((holiday) => holiday.holiday_date)), [holidays]);
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleTask[]>();
    for (const task of datedTasks) {
      const key = task.phase || "Other";
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return [...map.entries()];
  }, [datedTasks]);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-base">4. Gantt</CardTitle>
        <p className="text-sm text-muted-foreground">Bars use only dates calculated and returned by the database. Sundays and listed holidays are shaded.</p>
      </CardHeader>
      <CardContent className="min-w-0">
        {!range ? (
          <p className="py-6 text-sm text-muted-foreground">No calculated task dates are available yet.</p>
        ) : (
          <div className="max-w-full overflow-x-auto" aria-label="Schedule Gantt chart">
            <div className="w-max min-w-full">
              <div className="flex h-16 border-b border-border">
                <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-medium" style={{ width: LABEL_WIDTH }}>Activity / task</div>
                <div className="relative flex-1" style={{ width: range.days.length * DAY_WIDTH }}>
                  {range.days.map((day, index) => {
                    const off = isSunday(day) || holidayDates.has(format(day, "yyyy-MM-dd"));
                    return (
                      <div key={day.toISOString()} className={`absolute inset-y-0 border-r border-border px-1 py-1 text-center text-[10px] ${off ? "bg-muted" : ""} ${isToday(day) ? "border-x-2 border-accent-foreground" : ""}`} style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }}>
                        <div>{format(day, "dd")}</div>
                        <div className="text-muted-foreground">{format(day, "MMM")}</div>
                        <div className="text-muted-foreground">{format(day, "EEE")}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {groups.map(([phase, groupTasks]) => (
                <div key={phase}>
                  <div className="flex h-9 border-b border-border bg-muted/60">
                    <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-muted px-3 py-2 text-xs font-semibold" style={{ width: LABEL_WIDTH }}>{phase}</div>
                    <div style={{ width: range.days.length * DAY_WIDTH }} />
                  </div>
                  {groupTasks.map((task) => {
                    const start = parseISO(task.planned_start_date!);
                    const finish = parseISO(task.planned_finish_date!);
                    const left = differenceInCalendarDays(start, range.start) * DAY_WIDTH;
                    const width = (differenceInCalendarDays(finish, start) + 1) * DAY_WIDTH;
                    return (
                      <div key={task.id} className="flex h-11 border-b border-border">
                        <div className="sticky left-0 z-20 shrink-0 truncate border-r border-border bg-card px-3 py-3 text-xs" style={{ width: LABEL_WIDTH }} title={`${task.task_id_in_schedule} — ${task.task_name}`}>
                          <span className="mr-2 text-muted-foreground">{task.task_id_in_schedule}</span>{task.task_name}
                        </div>
                        <div className="relative flex-1" style={{ width: range.days.length * DAY_WIDTH }}>
                          {range.days.map((day, index) => {
                            const key = format(day, "yyyy-MM-dd");
                            const off = isSunday(day) || holidayDates.has(key);
                            return <div key={key} className={`absolute inset-y-0 border-r border-border/60 ${off ? "bg-muted" : ""} ${isToday(day) ? "border-x-2 border-accent-foreground" : ""}`} style={{ left: index * DAY_WIDTH, width: DAY_WIDTH }} />;
                          })}
                          <div className="absolute top-2 flex h-7 items-center overflow-hidden rounded bg-primary px-2 text-[10px] text-primary-foreground" style={{ left: left + 2, width: Math.max(width - 4, DAY_WIDTH - 4) }} title={`${task.task_name}: ${task.planned_start_date} to ${task.planned_finish_date}`}>
                            <span className="truncate">{task.task_name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex h-7">
                <div className="sticky left-0 z-20 shrink-0 border-r border-border bg-card" style={{ width: LABEL_WIDTH }} />
                <div className="relative" style={{ width: range.days.length * DAY_WIDTH }}>
                  {range.days.some(isToday) && <div className="absolute bottom-0 top-0 w-0.5 bg-accent-foreground" style={{ left: differenceInCalendarDays(new Date(), range.start) * DAY_WIDTH + DAY_WIDTH / 2 }} />}
                </div>
              </div>
            </div>
          </div>
        )}
        {range && <p className="mt-3 text-xs text-muted-foreground">Timeline: {format(range.start, "dd/MM/yyyy")} – {format(addDays(range.end, 0), "dd/MM/yyyy")}. Today is marked with a vertical line.</p>}
      </CardContent>
    </Card>
  );
}
