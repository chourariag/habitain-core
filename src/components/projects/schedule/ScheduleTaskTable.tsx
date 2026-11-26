import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { ScheduleComments } from "./ScheduleComments";
import { displayDate, unitLabel, type ProfileNameMap, type ScheduleComment, type ScheduleTask, type ScheduleUnit, type UnitKind } from "./schedule-types";

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

export function ScheduleTaskTable(props: Props) {
  const { tasks, units, canWrite, baselineExists, busy, onAddCustom } = props;
  const [customOpen, setCustomOpen] = useState(false);
  const activeUnits = units;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle className="text-base">3. Task table</CardTitle><p className="text-sm text-muted-foreground">Dates shown here are database results. Comments never edit the schedule.</p></div>
          {canWrite && <Button type="button" variant="outline" onClick={() => setCustomOpen(true)}><Plus className="mr-2 h-4 w-4" />Add task not in library</Button>}
        </div>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="max-w-full overflow-x-auto" aria-label="Project schedule task table">
          <Table className="min-w-[1240px]">
            <TableHeader><TableRow>
              <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Unit</TableHead><TableHead>Start day</TableHead><TableHead>Days</TableHead><TableHead>Predecessors</TableHead><TableHead>Computed start</TableHead><TableHead>Computed finish</TableHead><TableHead>Responsible role</TableHead><TableHead>Actions / comments</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {tasks.map((task) => <TaskRow key={task.id} {...props} task={task} />)}
            </TableBody>
          </Table>
        </div>
        {tasks.length === 0 && <p className="py-6 text-sm text-muted-foreground">No tasks yet. An editor can add library tasks or a custom task.</p>}
      </CardContent>
      <CustomTaskDialog open={customOpen} onOpenChange={setCustomOpen} units={activeUnits} tasks={tasks} baselineExists={baselineExists} busy={busy} onAdd={onAddCustom} />
    </Card>
  );
}

function TaskRow({ task, tasks, comments, names, warnings, canWrite, baselineExists, busy, onSave, onRemove, onAddComment, onCommentStatus }: Props & { task: ScheduleTask }) {
  const [startDay, setStartDay] = useState(String(task.start_day ?? 1));
  const [days, setDays] = useState(String(task.duration_days ?? 0));
  const [predecessors, setPredecessors] = useState<string[]>(task.predecessor_ids ?? []);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => {
    setStartDay(String(task.start_day ?? 1));
    setDays(String(task.duration_days ?? 0));
    setPredecessors(task.predecessor_ids ?? []);
  }, [task.id, task.start_day, task.duration_days, task.predecessor_ids]);
  const options = tasks.filter((candidate) => !candidate.is_removed && candidate.id !== task.id);
  const patch = { start_day: Number(startDay), duration_days: Number(days), predecessor_ids: predecessors };
  const validNumbers = Number.isInteger(patch.start_day) && patch.start_day >= 1 && Number.isInteger(patch.duration_days) && patch.duration_days >= 0;
  const taskWarnings = warnings.filter((warning) => warning.includes(task.task_id_in_schedule) || (task.unit_label && warning.includes(task.unit_label)));
  const save = async () => {
    const saved = await onSave(task, patch, baselineExists ? reason : undefined);
    if (saved) { setReviseOpen(false); setReason(""); }
  };
  const remove = async () => {
    const removed = await onRemove(task, reason);
    if (removed) { setRemoveOpen(false); setReason(""); }
  };
  return (
    <TableRow className={task.is_removed ? "bg-muted/50 text-muted-foreground" : undefined}>
      <TableCell className="align-top font-medium">{task.task_id_in_schedule}{task.is_removed && <Badge className="ml-2" variant="outline">Removed</Badge>}</TableCell>
      <TableCell className="max-w-64 align-top">
        <div className="break-words">{task.task_name}</div>
        {task.is_removed && <p className="mt-1 break-words text-xs">Reason: {task.removed_reason || "Revision removal"}</p>}
        {taskWarnings.map((warning, index) => <p key={index} className="mt-1 break-words text-xs text-warning" role="alert">{warning}</p>)}
      </TableCell>
      <TableCell className="align-top">{task.unit_label ? `${task.unit_label} (${unitLabel(task.unit_kind)})` : "—"}</TableCell>
      <TableCell className="align-top">{canWrite && !baselineExists && !task.is_removed ? <Input type="number" min={1} step={1} value={startDay} onChange={(event) => setStartDay(event.target.value)} className="w-20" aria-label={`Start day for ${task.task_id_in_schedule}`} /> : task.start_day ?? "—"}</TableCell>
      <TableCell className="align-top">{canWrite && !baselineExists && !task.is_removed ? <Input type="number" min={0} step={1} value={days} onChange={(event) => setDays(event.target.value)} className="w-20" aria-label={`Duration for ${task.task_id_in_schedule}`} /> : task.duration_days ?? 0}</TableCell>
      <TableCell className="align-top">
        {canWrite && !baselineExists && !task.is_removed ? (
          <select multiple value={predecessors} onChange={(event) => setPredecessors(Array.from(event.target.selectedOptions).map((option) => option.value))} className="h-20 w-48 rounded-md border border-input bg-background p-1 text-xs" aria-label={`Predecessors for ${task.task_id_in_schedule}`}>
            {options.map((option) => <option key={option.id} value={option.task_id_in_schedule}>{option.task_id_in_schedule} · {option.task_name}</option>)}
          </select>
        ) : <span className="block max-w-52 break-words">{(task.predecessor_ids ?? []).join(", ") || "—"}</span>}
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">{displayDate(task.planned_start_date)}</TableCell>
      <TableCell className="align-top whitespace-nowrap">{displayDate(task.planned_finish_date)}</TableCell>
      <TableCell className="align-top">{task.responsible_role || "—"}</TableCell>
      <TableCell className="align-top">
        <div className="flex min-w-56 flex-col items-start gap-2">
          {canWrite && !baselineExists && !task.is_removed && <Button type="button" size="sm" disabled={!validNumbers || busy} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save & recalculate</Button>}
          {canWrite && baselineExists && !task.is_removed && <Button type="button" size="sm" variant="outline" onClick={() => setReviseOpen(true)}>Revise</Button>}
          {canWrite && baselineExists && !task.is_removed && <Button type="button" size="sm" variant="outline" onClick={() => setRemoveOpen(true)}><Trash2 className="mr-1 h-4 w-4" />Remove with reason</Button>}
          <ScheduleComments task={task} comments={comments} names={names} canEditSchedule={canWrite} busy={busy} onAdd={onAddComment} onStatus={onCommentStatus} />
        </div>
      </TableCell>
      <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revise {task.task_id_in_schedule}</DialogTitle><DialogDescription>Review the changes and provide a reason. The checked revision function writes and audits them.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>Start day<Input type="number" min={1} value={startDay} onChange={(event) => setStartDay(event.target.value)} /></label>
            <label>Days<Input type="number" min={0} value={days} onChange={(event) => setDays(event.target.value)} /></label>
          </div>
          <label>Predecessors from this project
            <select multiple value={predecessors} onChange={(event) => setPredecessors(Array.from(event.target.selectedOptions).map((option) => option.value))} className="h-32 w-full rounded-md border border-input bg-background p-2 text-sm">
              {options.map((option) => <option key={option.id} value={option.task_id_in_schedule}>{option.task_id_in_schedule} · {option.task_name}</option>)}
            </select>
          </label>
          <div className="rounded-md bg-muted p-3 text-sm"><strong>Changes:</strong><p>Start day: {task.start_day ?? "—"} → {startDay}</p><p>Days: {task.duration_days ?? 0} → {days}</p><p className="break-words">Predecessors: {(task.predecessor_ids ?? []).join(", ") || "—"} → {predecessors.join(", ") || "—"}</p></div>
          <label>Reason (required)<Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
          <DialogFooter><Button variant="outline" onClick={() => setReviseOpen(false)}>Cancel</Button><Button disabled={!validNumbers || !reason.trim() || busy} onClick={() => void save()}>Confirm revision</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove {task.task_id_in_schedule}?</DialogTitle><DialogDescription>The task will remain visible as removed with its reason. It is never hard-deleted.</DialogDescription></DialogHeader>
          <p className="break-words text-sm">{task.task_name} · {task.unit_label || "No unit"}</p>
          <label>Reason (required)<Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /></label>
          <DialogFooter><Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!reason.trim() || busy} onClick={() => void remove()}>Confirm removal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </TableRow>
  );
}

function CustomTaskDialog({ open, onOpenChange, units, tasks, baselineExists, busy, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; units: ScheduleUnit[]; tasks: ScheduleTask[]; baselineExists: boolean; busy: boolean; onAdd: (input: CustomTaskInput, reason?: string) => Promise<boolean> }) {
  const empty = { code: "", name: "", phase: "Pre-Production", role: "", unit: "", start: "1", days: "1", preds: [] as string[], reason: "", startDate: "", finishDate: "" };
  const [form, setForm] = useState(empty);
  useEffect(() => { if (open) setForm(empty); }, [open]);
  const selectedUnit = units.find((unit) => `${unit.unit_kind}|${unit.unit_label}` === form.unit);
  const options = useMemo(() => tasks.filter((task) => !task.is_removed), [tasks]);
  const valid = form.code.trim() && form.name.trim() && selectedUnit && Number(form.start) >= 1 && Number(form.days) >= 0 && (!baselineExists || form.reason.trim());
  const submit = async () => {
    if (!selectedUnit) return;
    const saved = await onAdd({
      task_id_in_schedule: form.code.trim(), task_name: form.name.trim(), phase: form.phase.trim() || "Pre-Production", responsible_role: form.role.trim(),
      start_day: Number(form.start), duration_days: Number(form.days), predecessor_ids: form.preds,
      unit_kind: selectedUnit.unit_kind, unit_label: selectedUnit.unit_label,
      ...(baselineExists && form.startDate ? { planned_start_date: form.startDate } : {}),
      ...(baselineExists && form.finishDate ? { planned_finish_date: form.finishDate } : {}),
    }, baselineExists ? form.reason : undefined);
    if (saved) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add task not in library</DialogTitle><DialogDescription>{baselineExists ? "Review the new task and reason. The checked add function logs this revision." : "The task is inserted for this project, then the database recalculates its dates."}</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>Task code<Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
          <label>Task name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Unit<select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={`${unit.unit_kind}|${unit.unit_label}`}>{unit.unit_label} · {unitLabel(unit.unit_kind)}</option>)}</select></label>
          <label>Phase<Input value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value })} /></label>
          <label>Start day<Input type="number" min={1} value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label>
          <label>Days<Input type="number" min={0} value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></label>
          <label className="sm:col-span-2">Responsible role (optional)<Input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Existing role code, if known" /></label>
          <label className="sm:col-span-2">Predecessors from this project<select multiple value={form.preds} onChange={(event) => setForm({ ...form, preds: Array.from(event.target.selectedOptions).map((option) => option.value) })} className="h-28 w-full rounded-md border border-input bg-background p-2 text-sm">{options.map((task) => <option key={task.id} value={task.task_id_in_schedule}>{task.task_id_in_schedule} · {task.task_name}</option>)}</select></label>
          {baselineExists && <><label>Revision start date (optional)<Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>Revision finish date (optional)<Input type="date" value={form.finishDate} onChange={(event) => setForm({ ...form, finishDate: event.target.value })} /></label></>}
          {baselineExists && <label className="sm:col-span-2">Reason (required)<Textarea rows={3} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>}
        </div>
        <div className="rounded-md bg-muted p-3 text-sm">New task: <strong>{form.code || "Code"}</strong> · {form.name || "Name"} · {selectedUnit?.unit_label || "No unit"} · Day {form.start} · {form.days} days.</div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!valid || busy} onClick={() => void submit()}>Confirm new task</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
