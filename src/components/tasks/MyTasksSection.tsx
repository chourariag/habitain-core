import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, Clock, Circle, Ban, ClipboardList } from "lucide-react";
import { format, isToday, isPast, parseISO } from "date-fns";
import { TaskUpdateSheet } from "./TaskUpdateSheet";

const STATUS_CONFIG: Record<string, { color: string; dotClass: string; sortOrder: number }> = {
  Overdue: { color: "text-red-600", dotClass: "bg-red-500", sortOrder: 0 },
  "In Progress": { color: "text-[#006039]", dotClass: "bg-[#006039]", sortOrder: 1 },
  "Ready to Start": { color: "text-blue-600", dotClass: "bg-blue-500", sortOrder: 2 },
  Upcoming: { color: "text-muted-foreground", dotClass: "bg-gray-400", sortOrder: 3 },
  Blocked: { color: "text-muted-foreground", dotClass: "bg-gray-300", sortOrder: 4 },
  Completed: { color: "text-green-700", dotClass: "bg-green-600", sortOrder: 5 },
};

const ROLE_MAP: Record<string, string> = {
  production_head: "production_head",
  factory_supervisor: "factory_supervisor",
  planning_engineer: "planning_engineer",
  site_installation_manager: "site_installation_manager",
  site_manager: "site_manager",
  super_admin: "__all__",
  managing_director: "__all__",
};

interface TaskRow {
  id: string;
  project_id: string;
  task_id_in_schedule: string;
  task_name: string;
  phase: string;
  planned_start_date: string | null;
  planned_finish_date: string | null;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  duration_days: number;
  predecessor_ids: string[];
  responsible_role: string | null;
  status: string;
  completion_percentage: number;
  delay_days: number;
  remarks: string | null;
  is_locked: boolean;
  delay_cause?: string | null;
  delay_resolution?: string | null;
}

interface Props {
  userRole: string | null;
  phaseFilter?: string[];
  title?: string;
  showProjectName?: boolean;
  compact?: boolean;
}

export function MyTasksSection({ userRole, phaseFilter, title = "My Tasks", showProjectName = true, compact = false }: Props) {
  const [tasks, setTasks] = useState<(TaskRow & { project_name?: string })[]>([]);
  const [allProjectTasks, setAllProjectTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const mapped = ROLE_MAP[userRole ?? ""];
    if (!mapped) { setTasks([]); setLoading(false); return; }

    let query = supabase
      .from("project_tasks")
      .select("*, projects:project_id(name)")
      .neq("status", "Completed");

    if (mapped !== "__all__") {
      query = query.eq("responsible_role", mapped);
    }
    if (phaseFilter && phaseFilter.length > 0) {
      query = query.in("phase", phaseFilter);
    }

    const { data } = await query.order("planned_finish_date", { ascending: true }).limit(50);

    const rows = (data ?? []).map((r: any) => ({
      ...r,
      predecessor_ids: r.predecessor_ids ?? [],
      project_name: r.projects?.name ?? "",
    }));
    setTasks(rows);

    // Also fetch all tasks for status computation in the update sheet
    if (rows.length > 0) {
      const projectIds = [...new Set(rows.map((r: any) => r.project_id))];
      const { data: allData } = await supabase
        .from("project_tasks")
        .select("*")
        .in("project_id", projectIds);
      setAllProjectTasks((allData as any as TaskRow[]) ?? []);
    }
    setLoading(false);
  }, [userRole, phaseFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const computeStatus = (task: TaskRow): string => {
    if (task.completion_percentage === 100) return "Completed";
    const preds = task.predecessor_ids ?? [];
    if (preds.length > 0) {
      const blocking = allProjectTasks.filter(
        (t) => t.project_id === task.project_id && preds.includes(t.task_id_in_schedule) && t.completion_percentage < 100
      );
      if (blocking.length > 0) return "Blocked";
    }
    if (task.planned_finish_date && isPast(new Date(task.planned_finish_date)) && task.completion_percentage < 100) return "Overdue";
    if (task.completion_percentage > 0 || task.actual_start_date) return "In Progress";
    if (task.planned_start_date && new Date(task.planned_start_date) <= new Date()) return "Ready to Start";
    return "Upcoming";
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const sa = STATUS_CONFIG[computeStatus(a)]?.sortOrder ?? 99;
      const sb = STATUS_CONFIG[computeStatus(b)]?.sortOrder ?? 99;
      if (sa !== sb) return sa - sb;
      const da = a.planned_finish_date ? new Date(a.planned_finish_date).getTime() : Infinity;
      const db = b.planned_finish_date ? new Date(b.planned_finish_date).getTime() : Infinity;
      return da - db;
    });
  }, [tasks, allProjectTasks]);

  const canEdit = ["planning_engineer", "production_head", "factory_supervisor", "site_installation_manager", "site_manager", "super_admin", "managing_director"].includes(userRole ?? "");
  const canAddSubtasks = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (sortedTasks.length === 0) return null;

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#006039]" />
            {title}
            <Badge variant="secondary" className="ml-auto text-xs">{sortedTasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {sortedTasks.map((task) => {
            const status = computeStatus(task);
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Upcoming;
            const dueToday = task.planned_finish_date && isToday(new Date(task.planned_finish_date));
            return (
              <button
                key={task.id}
                className="w-full text-left rounded-lg border bg-background p-3 hover:bg-muted/50 transition-colors active:scale-[0.99]"
                onClick={() => setSelectedTask(task)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${cfg.dotClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{task.task_name}</p>
                      {dueToday && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Due Today</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{task.phase}</span>
                      {showProjectName && task.project_name && (
                        <span className="truncate">· {task.project_name}</span>
                      )}
                      {task.planned_finish_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.planned_finish_date), "dd MMM")}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${status === "Overdue" ? "bg-red-500" : "bg-[#006039]"}`}
                          style={{ width: `${task.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{task.completion_percentage}%</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <TaskUpdateSheet
        task={selectedTask}
        open={!!selectedTask}
        onOpenChange={(o) => { if (!o) setSelectedTask(null); }}
        onUpdated={() => { fetchTasks(); setSelectedTask(null); }}
        allTasks={allProjectTasks}
        canEdit={canEdit}
        canAddSubtasks={canAddSubtasks}
      />
    </>
  );
}
