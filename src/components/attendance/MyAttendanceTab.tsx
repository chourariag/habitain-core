import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, endOfMonth, eachDayOfInterval, format, isBefore, isSameDay, startOfMonth, subMonths } from "date-fns";
import { CheckInButton } from "./CheckInButton";

interface Props { userRole: string | null }

export function MyAttendanceTab({ userRole }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("attendance_records")
        .select("date,check_in_time,check_out_time,location_type,gps_lat,gps_lng,gps_verified")
        .eq("user_id", user.id)
        .gte("date", format(startOfMonth(month), "yyyy-MM-dd"))
        .lte("date", format(endOfMonth(month), "yyyy-MM-dd"));
      if (!cancelled) {
        setRecords(data ?? []);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, month]);

  const today = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
    .filter((day) => !isBefore(today, day) || isSameDay(day, today))
    .filter((day) => day.getDay() !== 0 || isSameDay(day, today))
    .reverse();

  return (
    <div className="space-y-4">
      <CheckInButton userRole={userRole} />
      <section className="space-y-3" aria-label="Attendance records">
        <div className="flex items-center justify-between gap-3 border-y border-border py-2">
          <Button variant="ghost" size="icon" onClick={() => setMonth((current) => subMonths(current, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-display text-base font-semibold text-foreground">{format(month, "MMMM yyyy")}</h2>
          <Button variant="ghost" size="icon" onClick={() => setMonth((current) => addMonths(current, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ul className="divide-y divide-border border-b border-border">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const record = records.find((item) => item.date === dateKey);
              const isToday = isSameDay(day, today);
              const label = record?.check_in_time ? "Present" : isBefore(day, today) ? "No check-in" : isToday ? "Due today" : "Upcoming";
              return (
                <li key={dateKey} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-24 shrink-0 text-sm font-medium text-foreground">{format(day, "dd/MM/yyyy")}</span>
                    <span className="text-xs text-muted-foreground">{format(day, "EEEE")}</span>
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className={record?.check_in_time ? "font-medium text-primary" : "text-muted-foreground"}>{label}</span>
                    {record?.check_in_time && <span className="text-muted-foreground">In {format(new Date(record.check_in_time), "HH:mm")}</span>}
                    {record?.check_out_time && <span className="text-muted-foreground">Out {format(new Date(record.check_out_time), "HH:mm")}</span>}
                    {record?.location_type && <span className="flex items-center gap-1 capitalize text-muted-foreground"><MapPin className="h-3 w-3" />{record.location_type}</span>}
                    {record?.gps_lat != null && record?.gps_lng != null && <span className="text-muted-foreground">GPS {record.gps_verified ? "verified" : "recorded"}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}