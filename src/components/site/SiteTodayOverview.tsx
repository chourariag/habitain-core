import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, ChevronRight, Factory, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSiteOverview } from "@/hooks/useSiteOverview";
import { overviewToday, overviewTime, overviewCostTotal, type OverviewRow } from "@/lib/site-overview";

const money = (amount: number) => `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const rowKey = (row: OverviewRow) => row.project_id ?? "factory";
const statusClass = (status: string) => status === "Not started" ? "text-destructive" : status === "Draft" ? "text-warning" : "text-primary";

function ReportReadOnly({ row, date }: { row: OverviewRow; date: string }) {
  return <div className="space-y-6 break-words">
    <p className="text-sm text-muted-foreground">{format(new Date(`${date}T12:00:00`), "dd/MM/yyyy")} · {row.status} · Read-only</p>
    {!row.report_id && <p className="text-destructive">No report yet</p>}
    <section className="space-y-3"><h3 className="font-semibold">{row.kind === "factory" ? "Modules & stages" : "Tasks"}</h3>
      {row.report.activities.length === 0 ? <p className="text-sm text-muted-foreground">No activities recorded</p> : row.report.activities.map((a, i) => <div key={i} className="border-b border-border pb-3">
        <p className="font-medium">{a.code} {a.name}{a.stage && ` · ${a.stage}`}</p>
        <p className="text-sm text-muted-foreground">{a.progress}% · {a.status ?? "Ongoing"} · {a.hours} h</p>
        {a.remarks && <p className="mt-1 text-sm">{a.remarks}</p>}
      </div>)}
    </section>
    <section className="space-y-2"><h3 className="font-semibold">Quantities</h3>{row.report.quantities.length ? row.report.quantities.map((q, i) => <div key={i} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><span className="min-w-0">{q.item}</span><span className="shrink-0 tabular-nums">{q.qty} {q.unit}</span></div>) : <p className="text-sm text-muted-foreground">No quantities recorded</p>}</section>
    <section className="space-y-2"><h3 className="font-semibold">People working</h3>{row.report.workers.length ? row.report.workers.map((w, i) => <div key={i} className="flex justify-between gap-3 text-sm"><span>{w.name}</span><span className="shrink-0">{w.hours} h</span></div>) : <p className="text-sm text-muted-foreground">No attendance recorded</p>}</section>
    <section className="space-y-2"><h3 className="font-semibold">Consumables & site expenses</h3>{row.report.expenses.length ? row.report.expenses.map((e, i) => <div key={i} className="flex justify-between gap-3 text-sm"><span className="min-w-0">{e.description}<span className="block text-muted-foreground">{e.kind}</span></span>{e.amount !== undefined && <span className="shrink-0">{money(e.amount)}</span>}</div>) : <p className="text-sm text-muted-foreground">None recorded</p>}</section>
    <section className="space-y-2"><h3 className="font-semibold">Notes</h3><p className="whitespace-pre-wrap text-sm">{row.report.notes || "—"}</p></section>
    {row.cost && <section className="border-t border-border pt-4"><h3 className="font-semibold">Day’s cost: {money(overviewCostTotal(row.cost))}</h3><p className="text-xs text-muted-foreground">Indicative. Submitted reports only.</p></section>}
  </div>;
}

export function SiteTodayOverview() {
  const [date, setDate] = useState(overviewToday);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { data, error, loading, updatedAt, visible, refresh } = useSiteOverview(date);
  const selected = data?.rows.find(row => rowKey(row) === selectedKey);
  const hasCosts = !!data?.kpis.cost;
  const totalCost = (data?.kpis.cost?.site ?? 0) + (data?.kpis.cost?.factory ?? 0);
  const stats = data ? [
    ["Sites submitted", `${data.kpis.sites_submitted} / ${data.kpis.sites_expected}`],
    ["Sites draft", String(data.kpis.sites_draft)],
    ...(data.factory ? [["Factory", data.kpis.factory_status ?? "Not started"]] : []),
    ["Activities", String(data.kpis.activities)], ["People working", String(data.kpis.people_working)], ["Labour hours", String(data.kpis.labour_hours)],
    ...(hasCosts ? [["Day’s cost", money(totalCost)]] : []),
  ] : [];
  return <div className="min-w-0 space-y-6 pb-20 sm:pb-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" className="min-h-11 gap-2" aria-label="Overview date"><CalendarDays className="h-4 w-4" />{format(new Date(`${date}T12:00:00`), "dd/MM/yyyy")}</Button></PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={new Date(`${date}T12:00:00`)} onSelect={d => { if (d) { setDate(format(d, "yyyy-MM-dd")); setSelectedKey(null); setCalendarOpen(false); } }} className="p-3 pointer-events-auto" classNames={{ caption: "flex h-11 items-center justify-center relative", head_cell: "w-11 text-muted-foreground font-normal text-xs", cell: "h-11 w-11 p-0 text-center relative", day: `${buttonVariants({ variant: "ghost" })} h-11 w-11 p-0 font-normal`, nav_button: `${buttonVariants({ variant: "outline" })} h-11 w-11 p-0` }} initialFocus /></PopoverContent>
      </Popover>
      <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground" aria-live="polite">{visible ? "Live" : "Paused"} - updated {overviewTime(updatedAt)}</span><Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Refresh overview" title="Refresh overview" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" className="min-h-11" onClick={() => void refresh()}>Retry</Button></div>}
    {loading && <div role="status" className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="sr-only">Loading reports</span></div>}
    {data && <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border py-4 sm:grid-cols-3 lg:grid-cols-7">{stats.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums">{value}</dd></div>)}</dl>
      {hasCosts && <p className="text-xs text-muted-foreground">Indicative. Submitted reports only.{data.kpis.cost?.site === undefined && " Factory cost only."}</p>}
      <section className="space-y-3"><h2 className="text-lg font-semibold">Sites & Factory</h2>
        {!data.rows.length && <p className="text-sm text-muted-foreground">No sites expected for this date.</p>}
        <div className="hidden lg:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="w-[25%] py-3">Site / Factory</th><th className="w-[21%]">Report</th><th>Activities</th><th>People</th><th>Hours</th>{hasCosts && <th>Cost</th>}<th>Updated</th></tr></thead><tbody>{data.rows.map(row => <tr key={rowKey(row)} className="border-b border-border align-top"><td className="py-2 pr-2"><Button variant="link" className="h-auto min-h-11 w-full justify-start whitespace-normal px-0 text-left" onClick={() => setSelectedKey(rowKey(row))}>{row.kind === "factory" && <Factory className="mr-1 h-4 w-4 shrink-0" />}<span className="min-w-0 break-words">{row.name}</span></Button>{row.expected === false && <p className="text-xs text-muted-foreground">Sunday · not expected</p>}</td><td className="break-words py-3 pr-2"><span className={statusClass(row.status)}>{row.status === "Not started" ? "No report yet" : row.status}</span><p className="mt-1 text-xs text-muted-foreground">{row.who ?? "—"}</p></td><td className="py-3">{row.activities}</td><td className="py-3">{row.people}</td><td className="py-3">{row.hours}</td>{hasCosts && <td className="break-words py-3 tabular-nums">{row.cost ? money(overviewCostTotal(row.cost)) : "—"}</td>}<td className="break-words py-3 text-xs">{overviewTime(row.last_update)}</td></tr>)}</tbody></table></div>
        <div className="grid gap-3 lg:hidden">{data.rows.map(row => <article key={rowKey(row)} className="rounded-md border border-border bg-card p-4"><Button variant="ghost" className="h-auto min-h-11 w-full justify-between whitespace-normal px-0 text-left" onClick={() => setSelectedKey(rowKey(row))}><span className="min-w-0 break-words font-semibold">{row.name}</span><ChevronRight className="h-4 w-4 shrink-0" /></Button><p className={`text-sm ${statusClass(row.status)}`}>{row.status === "Not started" ? "No report yet" : row.status}</p>{row.expected === false && <p className="text-xs text-muted-foreground">Sunday · not expected</p>}<p className="mt-2 break-words text-xs text-muted-foreground">{row.who ?? "—"} · {overviewTime(row.last_update)}</p><dl className="mt-3 grid grid-cols-3 gap-2 text-sm">{[["Activities", row.activities], ["People", row.people], ["Hours", row.hours]].map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key}</dt><dd className="tabular-nums">{value}</dd></div>)}</dl>{row.cost && <p className="mt-3 border-t border-border pt-2 text-sm font-semibold">{money(overviewCostTotal(row.cost))}</p>}</article>)}</div>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Latest submissions</h2>{data.feed.length ? <ol className="divide-y divide-border">{data.feed.map((entry, i) => <li key={i} className="flex gap-3 py-4"><time className="shrink-0 text-xs tabular-nums text-muted-foreground">{overviewTime(entry.time)}</time><div className="min-w-0 space-y-1 break-words text-sm"><p className="font-semibold">{entry.location}<Badge variant="outline" className="ml-2 text-primary">Submitted</Badge></p><p>{entry.who ?? "—"} · {entry.hours} h</p>{entry.name && <p className="text-muted-foreground">{entry.code} {entry.name}{entry.stage && ` · ${entry.stage}`}</p>}{entry.quantities.map((line, n) => <p key={n} className="text-xs text-muted-foreground">{line}</p>)}</div></li>)}</ol> : <p className="text-sm text-muted-foreground">No submissions for this date.</p>}</section>
    </>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelectedKey(null); }}><DialogContent aria-describedby={undefined} className="flex max-h-[85dvh] max-w-2xl flex-col overflow-hidden [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center"><DialogHeader className="shrink-0 pr-11"><DialogTitle className="break-words">{selected?.name} — Daily report</DialogTitle></DialogHeader><div className="min-h-0 overflow-y-auto pr-1 pb-4">{selected && <ReportReadOnly row={selected} date={date} />}</div></DialogContent></Dialog>
  </div>;
}