import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, MapPin } from "lucide-react";
import { format, startOfMonth, endOfMonth, isSunday, eachDayOfInterval } from "date-fns";
import { CheckInButton } from "./CheckInButton";

interface Props { userRole: string | null }

export function MyAttendanceTab({ userRole }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const start = format(startOfMonth(month), "yyyy-MM-dd");
      const end = format(endOfMonth(month), "yyyy-MM-dd");
      const { data } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end);
      setRecords(data ?? []);
      setLoading(false);
    })();
  }, [user, month]);

  const workingDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).filter(d => !isSunday(d) && d <= new Date()).length;
  const present = records.filter(r => r.check_in_time).length;
  const absent = Math.max(0, workingDays - present);
  const lateArrivals = records.filter(r => {
    if (!r.check_in_time) return false;
    const d = new Date(r.check_in_time);
    return d.getHours() > 9 || (d.getHours() === 9 && d.getMinutes() > 30);
  }).length;

  const recForSelected = selected ? records.find(r => r.date === format(selected, "yyyy-MM-dd")) : null;

  return (
    <div className="space-y-4">
      <CheckInButton userRole={userRole} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Days Present", value: present, color: "#006039" },
          { label: "Days Absent", value: absent, color: "#F40009" },
          { label: "On Leave", value: 0, color: "#D4860A" },
          { label: "Late Arrivals", value: lateArrivals, color: "#D4860A" },
        ].map(t => (
          <div key={t.label} className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7", borderLeft: `3px solid ${t.color}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999" }}>{t.label}</p>
            <p className="text-2xl font-bold font-display mt-1" style={{ color: t.color }}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-3">
          {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : (
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setSelected}
              month={month}
              onMonthChange={setMonth}
              modifiers={{
                present: records.filter(r => r.check_in_time).map(r => new Date(r.date)),
              }}
              modifiersStyles={{
                present: { backgroundColor: "#E8F2ED", color: "#006039", fontWeight: 700 },
              }}
              className="p-0 pointer-events-auto"
            />
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="font-display text-sm font-semibold" style={{ color: "#1A1A1A" }}>
            {selected ? format(selected, "EEEE, dd MMM yyyy") : "Select a day"}
          </h3>
          {recForSelected ? (
            <div className="space-y-1.5 text-sm">
              <p><span style={{ color: "#666" }}>Check-in:</span> <span className="font-mono font-semibold">{recForSelected.check_in_time ? format(new Date(recForSelected.check_in_time), "hh:mm a") : "—"}</span></p>
              <p><span style={{ color: "#666" }}>Check-out:</span> <span className="font-mono font-semibold">{recForSelected.check_out_time ? format(new Date(recForSelected.check_out_time), "hh:mm a") : "—"}</span></p>
              <p><span style={{ color: "#666" }}>Hours:</span> <span className="font-mono font-semibold">{recForSelected.hours_worked?.toFixed(1) ?? "—"}h</span></p>
              <p><span style={{ color: "#666" }}>Location:</span> <span className="capitalize">{recForSelected.location_type ?? "—"}</span></p>
              {recForSelected.gps_lat && (
                <p className="flex items-center gap-1 text-xs" style={{ color: "#666" }}>
                  <MapPin className="h-3 w-3" />
                  {Number(recForSelected.gps_lat).toFixed(4)}, {Number(recForSelected.gps_lng).toFixed(4)}
                  {recForSelected.gps_verified && <span className="ml-1" style={{ color: "#006039" }}>✓ Verified</span>}
                </p>
              )}
              {recForSelected.location_note && <p className="text-xs italic" style={{ color: "#666" }}>"{recForSelected.location_note}"</p>}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "#999" }}>No attendance record for this day.</p>
          )}
        </div>
      </div>
    </div>
  );
}
