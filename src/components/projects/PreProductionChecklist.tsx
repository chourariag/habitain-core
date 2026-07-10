import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { isAdsDivision, ADS_REQUIRED_GATES } from "@/lib/project-type";

// C-3 (Sale Agreement) + C-4 (Scope of Work) are combined into one row: "sale_scope"
export const REQUIRED_GATES = [
  { code: "sale_scope", label: "Sale Agreement + Scope of Work" },
  { code: "E-3", label: "S1 Sign-off" },
  { code: "E-5", label: "H1 Issued — Advance GFC" },
  { code: "E-8", label: "GFC Budget" },
  { code: "P-1", label: "Handover to Planning" },
] as const;

export const SETUP_GATE_CODES = ["sale_scope", "E-3", "E-5", "E-8"];

type Status = "Not Started" | "In Progress" | "Completed" | "Blocked" | "Skipped";
type GateInfo = { code: string; label: string; status: Status; notes: string | null };

export async function fetchPreProdGates(projectId: string, pipeline: "habitainer" | "ads" = "habitainer"): Promise<GateInfo[]> {
  const gateList = pipeline === "ads" ? ADS_REQUIRED_GATES : REQUIRED_GATES;
  const codeSet = gateList.map(g => g.code).filter(c => c !== "sale_scope");
  const [stagesRes, scopeRes, saleRes] = await Promise.all([
    supabase.from("project_design_stages")
      .select("status, notes, design_stage_definitions!inner(stage_code, pipeline_type)")
      .eq("project_id", projectId)
      .eq("design_stage_definitions.pipeline_type", pipeline)
      .in("design_stage_definitions.stage_code", codeSet),
    (supabase as any).from("project_scope_of_work").select("status").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    (supabase as any).from("contracts_register").select("id, contract_file_url").eq("project_id", projectId).eq("contract_type", "Sale Agreement").eq("is_archived", false).limit(1).maybeSingle(),
  ]);

  const byCode = new Map<string, { status: Status; notes: string | null }>();
  for (const r of (stagesRes.data ?? []) as any[]) {
    byCode.set(r.design_stage_definitions.stage_code, { status: r.status, notes: r.notes });
  }
  const scopeSigned = scopeRes.data?.status === "signed";
  const saleUploaded = !!saleRes.data?.contract_file_url;
  const combinedStatus: Status = scopeSigned && saleUploaded ? "Completed" : "Not Started";
  const combinedNote = scopeSigned && saleUploaded
    ? null
    : `${scopeSigned ? "✓" : "✗"} Scope signed · ${saleUploaded ? "✓" : "✗"} Sale Agreement uploaded`;

  return gateList.map(g => {
    if (g.code === "sale_scope") {
      return { code: g.code, label: g.label, status: combinedStatus, notes: combinedNote };
    }
    return {
      code: g.code,
      label: g.label,
      status: (byCode.get(g.code)?.status ?? "Not Started") as Status,
      notes: byCode.get(g.code)?.notes ?? null,
    };
  });
}

export function usePreProdGates(projectId: string, pipeline: "habitainer" | "ads" = "habitainer") {
  const [gates, setGates] = useState<GateInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPreProdGates(projectId, pipeline).then(g => { if (!cancelled) setGates(g); });
    return () => { cancelled = true; };
  }, [projectId, pipeline]);
  const total = pipeline === "ads" ? ADS_REQUIRED_GATES.length : REQUIRED_GATES.length;
  const completedCount = (gates ?? []).filter(g => g.status === "Completed").length;
  const setupReady = pipeline === "ads"
    ? completedCount === total
    : (gates ?? []).filter(g => SETUP_GATE_CODES.includes(g.code)).every(g => g.status === "Completed");
  const allComplete = (gates?.length ?? 0) > 0 && completedCount === total;
  return { gates, completedCount, total, setupReady, allComplete, loading: gates === null };
}

export function PreProductionChecklist({ projectId, division }: { projectId: string; division?: string | null }) {
  const isAds = isAdsDivision(division);
  const pipeline: "habitainer" | "ads" = isAds ? "ads" : "habitainer";
  const { gates, completedCount, total, allComplete, loading } = usePreProdGates(projectId, pipeline);
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
  else if (completedCount >= Math.ceil(total * 0.6)) borderColor = "#D4860A";

  const readyLabel = isAds ? "ADS Design Ready" : "Ready for Production";
  const readyMsg = isAds
    ? "All ADS design gates complete. GFC drawings issued — design delivery complete."
    : "All pre-production gates complete. Project Setup can now be uploaded.";

  if (allComplete) {
    return (
      <Card style={{ borderColor, borderWidth: 2 }}>
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 mt-0.5" style={{ color: "#006039" }} />
          <div>
            <p className="font-display font-semibold text-foreground">{readyLabel}</p>
            <p className="text-sm text-muted-foreground">{readyMsg}</p>
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
            <p className="font-display font-semibold text-foreground text-sm uppercase tracking-wide">
              {isAds ? "ADS Design Gate Checklist" : "Pre-Production Checklist"}
            </p>
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
              <span className="text-foreground">
                <span className="font-mono text-xs text-muted-foreground mr-1.5">{g.code === "sale_scope" ? "C-3+C-4" : g.code}</span>
                {g.label}
                {g.status !== "Completed" && (
                  <span className="text-muted-foreground"> — {g.notes ?? (g.status === "Not Started" ? "Not completed" : g.status)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-start gap-2 rounded-md p-2.5" style={{ backgroundColor: "#FFF8E8" }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
          <p className="text-xs" style={{ color: "#7A4E04" }}>
            {isAds
              ? <>ADS design gates are updated from <Link to={`/projects/${projectId}?tab=design-schedule`} className="underline font-medium">Design Schedule</Link>.</>
              : <>Production cannot start until all {total} gates are complete. Gates are updated from <Link to={`/projects/${projectId}?tab=design-schedule`} className="underline font-medium">Design Schedule</Link>.</>
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
