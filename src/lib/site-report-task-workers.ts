export type PresentWorker = { worker_id: string; name: string; skill_type: string | null; contractor_name: string | null; attendance_hours: number };
export type TaskWorker = { task_id: string; worker_id: string; hours: number };
export function allocatedHours(rows: TaskWorker[], workerId: string, excludingTask?: string) {
  return rows.filter(r => r.worker_id === workerId && r.task_id !== excludingTask).reduce((n, r) => n + Number(r.hours), 0);
}
export function remainingHours(worker: PresentWorker, rows: TaskWorker[], taskId: string) {
  return Math.max(0, Number(worker.attendance_hours) - allocatedHours(rows, worker.worker_id, taskId));
}
export function workerAllocationProblems(workers: PresentWorker[], rows: TaskWorker[]) {
  const problems: string[] = [];
  for (const row of rows) {
    if (!workers.some(w => w.worker_id === row.worker_id)) problems.push("Worker must be present on this project and date.");
    if (!Number.isFinite(row.hours) || row.hours <= 0 || row.hours > 16) problems.push("Worker hours must be greater than 0 and at most 16.");
  }
  for (const worker of workers) if (allocatedHours(rows, worker.worker_id) > Number(worker.attendance_hours)) problems.push(`${worker.name}: allocated hours exceed attendance hours.`);
  if (new Set(rows.map(r => `${r.task_id}:${r.worker_id}`)).size !== rows.length) problems.push("Worker already selected for this task.");
  return [...new Set(problems)];
}
export function derivedLabour(rows: TaskWorker[]) {
  const totals = new Map<string, number>();
  rows.forEach(r => totals.set(r.task_id, (totals.get(r.task_id) ?? 0) + Number(r.hours)));
  return [...totals].map(([task_id, hours]) => ({ task_id, hours }));
}
export function calculatedProgress(lines: { cumulative: number; today: number; progress_weight: number }[], manual: number | null, completed: boolean) {
  if (completed) return 100;
  if (!lines.some(b => Number(b.progress_weight) > 0)) return manual;
  return Math.min(100, Math.max(0, Math.round(100 * lines.reduce((v, b) => v + (Number(b.cumulative) + Number(b.today)) * Number(b.progress_weight), 0))));
}
export function isTodaysTask(task: { pct: number; planned_start: string | null; planned_finish?: string | null; previous_report?: boolean; in_report?: boolean }, date: string) {
  return (Number(task.pct) > 0 && Number(task.pct) < 100) ||
    (!!task.planned_start && !!task.planned_finish && task.planned_start <= date && date <= task.planned_finish) || !!task.previous_report || !!task.in_report;
}