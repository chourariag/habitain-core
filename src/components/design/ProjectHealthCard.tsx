import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { differenceInDays, format } from "date-fns";

const STAGES = [
  { key: "brief", label: "Brief & Scope" },
  { key: "concept", label: "Concept Design" },
  { key: "schematic", label: "Schematic Design" },
  { key: "design_development", label: "Design Development" },
  { key: "working_drawings", label: "Working Drawings" },
  { key: "gfc_issued", label: "GFC Issued" },
];

const STAGE_MAP: Record<string, string> = {
  "Concept Design": "concept",
  "Schematic Design": "schematic",
  "Design Development": "design_development",
  "Working Drawings": "working_drawings",
  "GFC Issue": "gfc_issued",
};

interface Props {
  project: any;
  designFile: any;
  designStages: any[];
  architects: any[];
}

export function ProjectHealthCard({ project, designFile, designStages, architects }: Props) {
  const currentStageKey = (() => {
    if (designFile?.design_stage === "gfc_issued") return "gfc_issued";
    const projStages = designStages.filter((s: any) => s.project_id === project.id);
    const approved = projStages.filter((s: any) => s.status === "client_approved");
    if (approved.length > 0) {
      const max = approved.reduce((a: any, b: any) => a.stage_order > b.stage_order ? a : b);
      const next = projStages.find((s: any) => s.stage_order > max.stage_order && s.status !== "not_started");
      return STAGE_MAP[next?.stage_name] || STAGE_MAP[max.stage_name] || "brief";
    }
    const active = projStages.filter((s: any) => s.status !== "not_started");
    if (active.length > 0) {
      const first = active.reduce((a: any, b: any) => a.stage_order < b.stage_order ? a : b);
      return STAGE_MAP[first.stage_name] || "brief";
    }
    return "brief";
  })();

  const currentIdx = STAGES.findIndex((s) => s.key === currentStageKey);
  const daysSinceStart = designFile?.created_at ? differenceInDays(new Date(), new Date(designFile.created_at)) : null;
  const targetGfc = designFile?.target_gfc_date ? new Date(designFile.target_gfc_date) : null;
  const daysToGfc = targetGfc ? differenceInDays(targetGfc, new Date()) : null;
  const isDesignOnly = designFile?.is_design_only !== false;

  const gfcColor = daysToGfc !== null
    ? daysToGfc < 0 ? "hsl(var(--destructive))" : daysToGfc <= 14 ? "hsl(var(--warning))" : "hsl(var(--primary))"
    : "hsl(var(--muted-foreground))";

  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)", color: "hsl(var(--foreground))" }}>
              {project.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "hsl(var(--muted-foreground))" }}>
              {project.client_name || "No client"}
            </p>
          </div>
          <Badge variant="outline" style={isDesignOnly
            ? { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none" }
            : { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "none" }
          }>
            {isDesignOnly ? "Design Only" : "Production-Linked"}
          </Badge>
        </div>

        {/* Current stage */}
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Current Stage</p>
          <p className="text-xl font-bold" style={{ color: "hsl(var(--primary))", fontFamily: "var(--font-heading)" }}>
            {STAGES[currentIdx]?.label || "Brief & Scope"}
          </p>
        </div>

        {/* Stage progress bar */}
        <div className="flex items-center gap-0">
          {STAGES.map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    i < currentIdx ? "border-transparent" : i === currentIdx ? "border-transparent" : "border-border"
                  }`}
                  style={{
                    backgroundColor: i < currentIdx ? "hsl(var(--primary))" : i === currentIdx ? "hsl(var(--primary))" : "transparent",
                    ...(i === currentIdx ? { boxShadow: "0 0 0 3px hsl(var(--accent))" } : {}),
                  }}
                >
                  {i <= currentIdx && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <p className="text-[9px] mt-1 text-center w-14 leading-tight" style={{
                  color: i <= currentIdx ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  fontWeight: i === currentIdx ? 600 : 400,
                }}>
                  {stage.label}
                </p>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className="h-0.5 w-4 md:w-8 -mt-4"
                  style={{ backgroundColor: i < currentIdx ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-xs">
          {daysSinceStart !== null && (
            <div>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>Started: </span>
              <span className="font-medium">{daysSinceStart} days ago</span>
            </div>
          )}
          {targetGfc && (
            <div>
              <span style={{ color: "hsl(var(--muted-foreground))" }}>Target GFC: </span>
              <span className="font-medium" style={{ color: gfcColor }}>
                {format(targetGfc, "dd MMM yyyy")}
                {daysToGfc !== null && (
                  <span className="ml-1">
                    ({daysToGfc < 0 ? `${Math.abs(daysToGfc)}d overdue` : `${daysToGfc}d remaining`})
                  </span>
                )}
              </span>
            </div>
          )}
          {architects.length > 0 && (
            <div className="flex items-center gap-1">
              <span style={{ color: "hsl(var(--muted-foreground))" }}>Architects: </span>
              {architects.map((a: any) => (
                <Badge key={a.id || a.auth_user_id} variant="outline" className="text-[10px] h-5">
                  {a.display_name || a.email}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
