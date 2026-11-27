import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useCanEditSchedule } from "@/hooks/useCanEditSchedule";
import { MicroScheduleTab } from "@/components/projects/MicroScheduleTab";
import { ScheduleUnits } from "./ScheduleUnits";
import { ScheduleLibrary } from "./ScheduleLibrary";
import { ScheduleTaskTable, type CustomTaskInput, type TaskPatch } from "./ScheduleTaskTable";
import { ScheduleGantt } from "./ScheduleGantt";
import { ScheduleHolidays } from "./ScheduleHolidays";
import { SchedulePublish, type ClearResult } from "./SchedulePublish";
import { ScheduleHistory } from "./ScheduleHistory";
import { displayDate, type FactoryModule, type LibraryActivity, type LibraryTask, type ProfileNameMap, type ScheduleBaseline, type ScheduleComment, type ScheduleHoliday, type ScheduleTask, type ScheduleUnit, type UnitKind, displayDateTime, type RevisionResult } from "./schedule-types";
import { boqTaskReportQueryKey } from "@/lib/boq-task-report";

interface Props {
  projectId: string;
  userRole: string | null;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "The schedule action could not be completed.";
}

export function ScheduleTab({ projectId, userRole }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { allowed, loading: entitlementLoading } = useCanEditSchedule();
  const [desktop, setDesktop] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [units, setUnits] = useState<ScheduleUnit[]>([]);
  const [modules, setModules] = useState<FactoryModule[]>([]);
  const [activities, setActivities] = useState<LibraryActivity[]>([]);
  const [libraryTasks, setLibraryTasks] = useState<LibraryTask[]>([]);
  const [holidays, setHolidays] = useState<ScheduleHoliday[]>([]);
  const [baselines, setBaselines] = useState<ScheduleBaseline[]>([]);
  const [comments, setComments] = useState<ScheduleComment[]>([]);
  const [names, setNames] = useState<ProfileNameMap>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [revisionNotice, setRevisionNotice] = useState<RevisionResult | null>(null);

  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [taskRes, unitRes, moduleRes, activityRes, libraryRes, holidayRes, baselineRes, commentRes, profileRes] = await Promise.all([
        (supabase.from("project_tasks") as any).select("*").eq("project_id", projectId).order("display_order", { ascending: true, nullsFirst: false }).order("task_id_in_schedule", { ascending: true }),
        (supabase.from("project_schedule_units") as any).select("*").eq("project_id", projectId).order("unit_kind").order("unit_label"),
        (supabase.from("modules") as any).select("id,project_id,name,module_code,is_archived").eq("project_id", projectId).order("name"),
        (supabase.from("schedule_library_activities") as any).select("id,code,name,phase,display_order").eq("active", true).order("display_order"),
        (supabase.from("schedule_library_tasks") as any).select("id,activity_id,code,name,default_days,std_start_day,display_order").eq("active", true).order("display_order"),
        (supabase.from("schedule_holidays") as any).select("holiday_date,label,is_active,created_by,created_at").order("holiday_date", { ascending: false }),
        (supabase.from("schedule_baselines") as any).select("*").eq("project_id", projectId).order("version", { ascending: false }),
        (supabase.from("schedule_task_comments") as any).select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        (supabase.from("profiles") as any).select("auth_user_id,display_name").eq("is_active", true),
      ]);
      const failure = [taskRes, unitRes, moduleRes, activityRes, libraryRes, holidayRes, baselineRes, commentRes, profileRes].find((result) => result.error);
      if (failure?.error) throw failure.error;
      setTasks((taskRes.data ?? []) as ScheduleTask[]);
      setUnits((unitRes.data ?? []) as ScheduleUnit[]);
      setModules((moduleRes.data ?? []) as FactoryModule[]);
      setActivities((activityRes.data ?? []) as LibraryActivity[]);
      setLibraryTasks((libraryRes.data ?? []) as LibraryTask[]);
      setHolidays((holidayRes.data ?? []) as ScheduleHoliday[]);
      setBaselines((baselineRes.data ?? []) as ScheduleBaseline[]);
      setComments((commentRes.data ?? []) as ScheduleComment[]);
      setNames(Object.fromEntries(((profileRes.data ?? []) as Array<{ auth_user_id: string; display_name: string | null }>).map((profile) => [profile.auth_user_id, profile.display_name || "Staff member"])));
    } catch (error) {
      toast.error(message(error));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void refresh(true); }, [refresh]);

  const latest = baselines[0] ?? null;
  const baselineExists = !!latest;
  const canWrite = allowed && desktop && !entitlementLoading;
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => Number(a.is_removed) - Number(b.is_removed) || (a.display_order ?? 999999) - (b.display_order ?? 999999) || a.task_id_in_schedule.localeCompare(b.task_id_in_schedule)), [tasks]);

  const recalculate = async () => {
    const { data, error } = await supabase.rpc("schedule_recalculate_dates", { p_project_id: projectId });
    if (error) throw error;
    const result = data as { warnings?: string[] } | null;
    setWarnings(result?.warnings ?? []);
    return result;
  };

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toast.success(success);
      await refresh();
      return true;
    } catch (error) {
      toast.error(message(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const updateUnit = (unit: ScheduleUnit, day1: string, note: string) => run(async () => {
    const { error } = await (supabase.from("project_schedule_units") as any).update({ day1: day1 || null, offset_note: note || null }).eq("id", unit.id);
    if (error) throw error;
    await recalculate();
  }, "Day 1 saved; dates updated.");

  const addUnit = (kind: UnitKind, label: string, day1: string, note: string) => run(async () => {
    const { error } = await (supabase.from("project_schedule_units") as any).insert({ project_id: projectId, unit_kind: kind, unit_label: label.trim(), day1: day1 || null, offset_note: note || null });
    if (error) throw error;
    await recalculate();
  }, "Unit added; dates updated.");

  const setUnitModule = (unit: ScheduleUnit, moduleId: string | null) => run(async () => {
    const { error } = await supabase.rpc("schedule_set_unit_module", { p_unit: unit.id, p_module: moduleId });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: boqTaskReportQueryKey(projectId) });
  }, moduleId ? "Factory module linked." : "Factory module link cleared.");

  const autoMatchUnits = () => run(async () => {
    const { data, error } = await supabase.rpc("schedule_auto_match_units", { p_project: projectId });
    if (error) throw error;
    const result = data as unknown as { linked: number; skipped: Array<{ unit_label: string; reason: string }> };
    const skipped = result.skipped.length ? result.skipped.map(item => `${item.unit_label}: ${item.reason}`).join("; ") : "none";
    toast.success(`Linked ${result.linked} unit(s). Skipped: ${skipped}`);
    await queryClient.invalidateQueries({ queryKey: boqTaskReportQueryKey(projectId) });
  });

  const addLibrary = (unit: ScheduleUnit, ids: string[]) => run(async () => {
    const { data, error } = await supabase.rpc("schedule_add_library_tasks", { p_project_id: projectId, p_unit_kind: unit.unit_kind, p_unit_label: unit.unit_label, p_library_task_ids: ids });
    if (error) throw error;
    const result = data as { count?: number; skipped?: number };
    toast.success(`${result.count ?? 0} tasks added; ${result.skipped ?? 0} already present.`);
    await recalculate();
  });

  const repeatUnits = (source: ScheduleUnit, targets: ScheduleUnit[]) => run(async () => {
    const { data, error } = await supabase.rpc("schedule_repeat_for_units", { p_project_id: projectId, p_source_unit_label: source.unit_label, p_target_unit_labels: targets.map((unit) => unit.unit_label) });
    if (error) throw error;
    const result = data as { count?: number; skipped?: number };
    toast.success(`${result.count ?? 0} tasks repeated; ${result.skipped ?? 0} already present.`);
    await recalculate();
  });

  const saveTask = (task: ScheduleTask, patch: TaskPatch, reason?: string) => run(async () => {
    if (baselineExists) {
      const { data, error } = await supabase.rpc("schedule_revise_task", { p_task_id: task.id, p_patch: patch as any, p_reason: reason ?? "" });
      if (error) throw error;
      const result = data as RevisionResult | null;
      setRevisionNotice(result && (result.task || result.moved?.length || result.not_moved?.length) ? result : null);
    } else {
      const { error } = await (supabase.from("project_tasks") as any).update(patch).eq("id", task.id);
      if (error) throw error;
      await recalculate();
    }
  }, baselineExists ? "Revision saved with its reason." : "Task saved; dates updated.");

  const addCustom = (input: CustomTaskInput, reason?: string) => run(async () => {
    if (baselineExists) {
      const { error } = await supabase.rpc("schedule_add_task", { p_project_id: projectId, p_task: input as any, p_reason: reason ?? "" });
      if (error) throw error;
    } else {
      const { planned_start_date: _start, planned_finish_date: _finish, ...draft } = input;
      const { error } = await (supabase.from("project_tasks") as any).insert({ ...draft, project_id: projectId, work_category: input.phase === "site" ? "construction" : "process" });
      if (error) throw error;
      await recalculate();
    }
  }, baselineExists ? "Revision task added with its reason." : "Task added; dates updated.");

  const removeTask = (task: ScheduleTask, reason: string) => run(async () => {
    const { error } = await supabase.rpc("schedule_remove_task", { p_task_id: task.id, p_reason: reason });
    if (error) throw error;
  }, "Task archived as removed with its reason.");

  const changeHoliday = (date: string, label: string, active: boolean, reason?: string) => run(async () => {
    if (baselineExists) {
      const { error } = await supabase.rpc("schedule_change_holiday", { p_date: date, p_label: label, p_active: active, p_reason: reason ?? "" });
      if (error) throw error;
    } else {
      if (active) {
        const { error } = await (supabase.from("schedule_holidays") as any).upsert({ holiday_date: date, label: label.trim(), is_active: true }, { onConflict: "holiday_date" });
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("schedule_holidays") as any).update({ is_active: false }).eq("holiday_date", date);
        if (error) throw error;
      }
      await recalculate();
    }
  }, baselineExists ? "Holiday revision saved with its reason; stored task dates did not move." : "Holiday saved; dates updated.");

  const clearUnscheduled = async (reason: string) => {
    let result: ClearResult | null = null;
    const ok = await run(async () => {
      const { data, error } = await (supabase.rpc as any)("schedule_clear_unscheduled_tasks", { p_project_id: projectId, p_reason: reason });
      if (error) throw error;
      result = data as ClearResult;
      toast.success(`Removed ${result.deleted} unscheduled tasks; kept ${result.skipped_with_progress}.`);
    });
    return ok ? (result as ClearResult | null) : null;
  };

  const publish = (reason?: string) => run(async () => {
    const { data, error } = await supabase.rpc("publish_schedule_baseline", { p_project_id: projectId, p_reason: reason ?? null });
    if (error) throw error;
    toast.success(`Baseline v${data} published.`);
  });

  const addComment = async (task: ScheduleTask, body: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from("schedule_task_comments") as any).insert({ project_id: projectId, task_id: task.id, body });
      if (error) throw error;
      toast.success("Comment added without changing the schedule.");
      await refresh();
    } catch (error) { toast.error(message(error)); } finally { setBusy(false); }
  };

  const commentStatus = async (comment: ScheduleComment, status: "seen" | "resolved") => {
    setBusy(true);
    try {
      const { error } = await (supabase.from("schedule_task_comments") as any).update({ status }).eq("id", comment.id);
      if (error) throw error;
      toast.success(`Comment marked ${status}.`);
      await refresh();
    } catch (error) { toast.error(message(error)); } finally { setBusy(false); }
  };

  if (loading || entitlementLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-w-0 space-y-4">
      {allowed && !desktop && (
        <Alert><Monitor className="h-4 w-4" /><AlertTitle>Desktop required for editing</AlertTitle><AlertDescription>Schedules are built on a desktop. Open HStack on a computer to edit. The read-only schedule and comments remain available below.</AlertDescription></Alert>
      )}
      {latest && (
        <Card className="border-primary/30 bg-accent"><CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm"><Badge>Baseline v{latest.version}</Badge><span>Published on {displayDateTime(latest.published_at)} (IST) by {names[latest.published_by] ?? "Staff member"}</span>{latest.reason && <span className="break-words text-muted-foreground">· {latest.reason}</span>}</CardContent></Card>
      )}
      <Tabs defaultValue="plan" className="min-w-0">
        <TabsList className="max-w-full"><TabsTrigger value="plan">Schedule plan</TabsTrigger><TabsTrigger value="actuals">Actuals & progress</TabsTrigger></TabsList>
        <TabsContent value="plan" className="min-w-0 space-y-4">
          <ScheduleUnits units={units} modules={modules} canWrite={canWrite} canLinkModules={allowed && !entitlementLoading} desktop={desktop} baselineExists={baselineExists} busy={busy} onUpdate={updateUnit} onAdd={addUnit} onSetModule={setUnitModule} onAutoMatch={autoMatchUnits} />
          {canWrite && !baselineExists && <ScheduleLibrary activities={activities} libraryTasks={libraryTasks} projectTasks={tasks} units={units} busy={busy} onAdd={addLibrary} onRepeat={repeatUnits} />}
          {canWrite && baselineExists && <Alert><AlertTitle>Revision mode</AlertTitle><AlertDescription>Use Revise on an existing task or “Add task not in library”. Every addition, change and removal requires a reason. Publish the next version below when ready.</AlertDescription></Alert>}
          {revisionNotice && <RevisionNotice result={revisionNotice} onClose={() => setRevisionNotice(null)} />}
          <ScheduleTaskTable tasks={sortedTasks} units={units} activities={activities} libraryTasks={libraryTasks} comments={comments} names={names} warnings={warnings} canWrite={canWrite} baselineExists={baselineExists} busy={busy} onSave={saveTask} onAddCustom={addCustom} onRemove={removeTask} onAddComment={addComment} onCommentStatus={commentStatus} />
          <ScheduleGantt tasks={tasks} holidays={holidays} units={units} activities={activities} libraryTasks={libraryTasks} />
          <ScheduleHolidays holidays={holidays} names={names} canWrite={canWrite} baselineExists={baselineExists} busy={busy} onChange={changeHoliday} />
          {canWrite && <SchedulePublish tasks={tasks} units={units} latest={latest} busy={busy} onPublish={publish} onClearUnscheduled={clearUnscheduled} />}
          <ScheduleHistory baselines={baselines} names={names} />
        </TabsContent>
        <TabsContent value="actuals" className="min-w-0">
          <MicroScheduleTab projectId={projectId} userRole={userRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RevisionNotice({ result, onClose }: { result: RevisionResult; onClose: () => void }) {
  const moved = result.moved ?? [];
  const notMoved = result.not_moved ?? [];
  const range = (start: string | null, finish: string | null) => `${displayDate(start)} – ${displayDate(finish)}`;
  return (
    <Alert role="status" className="min-w-0">
      <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
        <span>Revision saved</span>
        <button type="button" onClick={onClose} className="text-xs font-normal text-muted-foreground underline">Dismiss</button>
      </AlertTitle>
      <AlertDescription className="space-y-2 break-words text-sm">
        {result.task && <p>{result.task.name} now runs {range(result.task.new_start, result.task.new_finish)} (was {range(result.task.old_start, result.task.old_finish)}).</p>}
        {moved.length > 0 ? (
          <div><p className="font-medium">Following tasks moved ({moved.length}):</p><ul className="list-disc pl-5">{moved.map((task) => <li key={task.code}>{task.name}: {range(task.old_start, task.old_finish)} → {range(task.new_start, task.new_finish)}</li>)}</ul></div>
        ) : <p>No following tasks needed to move.</p>}
        {notMoved.length > 0 && (
          <div><p className="font-medium">Not moved ({notMoved.length}):</p><ul className="list-disc pl-5">{notMoved.map((task) => <li key={task.code}>{task.name}: {task.reason}</li>)}</ul></div>
        )}
      </AlertDescription>
    </Alert>
  );
}
