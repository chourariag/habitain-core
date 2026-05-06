import { useState, useEffect, useCallback, useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

const ROLE_MAP: Record<string, string> = {
  production_head: "production_head",
  factory_supervisor: "factory_supervisor",
  planning_engineer: "planning_engineer",
  site_installation_manager: "site_installation_manager",
  site_manager: "site_manager",
  super_admin: "__all__",
  managing_director: "__all__",
};

interface Props {
  userRole: string | null;
}

export function MyTasksSummaryStrip({ userRole }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchTasks = useCallback(async () => {
    const mapped = ROLE_MAP[userRole ?? ""];
    if (!mapped) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from("project_tasks")
      .select("id,task_name,phase,planned_finish_date,project_id,completion_percentage,projects:project_id(name)")
      .neq("status", "Completed");
    if (mapped !== "__all__") q = q.eq("responsible_role", mapped);
    const { data } = await q.order("planned_finish_date", { ascending: true }).limit(200);
    setTasks((data as any[]) ?? []);
    setLoading(false);
  }, [userRole]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const { dueTodayOrOverdue, projectsCount, top3 } = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (!t.planned_finish_date || (t.completion_percentage ?? 0) >= 100) return false;
      const d = new Date(t.planned_finish_date);
      return isPast(d) || isToday(d);
    });
    const projectIds = new Set(filtered.map((t) => t.project_id));
    const sorted = [...filtered].sort((a, b) => {
      const ao = isPast(new Date(a.planned_finish_date)) && !isToday(new Date(a.planned_finish_date)) ? 0 : 1;
      const bo = isPast(new Date(b.planned_finish_date)) && !isToday(new Date(b.planned_finish_date)) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return new Date(a.planned_finish_date).getTime() - new Date(b.planned_finish_date).getTime();
    });
    return {
      dueTodayOrOverdue: filtered.length,
      projectsCount: projectIds.size,
      top3: sorted.slice(0, 3),
    };
  }, [tasks]);

  if (loading || dueTodayOrOverdue === 0) return null;

  return (
    <Card className="shadow-sm border-l-4" style={{ borderLeftColor: "#006039" }}>
      <CardContent className="p-3">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center gap-3 text-left"
        >
          <ClipboardList className="h-5 w-5 shrink-0" style={{ color: "#006039" }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              You have {dueTodayOrOverdue} {dueTodayOrOverdue === 1 ? "task" : "tasks"} due today across {projectsCount} {projectsCount === 1 ? "project" : "projects"}
            </p>
            {!expanded && (
              <p className="text-xs text-muted-foreground">Tap to see top 3 most urgent</p>
            )}
          </div>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {top3.map((t) => {
              const d = new Date(t.planned_finish_date);
              const overdue = isPast(d) && !isToday(d);
              return (
                <div key={t.id} className="rounded-md border bg-background p-2.5 flex items-start gap-2">
                  {overdue ? (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#F40009" }} />
                  ) : (
                    <Clock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.task_name}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <span className="truncate">{t.projects?.name ?? ""}</span>
                      <span>· {t.phase}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={overdue
                          ? { backgroundColor: "#FFE5E7", color: "#F40009", border: "none" }
                          : { backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}
                      >
                        {overdue ? `Overdue · ${format(d, "dd/MM")}` : "Due Today"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end pt-1">
              <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs" style={{ color: "#006039" }}>
                <Link to="/tasks">View all →</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
