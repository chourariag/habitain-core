import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ScheduleBaseline, ScheduleTask, ScheduleUnit } from "./schedule-types";

interface Props {
  tasks: ScheduleTask[];
  units: ScheduleUnit[];
  latest: ScheduleBaseline | null;
  busy: boolean;
  onPublish: (reason?: string) => Promise<boolean>;
}

export function SchedulePublish({ tasks, units, latest, busy, onPublish }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);
  const active = tasks.filter((task) => !task.is_removed);
  const unitsWithoutDay1 = units.filter((unit) => !unit.day1);
  const withoutDates = active.filter((task) => !task.planned_start_date || !task.planned_finish_date);
  const blocking = withoutDates.filter((task) => task.unit_kind && task.unit_label);
  const nextVersion = (latest?.version ?? 0) + 1;
  const disabled = !active.length || blocking.length > 0 || (nextVersion > 1 && !reason.trim()) || busy;
  const publish = async () => { if (await onPublish(nextVersion > 1 ? reason : undefined)) setOpen(false); };
  return (
    <Card className="min-w-0" id="publish-baseline">
      <CardHeader><CardTitle className="text-base">6. Publish {nextVersion === 1 ? "baseline" : `revision v${nextVersion}`}</CardTitle><p className="text-sm text-muted-foreground">Publishing stores an immutable snapshot. Version 1 needs no reason; every later version requires one.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-muted p-3 text-sm"><strong>{active.length}</strong><br />Active tasks</div><div className="rounded-md bg-muted p-3 text-sm"><strong>{unitsWithoutDay1.length}</strong><br />Units without Day 1</div><div className="rounded-md bg-muted p-3 text-sm"><strong>{withoutDates.length}</strong><br />Tasks without dates</div></div>
        {blocking.length > 0 && <p className="break-words text-sm text-warning" role="alert">Publishing is blocked: {blocking.length} task{blocking.length === 1 ? "" : "s"} in a unit {blocking.length === 1 ? "has" : "have"} no calculated start or finish date. Save the schedule and resolve the database warnings first.</p>}
        <Button type="button" disabled={!active.length || blocking.length > 0 || busy} onClick={() => setOpen(true)}>{latest ? "Publish revision" : "Review & publish baseline"}</Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish v{nextVersion}?</DialogTitle><DialogDescription>This creates an immutable {nextVersion === 1 ? "baseline" : "revision"} snapshot for the project.</DialogDescription></DialogHeader>
          <div className="rounded-md bg-muted p-3 text-sm"><p>{active.length} active tasks · {units.length} units</p><p>{unitsWithoutDay1.length} units without Day 1 · {withoutDates.length} tasks without dates</p></div>
          {nextVersion > 1 && <label>Reason (required)<Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={disabled} onClick={() => void publish()}>Confirm publish v{nextVersion}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
