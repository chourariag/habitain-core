import { startOfWeek, addDays, setHours, setMinutes, setSeconds, format } from "date-fns";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// deadline_day in DB: 1=Mon..6=Sat (matches ISO weekday Mon=1)

export type ReportConfig = {
  id: string;
  report_name: string;
  assigned_role: string | null;
  assigned_user_id: string | null;
  deadline_day: number;
  deadline_time: string; // HH:MM:SS
  frequency: "weekly" | "fortnightly";
  reviewer_user_id: string | null;
  reviewer_role: string | null;
  active: boolean;
};

/** Returns deadline Date for the report period that contains `now`. Week = Mon..Sun. */
export function computeDeadline(cfg: Pick<ReportConfig, "deadline_day" | "deadline_time">, ref = new Date()): Date {
  const monday = startOfWeek(ref, { weekStartsOn: 1 });
  const day = addDays(monday, cfg.deadline_day - 1);
  const [h, m] = cfg.deadline_time.split(":").map(Number);
  return setSeconds(setMinutes(setHours(day, h), m), 0);
}

/** Period is Mon..Sun of the week containing the deadline. */
export function computePeriod(cfg: Pick<ReportConfig, "deadline_day" | "deadline_time">, ref = new Date()) {
  const monday = startOfWeek(ref, { weekStartsOn: 1 });
  const sunday = addDays(monday, 6);
  return {
    start: monday,
    end: sunday,
    label: `Week of ${format(monday, "d")}–${format(sunday, "d MMM yyyy")}`,
  };
}

export function statusFromTimes(submittedAt: Date, deadline: Date): "on_time" | "late" | "missed" {
  if (submittedAt <= deadline) return "on_time";
  // same calendar day as deadline => late, else missed
  const sameDay = submittedAt.toDateString() === deadline.toDateString();
  return sameDay ? "late" : "missed";
}

export function minutesDiff(submittedAt: Date, deadline: Date): number {
  return Math.round((submittedAt.getTime() - deadline.getTime()) / 60000);
}
