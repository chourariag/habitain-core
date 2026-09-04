import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Clock, Circle, Milestone } from "lucide-react";
import { format } from "date-fns";
import { computeClientMilestones } from "@/lib/client-milestones";

interface Props {
  stages: Array<{ stage_code?: string | null; status?: string | null; actual_date?: string | null }>;
}

export function ClientMilestoneTracker({ stages }: Props) {
  const milestones = computeClientMilestones(stages);
  const completed = milestones.filter((m) => m.status === "complete").length;
  const overall = Math.round(
    milestones.reduce((s, m) => s + m.percent, 0) / milestones.length
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
          <Milestone className="h-4 w-4" /> Project Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-body">
            <span className="text-muted-foreground">Overall progress</span>
            <span className="font-heading font-bold text-foreground">
              {completed} of {milestones.length} milestones complete
            </span>
          </div>
          <Progress value={overall} className="h-2" />
        </div>

        <ol className="space-y-3">
          {milestones.map((m, i) => {
            const done = m.status === "complete";
            const active = m.status === "in_progress";
            return (
              <li key={m.key} className="flex items-start gap-3 rounded-lg border p-3">
                <div
                  className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-warning/20 text-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : active ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading font-bold text-sm text-foreground">
                      {i + 1}. {m.label}
                    </p>
                    <Badge
                      className="text-[10px] shrink-0"
                      variant={done ? "default" : active ? "outline" : "secondary"}
                    >
                      {done ? "Complete" : active ? "In progress" : "Not started"}
                    </Badge>
                  </div>
                  <p className="text-xs font-body text-muted-foreground mt-0.5">
                    {m.description}
                  </p>
                  {active && (
                    <Progress value={m.percent} className="h-1.5 mt-2" />
                  )}
                  {done && m.completedOn && (
                    <p className="text-xs font-body text-primary mt-1">
                      ✓ Completed on {format(new Date(m.completedOn), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-[11px] font-body text-muted-foreground">
          Milestones update automatically as your project progresses. Your project team will
          contact you for any approvals along the way.
        </p>
      </CardContent>
    </Card>
  );
}
