import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Users } from "lucide-react";
import { remainingHours, type PresentWorker, type TaskWorker } from "@/lib/site-report-task-workers";

export function TaskWorkerChips({ taskId, workers, rows, readOnly, onChange }: {
  taskId: string; workers: PresentWorker[]; rows: TaskWorker[]; readOnly: boolean; onChange: (rows: TaskWorker[]) => void;
}) {
  const select = (worker: PresentWorker) => {
    const selected = rows.some(r => r.task_id === taskId && r.worker_id === worker.worker_id);
    if (selected) onChange(rows.filter(r => r.task_id !== taskId || r.worker_id !== worker.worker_id));
    else {
      const hours = remainingHours(worker, rows, taskId);
      if (hours > 0) onChange([...rows, { task_id: taskId, worker_id: worker.worker_id, hours }]);
    }
  };
  return <div className="space-y-2 min-w-0" id={`workers-${taskId}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Who worked on this</h4>
      <Button size="sm" variant="outline" disabled={readOnly || !workers.length} onClick={() => {
        const next = [...rows];
        workers.forEach(w => {
          const hours = remainingHours(w, next, taskId);
          if (hours > 0 && !next.some(r => r.task_id === taskId && r.worker_id === w.worker_id)) next.push({task_id:taskId,worker_id:w.worker_id,hours});
        });
        onChange(next);
      }}><Users className="mr-1 h-3.5 w-3.5" />Select all present</Button>
    </div>
    {!workers.length && <p className="text-xs text-muted-foreground">No present workers for this date.</p>}
    <div className="flex flex-wrap gap-2">
      {workers.map(w => {
        const row = rows.find(r => r.task_id === taskId && r.worker_id === w.worker_id);
        const available = remainingHours(w, rows, taskId);
        return <div key={w.worker_id} className="inline-flex min-w-0 max-w-full items-stretch" data-worker-group>
          <Button type="button" size="sm" variant={row ? "default" : "outline"} className={`h-auto min-h-11 min-w-0 whitespace-normal text-left ${row ? 'rounded-r-none' : ''}`} title={[w.skill_type,w.contractor_name].filter(Boolean).join(" · ")} aria-pressed={!!row} disabled={readOnly || (!row && available <= 0)} onClick={() => select(w)}>
            {row && <Check className="mr-1 h-3.5 w-3.5 shrink-0" />}<span className="break-words">{w.name}{row ? ` · ${row.hours} h` : ` · ${available} h`}</span>
          </Button>
          {row && <Input className="w-16 shrink-0 h-auto min-h-11 rounded-l-none border-l-0 px-2" aria-label={`${w.name} task hours`} type="number" inputMode="decimal" min={0.5} max={Math.min(16,available)} step={0.5} value={row.hours} disabled={readOnly} onChange={e => onChange(rows.map(r => r.task_id === taskId && r.worker_id === w.worker_id ? {...r,hours:Number(e.target.value)} : r))} />}
        </div>;
      })}
    </div>
  </div>;
}