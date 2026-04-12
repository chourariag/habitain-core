import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, subWeeks, startOfWeek } from "date-fns";

function getWeekStart(date: Date) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

interface ManpowerRow {
  id?: string;
  moduleId: string;
  moduleCode: string;
  projectName: string;
  plannedWorkers: number;
  actualWorkers: number;
}

export function WeeklyManpowerPlanner() {
  const [weekDate, setWeekDate] = useState(() => getWeekStart(new Date()));
  const [rows, setRows] = useState<ManpowerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekKey = format(weekDate, "yyyy-MM-dd");

  useEffect(() => { fetchData(); }, [weekKey]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: modules }, { data: plans }] = await Promise.all([
      supabase
        .from("modules")
        .select("id, module_code, name, projects(name)")
        .eq("is_archived", false)
        .in("production_status", ["not_started", "in_progress"]),
      (supabase.from("weekly_manpower_plans" as any) as any)
        .select("*")
        .eq("week_start_date", weekKey),
    ]);

    const planMap: Record<string, any> = {};
    (plans ?? []).forEach((p: any) => { planMap[p.module_id] = p; });

    setRows(
      (modules ?? []).map((m: any) => ({
        id: planMap[m.id]?.id,
        moduleId: m.id,
        moduleCode: m.module_code || m.name,
        projectName: m.projects?.name || "—",
        plannedWorkers: planMap[m.id]?.planned_workers ?? 0,
        actualWorkers: planMap[m.id]?.actual_workers ?? 0,
      }))
    );
    setLoading(false);
  };

  const handleChange = (moduleId: string, field: "plannedWorkers" | "actualWorkers", value: number) => {
    setRows((prev) => prev.map((r) => r.moduleId === moduleId ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const row of rows) {
      if (row.plannedWorkers === 0 && row.actualWorkers === 0 && !row.id) continue;
      if (row.id) {
        await (supabase.from("weekly_manpower_plans" as any) as any)
          .update({ planned_workers: row.plannedWorkers, actual_workers: row.actualWorkers })
          .eq("id", row.id);
      } else if (row.plannedWorkers > 0 || row.actualWorkers > 0) {
        await (supabase.from("weekly_manpower_plans" as any) as any)
          .insert({ module_id: row.moduleId, week_start_date: weekKey, planned_workers: row.plannedWorkers, actual_workers: row.actualWorkers });
      }
    }
    toast.success("Manpower plan saved");
    setSaving(false);
    fetchData();
  };

  const totalPlanned = rows.reduce((s, r) => s + r.plannedWorkers, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualWorkers, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setWeekDate((d) => subWeeks(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
            Week of {format(weekDate, "dd MMM yyyy")}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setWeekDate((d) => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span style={{ color: "#666" }}>Planned: <strong>{totalPlanned}</strong></span>
          <span style={{ color: "#006039" }}>Actual: <strong>{totalActual}</strong></span>
          <Button size="sm" onClick={handleSave} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs" style={{ color: "#666" }}>
                  <th className="text-left py-2">Module</th>
                  <th className="text-left py-2">Project</th>
                  <th className="text-center py-2 w-24">Planned</th>
                  <th className="text-center py-2 w-24">Actual</th>
                  <th className="text-center py-2 w-16">Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const diff = r.actualWorkers - r.plannedWorkers;
                  return (
                    <tr key={r.moduleId} className="border-b">
                      <td className="py-2 font-medium text-xs" style={{ color: "#1A1A1A" }}>{r.moduleCode}</td>
                      <td className="py-2 text-xs" style={{ color: "#666" }}>{r.projectName}</td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min={0}
                          value={r.plannedWorkers || ""}
                          onChange={(e) => handleChange(r.moduleId, "plannedWorkers", parseInt(e.target.value) || 0)}
                          className="h-7 text-xs text-center w-full"
                        />
                      </td>
                      <td className="py-2">
                        <Input
                          type="number"
                          min={0}
                          value={r.actualWorkers || ""}
                          onChange={(e) => handleChange(r.moduleId, "actualWorkers", parseInt(e.target.value) || 0)}
                          className="h-7 text-xs text-center w-full"
                        />
                      </td>
                      <td className="py-2 text-center text-xs font-mono font-bold" style={{ color: diff > 0 ? "#006039" : diff < 0 ? "#F40009" : "#999" }}>
                        {diff > 0 ? "+" : ""}{diff || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
