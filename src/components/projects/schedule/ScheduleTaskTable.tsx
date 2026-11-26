import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ScheduleComments } from "./ScheduleComments";
import { PredecessorPicker } from "./PredecessorPicker";
import {
  activityDisplayName, compareCodes, displayDate, isExtrasGroup, roleName, ROLE_LABELS, unitLabel,
  type LibraryActivity, type LibraryTask, type ProfileNameMap, type ScheduleComment, type ScheduleTask, type ScheduleUnit, type UnitKind,
} from "./schedule-types";

export interface TaskPatch {
  start_day: number;
  duration_days: number;
  predecessor_ids: string[];
}

export interface CustomTaskInput {
  task_id_in_schedule: string;
  task_name: string;
  phase: string;
  responsible_role: string;
  start_day: number;
  duration_days: number;
  predecessor_ids: string[];
  unit_kind: UnitKind;
  unit_label: string;
  planned_start_date?: string;
  planned_finish_date?: string;
}

interface Props {
  tasks: ScheduleTask[];
  units: ScheduleUnit[];
  activities: LibraryActivity[];
  libraryTasks: LibraryTask[];
  comments: ScheduleComment[];
  names: ProfileNameMap;
  warnings: string[];
  canWrite: boolean;
  baselineExists: boolean;
  busy: boolean;
  onSave: (task: ScheduleTask, patch: TaskPatch, reason?: string) => Promise<boolean>;
  onAddCustom: (input: CustomTaskInput, reason?: string) => Promise<boolean>;
  onRemove: (task: ScheduleTask, reason: string) => Promise<boolean>;
  onAddComment: (task: ScheduleTask, body: string) => Promise<void>;
  onCommentStatus: (comment: ScheduleComment, status: "seen" | "resolved") => Promise<void>;
}

const NO_UNIT = "__no_unit__";
const W = { code: 132, name: 200, unit: 88 };
const LEFT_NAME = W.code;
const LEFT_UNIT = W.code + W.name;
const NO_UNIT_WARNING = /has no unit/i;

type Row = { task: ScheduleTask; activity: string };
type Group = { unitKey: string; unitTitle: string; activities: Array<{ name: string; rows: Row[] }>; count: number };

export function ScheduleTaskTable(props: Props) {
  const { tasks, units, activities, libraryTasks, warnings, canWrite, baselineExists, busy, onAddCustom } = props;
  const [customOpen, setCustomOpen] = useState(false);
  const [unitFilter, setUnitFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [onlyUndated, setOnlyUndated] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set([NO_UNIT]));
  const scrollRef = useRef<HTMLDivElement>(null);

  const activityOf = useMemo(() => {
    const activityName = new Map(activities.map((activity) => [activity.id, activity.name]));
    const byLibrary = new Map(libraryTasks.map((task) => [task.id, activityName.get(task.activity_id) ?? null]));
    return (task: ScheduleTask) => activityDisplayName((task.library_task_id && byLibrary.get(task.library_task_id)) || task.phase);
  }, [activities, libraryTasks]);

  const legacyUndated = useMemo(() => tasks.filter((task) => !task.is_removed && !task.unit_label && !task.planned_start_date && !task.planned_finish_date).length, [tasks]);
  const otherWarnings = useMemo(() => warnings.filter((warning) => !NO_UNIT_WARNING.test(warning)), [warnings]);
  const activityOptions = useMemo(() => [...new Set(tasks.map(activityOf))].sort(), [tasks, activityOf]);

  const groups = useMemo<Group[]>(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, Map<string, Row[]>>();
    for (const task of tasks) {
      const unitKey = task.unit_label ? `${task.unit_kind}|${task.unit_label}` : NO_UNIT;
      const activity = activityOf(task);
      if (unitFilter !== "all" && unitFilter !== unitKey) continue;
      if (activityFilter !== "all" && activityFilter !== activity) continue;
      if (onlyUndated && task.planned_start_date && task.planned_finish_date) continue;
      if (term && !task.task_id_in_schedule.toLowerCase().includes(term) && !task.task_name.toLowerCase().includes(term)) continue;
      const unitGroup = map.get(unitKey) ?? new Map<string, Row[]>();
      unitGroup.set(activity, [...(unitGroup.get(activity) ?? []), { task, activity }]);
      map.set(unitKey, unitGroup);
    }
    const unitOrder = [...units.map((unit) => `${unit.unit_kind}|${unit.unit_label}`), NO_UNIT];
    return [...map.entries()]
      .sort(([a], [b]) => (unitOrder.indexOf(a) + 1 || 999) - (unitOrder.indexOf(b) + 1 || 999) || a.localeCompare(b))
      .map(([unitKey, activityMap]) => {
        const [kind, label] = unitKey.split("|");
        const list = [...activityMap.entries()].map(([name, rows]) => ({ name, rows: rows.sort((a, b) => Number(a.task.is_removed) - Number(b.task.is_removed) || compareCodes(a.task.task_id_in_schedule, b.task.task_id_in_schedule)) }));
        return {
          unitKey,
          unitTitle: unitKey === NO_UNIT ? "No unit (legacy)" : `${label} · ${unitLabel(kind as UnitKind)}`,
          activities: list,
          count: list.reduce((sum, item) => sum + item.rows.length, 0),
        };
      });
  }, [tasks, units, unitFilter, activityFilter, onlyUndated, search, activityOf]);

  const toggle = (key: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const openLegacy = () => {
    setUnitFilter(NO_UNIT);
    setOnlyUndated(true);
    setCollapsed((current) => { const next = new Set(current); next.delete(NO_UNIT); return next; });
    scrollRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  const visibleRows = groups.reduce((sum, group) => sum + group.count, 0);
  const columns = 10;

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">3. Task table</CardTitle>
            <p className="text-sm text-muted-foreground">Dates are worked out automatically from the start day, the days and the working calendar. Comments never change the schedule.</p>
          </div>
          {canWrite && <Button type="button" variant="outline" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Add task not in library</Button>}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
        {legacyUndated > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-muted px-3 py-2 text-sm" role="status">
            <span className="flex min-w-0 items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-warning" />{legacyUndated} task{legacyUndated === 1 ? " has" : "s have"} no unit and no dates.</span>
            <Button type="button" size="sm" variant="outline" onClick={openLegacy}>Show them</Button>
          </div>
        )}
        {otherWarnings.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-muted px-3 py-2 text-sm" role="alert">
            <p className="font-medium">Check these before publishing:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{otherWarnings.slice(0, 8).map((warning, index) => <li key={index} className="break-words">{plainWarning(warning)}</li>)}</ul>
            {otherWarnings.length > 8 && <p className="mt-1 text-xs text-muted-foreground">…and {otherWarnings.length - 8} more. Expand a task row to see its own warning.</p>}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-[180px_200px_minmax(0,1fr)_auto]" ref={scrollRef}>
          <label className="text-xs font-medium">Unit
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
              <option value="all">All units</option>
              {units.map((unit) => <option key={unit.id} value={`${unit.unit_kind}|${unit.unit_label}`}>{unit.unit_label}</option>)}
              <option value={NO_UNIT}>No unit (legacy)</option>
            </select>
          </label>
          <label className="text-xs font-medium">Activity
            <select className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}>
              <option value="all">All activities</option>
              {activityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium">Search
            <Input className="mt-1 h-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Code or task name" />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={onlyUndated} onCheckedChange={(checked) => setOnlyUndated(checked === true)} />Show only tasks without dates</label>
        </div>
        <div className="relative max-h-[70vh] max-w-full overflow-auto rounded-md border border-border" aria-label="Project schedule task table">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30 bg-card">
              <tr className="text-left text-xs text-muted-foreground">
                <Th sticky={0} width={W.code}>Code</Th>
                <Th sticky={LEFT_NAME} width={W.name}>Name</Th>
                <Th sticky={LEFT_UNIT} width={W.unit} edge>Unit</Th>
                <Th width={76}>Start day</Th>
                <Th width={68}>Days</Th>
                <Th width={168}>Predecessors</Th>
                <Th width={92}>Start</Th>
                <Th width={92}>Finish</Th>
                <Th width={160}>Responsible</Th>
                <Th stickyRight width={canWrite ? 108 : 56}>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const unitClosed = collapsed.has(group.unitKey);
                return (
                  <Fragment key={group.unitKey}>
                    <tr>
                      <td colSpan={columns} className="border-b border-border bg-muted p-0">
                        <button type="button" className="sticky left-0 flex h-9 items-center gap-2 px-3 text-sm font-semibold" onClick={() => toggle(group.unitKey)} aria-expanded={!unitClosed}>
                          {unitClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{group.unitTitle}<span className="font-normal text-muted-foreground">({group.count})</span>
                        </button>
                      </td>
                    </tr>
                    {!unitClosed && group.activities.map((activity) => {
                      const key = `${group.unitKey}::${activity.name}`;
                      const closed = collapsed.has(key);
                      return (
                        <Fragment key={key}>
                          <tr>
                            <td colSpan={columns} className="border-b border-border bg-muted/40 p-0">
                              <button type="button" className="sticky left-0 flex h-8 items-center gap-2 pl-7 pr-3 text-xs font-medium" onClick={() => toggle(key)} aria-expanded={!closed}>
                                {closed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{activity.name}<span className="text-muted-foreground">({activity.rows.length})</span>
                              </button>
                            </td>
                          </tr>
                          {!closed && activity.rows.map((row) => <TaskRow key={row.task.id} {...props} task={row.task} activity={row.activity} />)}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {visibleRows === 0 && <p className="px-3 py-6 text-sm text-muted-foreground">{tasks.length ? "No tasks match these filters." : "No tasks yet. An editor can add library tasks or a custom task."}</p>}
        </div>
      </CardContent>
      <CustomTaskDialog open={customOpen} onOpenChange={setCustomOpen} units={units} tasks={tasks} baselineExists={baselineExists} busy={busy} onAdd={onAddCustom} />
    </Card>
  );
}

function Th({ children, width, sticky, stickyRight, edge }: { children: React.ReactNode; width: number; sticky?: number; stickyRight?: boolean; edge?: boolean }) {
  const stuck = sticky !== undefined || stickyRight;
  return (
    <th
      className={`h-9 whitespace-nowrap border-b border-border bg-card px-2 font-medium ${stuck ? "sticky z-40" : ""} ${edge ? "border-r" : ""} ${stickyRight ? "border-l" : ""}`}
      style={{ width, minWidth: width, maxWidth: width, left: sticky, right: stickyRight ? 0 : undefined }}
    >{children}</th>
  );
}

function stickyCell(left?: number, right?: boolean) {
  return { position: "sticky" as const, left, right: right ? 0 : undefined, zIndex: 20 };
}

/** Turns stored warning text into planner wording; never changes what the warning says. */
export function plainWarning(warning: string) {
  return warning.replace(/\bpredecessor_ids?\b/gi, "predecessors").replace(/\bday1\b/gi, "Day 1").replace(/\bunit_label\b/gi, "unit");
}

function TaskRow({ task, activity, tasks, comments, names, warnings, canWrite, baselineExists, busy, onSave, onRemove, onAddComment, onCommentStatus }: Props & { task: ScheduleTask; activity: string }) {
  const extras = isExtrasGroup(activity) || activity === "Unscheduled extras";
  const initialDays = () => (extras && !task.planned_start_date && !task.planned_finish_date ? "" : String(task.duration_days ?? 0));
  const [startDay, setStartDay] = useState(String(task.start_day ?? 1));
  const [days, setDays] = useState(initialDays);
  const [predecessors, setPredecessors] = useState<string[]>(task.predecessor_ids ?? []);
  const [expanded, setExpanded] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const savedFrom = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    setStartDay(String(task.start_day ?? 1));
    setDays(initialDays());
    setPredecessors(task.predecessor_ids ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, task.start_day, task.duration_days, task.predecessor_ids, task.planned_start_date]);

  // After a save, explain a start day that moved because of a predecessor (uses stored results only).
  useEffect(() => {
    if (savedFrom.current === undefined) return;
    const before = savedFrom.current;
    savedFrom.current = undefined;
    const preds = task.predecessor_ids ?? [];
    if (!preds.length || task.start_day == null || task.start_day === before) return;
    const driver = tasks
      .filter((candidate) => preds.includes(candidate.task_id_in_schedule) && candidate.unit_label === task.unit_label)
      .sort((a, b) => (b.planned_finish_date ?? "").localeCompare(a.planned_finish_date ?? ""))[0];
    setNotice(`Start day set to ${task.start_day} because it follows ${driver?.task_id_in_schedule ?? preds[0]}.`);
  }, [task.start_day, task.predecessor_ids, task.unit_label, tasks]);

  const editable = canWrite && !baselineExists && !task.is_removed;
  const patch = { start_day: Number(startDay), duration_days: Number(days), predecessor_ids: predecessors };
  const validNumbers = days.trim() !== "" && Number.isInteger(patch.start_day) && patch.start_day >= 1 && Number.isInteger(patch.duration_days) && patch.duration_days >= 0;
  const taskWarnings = warnings.filter((warning) => warning.includes(task.task_id_in_schedule) && !NO_UNIT_WARNING.test(warning));
  const taskComments = comments.filter((comment) => comment.task_id === task.id).length;
  const save = async () => {
    savedFrom.current = task.start_day;
    setNotice(null);
    const saved = await onSave(task, patch, baselineExists ? reason : undefined);
    if (saved) { setReviseOpen(false); setReason(""); } else savedFrom.current = undefined;
  };
  const remove = async () => {
    const removed = await onRemove(task, reason);
    if (removed) { setRemoveOpen(false); setReason(""); }
  };
  const rowBg = task.is_removed ? "bg-muted" : "bg-card";
  const cell = `h-11 border-b border-border px-2 align-middle ${rowBg}`;

  return (
    <>
      <tr className={task.is_removed ? "text-muted-foreground" : undefined} data-testid="schedule-task-row">
        <td className={`${cell} whitespace-nowrap font-mono text-xs`} style={{ ...stickyCell(0), width: W.code, maxWidth: W.code }}>
          <div className="flex items-center gap-1">
            <button type="button" className="shrink-0 rounded p-0.5 hover:bg-muted" onClick={() => setExpanded((value) => !value)} aria-label={`${expanded ? "Collapse" : "Expand"} ${task.task_id_in_schedule}`} aria-expanded={expanded}>
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            <span className="truncate" title={task.task_id_in_schedule}>{task.task_id_in_schedule}</span>
            {(taskWarnings.length > 0 || notice) && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="Has a note" />}
          </div>
        </td>
        <td className={cell} style={{ ...stickyCell(LEFT_NAME), width: W.name, maxWidth: W.name }}>
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate" title={task.task_name}>{task.task_name}</span>
            {task.is_removed && <Badge className="shrink-0 px-1 text-[10px]" variant="outline">Removed</Badge>}
          </div>
        </td>
        <td className={`${cell} border-r text-xs`} style={{ ...stickyCell(LEFT_UNIT), width: W.unit, maxWidth: W.unit }}>
          <span className="block truncate" title={task.unit_label ?? "No unit"}>{task.unit_label ?? "—"}</span>
        </td>
        <td className={cell}>{editable ? <Input type="number" min={1} step={1} value={startDay} onChange={(event) => setStartDay(event.target.value)} className="h-8 w-16 px-2" aria-label={`Start day for ${task.task_id_in_schedule}`} /> : task.start_day ?? "—"}</td>
        <td className={cell}>{editable ? <Input type="number" min={0} step={1} value={days} placeholder="—" onChange={(event) => setDays(event.target.value)} className="h-8 w-14 px-2" aria-label={`Duration for ${task.task_id_in_schedule}`} /> : (extras && !task.planned_start_date ? "—" : task.duration_days ?? 0)}</td>
        <td className={cell} style={{ maxWidth: 168 }}>
          {editable
            ? <PredecessorPicker unitLabel={task.unit_label} selfId={task.id} selfCode={task.task_id_in_schedule} tasks={tasks} value={predecessors} onChange={setPredecessors} label={`Predecessors for ${task.task_id_in_schedule}`} />
            : <span className="block truncate font-mono text-xs" title={(task.predecessor_ids ?? []).join(", ")}>{(task.predecessor_ids ?? []).join(", ") || "—"}</span>}
        </td>
        <td className={`${cell} whitespace-nowrap text-xs`}>{displayDate(task.planned_start_date)}</td>
        <td className={`${cell} whitespace-nowrap text-xs`}>{displayDate(task.planned_finish_date)}</td>
        <td className={`${cell} text-xs`} style={{ maxWidth: 160 }}><span className="block truncate" title={roleName(task.responsible_role, ROLE_LABELS)}>{roleName(task.responsible_role, ROLE_LABELS)}</span></td>
        <td className={`${cell} border-l`} style={stickyCell(undefined, true)}>
          <div className="flex items-center gap-1">
            {editable && <Button type="button" size="sm" className="h-8 px-3" disabled={!validNumbers || busy} title={days.trim() === "" ? "Set the days first" : undefined} onClick={() => void save()}>Save</Button>}
            {canWrite && baselineExists && !task.is_removed && <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Revise" title="Revise with a reason" onClick={() => setReviseOpen(true)}><Pencil className="h-4 w-4" /></Button>}
            {canWrite && baselineExists && !task.is_removed && <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Remove with reason" title="Remove with a reason" onClick={() => setRemoveOpen(true)}><Trash2 className="h-4 w-4" /></Button>}
            <ScheduleComments task={task} comments={comments} names={names} canEditSchedule={canWrite} busy={busy} onAdd={onAddComment} onStatus={onCommentStatus} compact count={taskComments} />
          </div>
        </td>
      </tr>
      {(expanded || notice) && (
        <tr>
          <td colSpan={10} className={`border-b border-border px-3 py-2 text-xs ${rowBg}`}>
            <div className="sticky left-3 max-w-[min(900px,80vw)] space-y-1">
              {notice && <p className="font-medium text-primary" role="status">{notice}</p>}
              {expanded && <p className="break-words"><span className="text-muted-foreground">Task:</span> {task.task_name}</p>}
              {expanded && <p className="break-words"><span className="text-muted-foreground">Activity:</span> {activity} · <span className="text-muted-foreground">Unit:</span> {task.unit_label ? `${task.unit_label} (${unitLabel(task.unit_kind)})` : "No unit (legacy)"}</p>}
              {expanded && (task.predecessor_ids ?? []).length > 0 && <p className="break-words"><span className="text-muted-foreground">Follows:</span> {(task.predecessor_ids ?? []).join(", ")}</p>}
              {expanded && <p><span className="text-muted-foreground">Responsible:</span> {roleName(task.responsible_role, ROLE_LABELS)}</p>}
              {expanded && task.is_removed && <p className="break-words">Removed: {task.removed_reason || "Revision removal"}</p>}
              {expanded && taskWarnings.map((warning, index) => <p key={index} className="break-words text-warning" role="alert">{plainWarning(warning)}</p>)}
              {expanded && !task.unit_label && !task.planned_start_date && <p className="text-muted-foreground">This task has no unit, so it gets no dates. Add it to a unit or clear unscheduled legacy tasks before publishing.</p>}
            </div>
          </td>
        </tr>
      )}
      {reviseOpen && (
        <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Revise {task.task_id_in_schedule}</DialogTitle><DialogDescription>Check the changes and give a reason. The revision is saved and logged.</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>Start day<Input type="number" min={1} value={startDay} onChange={(event) => setStartDay(event.target.value)} /></label>
              <label>Days<Input type="number" min={0} value={days} onChange={(event) => setDays(event.target.value)} /></label>
            </div>
            <div className="space-y-1 text-sm">Predecessors
              <PredecessorPicker unitLabel={task.unit_label} selfId={task.id} selfCode={task.task_id_in_schedule} tasks={tasks} value={predecessors} onChange={setPredecessors} label={`Revise predecessors for ${task.task_id_in_schedule}`} />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm"><strong>Changes:</strong><p>Start day: {task.start_day ?? "—"} → {startDay}</p><p>Days: {task.duration_days ?? 0} → {days || "—"}</p><p className="break-words">Predecessors: {(task.predecessor_ids ?? []).join(", ") || "—"} → {predecessors.join(", ") || "—"}</p></div>
            <label>Reason (required)<Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
            <DialogFooter><Button variant="outline" onClick={() => setReviseOpen(false)}>Cancel</Button><Button disabled={!validNumbers || !reason.trim() || busy} onClick={() => void save()}>Confirm revision</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {removeOpen && (
        <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Remove {task.task_id_in_schedule}?</DialogTitle><DialogDescription>The task stays visible as removed, with its reason. It is never deleted.</DialogDescription></DialogHeader>
            <p className="break-words text-sm">{task.task_name} · {task.unit_label || "No unit"}</p>
            <label>Reason (required)<Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
            <DialogFooter><Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => void remove()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm removal</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CustomTaskDialog({ open, onOpenChange, units, tasks, baselineExists, busy, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; units: ScheduleUnit[]; tasks: ScheduleTask[]; baselineExists: boolean; busy: boolean; onAdd: (input: CustomTaskInput, reason?: string) => Promise<boolean> }) {
  const empty = { code: "", name: "", phase: "Pre-Production", role: "", unit: "", start: "1", days: "1", preds: [] as string[], reason: "", startDate: "", finishDate: "" };
  const [form, setForm] = useState(empty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setForm(empty); }, [open]);
  const selectedUnit = units.find((unit) => `${unit.unit_kind}|${unit.unit_label}` === form.unit);
  const roleOptions = useMemo(() => Object.entries(ROLE_LABELS).sort((a, b) => a[1].localeCompare(b[1])), []);
  const valid = form.code.trim() && form.name.trim() && selectedUnit && Number(form.start) >= 1 && form.days.trim() !== "" && Number(form.days) >= 0 && (!baselineExists || form.reason.trim());
  const submit = async () => {
    if (!selectedUnit) return;
    const saved = await onAdd({
      task_id_in_schedule: form.code.trim(), task_name: form.name.trim(), phase: form.phase.trim() || "Pre-Production", responsible_role: form.role,
      start_day: Number(form.start), duration_days: Number(form.days), predecessor_ids: form.preds,
      unit_kind: selectedUnit.unit_kind, unit_label: selectedUnit.unit_label,
      ...(baselineExists && form.startDate ? { planned_start_date: form.startDate } : {}),
      ...(baselineExists && form.finishDate ? { planned_finish_date: form.finishDate } : {}),
    }, baselineExists ? form.reason : undefined);
    if (saved) onOpenChange(false);
  };
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add task not in library</DialogTitle><DialogDescription>{baselineExists ? "Check the new task and give a reason. The change is saved and logged." : "The task is added to this project. Its dates are worked out automatically."}</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Task code<Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
          <label>Task name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Unit<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value, preds: [] })}><option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={`${unit.unit_kind}|${unit.unit_label}`}>{unit.unit_label} · {unitLabel(unit.unit_kind)}</option>)}</select></label>
          <label>Phase<Input value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value })} /></label>
          <label>Start day<Input type="number" min={1} value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
          <label>Days<Input type="number" min={0} value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></label>
          <label className="sm:col-span-2">Responsible (optional)
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="">Not set</option>{roleOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <div className="space-y-1 text-sm sm:col-span-2">Predecessors
            <PredecessorPicker unitLabel={selectedUnit?.unit_label ?? null} tasks={tasks} value={form.preds} onChange={(preds) => setForm((current) => ({ ...current, preds }))} label="Predecessors for the new task" />
          </div>
          {baselineExists && <><label>Revision start date (optional)<Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>Revision finish date (optional)<Input type="date" value={form.finishDate} onChange={(event) => setForm({ ...form, finishDate: event.target.value })} /></label></>}
          {baselineExists && <label className="sm:col-span-2">Reason (required)<Textarea rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>}
        </div>
        <div className="break-words rounded-md bg-muted p-3 text-sm">New task: <strong>{form.code || "Code"}</strong> · {form.name || "Name"} · {selectedUnit?.unit_label || "No unit"} · Day {form.start} · {form.days || "—"} days.</div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!valid || busy} onClick={() => void submit()}>Confirm new task</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
