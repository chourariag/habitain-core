import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export const REQUIRED_GATES = [
  { code: "C-3", label: "Sale Agreement" },
  { code: "C-4", label: "Scope of Work" },
  { code: "E-3", label: "S1 Sign-off" },
  { code: "E-5", label: "H1 Issued — Advance GFC" },
  { code: "E-8", label: "GFC Budget" },
  { code: "P-1", label: "Handover to Planning" },
] as const;

export const SETUP_GATE_CODES = ["C-3", "C-4", "E-3", "E-5", "E-8"];

type Status = "Not Started" | "In Progress" | "Completed" | "Blocked" | "Skipped";
type GateInfo = { code: string; label: string; status: Status; notes: string | null };

export async function fetchPreProdGates(projectId: string): Promise<GateInfo[]> {
  const { data } = await supabase
    .from("project_design_stages")
    .select("status, notes, design_stage_definitions!inner(stage_code, pipeline_type)")
    .eq("project_id", projectId)
    .eq("design_stage_definitions.pipeline_type", "habitainer")
    .in("design_stage_definitions.stage_code", REQUIRED_GATES.map(g => g.code));

  const byCode = new Map<string, { status: Status; notes: string | null }>();
  for (const r of (data ?? []) as any[]) {
    byCode.set(r.design_stage_definitions.stage_code, { status: r.status, notes: r.notes });
  }
  return REQUIRED_GATES.map(g => ({
    code: g.code,
    label: g.label,
    status: (byCode.get(g.code)?.status ?? "Not Started") as Status,
    notes: byCode.get(g.code)?.notes ?? null,
  }));
}

export function usePreProdGates(projectId: string) {
  const [gates, setGates] = useState<GateInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPreProdGates(projectId).then(g => { if (!cancelled) setGates(g); });
    return () => { cancelled = true; };
  }, [projectId]);
  const completedCount = (gates ?? []).filter(g => g.status === "Completed").length;
  const setupReady = (gates ?? []).filter(g => SETUP_GATE_CODES.includes(g.code)).every(g => g.status === "Completed");
  const allComplete = (gates?.length ?? 0) > 0 && completedCount === REQUIRED_GATES.length;
  return { gates, completedCount, total: REQUIRED_GATES.length, setupReady, allComplete, loading: gates === null };
}

export function PreProductionChecklist({ projectId, projectType }: { projectId: string; projectType?: string | null }) {
  // ADS projects have no production — skip.
  if ((projectType ?? "").toLowerCase().startsWith("ads")) return null;

  const { gates, completedCount, total, allComplete, loading } = usePreProdGates(projectId);
  if (loading) {
    return (
      <Card><CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading pre-production checklist…
      </CardContent></Card>
    );
  }
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  let borderColor = "#F40009"; // red 0-3
  if (allComplete) borderColor = "#006039";
  else if (completedCount >= 4) borderColor = "#D4860A";

  if (allComplete) {
    return (
      <Card style={{ borderColor, borderWidth: 2 }}>
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 mt-0.5" style={{ color: "#006039" }} />
          <div>
            <p className="font-display font-semibold text-foreground">Ready for Production</p>
            <p className="text-sm text-muted-foreground">All pre-production gates complete. Project Setup can now be uploaded.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ borderColor, borderWidth: 2 }}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-semibold text-foreground text-sm uppercase tracking-wide">Pre-Production Checklist</p>
            <p className="text-sm text-muted-foreground">{completedCount} of {total} gates complete</p>
          </div>
          <span className="text-sm font-medium" style={{ color: borderColor }}>{pct}%</span>
        </div>
        <Progress value={pct} />
        <ul className="space-y-1.5">
          {gates!.map(g => (
            <li key={g.code} className="flex items-start gap-2 text-sm">
              {g.status === "Completed" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#006039" }} />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#F40009" }} />
              )}
              <span className={g.status === "Completed" ? "text-foreground" : "text-foreground"}>
                <span className="font-mono text-xs text-muted-foreground mr-1.5">{g.code}</span>
                {g.label}
                {g.status !== "Completed" && (
                  <span className="text-muted-foreground"> — {g.status === "Not Started" ? "Not completed" : g.status}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 rounded-md p-2.5" style={{ backgroundColor: "#FFF8E8" }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
          <p className="text-xs" style={{ color: "#7A4E04" }}>
            Production cannot start until all 6 gates are complete. Gates are updated from{" "}
            <Link to={`/projects/${projectId}?tab=design-schedule`} className="underline font-medium">Design Schedule</Link>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
