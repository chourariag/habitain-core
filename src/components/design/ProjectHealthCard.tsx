import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { differenceInDays, format } from "date-fns";

interface Props {
  project: any;
  designFile: any;
  designStages: any[];
  architects: any[];
}

const DONE_STATUSES = ["Completed", "Skipped", "completed", "client_approved", "completed_pre_hstack", "skipped"];

function statusColor(status: string | null | undefined) {
  if (status === "Completed" || status === "Skipped" || status === "client_approved" || status === "completed" || status === "completed_pre_hstack") return "hsl(var(--primary))";
  if (status === "In Progress" || status === "submitted_to_client" || status === "in_progress") return "hsl(var(--warning))";
  if (status === "Blocked" || status === "changes_requested" || status === "blocked") return "hsl(var(--destructive))";
  return "transparent";
}

export function ProjectHealthCard({ project, designFile, designStages, architects }: Props) {
  // Real stages for this project, ordered — same source as the Design Schedule list below.
  const stages = designStages
    .filter((s: any) => s.project_id === project.id && !s.is_read_only)
    .sort((a: any, b: any) => (a.stage_order ?? 0) - (b.stage_order ?? 0));

  const currentIdx = (() => {
    const idx = stages.findIndex((s: any) => !DONE_STATUSES.includes(s.status));
    return idx === -1 ? stages.length - 1 : idx;
  })();
  const currentStage = stages[currentIdx];

  const daysSinceStart = designFile?.created_at ? differenceInDays(new Date(), new Date(designFile.created_at)) : null;
  const targetGfc = designFile?.target_gfc_date ? new Date(designFile.target_gfc_date) : null;
  const daysToGfc = targetGfc ? differenceInDays(targetGfc, new Date()) : null;
  // Design-only status is a property of the project record, not of the design file.
  const isDesignOnly = project?.is_design_only === true;

  const gfcColor = daysToGfc !== null
    ? daysToGfc < 0 ? "hsl(var(--destructive))" : daysToGfc <= 14 ? "hsl(var(--warning))" : "hsl(var(--primary))"
    : "hsl(var(--muted-foreground))";

  const goToStage = (stageId: string) => {
    const el = document.getElementById(`design-stage-${stageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
  };

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
            {currentStage ? `${currentStage.stage_code ?? currentStage.stage_order}. ${currentStage.stage_name}` : "No design stages yet"}
          </p>
        </div>

        {/* Stage progress bar — driven by the live design schedule (project_design_stages) */}
        {stages.length > 0 && (
          <div className="flex items-start gap-0 overflow-x-auto pb-1">
            {stages.map((stage: any, i: number) => {
              const done = DONE_STATUSES.includes(stage.status);
              const isCurrent = i === currentIdx;
              const fill = done ? "hsl(var(--primary))" : statusColor(stage.status);
              return (
                <div key={stage.id} className="flex items-start shrink-0">
                  <button
                    type="button"
                    onClick={() => goToStage(stage.id)}
                    title={`${stage.stage_name} — ${String(stage.status ?? "not_started").replace(/_/g, " ")}`}
                    aria-label={`Go to stage ${stage.stage_name}`}
                    className="flex flex-col items-center focus:outline-none group"
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110 ${
                        fill === "transparent" ? "border-border" : "border-transparent"
                      }`}
                      style={{
                        backgroundColor: fill,
                        ...(isCurrent ? { boxShadow: "0 0 0 3px hsl(var(--accent))" } : {}),
                      }}
                    >
                      {fill !== "transparent" && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <p className="text-[9px] mt-1 text-center w-16 leading-tight group-hover:underline" style={{
                      color: done || isCurrent ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      fontWeight: isCurrent ? 600 : 400,
                    }}>
                      {stage.stage_name}
                    </p>
                  </button>
                  {i < stages.length - 1 && (
                    <div
                      className="h-0.5 w-3 md:w-5 mt-2.5"
                      style={{ backgroundColor: done ? "hsl(var(--primary))" : "hsl(var(--border))" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

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
