import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { Play, CheckCircle2, AlertTriangle, Plus, Loader2, Calendar, Clock, Link2 } from "lucide-react";

const DELAY_CAUSES = [
  "Internal — Method",
  "Internal — Manpower",
  "Internal — Material",
  "Internal — Equipment",
  "External — Client",
  "External — Vendor",
  "External — Weather",
  "External — Approvals",
  "External — Payment",
];

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

interface Subtask {
  id: string;
  title: string;
  is_complete: boolean;
  sort_order: number;
}

interface TaskData {
  id: string;
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
  project_id: string;
}

interface Props {
  task: TaskData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  allTasks?: TaskData[];
  canEdit?: boolean;
  canAddSubtasks?: boolean;
}

export function TaskUpdateSheet({ task, open, onOpenChange, onUpdated, allTasks = [], canEdit = true, canAddSubtasks = false }: Props) {
  const [percentage, setPercentage] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [delayCause, setDelayCause] = useState("");
  const [delayResolution, setDelayResolution] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  useEffect(() => {
    if (task) {
      setPercentage(task.completion_percentage);
      setRemarks(task.remarks ?? "");
      setDelayCause((task as any).delay_cause ?? "");
      setDelayResolution((task as any).delay_resolution ?? "");
      fetchSubtasks(task.id);
    }
  }, [task?.id]);

  const fetchSubtasks = async (taskId: string) => {
    setLoadingSubtasks(true);
    const { data } = await supabase
      .from("project_subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true });
    setSubtasks((data as any as Subtask[]) ?? []);
    setLoadingSubtasks(false);
  };

  if (!task) return null;

  const predecessorNames = (task.predecessor_ids ?? []).map((pid) => {
    const pred = allTasks.find((t) => t.task_id_in_schedule === pid);
    return pred ? pred.task_name : pid;
  });

  const isDelayed = task.planned_finish_date && (
    (task.actual_finish_date && new Date(task.actual_finish_date) > new Date(task.planned_finish_date)) ||
    (!task.actual_finish_date && task.completion_percentage < 100 && new Date(task.planned_finish_date) < new Date())
  );

  const liveStatus = (() => {
    if (percentage === 100) return "Completed";
    const preds = task.predecessor_ids ?? [];
    if (preds.length > 0) {
      const blocking = allTasks.filter((t) => preds.includes(t.task_id_in_schedule) && t.completion_percentage < 100);
      if (blocking.length > 0) return "Blocked";
    }
    if (task.planned_finish_date && new Date(task.planned_finish_date) < new Date() && percentage < 100) return "Overdue";
    if (percentage > 0 || task.actual_start_date) return "In Progress";
    if (task.planned_start_date && new Date(task.planned_start_date) <= new Date()) return "Ready to Start";
    return "Upcoming";
  })();

  const showStart = liveStatus === "Ready to Start" && !task.actual_start_date;
  const showComplete = percentage === 100 && liveStatus !== "Completed";
  const delayRequired = isDelayed;
  const delayOver3 = task.planned_finish_date && new Date() > new Date(new Date(task.planned_finish_date).getTime() + 3 * 86400000);

  const handleStart = async () => {
    setSaving(true);
    await supabase.from("project_tasks").update({
      actual_start_date: format(new Date(), "yyyy-MM-dd"),
      status: "In Progress",
      completion_percentage: Math.max(percentage, 5),
      remarks: remarks || null,
    } as any).eq("id", task.id);
    toast.success("Task started");
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const handleComplete = async () => {
    if (delayRequired && !delayCause) {
      toast.error("Please select the cause of delay");
      return;
    }
    setSaving(true);
    await supabase.from("project_tasks").update({
      actual_finish_date: format(new Date(), "yyyy-MM-dd"),
      status: "Completed",
      completion_percentage: 100,
      remarks: remarks || null,
      delay_cause: delayCause || null,
      delay_resolution: delayResolution || null,
    } as any).eq("id", task.id);
    toast.success("Task completed");
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const handleSaveProgress = async () => {
    if (delayRequired && !delayCause) {
      toast.error("Please select the cause of delay");
      return;
    }
    setSaving(true);
    const updates: any = {
      completion_percentage: percentage,
      remarks: remarks || null,
      delay_cause: delayCause || null,
      delay_resolution: delayResolution || null,
    };
    if (percentage > 0 && !task.actual_start_date) {
      updates.actual_start_date = format(new Date(), "yyyy-MM-dd");
      updates.status = "In Progress";
    }
    if (percentage === 100) {
      updates.actual_finish_date = format(new Date(), "yyyy-MM-dd");
      updates.status = "Completed";
    }
    await supabase.from("project_tasks").update(updates).eq("id", task.id);
    toast.success("Progress saved");
    setSaving(false);
    onUpdated();
    onOpenChange(false);
  };

  const toggleSubtask = async (sub: Subtask) => {
    const newVal = !sub.is_complete;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("project_subtasks").update({
      is_complete: newVal,
      completed_at: newVal ? new Date().toISOString() : null,
      completed_by: newVal ? user?.id : null,
    } as any).eq("id", sub.id);

    const updated = subtasks.map((s) => s.id === sub.id ? { ...s, is_complete: newVal } : s);
    setSubtasks(updated);

    // Auto-calc parent percentage from subtasks
    if (updated.length > 0) {
      const done = updated.filter((s) => s.is_complete).length;
      const newPct = Math.round((done / updated.length) * 100);
      setPercentage(newPct);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await supabase.from("project_subtasks").insert({
      task_id: task.id,
      title: newSubtaskTitle.trim(),
      sort_order: subtasks.length,
    } as any);
    setNewSubtaskTitle("");
    fetchSubtasks(task.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto md:max-w-2xl md:mx-auto rounded-t-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-left">{task.task_name}</SheetTitle>
        </SheetHeader>

        {/* Section A — Task Info */}
        <div className="space-y-3 pb-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Phase</span>
              <p className="font-medium">{task.phase}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Duration</span>
              <p className="font-medium">{task.duration_days} days</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Planned Start</span>
              <p className="font-medium">{task.planned_start_date ? format(new Date(task.planned_start_date), "dd MMM yyyy") : "-"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Planned Finish</span>
              <p className="font-medium">{task.planned_finish_date ? format(new Date(task.planned_finish_date), "dd MMM yyyy") : "-"}</p>
            </div>
            {task.actual_start_date && (
              <div>
                <span className="text-muted-foreground text-xs">Actual Start</span>
                <p className="font-medium text-[#006039]">{format(new Date(task.actual_start_date), "dd MMM yyyy")}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-xs">Responsible</span>
              <p className="font-medium">{ROLE_LABELS[task.responsible_role ?? ""] ?? task.responsible_role ?? "-"}</p>
            </div>
          </div>
          {predecessorNames.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Predecessors</span>
              <p className="font-medium">{predecessorNames.join(", ")}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Section B — Progress Update */}
        {canEdit && liveStatus !== "Blocked" && (
          <div className="space-y-4 py-4">
            {showStart && (
              <Button size="lg" className="w-full bg-[#006039] hover:bg-[#004d2e] text-white text-base h-14" onClick={handleStart} disabled={saving}>
                {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                START TASK
              </Button>
            )}

            {!showStart && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Progress: {percentage}%</label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[percentage]}
                      onValueChange={([v]) => setPercentage(v)}
                      min={0} max={100} step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-10 text-right">{percentage}%</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                    <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
                  </div>
                </div>

                {showComplete && (
                  <Button size="lg" className="w-full bg-[#006039] hover:bg-[#004d2e] text-white text-base h-14" onClick={handleComplete} disabled={saving}>
                    {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                    MARK COMPLETE
                  </Button>
                )}

                <Textarea
                  placeholder="What happened today? Any issues?"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value.slice(0, 200))}
                  maxLength={200}
                  className="resize-none"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">{remarks.length}/200</p>
              </>
            )}
          </div>
        )}

        {liveStatus === "Blocked" && (
          <div className="py-4">
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Blocked — waiting for predecessor to complete
            </Badge>
          </div>
        )}

        {/* Section C — Delay Declaration */}
        {delayRequired && canEdit && (
          <>
            <Separator />
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                This task is/will be delayed
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Cause of Delay *</label>
                <Select value={delayCause} onValueChange={setDelayCause}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select cause..." /></SelectTrigger>
                  <SelectContent>
                    {DELAY_CAUSES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {delayOver3 && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Short-term Resolution *</label>
                  <Textarea
                    placeholder="What is being done to resolve the delay?"
                    value={delayResolution}
                    onChange={(e) => setDelayResolution(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Subtasks */}
        {(subtasks.length > 0 || canAddSubtasks) && (
          <>
            <Separator />
            <div className="space-y-3 py-4">
              <h4 className="text-sm font-semibold">Subtasks {subtasks.length > 0 && `(${subtasks.filter((s) => s.is_complete).length}/${subtasks.length})`}</h4>
              {loadingSubtasks ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="space-y-2">
                  {subtasks.map((sub) => (
                    <label key={sub.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={sub.is_complete} onCheckedChange={() => canEdit && toggleSubtask(sub)} disabled={!canEdit} />
                      <span className={sub.is_complete ? "line-through text-muted-foreground" : ""}>{sub.title}</span>
                    </label>
                  ))}
                </div>
              )}
              {canAddSubtasks && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Add subtask..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                  />
                  <Button size="sm" variant="outline" onClick={addSubtask} disabled={!newSubtaskTitle.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Save button */}
        {canEdit && !showStart && liveStatus !== "Blocked" && !showComplete && (
          <>
            <Separator />
            <div className="py-4">
              <Button className="w-full" onClick={handleSaveProgress} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Progress
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
