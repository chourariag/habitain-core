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
import { Upload, Download, List, Columns3, BarChart3, Lock, Unlock, Loader2, Monitor, CheckCircle2, Clock, AlertTriangle, Ban, Circle, Timer, Ruler, BookOpen } from "lucide-react";
import { format, parseISO, differenceInDays, eachWeekOfInterval, addDays } from "date-fns";
import { DelayDashboard } from "./DelayDashboard";
import { MeasurementSheet } from "./MeasurementSheet";
import { RedFlagAlerts } from "./RedFlagAlerts";
import { fetchBenchmarkStats, getModuleCountBand, BenchmarkStats } from "@/lib/task-benchmarks";
import * as XLSX from "xlsx";
import { getPhasesForSystem, TASK_TYPE_META, type TaskTemplateType } from "@/lib/production-phases";
import { downloadScheduleTemplate } from "@/lib/xlsx-templates";
import { ChevronRight, ChevronDown, ShieldAlert } from "lucide-react";

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
  task_type?: TaskTemplateType | null;
  is_qc_gate?: boolean | null;
  display_order?: number | null;
  stage_number?: string | null;
}
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

type ViewMode = "list" | "phase" | "gantt" | "delays" | "measurement" | "flags";

const UPLOAD_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"];
// Production roles see a read-only, simplified stage rollup view (Fix 3 + Fix 4)
const PRODUCTION_VIEW_ROLES = ["production_head", "factory_floor_supervisor", "fabrication_foreman", "site_installation_mgr", "site_engineer"];

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
  const [scheduleFlags, setScheduleFlags] = useState<{ task: string; message: string; level: "yellow" | "amber" }[]>([]);
  const [materialRiskTaskIds, setMaterialRiskTaskIds] = useState<Record<string, string>>({});
  const [productionSystem, setProductionSystem] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Project");
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const isProductionView = PRODUCTION_VIEW_ROLES.includes(userRole ?? "");
  const canUpload = UPLOAD_ROLES.includes(userRole ?? "") && !isProductionView;
  const canEdit = EDIT_ROLES.includes(userRole ?? "") && !isProductionView;
  const canOverride = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? "") && !isProductionView;
  const PHASES = useMemo(() => getPhasesForSystem(productionSystem), [productionSystem]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const [taskRes, alertRes, projectRes] = await Promise.all([
      supabase.from("project_tasks").select("*").eq("project_id", projectId).order("display_order", { ascending: true, nullsFirst: false }).order("task_id_in_schedule", { ascending: true }),
      supabase.from("material_alerts").select("related_task_id, material_name").eq("project_id", projectId).eq("status", "active").not("related_task_id", "is", null),
      supabase.from("projects").select("name, production_system").eq("id", projectId).maybeSingle(),
    ]);
    setTasks((taskRes.data as any as ProjectTask[]) ?? []);
    setProductionSystem(((projectRes.data as any)?.production_system as string | null) ?? null);
    setProjectName(((projectRes.data as any)?.name as string | null) ?? "Project");
    const riskMap: Record<string, string> = {};
    (alertRes.data ?? []).forEach((a: any) => {
      if (a.related_task_id) riskMap[a.related_task_id] = a.material_name ?? "Material";
    });
    setMaterialRiskTaskIds(riskMap);
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

        // Find header row — look for "Name" or "Task Name" or "ID"
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i];
          if (row && row.some((c: any) => {
            const v = String(c).toLowerCase().trim();
            return v === "name" || v.includes("task name") || v === "id";
          })) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) { toast.error("Could not find header row with 'Name' or 'ID'"); return; }

        const headers = rows[headerIdx].map((h: any) => String(h ?? "").toLowerCase().trim());
        const colIdx = {
          section: headers.findIndex((h: string) => h === "" || h === "section"),
          id: headers.findIndex((h: string) => h === "id"),
          name: headers.findIndex((h: string) => h === "name" || h.includes("task name") || h.includes("task / sub-task")),
          duration: headers.findIndex((h: string) => h.includes("duration")),
          predecessors: headers.findIndex((h: string) => h.includes("predecessor")),
          plannedStart: headers.findIndex((h: string) => h.includes("planned start")),
          plannedFinish: headers.findIndex((h: string) => h.includes("planned finish")),
          role: headers.findIndex((h: string) => h.includes("responsible") || h.includes("who does")),
          phase: headers.findIndex((h: string) => h === "phase"),
          taskType: headers.findIndex((h: string) => h.includes("task type")),
        };

        if (colIdx.name === -1 && colIdx.id === -1) { toast.error("Missing 'Name' or 'ID' column"); return; }
        const nameCol = colIdx.name >= 0 ? colIdx.name : colIdx.id;

        const parsedTasks: any[] = [];
        const allIds = new Set<string>();
        let currentPhase = "Pre-Production";

        const parseDate = (val: any): string | null => {
          if (!val) return null;
          if (val instanceof Date) return format(val, "yyyy-MM-dd");
          const s = String(val).trim();
          const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (parts) {
            const yr = parts[3].length === 2 ? "20" + parts[3] : parts[3];
            return `${yr}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
          }
          const d = new Date(s);
          return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
        };

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c: any) => !c || !String(c).trim())) continue;

          // Section header detection: text in col A (section col), and col B (ID) is either empty or non-numeric
          const colAVal = colIdx.section >= 0 ? String(row[colIdx.section] ?? "").trim() : String(row[0] ?? "").trim();
          const colBVal = colIdx.id >= 0 ? String(row[colIdx.id] ?? "").trim() : "";
          const nameVal = String(row[nameCol] ?? "").trim();

          // Section header: col A has text and ID col is empty or non-numeric
          if (colAVal && (!colBVal || isNaN(Number(colBVal.replace(/[.]/g, ""))))) {
            if (!nameVal || nameVal === colAVal) {
              currentPhase = colAVal;
              continue;
            }
          }

          if (!nameVal && !colBVal) continue;

          const taskId = colBVal || String(i - headerIdx);
          allIds.add(taskId);

          // Parse predecessors — handle "7FS+22d" format
          const predStr = colIdx.predecessors >= 0 ? String(row[colIdx.predecessors] ?? "") : "";
          const predecessors = predStr.split(",").map((s: string) => {
            const match = s.trim().match(/^(\d+(?:\.\d+)?)/);
            return match ? match[1] : s.trim();
          }).filter(Boolean);

          const duration = colIdx.duration >= 0 ? parseInt(String(row[colIdx.duration] ?? "0")) || 0 : 0;
          const startDate = parseDate(colIdx.plannedStart >= 0 ? row[colIdx.plannedStart] : null);
          const finishDate = parseDate(colIdx.plannedFinish >= 0 ? row[colIdx.plannedFinish] : null);

          // Determine phase from col or current section
          let phase = currentPhase;
          if (colIdx.phase >= 0 && row[colIdx.phase]) phase = String(row[colIdx.phase]);

          // Clean name — remove [QC], [SIGN-OFF], [PAYMENT] prefixes
          let cleanName = nameVal;
          cleanName = cleanName.replace(/^\[QC\]\s*/i, "");
          cleanName = cleanName.replace(/^\[SIGN-OFF\]\s*/i, "");
          cleanName = cleanName.replace(/^\[PAYMENT\]\s*/i, "");

          parsedTasks.push({
            project_id: projectId,
            task_id_in_schedule: taskId,
            task_name: cleanName,
            phase,
            planned_start_date: startDate,
            planned_finish_date: finishDate,
            duration_days: duration,
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

        // Schedule Intelligence: compare planned durations vs benchmarks
        try {
          const { count: modCount } = await supabase.from("modules").select("*", { count: "exact", head: true }).eq("project_id", projectId);
          const band = getModuleCountBand(modCount ?? 0);
          const allBenchmarks = await fetchBenchmarkStats();
          const flags: { task: string; message: string; level: "yellow" | "amber" }[] = [];
          for (const t of parsedTasks) {
            const bm = allBenchmarks.find((b) => b.task_category === t.task_name && b.module_count_band === band && b.data_points >= 3);
            if (!bm) continue;
            const planned = t.duration_days;
            if (planned > 0 && planned < bm.fastest) {
              flags.push({ task: t.task_name, message: `May be optimistic — fastest recorded: ${bm.fastest}d, you planned ${planned}d`, level: "yellow" });
            }
            if (planned > 0 && planned > bm.slowest * 1.5) {
              flags.push({ task: t.task_name, message: `Much longer than typical — slowest: ${bm.slowest}d, you planned ${planned}d`, level: "amber" });
            }
          }
          setScheduleFlags(flags);
        } catch { /* benchmarks advisory only */ }

        toast.success(`${parsedTasks.length} tasks imported across ${uniquePhases.size} phases`);
        fetchTasks();
      } catch (err: any) {
        toast.error("Failed to parse schedule: " + (err.message ?? "Unknown error"));
      }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = async () => {
    const sys = (productionSystem ?? "").trim();
    const fileSafeProject = (projectName || "Project").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
    const sysLabel = sys ? sys.charAt(0).toUpperCase() + sys.slice(1) : "Generic";

    if (sys === "modular" || sys === "panelised" || sys === "hybrid") {
      const { data } = await supabase
        .from("production_task_templates")
        .select("phase_name, stage_number, task_type, task_name, predecessor_stage_numbers, typical_duration_days")
        .eq("production_system", sys as any)
        .order("display_order", { ascending: true });

      const tasks = (data ?? []).map((t: any) => ({
        phase_name: t.phase_name ?? "",
        stage_number: t.stage_number ?? "",
        task_type: t.task_type ?? "task",
        task_name: t.task_name ?? "",
        predecessor_stage_numbers: t.predecessor_stage_numbers ?? [],
        typical_duration_days: t.typical_duration_days ?? null,
      }));

      const filename = `Schedule_${fileSafeProject}_${sysLabel}.xlsx`;
      downloadScheduleTemplate(filename, tasks);
      toast.success(`Template downloaded: ${filename}`);
    } else {
      // Fallback generic
      const filename = `Schedule_${fileSafeProject}_Generic.xlsx`;
      downloadScheduleTemplate(filename, [
        { phase_name: "Pre-Production", stage_number: "1.1", task_type: "task", task_name: "Site survey", predecessor_stage_numbers: [], typical_duration_days: 2 },
      ]);
      toast.success(`Template downloaded: ${filename}`);
    }
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
    if (overrideReason.trim().length < 20) {
      toast.error("Override reason must be at least 20 characters.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await updateTask(overrideTask.id, {
      status: "Ready to Start",
      is_locked: false,
      lock_override_by: user?.id ?? null,
      lock_override_reason: overrideReason.trim(),
      lock_override_at: new Date().toISOString(),
    } as any);
    toast.success(`Lock overridden for "${overrideTask.task_name}".`);
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

  if (isProductionView) {
    return <ProductionStageRollup tasks={tasks} userRole={userRole} liveStatus={liveStatus} getDelay={getDelay} />;
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

      {scheduleFlags.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 px-4 space-y-1">
            <p className="text-sm font-medium text-amber-800">⚠ Schedule Intelligence Flags</p>
            {scheduleFlags.map((f, i) => (
              <p key={i} className="text-xs" style={{ color: f.level === "yellow" ? "#b45309" : "#92400e" }}>
                <strong>{f.task}:</strong> {f.message}
              </p>
            ))}
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
            <div className="flex border rounded-md overflow-hidden flex-wrap">
              {([["list", List, "List"], ["phase", Columns3, "Phase"], ["gantt", BarChart3, "Gantt"], ["delays", Timer, "Delays"], ["measurement", Ruler, "Costs"], ["flags", AlertTriangle, "Flags"]] as const).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === mode ? "bg-[#006039] text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            {(viewMode === "list" || viewMode === "phase" || viewMode === "gantt") && (
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger className="w-[180px] h-8 text-sm"><SelectValue placeholder="All Phases" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Phases</SelectItem>
                  {PHASES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {viewMode === "list" && (
            <ListView tasks={filteredTasks} taskMap={taskMap} canEdit={canEdit} canOverride={canOverride} liveStatus={liveStatus} getDelay={getDelay} getBlockingName={getBlockingName} onStart={handleStartTask} onUpdate={updateTask} onRequestOverride={(t) => setOverrideTask(t)} materialRiskMap={materialRiskTaskIds} collapsedParents={collapsedParents} setCollapsedParents={setCollapsedParents} />
          )}
          {viewMode === "phase" && (
            <PhaseBoard tasks={filteredTasks} liveStatus={liveStatus} phases={PHASES} />
          )}
          {viewMode === "gantt" && (
            <GanttView tasks={filteredTasks} taskMap={taskMap} getDelay={getDelay} />
          )}
          {viewMode === "delays" && (
            <DelayDashboard tasks={tasks as any} />
          )}
          {viewMode === "measurement" && (
            <MeasurementSheet projectId={projectId} />
          )}
          {viewMode === "flags" && (
            <RedFlagAlerts projectId={projectId} />
          )}
        </>
      )}

      {/* Override dialog */}
      <Dialog open={!!overrideTask} onOpenChange={(o) => { if (!o) { setOverrideTask(null); setOverrideReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-[#F40009]" /> Override Lock</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">Task: <strong>{overrideTask?.task_name}</strong></p>
            <p className="text-xs text-muted-foreground">
              {overrideTask?.is_qc_gate
                ? "This is a QC gate. Overriding will release downstream tasks before the gate is signed off."
                : "This task is blocked by a predecessor (likely a QC gate or sign-off). Provide a clear reason — minimum 20 characters."}
            </p>
            <Textarea
              placeholder="Reason for override (min 20 characters)..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              rows={4}
            />
            <p className="text-[11px] text-muted-foreground">{overrideReason.trim().length}/20 characters minimum. Logged with your name and timestamp.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideTask(null); setOverrideReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmOverride} disabled={overrideReason.trim().length < 20}>Confirm Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===================== LIST VIEW ===================== */
function ListView({ tasks, taskMap, canEdit, canOverride, liveStatus, getDelay, getBlockingName, onStart, onUpdate, onRequestOverride, materialRiskMap = {}, collapsedParents, setCollapsedParents }: {
  tasks: ProjectTask[]; taskMap: Record<string, ProjectTask>; canEdit: boolean; canOverride: boolean;
  liveStatus: (t: ProjectTask) => string; getDelay: (t: ProjectTask) => number;
  getBlockingName: (t: ProjectTask) => string | null;
  onStart: (t: ProjectTask) => void; onUpdate: (id: string, u: Partial<ProjectTask>) => void;
  onRequestOverride: (t: ProjectTask) => void;
  materialRiskMap?: Record<string, string>;
  collapsedParents: Set<string>;
  setCollapsedParents: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  // Group sub-tasks under their parent (parent = nearest preceding non-subtask in display order)
  const visibleTasks = useMemo(() => {
    const out: ProjectTask[] = [];
    let currentParentId: string | null = null;
    for (const t of tasks) {
      const isSub = t.task_type === "sub-task";
      if (!isSub) { currentParentId = t.id; out.push(t); continue; }
      if (currentParentId && collapsedParents.has(currentParentId)) continue;
      out.push(t);
    }
    return out;
  }, [tasks, collapsedParents]);

  // Map parent -> sub-tasks for progress computation
  const subtaskMap = useMemo(() => {
    const m: Record<string, ProjectTask[]> = {};
    let parentId: string | null = null;
    for (const t of tasks) {
      if (t.task_type !== "sub-task") { parentId = t.id; m[parentId] = m[parentId] ?? []; continue; }
      if (parentId) (m[parentId] = m[parentId] ?? []).push(t);
    }
    return m;
  }, [tasks]);

  const toggleCollapse = (id: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
          {visibleTasks.map((task) => {
            const status = liveStatus(task);
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Upcoming"];
            const delay = getDelay(task);
            const blocking = getBlockingName(task);
            const Icon = cfg.icon;
            const materialRisk = materialRiskMap[task.id];
            const ttype = (task.task_type ?? "task") as TaskTemplateType;
            const meta = TASK_TYPE_META[ttype];
            const isSub = ttype === "sub-task";
            const subs = subtaskMap[task.id] ?? [];
            const subDoneCount = subs.filter((s) => s.completion_percentage === 100).length;
            const isCollapsed = collapsedParents.has(task.id);
            const isQcBlocked = task.is_locked && (status === "Blocked" || status === "Upcoming");
            return (
              <TableRow key={task.id} className={`${status === "Overdue" ? "bg-red-50/50" : ""} ${isSub ? "bg-muted/20" : ""}`}>
                <TableCell className="font-mono text-xs">{task.task_id_in_schedule}</TableCell>
                <TableCell className={`font-medium ${isSub ? "text-xs text-muted-foreground" : "text-sm"}`}>
                  <div className="flex items-center gap-1.5 flex-wrap" style={{ paddingLeft: isSub ? 16 : 0 }}>
                    {!isSub && subs.length > 0 && (
                      <button onClick={() => toggleCollapse(task.id)} className="text-muted-foreground hover:text-foreground">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {meta.icon && (
                      <span aria-hidden style={{ color: meta.color }} title={meta.label} className="text-sm font-bold leading-none">{meta.icon}</span>
                    )}
                    {task.is_qc_gate && !meta.icon && (
                      <ShieldAlert className="h-3.5 w-3.5" style={{ color: "#F40009" }} aria-label="QC Gate" />
                    )}
                    {isQcBlocked && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><Lock className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                          <TooltipContent>Waiting for QC gate: {blocking ?? "predecessor"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {materialRisk && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger><AlertTriangle className="h-3.5 w-3.5" style={{ color: "#D4860A" }} /></TooltipTrigger>
                          <TooltipContent className="max-w-xs">Material "{materialRisk}" not yet delivered — task start may be impacted.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <span>{task.task_name}</span>
                    {!isSub && subs.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">({subDoneCount}/{subs.length})</span>
                    )}
                    {isQcBlocked && canOverride && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 ml-1 px-2 text-[10px] border-[#F40009] text-[#F40009] hover:bg-[#F40009]/10"
                        onClick={(e) => { e.stopPropagation(); onRequestOverride(task); }}
                      >
                        Override Lock
                      </Button>
                    )}
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
function PhaseBoard({ tasks, liveStatus, phases }: { tasks: ProjectTask[]; liveStatus: (t: ProjectTask) => string; phases: string[] }) {
  const grouped = useMemo(() => {
    const m: Record<string, ProjectTask[]> = {};
    phases.forEach((p) => { m[p] = []; });
    tasks.forEach((t) => { (m[t.phase] ?? (m[t.phase] = [])).push(t); });
    return m;
  }, [tasks, phases]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {phases.map((phase) => {
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

/* ===================== PRODUCTION STAGE ROLLUP (read-only, simplified) ===================== */
function ProductionStageRollup({ tasks, userRole, liveStatus, getDelay }: {
  tasks: ProjectTask[];
  userRole: string | null;
  liveStatus: (t: ProjectTask) => string;
  getDelay: (t: ProjectTask) => number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const stages = useMemo(() => {
    const groups: Record<string, ProjectTask[]> = {};
    for (const t of tasks) {
      const key = (t.stage_number ?? "").split(".")[0] || t.phase || "Other";
      (groups[key] = groups[key] ?? []).push(t);
    }
    return Object.entries(groups)
      .map(([key, items]) => {
        const total = items.length;
        const done = items.filter((i) => i.completion_percentage === 100).length;
        const inProg = items.filter((i) => i.completion_percentage > 0 && i.completion_percentage < 100).length;
        const overdue = items.filter((i) => liveStatus(i) === "Overdue").length;
        const avg = total ? Math.round(items.reduce((s, i) => s + (i.completion_percentage || 0), 0) / total) : 0;
        const dates = items.map((i) => i.planned_start_date).filter(Boolean) as string[];
        const ends = items.map((i) => i.planned_finish_date).filter(Boolean) as string[];
        const start = dates.length ? dates.sort()[0] : null;
        const end = ends.length ? ends.sort().reverse()[0] : null;
        const phaseLabel = items[0]?.phase ?? key;
        return { key, label: `Stage ${key} — ${phaseLabel}`, items, total, done, inProg, overdue, avg, start, end };
      })
      .sort((a, b) => {
        const an = parseFloat(a.key); const bn = parseFloat(b.key);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return a.key.localeCompare(b.key);
      });
  }, [tasks, liveStatus]);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.responsible_role === userRole && t.completion_percentage < 100),
    [tasks, userRole]
  );

  const toggle = (k: string) => setExpanded((p) => {
    const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n;
  });

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No schedule available yet. Karthik will publish the schedule shortly.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg font-semibold text-foreground">Production Schedule</h2>
        <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1">
          <Lock className="h-3 w-3" /> Read-only — contact Karthik to amend
        </Badge>
      </div>

      {/* My Tasks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Circle className="h-4 w-4 text-[#006039]" /> My Open Tasks ({myTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open tasks assigned to you in this project.</p>
          ) : (
            <div className="space-y-1.5">
              {myTasks.map((t) => {
                const status = liveStatus(t);
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Upcoming"];
                const delay = getDelay(t);
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border bg-background text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-muted-foreground shrink-0">{t.task_id_in_schedule}</span>
                      <span className="truncate">{t.task_name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{t.planned_finish_date ? format(new Date(t.planned_finish_date), "dd MMM") : "-"}</span>
                      {delay > 0 && <span className="text-red-600 font-medium">+{delay}d</span>}
                      <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage rollups */}
      <div className="space-y-2">
        {stages.map((s) => {
          const isOpen = expanded.has(s.key);
          return (
            <Card key={s.key}>
              <button
                onClick={() => toggle(s.key)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{s.label}</span>
                    {s.overdue > 0 && <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px]">{s.overdue} overdue</Badge>}
                    {s.done === s.total && <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px]">Complete</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{s.done}/{s.total} tasks</span>
                    {s.inProg > 0 && <span>· {s.inProg} in progress</span>}
                    {s.start && <span>· {format(new Date(s.start), "dd MMM")} → {s.end ? format(new Date(s.end), "dd MMM") : "-"}</span>}
                  </div>
                </div>
                <div className="w-32 shrink-0">
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div className="bg-[#006039] h-1.5 rounded-full transition-all" style={{ width: `${s.avg}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground text-right mt-0.5">{s.avg}%</div>
                </div>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/10 px-4 py-2 space-y-1">
                  {s.items.map((t) => {
                    const status = liveStatus(t);
                    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Upcoming"];
                    const delay = getDelay(t);
                    const isMine = t.responsible_role === userRole;
                    return (
                      <div key={t.id} className={`flex items-center justify-between gap-2 py-1.5 text-xs ${isMine ? "font-medium" : ""}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {t.is_locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <span className="font-mono text-muted-foreground shrink-0">{t.task_id_in_schedule}</span>
                          <span className="truncate">{t.task_name}</span>
                          {isMine && <Badge variant="outline" className="text-[10px] bg-[#006039]/10 text-[#006039] border-[#006039]/20">Mine</Badge>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{t.planned_finish_date ? format(new Date(t.planned_finish_date), "dd MMM") : "-"}</span>
                          {delay > 0 && <span className="text-red-600">+{delay}d</span>}
                          <span className="text-muted-foreground w-10 text-right">{t.completion_percentage}%</span>
                          <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
