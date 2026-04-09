import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

interface ReworkEntry {
  id: string;
  ncr_number: string;
  module_name: string;
  project_name: string;
  regression_from_stage: number | null;
  regression_to_stage: number | null;
  regression_reason: string | null;
  regression_start_date: string | null;
  regression_end_date: string | null;
  total_rework_hours: number;
  total_rework_cost: number;
  status: string;
}

const STAGES = ["Sub-Frame","MEP Rough-In","Insulation","Drywall","Paint","MEP Final","Windows & Doors","Finishing","QC Inspection","Dispatch"];

export function ReworkSummaryTab() {
  const [entries, setEntries] = useState<ReworkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState("all");
  const [projects, setProjects] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    (async () => {
      const [ncrRes, projRes] = await Promise.all([
        (supabase.from("ncr_register") as any)
          .select("id, ncr_number, status, requires_regression, regression_from_stage, regression_to_stage, regression_reason, regression_start_date, regression_end_date, total_rework_hours, total_rework_cost, qc_inspections(module_id, modules(name, module_code, project_id, projects(name)))")
          .eq("requires_regression", true)
          .eq("is_archived", false)
          .order("created_at", { ascending: false }),
        supabase.from("projects").select("id, name").eq("is_archived", false).order("name"),
      ]);

      const mapped = (ncrRes.data ?? []).map((n: any) => ({
        id: n.id,
        ncr_number: n.ncr_number,
        module_name: n.qc_inspections?.modules?.module_code || n.qc_inspections?.modules?.name || "—",
        project_name: n.qc_inspections?.modules?.projects?.name || "—",
        project_id: n.qc_inspections?.modules?.project_id,
        regression_from_stage: n.regression_from_stage,
        regression_to_stage: n.regression_to_stage,
        regression_reason: n.regression_reason,
        regression_start_date: n.regression_start_date,
        regression_end_date: n.regression_end_date,
        total_rework_hours: n.total_rework_hours ?? 0,
        total_rework_cost: n.total_rework_cost ?? 0,
        status: n.status,
      }));

      setEntries(mapped);
      setProjects(projRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = projectFilter === "all" ? entries : entries.filter((e: any) => e.project_id === projectFilter);

  const daysLost = (e: ReworkEntry) => {
    if (!e.regression_start_date) return "—";
    const end = e.regression_end_date ? new Date(e.regression_end_date) : new Date();
    const start = new Date(e.regression_start_date);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No rework records found.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Project</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">NCR ID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Module</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Stage Regressed</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Days Lost</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Rework Cost (₹)</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Root Cause</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{e.project_name}</td>
                  <td className="px-3 py-2 font-mono text-foreground">{e.ncr_number}</td>
                  <td className="px-3 py-2 text-foreground">{e.module_name}</td>
                  <td className="px-3 py-2 text-foreground">
                    {e.regression_from_stage != null && e.regression_to_stage != null
                      ? `${STAGES[e.regression_from_stage] || e.regression_from_stage} → ${STAGES[e.regression_to_stage] || e.regression_to_stage}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-foreground">{daysLost(e)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">₹{e.total_rework_cost.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{e.regression_reason || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={e.status === "closed" ? "text-muted-foreground" : "text-warning-foreground"}>
                      {e.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center gap-6 text-sm bg-muted/30 rounded-lg p-3">
          <span className="text-muted-foreground">Total Rework Cost:</span>
          <span className="font-bold text-destructive">₹{filtered.reduce((s, e) => s + e.total_rework_cost, 0).toLocaleString("en-IN")}</span>
          <span className="text-muted-foreground">Total Hours:</span>
          <span className="font-bold text-foreground">{filtered.reduce((s, e) => s + e.total_rework_hours, 0).toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
