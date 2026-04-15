import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, Download, List, Columns3, BarChart3, Lock, Unlock, Loader2, Monitor, CheckCircle2, Clock, AlertTriangle, Ban, Circle } from "lucide-react";
import { format, parseISO, differenceInDays, eachWeekOfInterval, addDays } from "date-fns";
import * as XLSX from "xlsx";

interface ProjectTask {
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
  lock_override_by: string | null;
  lock_override_reason: string | null;
}

const PHASES = ["Pre-Production", "Civil Works", "Factory Production", "Delivery", "Site Installation", "Finishing", "Handover"];
const ROLE_LABELS: Record<string, string> = {
  production_head: "Production Head",
  factory_supervisor: "Factory Supervisor",
  planning_engineer: "Planning Engineer",
  site_installation_manager: "Site Installation Mgr",
  site_manager: "Site Manager",
  procurement: "Procurement",
  external_contractor: "External Contractor",
  design_team: "Design Team",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  "Ready to Start": { label: "Ready to Start", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Circle },
  "In Progress": { label: "In Progress", className: "bg-[#006039]/10 text-[#006039] border-[#006039]/20", icon: Clock },
  "Blocked": { label: "Blocked", className: "bg-muted text-muted-foreground border-border", icon: Ban },
  "Completed": { label: "Completed", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle2 },
  "Overdue": { label: "Overdue", className: "bg-red-100 text-red-800 border-red-200", icon: AlertTriangle },
  "Upcoming": { label: "Upcoming", className: "bg-muted text-muted-foreground border-border", icon: Clock },
};

type ViewMode = "list" | "phase" | "gantt";

const UPLOAD_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const EDIT_ROLES = ["planning_engineer", "production_head", "site_installation_manager", "site_manager", "super_admin", "managing_director"];

interface Props {
  projectId: string;
  userRole: string | null;
}

export function MicroScheduleTab({ projectId, userRole }: Props) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [uploadSummary, setUploadSummary] = useState<{ taskCount: number; phases: number } | null>(null);
  const [overrideTask, setOverrideTask] = useState<ProjectTask | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = UPLOAD_ROLES.includes(userRole ?? "");
  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const canOverride = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("task_id_in_schedule", { ascending: true });
    setTasks((data as any as ProjectTask[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const computeStatus = (task: any, allTasks: any[]): string => {
    if (task.completion_percentage === 100) return "Completed";
    const preds = task.predecessor_ids ?? [];
    if (preds.length > 0) {
      const blocking = allTasks.filter(
        (t: any) => preds.includes(t.task_id_in_schedule) && t.completion_percentage < 100
      );
      if (blocking.length > 0) return "Blocked";
    }
    if (task.planned_finish_date && new Date(task.planned_finish_date) < new Date() && task.completion_percentage < 100) return "Overdue";
    if (task.completion_percentage > 0) return "In Progress";
    if (task.planned_start_date && new Date(task.planned_start_date) <= new Date()) return "Ready to Start";
    return "Upcoming";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

        // Find header row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i];
          if (row && row.some((c: any) => String(c).toLowerCase().includes("task name"))) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) { toast.error("Could not find header row with 'Task Name'"); return; }

        const headers = rows[headerIdx].map((h: any) => String(h ?? "").toLowerCase().trim());
        const colIdx = {
          id: headers.findIndex((h: string) => h === "id"),
          taskName: headers.findIndex((h: string) => h.includes("task name")),
          duration: headers.findIndex((h: string) => h.includes("duration")),
          predecessors: headers.findIndex((h: string) => h.includes("predecessor")),
          plannedStart: headers.findIndex((h: string) => h.includes("planned start")),
          plannedFinish: headers.findIndex((h: string) => h.includes("planned finish")),
          role: headers.findIndex((h: string) => h.includes("responsible")),
          phase: headers.findIndex((h: string) => h === "phase"),
        };

        if (colIdx.taskName === -1) { toast.error("Missing 'Task Name' column"); return; }

        const parsedTasks: any[] = [];
        const allIds = new Set<string>();

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[colIdx.taskName]) continue;

          const taskId = String(row[colIdx.id] ?? (i - headerIdx));
          allIds.add(taskId);

          const predStr = colIdx.predecessors >= 0 ? String(row[colIdx.predecessors] ?? "") : "";
          const predecessors = predStr.split(",").map((s: string) => s.trim()).filter(Boolean);

          const parseDate = (val: any): string | null => {
            if (!val) return null;
            if (val instanceof Date) return format(val, "yyyy-MM-dd");
            const s = String(val).trim();
            // Try DD/MM/YYYY
            const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (parts) {
              const yr = parts[3].length === 2 ? "20" + parts[3] : parts[3];
              return `${yr}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
            }
            // Try ISO
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
          };

          parsedTasks.push({
            project_id: projectId,
            task_id_in_schedule: taskId,
            task_name: String(row[colIdx.taskName]),
            phase: colIdx.phase >= 0 ? String(row[colIdx.phase] ?? "Pre-Production") : "Pre-Production",
            planned_start_date: parseDate(colIdx.plannedStart >= 0 ? row[colIdx.plannedStart] : null),
            planned_finish_date: parseDate(colIdx.plannedFinish >= 0 ? row[colIdx.plannedFinish] : null),
            duration_days: colIdx.duration >= 0 ? parseInt(String(row[colIdx.duration] ?? "0")) || 0 : 0,
            predecessor_ids: predecessors,
            responsible_role: colIdx.role >= 0 ? String(row[colIdx.role] ?? "").toLowerCase().replace(/\s+/g, "_") : null,
            status: "Upcoming",
            completion_percentage: 0,
            delay_days: 0,
            remarks: null,
            is_locked: predecessors.length > 0,
          });
        }

        // Circular dependency check
        const adjMap: Record<string, string[]> = {};
        parsedTasks.forEach((t) => { adjMap[t.task_id_in_schedule] = t.predecessor_ids; });
        const hasCycle = (id: string, visited: Set<string>, stack: Set<string>): boolean => {
          visited.add(id); stack.add(id);
          for (const pred of (adjMap[id] ?? [])) {
            if (!visited.has(pred)) { if (hasCycle(pred, visited, stack)) return true; }
            else if (stack.has(pred)) return true;
          }
          stack.delete(id);
          return false;
        };
        const vis = new Set<string>(), stk = new Set<string>();
        let cycleFound = false;
        for (const id of Object.keys(adjMap)) {
          if (!vis.has(id) && hasCycle(id, vis, stk)) { cycleFound = true; break; }
        }
        if (cycleFound) { toast.error("Circular dependency detected in schedule. Please fix and re-upload."); return; }

        // Compute statuses
        parsedTasks.forEach((t) => { t.status = computeStatus(t, parsedTasks); });

        // Delete existing tasks, insert new
        await supabase.from("project_tasks").delete().eq("project_id", projectId);
        // Batch insert in chunks of 50
        for (let i = 0; i < parsedTasks.length; i += 50) {
          await supabase.from("project_tasks").insert(parsedTasks.slice(i, i + 50));
        }

        // Record upload
        const { data: { user } } = await supabase.auth.getUser();
        const { data: prevUploads } = await supabase.from("project_task_schedule_uploads").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1);
        const nextVersion = ((prevUploads as any)?.[0]?.version ?? 0) + 1;
        await supabase.from("project_task_schedule_uploads").insert({
          project_id: projectId,
          version: nextVersion,
          uploaded_by: user?.id ?? "",
          task_count: parsedTasks.length,
        });

        const uniquePhases = new Set(parsedTasks.map((t) => t.phase));
        setUploadSummary({ taskCount: parsedTasks.length, phases: uniquePhases.size });
        toast.success(`${parsedTasks.length} tasks imported across ${uniquePhases.size} phases`);
        fetchTasks();
      } catch (err: any) {
        toast.error("Failed to parse schedule: " + (err.message ?? "Unknown error"));
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["ID", "Task Name", "Duration (days)", "Predecessors", "Planned Start Date", "Planned Finish Date", "Responsible Role", "Phase"],
      ["1", "Site survey", "2", "", "01/05/2025", "02/05/2025", "planning_engineer", "Pre-Production"],
      ["2", "Foundation design", "5", "1", "03/05/2025", "07/05/2025", "design_team", "Pre-Production"],
      ["3", "Procurement of steel", "10", "2", "08/05/2025", "17/05/2025", "procurement", "Factory Production"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    XLSX.writeFile(wb, "HStack_Schedule_Template.xlsx");
  };

  const updateTask = async (taskId: string, updates: Partial<ProjectTask>) => {
    await supabase.from("project_tasks").update(updates as any).eq("id", taskId);
    fetchTasks();
  };

  const handleStartTask = async (task: ProjectTask) => {
    if (task.is_locked && !canOverride) {
      toast.error("Task is blocked by predecessor dependencies");
      return;
    }
    if (task.is_locked && canOverride) {
      setOverrideTask(task);
      return;
    }
    await updateTask(task.id, {
      status: "In Progress",
      actual_start_date: format(new Date(), "yyyy-MM-dd"),
      completion_percentage: 5,
    } as any);
  };

  const confirmOverride = async () => {
    if (!overrideTask) return;
    const { data: { user } } = await supabase.auth.getUser();
    await updateTask(overrideTask.id, {
      status: "In Progress",
      actual_start_date: format(new Date(), "yyyy-MM-dd"),
      completion_percentage: 5,
      is_locked: false,
      lock_override_by: user?.id ?? null,
      lock_override_reason: overrideReason,
    } as any);
    setOverrideTask(null);
    setOverrideReason("");
  };

  const filteredTasks = useMemo(() => {
    if (phaseFilter === "all") return tasks;
    return tasks.filter((t) => t.phase === phaseFilter);
  }, [tasks, phaseFilter]);

  const taskMap = useMemo(() => {
    const m: Record<string, ProjectTask> = {};
    tasks.forEach((t) => { m[t.task_id_in_schedule] = t; });
    return m;
  }, [tasks]);

  const getBlockingName = (task: ProjectTask): string | null => {
    for (const pId of task.predecessor_ids ?? []) {
      const pred = taskMap[pId];
      if (pred && pred.completion_percentage < 100) return pred.task_name;
    }
    return null;
  };

  const getDelay = (task: ProjectTask): number => {
    if (!task.planned_finish_date) return 0;
    if (task.completion_percentage === 100 && task.actual_finish_date) {
      return differenceInDays(new Date(task.actual_finish_date), new Date(task.planned_finish_date));
    }
    if (task.completion_percentage < 100 && new Date(task.planned_finish_date) < new Date()) {
      return differenceInDays(new Date(), new Date(task.planned_finish_date));
    }
    return 0;
  };

  const liveStatus = (task: ProjectTask) => computeStatus(task, tasks);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Micro-Schedule</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {canUpload && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Template</Button>
              <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Upload Schedule</Button>
            </>
          )}
        </div>
      </div>

      {uploadSummary && (
        <Card className="border-[#006039]/20 bg-[#006039]/5">
          <CardContent className="py-3 px-4 text-sm text-[#006039]">
            ✓ {uploadSummary.taskCount} tasks created across {uploadSummary.phases} phases
          </CardContent>
        </Card>
      )}

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No schedule uploaded yet. {canUpload ? 'Click "Upload Schedule" to import your execution plan.' : "Ask Karthik to upload the schedule."}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex border rounded-md overflow-hidden">
              {([["list", List, "List"], ["phase", Columns3, "Phase Board"], ["gantt", BarChart3, "Gantt"]] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === mode ? "bg-[#006039] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="All Phases" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {viewMode === "list" && (
            <ListView tasks={filteredTasks} taskMap={taskMap} canEdit={canEdit} liveStatus={liveStatus} getDelay={getDelay} getBlockingName={getBlockingName} onStart={handleStartTask} onUpdate={updateTask} />
          )}
          {viewMode === "phase" && (
            <PhaseBoard tasks={filteredTasks} liveStatus={liveStatus} />
          )}
          {viewMode === "gantt" && (
            <GanttView tasks={filteredTasks} taskMap={taskMap} getDelay={getDelay} />
          )}
        </>
      )}

      {/* Override dialog */}
      <Dialog open={!!overrideTask} onOpenChange={(o) => { if (!o) { setOverrideTask(null); setOverrideReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Override Dependency Lock</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Task "{overrideTask?.task_name}" is blocked by predecessor dependencies. Provide a reason to override.</p>
          <Textarea placeholder="Reason for override..." value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideTask(null); setOverrideReason(""); }}>Cancel</Button>
            <Button onClick={confirmOverride} disabled={!overrideReason.trim()}>Override & Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===================== LIST VIEW ===================== */
function ListView({ tasks, taskMap, canEdit, liveStatus, getDelay, getBlockingName, onStart, onUpdate }: {
  tasks: ProjectTask[]; taskMap: Record<string, ProjectTask>; canEdit: boolean;
  liveStatus: (t: ProjectTask) => string; getDelay: (t: ProjectTask) => number;
  getBlockingName: (t: ProjectTask) => string | null;
  onStart: (t: ProjectTask) => void; onUpdate: (id: string, u: Partial<ProjectTask>) => void;
}) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-12">ID</TableHead>
            <TableHead>Task Name</TableHead>
            <TableHead className="w-28">Phase</TableHead>
            <TableHead className="w-24">Start</TableHead>
            <TableHead className="w-24">Finish</TableHead>
            <TableHead className="w-16">Days</TableHead>
            <TableHead className="w-28">Responsible</TableHead>
            <TableHead className="w-28">Status</TableHead>
            <TableHead className="w-16">%</TableHead>
            <TableHead className="w-16">Delay</TableHead>
            {canEdit && <TableHead className="w-20">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const status = liveStatus(task);
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Upcoming"];
            const delay = getDelay(task);
            const blocking = getBlockingName(task);
            const Icon = cfg.icon;
            return (
              <TableRow key={task.id} className={status === "Overdue" ? "bg-red-50/50" : ""}>
                <TableCell className="font-mono text-xs">{task.task_id_in_schedule}</TableCell>
                <TableCell className="font-medium text-sm">
                  <div className="flex items-center gap-1.5">
                    {task.is_locked && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Lock className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Waiting for: {blocking ?? "predecessor"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {task.task_name}
                  </div>
                </TableCell>
                <TableCell><span className="text-xs">{task.phase}</span></TableCell>
                <TableCell className="text-xs">{task.planned_start_date ? format(new Date(task.planned_start_date), "dd MMM") : "-"}</TableCell>
                <TableCell className="text-xs">{task.planned_finish_date ? format(new Date(task.planned_finish_date), "dd MMM") : "-"}</TableCell>
                <TableCell className="text-xs">{task.duration_days || "-"}</TableCell>
                <TableCell className="text-xs">{ROLE_LABELS[task.responsible_role ?? ""] ?? task.responsible_role ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                    <Icon className="h-3 w-3 mr-1" /> {cfg.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {canEdit && status !== "Blocked" && status !== "Upcoming" ? (
                    <Input
                      type="number" min={0} max={100}
                      className="h-7 w-14 text-xs"
                      defaultValue={task.completion_percentage}
                      onBlur={(e) => {
                        const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        onUpdate(task.id, {
                          completion_percentage: val,
                          ...(val === 100 ? { actual_finish_date: format(new Date(), "yyyy-MM-dd"), status: "Completed" } : {}),
                        } as any);
                      }}
                    />
                  ) : (
                    <span className="text-xs">{task.completion_percentage}%</span>
                  )}
                </TableCell>
                <TableCell className={`text-xs font-medium ${delay > 0 ? "text-red-600" : delay < 0 ? "text-[#006039]" : ""}`}>
                  {delay !== 0 ? (delay > 0 ? `+${delay}d` : `${delay}d`) : "-"}
                </TableCell>
                {canEdit && (
                  <TableCell>
                    {(status === "Ready to Start" || (status === "Blocked" && task.is_locked)) && task.completion_percentage === 0 && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStart(task)}>Start</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ===================== PHASE BOARD ===================== */
function PhaseBoard({ tasks, liveStatus }: { tasks: ProjectTask[]; liveStatus: (t: ProjectTask) => string }) {
  const grouped = useMemo(() => {
    const m: Record<string, ProjectTask[]> = {};
    PHASES.forEach((p) => { m[p] = []; });
    tasks.forEach((t) => { (m[t.phase] ?? (m[t.phase] = [])).push(t); });
    return m;
  }, [tasks]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {PHASES.map((phase) => {
        const phaseTasks = grouped[phase] ?? [];
        if (phaseTasks.length === 0) return null;
        return (
          <div key={phase} className="min-w-[240px] max-w-[280px] flex-shrink-0">
            <div className="bg-muted rounded-t-lg px-3 py-2 font-medium text-sm flex items-center justify-between">
              <span>{phase}</span>
              <Badge variant="secondary" className="text-xs">{phaseTasks.length}</Badge>
            </div>
            <div className="border border-t-0 rounded-b-lg p-2 space-y-2 max-h-[600px] overflow-y-auto bg-background">
              {phaseTasks.map((task) => {
                const status = liveStatus(task);
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Upcoming"];
                return (
                  <Card key={task.id} className="shadow-sm">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{task.task_name}</p>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${status === "Completed" ? "bg-green-600" : status === "In Progress" ? "bg-[#006039]" : status === "Overdue" ? "bg-red-500" : status === "Blocked" ? "bg-gray-400" : "bg-blue-500"}`} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{ROLE_LABELS[task.responsible_role ?? ""] ?? "-"}</span>
                        <span>{task.planned_finish_date ? format(new Date(task.planned_finish_date), "dd MMM") : "-"}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="bg-[#006039] h-1.5 rounded-full transition-all" style={{ width: `${task.completion_percentage}%` }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== GANTT VIEW ===================== */
const LEFT_PANEL = 220;
const ROW_H = 36;
const DAY_W = 20;

function GanttView({ tasks, taskMap, getDelay }: { tasks: ProjectTask[]; taskMap: Record<string, ProjectTask>; getDelay: (t: ProjectTask) => number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
  if (isMobile) {
    return (
      <Card><CardContent className="py-12 text-center"><Monitor className="h-8 w-8 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">Switch to desktop to view Gantt</p></CardContent></Card>
    );
  }

  const dated = tasks.filter((t) => t.planned_start_date && t.planned_finish_date);
  if (dated.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No tasks with dates to display.</CardContent></Card>;

  const allDates = dated.flatMap((t) => [new Date(t.planned_start_date!), new Date(t.planned_finish_date!)]);
  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
  const origin = addDays(minDate, -3);
  const totalDays = differenceInDays(maxDate, origin) + 10;
  const weeks = eachWeekOfInterval({ start: origin, end: addDays(origin, totalDays) });
  const todayOffset = differenceInDays(new Date(), origin);

  return (
    <div ref={containerRef} className="border rounded-lg overflow-auto" style={{ maxHeight: 500 }}>
      <div className="relative" style={{ width: LEFT_PANEL + totalDays * DAY_W, minHeight: 40 + dated.length * ROW_H }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex bg-muted border-b" style={{ height: 40 }}>
          <div className="shrink-0 border-r bg-muted px-2 flex items-center text-xs font-medium" style={{ width: LEFT_PANEL }}>Task</div>
          <div className="relative flex-1">
            {weeks.map((w, i) => (
              <div key={i} className="absolute top-0 text-[10px] text-muted-foreground border-l border-border/50 px-1 flex items-center" style={{ left: differenceInDays(w, origin) * DAY_W, height: 40 }}>
                {format(w, "dd MMM")}
              </div>
            ))}
          </div>
        </div>

        {/* Today line */}
        <div className="absolute top-0 bottom-0 w-px bg-[#F40009] z-[5]" style={{ left: LEFT_PANEL + todayOffset * DAY_W }} />

        {/* Rows */}
        {dated.map((task, idx) => {
          const startOff = differenceInDays(new Date(task.planned_start_date!), origin);
          const endOff = differenceInDays(new Date(task.planned_finish_date!), origin);
          const barW = Math.max((endOff - startOff + 1) * DAY_W, 4);
          const progressW = barW * (task.completion_percentage / 100);
          const delay = getDelay(task);

          return (
            <div key={task.id} className="flex border-b" style={{ height: ROW_H }}>
              <div className="shrink-0 border-r px-2 flex items-center text-xs truncate bg-background" style={{ width: LEFT_PANEL }}>
                <span className="font-mono text-muted-foreground mr-1.5">{task.task_id_in_schedule}</span>
                <span className="truncate">{task.task_name}</span>
              </div>
              <div className="relative flex-1">
                {/* Planned bar */}
                <div className="absolute rounded-sm bg-[#006039]/20" style={{ left: startOff * DAY_W, top: (ROW_H - 16) / 2, width: barW, height: 16 }} />
                {/* Progress bar */}
                {progressW > 0 && (
                  <div className="absolute rounded-sm bg-[#006039]" style={{ left: startOff * DAY_W, top: (ROW_H - 16) / 2, width: progressW, height: 16 }} />
                )}
                {/* Overdue extension */}
                {delay > 0 && (
                  <div className="absolute rounded-sm bg-red-400/60" style={{ left: (endOff + 1) * DAY_W, top: (ROW_H - 16) / 2, width: delay * DAY_W, height: 16 }} />
                )}
                {/* Predecessor arrows */}
                {(task.predecessor_ids ?? []).map((pId) => {
                  const pred = taskMap[pId];
                  if (!pred?.planned_finish_date) return null;
                  const predIdx = dated.findIndex((t) => t.task_id_in_schedule === pId);
                  if (predIdx === -1) return null;
                  const predEndOff = differenceInDays(new Date(pred.planned_finish_date), origin);
                  const fromX = predEndOff * DAY_W + DAY_W;
                  const fromY = predIdx * ROW_H + ROW_H / 2 - 40;
                  const toX = startOff * DAY_W;
                  const toY = idx * ROW_H + ROW_H / 2 - 40;
                  return (
                    <svg key={pId} className="absolute top-0 left-0 pointer-events-none overflow-visible" style={{ width: "100%", height: "100%" }}>
                      <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke="#9ca3af" strokeWidth={1} markerEnd="url(#arrow)" />
                      <defs>
                        <marker id="arrow" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                          <path d="M0,0 L6,2 L0,4" fill="#9ca3af" />
                        </marker>
                      </defs>
                    </svg>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
