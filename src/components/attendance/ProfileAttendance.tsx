import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Loader2, Calendar as CalIcon } from "lucide-react";
import { format, subDays, isSunday, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { LeaveRequestDrawer } from "./LeaveRequestDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ARCHITECT_ROLES = ["principal_architect", "project_architect", "structural_architect"];

interface Props {
  userRole: string | null;
}

export function ProfileAttendance({ userRole }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isArchitect = userRole && ARCHITECT_ROLES.includes(userRole);

  useEffect(() => {
    if (!user || isArchitect) return;
    fetchRecords();
  }, [user]);

  const fetchRecords = async () => {
    if (!user) return;
    setLoading(true);
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("attendance_records")
      .select("date, location_type, check_in_time")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo)
      .lte("date", today);
    setRecords(data ?? []);
    setLoading(false);
  };

  if (isArchitect || !user) return null;

  // This month stats
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const monthRecords = records.filter((r: any) => r.date >= monthStart && r.date <= monthEnd);
  const monthWorkingDays = eachDayOfInterval({ start: startOfMonth(now), end: now }).filter((d) => !isSunday(d)).length;
  const presentDays = monthRecords.filter((r: any) => r.check_in_time).length;
  const absentDays = Math.max(0, monthWorkingDays - presentDays);

  // Last 30 days strip
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(now, 29 - i);
    const dateStr = format(d, "yyyy-MM-dd");
    const rec = records.find((r: any) => r.date === dateStr);
    const isWeekend = isSunday(d);
    const isFuture = d > now;
    let color = "#E5E7EB"; // grey = weekend/future
    let label = "Weekend";
    if (!isWeekend && !isFuture) {
      if (rec?.check_in_time) {
        color = "#006039"; // present
        label = "Present";
      } else {
        color = "#F40009"; // absent
        label = "Absent";
      }
    }
    return { date: d, color, label };
  });

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  return (
    <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <CalIcon className="h-4 w-4" style={{ color: "#006039" }} /> My Attendance
        </h2>
        <LeaveRequestDrawer onSuccess={fetchRecords} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-md p-3" style={{ backgroundColor: "#E8F2ED" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#006039" }}>Present</p>
          <p className="text-xl font-bold font-display" style={{ color: "#006039" }}>{presentDays}</p>
        </div>
        <div className="rounded-md p-3" style={{ backgroundColor: "#FFF3E0" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#D4860A" }}>Leave</p>
          <p className="text-xl font-bold font-display" style={{ color: "#D4860A" }}>0</p>
        </div>
        <div className="rounded-md p-3" style={{ backgroundColor: "#FEE2E2" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#F40009" }}>Absent</p>
          <p className="text-xl font-bold font-display" style={{ color: "#F40009" }}>{absentDays}</p>
        </div>
      </div>

      <p className="text-xs mb-2" style={{ color: "#999" }}>Last 30 days</p>
      <div className="flex gap-[3px] flex-wrap">
        {last30.map((d, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div className="w-[14px] h-[14px] rounded-[2px]" style={{ backgroundColor: d.color }} />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{format(d.date, "dd MMM")} — {d.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-[10px]" style={{ color: "#999" }}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#006039" }} /> Present</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#D4860A" }} /> Leave</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#F40009" }} /> Absent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#E5E7EB" }} /> Weekend</span>
      </div>
    </div>
  );
}
