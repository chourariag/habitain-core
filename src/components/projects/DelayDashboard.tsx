import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import * as XLSX from "xlsx";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip as ReTooltip,
} from "recharts";

interface TaskRow {
  id: string;
  task_id_in_schedule: string;
  task_name: string;
  phase: string;
  planned_finish_date: string | null;
  actual_finish_date: string | null;
  completion_percentage: number;
  delay_cause?: string | null;
  delay_resolution?: string | null;
  remarks: string | null;
  status: string;
}

interface Props {
  tasks: TaskRow[];
}

const PIE_COLORS = ["#006039", "#2563eb", "#F40009", "#d97706", "#7c3aed", "#0891b2", "#64748b", "#dc2626", "#ea580c"];

const CAUSE_LABELS: Record<string, { type: "Internal" | "External"; short: string }> = {
  "Internal — Method": { type: "Internal", short: "Method" },
  "Internal — Manpower": { type: "Internal", short: "Manpower" },
  "Internal — Material": { type: "Internal", short: "Material" },
  "Internal — Equipment": { type: "Internal", short: "Equipment" },
  "External — Client": { type: "External", short: "Client" },
  "External — Vendor": { type: "External", short: "Vendor" },
  "External — Weather": { type: "External", short: "Weather" },
  "External — Approvals": { type: "External", short: "Approvals" },
  "External — Payment": { type: "External", short: "Payment" },
};

export function DelayDashboard({ tasks }: Props) {
  const delayedTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (!t.planned_finish_date) return false;
        if (t.completion_percentage === 100 && t.actual_finish_date) {
          return new Date(t.actual_finish_date) > new Date(t.planned_finish_date);
        }
        if (t.completion_percentage < 100 && new Date(t.planned_finish_date) < new Date()) {
          return true;
        }
        return false;
      })
      .map((t) => {
        const delayDays = t.completion_percentage === 100 && t.actual_finish_date
          ? differenceInDays(new Date(t.actual_finish_date), new Date(t.planned_finish_date!))
          : differenceInDays(new Date(), new Date(t.planned_finish_date!));
        return { ...t, delayDays, resolved: t.completion_percentage === 100 };
      })
      .sort((a, b) => b.delayDays - a.delayDays);
  }, [tasks]);

  const stats = useMemo(() => {
    const totalDelayDays = delayedTasks.reduce((s, t) => s + t.delayDays, 0);
    const internal = delayedTasks.filter((t) => t.delay_cause && CAUSE_LABELS[t.delay_cause]?.type === "Internal").length;
    const external = delayedTasks.filter((t) => t.delay_cause && CAUSE_LABELS[t.delay_cause]?.type === "External").length;
    const total = delayedTasks.length;
    const phaseDelays: Record<string, number> = {};
    delayedTasks.forEach((t) => { phaseDelays[t.phase] = (phaseDelays[t.phase] ?? 0) + t.delayDays; });
    const mostDelayed = Object.entries(phaseDelays).sort((a, b) => b[1] - a[1])[0];
    return { total, totalDelayDays, internal, external, internalPct: total > 0 ? Math.round((internal / total) * 100) : 0, externalPct: total > 0 ? Math.round((external / total) * 100) : 0, mostDelayed };
  }, [delayedTasks]);

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    delayedTasks.forEach((t) => {
      const cause = t.delay_cause ?? "Unspecified";
      counts[cause] = (counts[cause] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: CAUSE_LABELS[name]?.short ?? name, value }));
  }, [delayedTasks]);

  const exportDelayReport = () => {
    const rows = delayedTasks.map((t) => ({
      "Task ID": t.task_id_in_schedule,
      "Task Name": t.task_name,
      Phase: t.phase,
      "Planned Finish": t.planned_finish_date ? format(new Date(t.planned_finish_date), "dd/MM/yyyy") : "",
      "Actual Finish": t.actual_finish_date ? format(new Date(t.actual_finish_date), "dd/MM/yyyy") : "Ongoing",
      "Delay Days": t.delayDays,
      "Cause Category": t.delay_cause ?? "",
      "Cause Description": t.remarks ?? "",
      "Short-Term Solution": t.delay_resolution ?? "",
      "Impact (days)": t.delayDays,
      Status: t.resolved ? "Resolved" : "Ongoing",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Delay Matrix");
    XLSX.writeFile(wb, "Delay_Report.xlsx");
  };

  if (delayedTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-[#006039]" />
          <p className="text-sm text-muted-foreground">No delays recorded. All tasks are on track.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Delays", value: stats.total, color: "text-red-600" },
          { label: "Total Delay Days", value: stats.totalDelayDays, color: "text-red-600" },
          { label: "Internal Delays", value: `${stats.internal} (${stats.internalPct}%)`, color: "text-amber-600" },
          { label: "External Delays", value: `${stats.external} (${stats.externalPct}%)`, color: "text-blue-600" },
          { label: "Most Delayed Phase", value: stats.mostDelayed ? `${stats.mostDelayed[0]}` : "-", sub: stats.mostDelayed ? `${stats.mostDelayed[1]}d` : "", color: "text-foreground" },
        ].map((s, i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cause Analysis Pie */}
      {pieData.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Delay Cause Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <ReTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delay Table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Delay Records</h3>
        <Button size="sm" variant="outline" onClick={exportDelayReport}>
          <Download className="h-4 w-4 mr-1" /> Export Delay Report
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">ID</TableHead>
              <TableHead>Task Name</TableHead>
              <TableHead className="w-24">Phase</TableHead>
              <TableHead className="w-24">Planned</TableHead>
              <TableHead className="w-24">Actual</TableHead>
              <TableHead className="w-16">Days</TableHead>
              <TableHead className="w-28">Cause</TableHead>
              <TableHead>Solution</TableHead>
              <TableHead className="w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {delayedTasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.task_id_in_schedule}</TableCell>
                <TableCell className="text-sm font-medium">{t.task_name}</TableCell>
                <TableCell className="text-xs">{t.phase}</TableCell>
                <TableCell className="text-xs">{t.planned_finish_date ? format(new Date(t.planned_finish_date), "dd MMM") : "-"}</TableCell>
                <TableCell className="text-xs">{t.actual_finish_date ? format(new Date(t.actual_finish_date), "dd MMM") : "Ongoing"}</TableCell>
                <TableCell className="text-xs font-bold text-red-600">+{t.delayDays}d</TableCell>
                <TableCell className="text-xs">{t.delay_cause ?? <span className="text-muted-foreground italic">Not specified</span>}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{t.delay_resolution ?? t.remarks ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${t.resolved ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {t.resolved ? "Resolved" : "Ongoing"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
