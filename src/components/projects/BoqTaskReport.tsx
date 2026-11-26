import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { costMoney } from "@/lib/cost-report";
import { isTaskReport, type TaskReport, type TaskReportResult, type TaskReportTask, type TaskReportUnit } from "@/lib/boq-task-report";

// Read-only. Shown only when the project's BOQ links are locked; all numbers come from boq3_task_report.
export function BoqTaskReport({ projectId }: { projectId: string }) {
  const [data, setData] = useState<TaskReportResult | null>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    Promise.resolve(supabase.rpc("boq3_task_report", { p_project: projectId }))
      .then(res => { if (live) setData(res && !res.error ? (res.data as unknown as TaskReportResult) : null); }) // no access: stays hidden
      .catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, [projectId]);
  if (!isTaskReport(data)) return null;
  return <BoqTaskReportView report={data} />;
}

function Flags({ unit, task }: { unit: TaskReportUnit; task?: TaskReportTask }) {
  return <span className="inline-flex flex-wrap gap-1">
    {!unit.mapped && <Badge variant="outline" className="border-warning text-warning">Unmapped</Badge>}
    {task?.overrun && <Badge variant="destructive">Overrun</Badge>}
    {task?.broken && <Badge variant="outline">Broken link</Badge>}
  </span>;
}

const money = (v: number) => <span className="tabular-nums">{costMoney(v)}</span>;
const variance = (v: number) => <span className={`tabular-nums ${v < 0 ? "text-destructive" : ""}`}>{costMoney(v)}</span>;

export function BoqTaskReportView({ report }: { report: TaskReport }) {
  const t = report.totals;
  const kpis = [["Budget (factory lines)", t.factory_budget], ["Earned", t.earned], ["Actual", t.actual], ["Variance (earned − actual)", t.variance]] as const;
  return <section aria-label="Budget vs earned vs actual (linked BOQ)" className="min-w-0 space-y-4 border-t border-border pt-5">
    <div className="min-w-0"><h3 className="font-display text-base font-semibold">Budget vs earned vs actual (linked BOQ)</h3><p className="text-xs text-muted-foreground break-words">Factory lines, from submitted factory reports. Earned = budget × consumed ÷ allocated quantity. Read-only.</p></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(([label, v]) => <div key={label} className="min-w-0 bg-card border border-border rounded-md p-3"><p className="text-xs text-muted-foreground break-words">{label}</p><p className="text-base font-semibold mt-2 break-words">{label.startsWith("Variance") ? variance(v) : money(v)}</p></div>)}</div>
    {t.unmapped_units > 0 && <p className="border-l-4 border-warning bg-muted p-3 text-sm break-words">{t.unmapped_units} unit(s) could not be matched to a module by exact label or code, so their earned and actual are not counted.</p>}
    {report.units.map(u => {
      const tasks = report.tasks.filter(x => x.unit_kind === u.unit_kind && x.unit_label === u.unit_label);
      return <div key={`${u.unit_kind}-${u.unit_label}`} className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold break-words">{u.unit_label}</h4>{u.mapped && u.module_name && <span className="text-xs text-muted-foreground">Module: {u.module_name}</span>}<Flags unit={u} task={{ overrun: u.overrun } as TaskReportTask} /></div>
        {!u.mapped && <p className="text-xs text-muted-foreground break-words">{u.unmapped_reason}. Modules found: {u.modules_found.length ? u.modules_found.join(", ") : "none"}.</p>}
        <div className="hidden md:block max-w-full overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border text-left text-muted-foreground">{["Task", "Budget", "Earned", "Actual", "Variance", ""].map(h => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{tasks.map(x => <tr key={x.task_id} className="border-b border-border"><td className="p-2 break-words">{x.code} · {x.task_name}</td><td className="p-2">{money(x.budget)}</td><td className="p-2">{money(x.earned)}</td><td className="p-2">{money(x.actual)}</td><td className="p-2">{variance(x.variance)}</td><td className="p-2"><Flags unit={u} task={x} /></td></tr>)}
          <tr className="font-semibold"><td className="p-2">Unit total</td><td className="p-2">{money(u.budget)}</td><td className="p-2">{money(u.earned)}</td><td className="p-2">{money(u.actual)}</td><td className="p-2">{variance(u.variance)}</td><td /></tr></tbody></table></div>
        <div className="md:hidden space-y-2">{tasks.map(x => <dl key={x.task_id} className="rounded-md border border-border bg-card p-3 grid grid-cols-2 gap-x-3 gap-y-2 min-w-0">
          <div className="col-span-2 min-w-0 break-words text-sm font-medium">{x.code} · {x.task_name} <Flags unit={u} task={x} /></div>
          {([["Budget", money(x.budget)], ["Earned", money(x.earned)], ["Actual", money(x.actual)], ["Variance", variance(x.variance)]] as const).map(([k, v]) => <div key={k} className="min-w-0 break-words"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm mt-0.5">{v}</dd></div>)}
        </dl>)}<p className="text-xs text-muted-foreground break-words">Unit total: {costMoney(u.budget)} budget · {costMoney(u.earned)} earned · {costMoney(u.actual)} actual</p></div>
      </div>;
    })}
    {report.site_lines.length > 0 && <div className="min-w-0 space-y-2"><h4 className="text-sm font-semibold">Site-work lines (budget only)</h4><p className="text-xs text-muted-foreground">Waiting for unit on site reports. Total {costMoney(t.site_budget)}.</p>
      <ul className="space-y-1">{report.site_lines.map(l => <li key={l.boq_item_id} className="flex justify-between gap-3 text-sm border-b border-border py-1 min-w-0"><span className="min-w-0 break-words">{l.sno}. {l.description}</span>{money(l.budget)}</li>)}</ul></div>}
  </section>;
}
