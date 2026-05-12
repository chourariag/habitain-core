import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { FACTORY_STAGES } from "@/lib/hstack-stages";
import { useProjectImportListener } from "@/lib/use-project-import";

interface Props {
  moduleId: string;
  currentStage: string | null;
  userRole: string | null;
}

interface ScheduleRow {
  stage_number: number;
  stage_name: string;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  is_na: boolean;
}

const fmt = (d: string | null) => d ? format(new Date(d), "dd/MM/yyyy") : "—";

export function ModuleSchedule({ moduleId, currentStage }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Resolve module → project_id
    const { data: mod } = await supabase.from("modules").select("project_id").eq("id", moduleId).maybeSingle();
    const projectId = (mod as any)?.project_id ?? null;

    let stageRows: any[] = [];
    if (projectId) {
      // Prefer module-specific rows; fall back to project-level rows where module_id is null
      const { data } = await (supabase.from("project_stages") as any)
        .select("stage_number, stage_name, planned_start, planned_end, actual_start, actual_end, status, is_na, module_id")
        .eq("project_id", projectId)
        .lte("stage_number", 15);
      stageRows = (data || []).filter((s: any) => s.module_id === moduleId || s.module_id == null);
    }

    // Pull task-level rollup to derive Actual Start/End if project_stages doesn't have them yet
    let taskRollup: Record<string, { firstActual?: string; lastActual?: string }> = {};
    if (projectId) {
      const { data: tdata } = await supabase
        .from("project_tasks")
        .select("stage_name, status, actual_start_date, actual_finish_date")
        .eq("project_id", projectId);
      (tdata || []).forEach((t: any) => {
        if (!t.stage_name) return;
        const r = (taskRollup[t.stage_name] ||= {});
        if (t.actual_start_date && (!r.firstActual || t.actual_start_date < r.firstActual)) r.firstActual = t.actual_start_date;
        if (t.actual_finish_date && (!r.lastActual || t.actual_finish_date > r.lastActual)) r.lastActual = t.actual_finish_date;
      });
    }

    // Build authoritative rows from FACTORY_STAGES, hydrate from data
    const out: ScheduleRow[] = FACTORY_STAGES.map((s) => {
      const match = stageRows.find((r: any) => r.stage_number === s.number);
      const tr = taskRollup[s.name] || {};
      const actualStart = match?.actual_start ?? tr.firstActual ?? null;
      const actualEnd = match?.actual_end ?? tr.lastActual ?? null;
      let status = (match?.status as string) || "Pending";
      if (match?.is_na) status = "N/A";
      else if (actualEnd) status = "Completed";
      else if (actualStart) status = "In Progress";
      else status = "Pending";
      return {
        stage_number: s.number,
        stage_name: s.name,
        planned_start: match?.planned_start ?? null,
        planned_end: match?.planned_end ?? null,
        actual_start: actualStart,
        actual_end: actualEnd,
        status,
        is_na: !!match?.is_na,
      };
    });
    setRows(out);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { load(); }, [load]);
  // Refresh after Karthik uploads the Project Setup Template
  useProjectImportListener(moduleId, load);

  const statusStyle = (s: string): string => {
    if (s === "Completed") return "bg-[#E8F2ED] text-[#006039]";
    if (s === "In Progress") return "bg-[#FFF8E8] text-[#D4860A]";
    if (s === "N/A") return "bg-muted text-muted-foreground";
    return "bg-muted text-muted-foreground";
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Production Schedule (live from Project Setup → Schedule sheet)</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-muted-foreground w-10">#</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Stage</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Target Start</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Target End</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Actual Start</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Actual End</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.stage_number} className={`border-b last:border-0 ${row.is_na ? "opacity-60" : ""}`}>
                <td className="p-2 font-mono text-muted-foreground">{row.stage_number}</td>
                <td className="p-2 font-medium text-foreground whitespace-nowrap">{row.stage_name}</td>
                <td className="p-2 text-muted-foreground font-inter">{fmt(row.planned_start)}</td>
                <td className="p-2 text-muted-foreground font-inter">{fmt(row.planned_end)}</td>
                <td className="p-2 text-muted-foreground font-inter">{fmt(row.actual_start)}</td>
                <td className="p-2 text-muted-foreground font-inter">{fmt(row.actual_end)}</td>
                <td className="p-2">
                  <Badge variant="outline" className={`${statusStyle(row.status)} text-[10px] border-0`}>{row.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
