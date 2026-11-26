import { useCallback, useEffect, useMemo, useState } from "react";
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
import { SchedulePublish } from "./SchedulePublish";
import { ScheduleHistory } from "./ScheduleHistory";
import { displayDate, type LibraryActivity, type LibraryTask, type ProfileNameMap, type ScheduleBaseline, type ScheduleComment, type ScheduleHoliday, type ScheduleTask, type ScheduleUnit, type UnitKind } from "./schedule-types";

interface Props {
  projectId: string;
  userRole: string | null;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "The schedule action could not be completed.";
}

export function ScheduleTab({ projectId, userRole }: Props) {
  const { user } = useAuth();
  const { allowed, loading: entitlementLoading } = useCanEditSchedule();
  const [desktop, setDesktop] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [units, setUnits] = useState<ScheduleUnit[]>([]);
  const [activities, setActivities] = useState<LibraryActivity[]>([]);
  const [libraryTasks, setLibraryTasks] = useState<LibraryTask[]>([]);
  const [holidays, setHolidays] = useState<ScheduleHoliday[]>([]);
  const [baselines, setBaselines] = useState<ScheduleBaseline[]>([]);
  const [comments, setComments] = useState<ScheduleComment[]>([]);
  const [names, setNames] = useState<ProfileNameMap>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 1024);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, unitRes, activityRes, libraryRes, holidayRes, baselineRes, commentRes, profileRes] = await Promise.all([
        (supabase.from("project_tasks") as any).select("*").eq("project_id", projectId).order("display_order", { ascending: true, nullsFirst: false }).order("task_id_in_schedule", { ascending: true }),
        (supabase.from("project_schedule_units") as any).select("*").eq("project_id", projectId).order("unit_kind").order("unit_label"),
        (supabase.from("schedule_library_activities") as any).select("id,code,name,phase,display_order").eq("active", true).order("display_order"),
        (supabase.from("schedule_library_tasks") as any).select("id,activity_id,code,name,default_days,std_start_day,display_order").eq("active", true).order("display_order"),
        (supabase.from("schedule_holidays") as any).select("holiday_date,label,is_active").order("holiday_date", { ascending: false }),
        (supabase.from("schedule_baselines") as any).select("*").eq("project_id", projectId).order("version", { ascending: false }),
        (supabase.from("schedule_task_comments") as any).select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        (supabase.from("profiles") as any).select("auth_user_id,display_name").eq("is_active", true),
      ]);
      const failure = [taskRes, unitRes, activityRes, libraryRes, holidayRes, baselineRes, commentRes, profileRes].find((result) => result.error);
      if (failure?.error) throw failure.error;
      setTasks((taskRes.data ?? []) as ScheduleTask[]);
      setUnits((unitRes.data ?? []) as ScheduleUnit[]);
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

  useEffect(() => { void refresh(); }, [refresh]);

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
    const { error } = await (supabase.from("project_schedule_units") as any).update({ day1: day1 || null, offset_note: note || null, updated_by: user?.id }).eq("id", unit.id);
    if (error) throw error;
    await recalculate();
  }, "Day 1 saved and dates recalculated by the database.");

  const addUnit = (kind: UnitKind, label: string, day1: string, note: string) => run(async () => {
    const { error } = await (supabase.from("project_schedule_units") as any).insert({ project_id: projectId, unit_kind: kind, unit_label: label.trim(), day1: day1 || null, offset_note: note || null, created_by: user?.id, updated_by: user?.id });
    if (error) throw error;
    await recalculate();
  }, "Unit added and dates recalculated by the database.");

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
      const { error } = await supabase.rpc("schedule_revise_task", { p_task_id: task.id, p_patch: patch as any, p_reason: reason ?? "" });
      if (error) throw error;
    } else {
      const { error } = await (supabase.from("project_tasks") as any).update(patch).eq("id", task.id);
      if (error) throw error;
      await recalculate();
    }
  }, baselineExists ? "Revision saved with its reason." : "Task saved and dates recalculated by the database.");

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
  }, baselineExists ? "Revision task added with its reason." : "Custom task added and dates recalculated by the database.");

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
        const { error } = await (supabase.from("schedule_holidays") as any).upsert({ holiday_date: date, label: label.trim(), is_active: true, created_by: user?.id, updated_by: user?.id }, { onConflict: "holiday_date" });
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("schedule_holidays") as any).update({ is_active: false, updated_by: user?.id }).eq("holiday_date", date);
        if (error) throw error;
      }
      await recalculate();
    }
  }, baselineExists ? "Holiday revision saved with its reason; stored task dates did not move." : "Holiday saved and dates recalculated by the database.");

  const publish = (reason?: string) => run(async () => {
    const { data, error } = await supabase.rpc("publish_schedule_baseline", { p_project_id: projectId, p_reason: reason ?? null });
    if (error) throw error;
    toast.success(`Baseline v${data} published.`);
  });

  const addComment = async (task: ScheduleTask, body: string) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await (supabase.from("schedule_task_comments") as any).insert({ project_id: projectId, task_id: task.id, author_id: user.id, body, status: "open" });
      if (error) throw error;
      toast.success("Comment added without changing the schedule.");
      await refresh();
    } catch (error) { toast.error(message(error)); } finally { setBusy(false); }
  };

  const commentStatus = async (comment: ScheduleComment, status: "seen" | "resolved") => {
    setBusy(true);
    try {
      const { error } = await (supabase.from("schedule_task_comments") as any).update({ status, updated_by: user?.id, ...(status === "resolved" ? { resolved_by: user?.id, resolved_at: new Date().toISOString() } : {}) }).eq("id", comment.id);
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
        <Card className="border-primary/30 bg-accent"><CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm"><Badge>Baseline v{latest.version}</Badge><span>Published on {displayDate(latest.published_at)} by {names[latest.published_by] ?? "Staff member"}</span>{latest.reason && <span className="break-words text-muted-foreground">· {latest.reason}</span>}</CardContent></Card>
      )}
      <Tabs defaultValue="plan" className="min-w-0">
        <TabsList className="max-w-full"><TabsTrigger value="plan">Schedule plan</TabsTrigger><TabsTrigger value="actuals">Actuals & progress</TabsTrigger></TabsList>
        <TabsContent value="plan" className="min-w-0 space-y-4">
          <ScheduleUnits units={units} canWrite={canWrite} baselineExists={baselineExists} busy={busy} onUpdate={updateUnit} onAdd={addUnit} />
          {canWrite && !baselineExists && <ScheduleLibrary activities={activities} libraryTasks={libraryTasks} projectTasks={tasks} units={units} busy={busy} onAdd={addLibrary} onRepeat={repeatUnits} />}
          {canWrite && baselineExists && <Alert><AlertTitle>Revision mode</AlertTitle><AlertDescription>Use Revise on an existing task or “Add task not in library”. Every addition, change and removal requires a reason. Publish the next version below when ready.</AlertDescription></Alert>}
          <ScheduleTaskTable tasks={sortedTasks} units={units} comments={comments} names={names} warnings={warnings} canWrite={canWrite} baselineExists={baselineExists} busy={busy} onSave={saveTask} onAddCustom={addCustom} onRemove={removeTask} onAddComment={addComment} onCommentStatus={commentStatus} />
          <ScheduleGantt tasks={tasks} holidays={holidays} />
          <ScheduleHolidays holidays={holidays} canWrite={canWrite} baselineExists={baselineExists} busy={busy} onChange={changeHoliday} />
          {canWrite && <SchedulePublish tasks={tasks} units={units} latest={latest} busy={busy} onPublish={publish} />}
          <ScheduleHistory baselines={baselines} names={names} />
        </TabsContent>
        <TabsContent value="actuals" className="min-w-0">
          <MicroScheduleTab projectId={projectId} userRole={userRole} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
