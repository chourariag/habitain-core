import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeDeadline, computePeriod, statusFromTimes, minutesDiff, DAY_NAMES } from "@/lib/weekly-reports";
import { startOfWeek, addDays, subWeeks, format } from "date-fns";

type Row = {
  person: string;
  reportName: string;
  deadline: Date;
  submittedAt: Date | null;
  status: "on_time" | "late" | "missed" | "pending";
  reviewedBy: string | null;
};

export function ReportComplianceTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: cfgs } = await supabase.from("weekly_report_configs").select("*").eq("active", true);
    const { data: profs } = await supabase.from("profiles").select("id,display_name,role,auth_user_id").eq("is_active", true);
    const profMap = new Map((profs || []).map((p) => [p.id, p]));

    const now = new Date();
    const thisWeekRows: Row[] = [];

    // Resolve assignees per config
    for (const c of cfgs || []) {
      const assignees = c.assigned_user_id
        ? [(profs || []).find((p) => p.id === c.assigned_user_id)].filter(Boolean) as any[]
        : (profs || []).filter((p) => p.role === c.assigned_role);

      const deadline = computeDeadline(c as any, now);
      const period = computePeriod(c as any, now);

      const { data: subs } = await supabase
        .from("weekly_report_submissions").select("*")
        .eq("config_id", c.id)
        .eq("report_period_start", period.start.toISOString().slice(0,10));

      for (const a of assignees) {
        const sub = (subs || []).find((s) => s.submitted_by === a.id);
        let status: Row["status"] = "pending";
        let submittedAt: Date | null = null;
        if (sub) {
          submittedAt = new Date(sub.submitted_at);
          status = sub.status;
        } else if (now > addDays(deadline, 0).setHours(23,59,59,999) ? false : false) {
          status = "pending";
        } else {
          // No submission yet
          const endOfDay = new Date(deadline); endOfDay.setHours(23,59,59,999);
          if (now > endOfDay) status = "missed";
          else status = "pending";
        }
        const reviewer = sub?.reviewed_by ? (profMap.get(sub.reviewed_by) as any)?.display_name : null;
        thisWeekRows.push({
          person: a.display_name || "—",
          reportName: c.report_name,
          deadline,
          submittedAt,
          status,
          reviewedBy: reviewer || null,
        });
      }
    }

    // Last 4-week trend per person (only across configs they're assigned to)
    const fourWeeksAgo = subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 4);
    const { data: recentSubs } = await supabase
      .from("weekly_report_submissions").select("submitted_by, status, report_period_start")
      .gte("report_period_start", fourWeeksAgo.toISOString().slice(0,10));

    const trendMap = new Map<string, { person: string; on_time: number; late: number; missed: number }>();
    // Build expected rows per assignee per week (4 weeks)
    for (const c of cfgs || []) {
      const assignees = c.assigned_user_id
        ? [(profs || []).find((p) => p.id === c.assigned_user_id)].filter(Boolean) as any[]
        : (profs || []).filter((p) => p.role === c.assigned_role);
      for (let w = 0; w < 4; w++) {
        const ref = subWeeks(now, w);
        const period = computePeriod(c as any, ref);
        const periodStart = period.start.toISOString().slice(0,10);
        for (const a of assignees) {
          const key = a.id;
          if (!trendMap.has(key)) trendMap.set(key, { person: a.display_name, on_time: 0, late: 0, missed: 0 });
          const sub = (recentSubs || []).find((s) => s.submitted_by === a.id && s.report_period_start === periodStart);
          const t = trendMap.get(key)!;
          if (!sub) {
            // only count as missed if that week has fully passed
            const endOfWeek = addDays(period.end, 0); endOfWeek.setHours(23,59,59,999);
            if (now > endOfWeek) t.missed++;
          } else if (sub.status === "on_time") t.on_time++;
          else if (sub.status === "late") t.late++;
          else if (sub.status === "missed") t.missed++;
        }
      }
    }

    setRows(thisWeekRows);
    setTrend(Array.from(trendMap.values()));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  const onTime = rows.filter((r) => r.status === "on_time").length;
  const late = rows.filter((r) => r.status === "late").length;
  const missed = rows.filter((r) => r.status === "missed").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="On time this week" value={onTime} color="#006039" />
        <Stat label="Late this week" value={late} color="#D4860A" />
        <Stat label="Missed this week" value={missed} color="#F40009" />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Report</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Δ Minutes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.person}</TableCell>
                <TableCell>{r.reportName}</TableCell>
                <TableCell className="text-xs">{format(r.deadline, "EEE dd/MM HH:mm")}</TableCell>
                <TableCell className="text-xs">{r.submittedAt ? format(r.submittedAt, "EEE dd/MM HH:mm") : "—"}</TableCell>
                <TableCell className="text-xs">{r.submittedAt ? minutesDiff(r.submittedAt, r.deadline) : "—"}</TableCell>
                <TableCell><StatusPill status={r.status} /></TableCell>
                <TableCell className="text-xs">{r.reviewedBy || "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reports configured.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Last 4 weeks — compliance per person</h4>
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Person</TableHead><TableHead>On time</TableHead><TableHead>Late</TableHead><TableHead>Missed</TableHead><TableHead>Compliance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {trend.map((t, i) => {
                const total = t.on_time + t.late + t.missed;
                const pct = total ? Math.round((t.on_time / total) * 100) : 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{t.person}</TableCell>
                    <TableCell>{t.on_time}</TableCell>
                    <TableCell>{t.late}</TableCell>
                    <TableCell>{t.missed}</TableCell>
                    <TableCell><Badge style={{ backgroundColor: pct >= 80 ? "#006039" : pct >= 50 ? "#D4860A" : "#F40009", color: "white" }}>{pct}%</Badge></TableCell>
                  </TableRow>
                );
              })}
              {trend.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: any) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    on_time: { bg: "#006039", label: "On Time" },
    late: { bg: "#D4860A", label: "Late" },
    missed: { bg: "#F40009", label: "Missed" },
    pending: { bg: "#999", label: "Pending" },
  };
  const s = map[status] || map.pending;
  return <Badge style={{ backgroundColor: s.bg, color: "white" }}>{s.label}</Badge>;
}
