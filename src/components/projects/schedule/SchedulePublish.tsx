import { forwardRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ScheduleBaseline, ScheduleTask, ScheduleUnit } from "./schedule-types";

export interface ClearResult { deleted: number; skipped_with_progress: number }

interface Props {
  tasks: ScheduleTask[];
  units: ScheduleUnit[];
  latest: ScheduleBaseline | null;
  busy: boolean;
  onPublish: (reason?: string) => Promise<boolean>;
  onClearUnscheduled?: (reason: string) => Promise<ClearResult | null>;
}

export const SchedulePublish = forwardRef<HTMLDivElement, Props>(function SchedulePublish({ tasks, units, latest, busy, onPublish, onClearUnscheduled }, ref) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [clearReason, setClearReason] = useState("");
  const [clearResult, setClearResult] = useState<ClearResult | null>(null);
  useEffect(() => { if (!open) setReason(""); }, [open]);
  useEffect(() => { if (!clearOpen) setClearReason(""); }, [clearOpen]);
  const active = tasks.filter((task) => !task.is_removed);
  const unitsWithoutDay1 = units.filter((unit) => !unit.day1);
  const withoutDates = active.filter((task) => !task.planned_start_date || !task.planned_finish_date);
  const blocking = withoutDates.filter((task) => task.unit_kind && task.unit_label);
  const legacyUndated = withoutDates.filter((task) => !task.unit_label);
  const scheduled = active.filter((task) => task.unit_label);
  const legacy = active.filter((task) => !task.unit_label);
  const nextVersion = (latest?.version ?? 0) + 1;
  const disabled = !scheduled.length || blocking.length > 0 || (nextVersion > 1 && !reason.trim()) || busy;
  const publish = async () => { if (await onPublish(nextVersion > 1 ? reason : undefined)) setOpen(false); };
  const clear = async () => {
    if (!onClearUnscheduled) return;
    const result = await onClearUnscheduled(clearReason.trim());
    if (result) { setClearResult(result); setClearOpen(false); }
  };
  return (
    <Card className="min-w-0" id="publish-baseline" ref={ref}>
      <CardHeader><CardTitle className="text-base">6. Publish {nextVersion === 1 ? "baseline" : `revision v${nextVersion}`}</CardTitle><p className="text-sm text-muted-foreground">Publishing saves a copy of the plan that cannot be changed. Version 1 needs no reason; every later version needs one.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-muted p-3 text-sm"><strong>{active.length}</strong><br />Active tasks</div>
          <div className="rounded-md bg-muted p-3 text-sm"><strong>{unitsWithoutDay1.length}</strong><br />Units without Day 1</div>
          <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
            <div><strong>{withoutDates.length}</strong><br />Tasks without dates</div>
            {!latest && onClearUnscheduled && legacyUndated.length > 0 && <Button type="button" size="sm" variant="outline" className="h-auto whitespace-normal text-left" disabled={busy} onClick={() => { setClearResult(null); setClearOpen(true); }}>Clear unscheduled legacy tasks…</Button>}
          </div>
        </div>
        <div className="space-y-1 text-sm" data-testid="publish-scope">
          <p><strong>{scheduled.length}</strong> scheduled task{scheduled.length === 1 ? "" : "s"} will be in the baseline</p>
          <p className="text-muted-foreground"><strong>{legacy.length}</strong> legacy task{legacy.length === 1 ? "" : "s"} without a unit {legacy.length === 1 ? "is" : "are"} not part of the baseline</p>
        </div>
        {clearResult && <p className="text-sm" role="status">Cleared {clearResult.deleted} unscheduled legacy task{clearResult.deleted === 1 ? "" : "s"}; kept {clearResult.skipped_with_progress} that have progress, comments or links.</p>}
        {blocking.length > 0 && <p className="break-words text-sm text-warning" role="alert">Publishing is blocked: {blocking.length} task{blocking.length === 1 ? "" : "s"} in a unit {blocking.length === 1 ? "has" : "have"} no calculated start or finish date. Set Day 1 for the unit and fix the warnings in the task table first.</p>}
        <Button type="button" disabled={!scheduled.length || blocking.length > 0 || busy} onClick={() => setOpen(true)}>{latest ? "Publish revision" : "Review & publish baseline"}</Button>
      </CardContent>
      {open && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Publish v{nextVersion}?</DialogTitle><DialogDescription>This saves a {nextVersion === 1 ? "baseline" : "revision"} copy of the plan that cannot be changed.</DialogDescription></DialogHeader>
            <div className="rounded-md bg-muted p-3 text-sm"><p>{scheduled.length} scheduled tasks will be in the baseline</p><p>{legacy.length} legacy tasks without a unit are not part of the baseline</p><p>{units.length} units</p><p>{unitsWithoutDay1.length} units without Day 1 · {blocking.length} scheduled tasks without dates</p></div>
            {nextVersion > 1 && <label>Reason (required)<Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={disabled} onClick={() => void publish()}>Confirm publish v{nextVersion}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {clearOpen && (
        <Dialog open={clearOpen} onOpenChange={setClearOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Clear unscheduled legacy tasks?</DialogTitle><DialogDescription>Only tasks with no unit, no dates and no progress are removed. Tasks with progress, comments, sub-tasks, BOQ or material links, QC gates and payment milestones are kept. Tasks in a unit are never touched.</DialogDescription></DialogHeader>
            <div className="rounded-md bg-muted p-3 text-sm"><p><strong>{legacyUndated.length}</strong> tasks have no unit and no dates.</p><p className="text-muted-foreground">After it runs you will see how many were removed and how many were kept.</p></div>
            <label>Reason (required)<Textarea rows={3} value={clearReason} onChange={(event) => setClearReason(event.target.value)} placeholder="e.g. Old template tasks replaced by the new schedule" /></label>
            <DialogFooter><Button variant="outline" onClick={() => setClearOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!clearReason.trim() || busy} onClick={() => void clear()}>Confirm clear</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
});
