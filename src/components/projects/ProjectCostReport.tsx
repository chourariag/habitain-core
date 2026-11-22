import { useEffect, useRef, useState, type ReactNode } from "react";
import * as XLSX from "@/lib/safe-xlsx";
import { ChevronDown, ChevronRight, Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { canViewRunningBill } from "@/lib/running-bill";
import { parseLabourDateInput } from "@/lib/labour-rules";
import { costDate, costMoney, costMonthToDate, costNumber, costReportWorkbook, type CostGroup, type CostReport } from "@/lib/cost-report";

function Rows({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <><div className="hidden sm:block max-w-full overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border text-left text-muted-foreground">{headers.map(h => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border">{r.map((v, j) => <td key={j} className="p-2 align-top tabular-nums">{v}</td>)}</tr>)}</tbody></table></div><div className="sm:hidden space-y-3">{rows.map((r, i) => <dl key={i} className="rounded-md border border-border bg-card p-3 grid grid-cols-2 gap-x-3 gap-y-2 min-w-0">{r.map((v, j) => <div key={j} className={j === 0 ? "col-span-2 min-w-0 break-words" : "min-w-0 break-words"}><dt className="text-xs text-muted-foreground">{headers[j]}</dt><dd className="text-sm tabular-nums mt-0.5">{v}</dd></div>)}</dl>)}</div></>;
}

function Group({ group, showPersonCost }: { group: CostGroup; showPersonCost: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="border-b border-border py-3 min-w-0">
    <div className="flex gap-2 items-start"><Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label={`Who worked on ${group.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold break-words">{group.code && `${group.code} · `}{group.name}</h4><Badge variant="secondary" className="mt-1">{group.allocation}</Badge></div></div>
    <Rows headers={["Hours", "Labour", "Subcontract", "Material (frozen)", "Consumables and expenses", "Total"]} rows={[[costNumber(group.hours), costMoney(group.labour_cost), costMoney(group.subcontract), costMoney(group.material), costMoney(group.consumables_expenses), costMoney(group.total)]]} />
    {open && <div className="mt-3 min-w-0"><h5 className="text-sm font-semibold mb-2">Who worked on what</h5>{group.allocation === "Approximate" && <p className="text-xs text-muted-foreground mb-2">Earlier reports: attendance hours are proportionally allocated, not recorded worker selections.</p>}{group.workers.length ? <Rows headers={["Worker", "Hours", ...(showPersonCost ? ["Amount"] : [])]} rows={group.workers.map(w => [w.name, costNumber(w.hours), ...(showPersonCost && w.amount !== undefined ? [costMoney(w.amount)] : showPersonCost ? ["—"] : [])])} /> : <p className="text-sm text-muted-foreground">No worker hours recorded.</p>}</div>}
  </div>;
}

export function ProjectCostReport({ projectId, role, onOpenRates }: { projectId: string; role: string | null; onOpenRates: () => void }) {
  const [range, setRange] = useState(costMonthToDate);
  const [fromText, setFromText] = useState(() => costDate(range.from));
  const [toText, setToText] = useState(() => costDate(range.to));
  const [data, setData] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  const allowed = canViewRunningBill(role);
  useEffect(() => {
    const current = ++request.current;
    setData(null); setError(""); setLoading(true);
    if (!allowed) return;
    void supabase.rpc("get_cost_report", { p_project_id: projectId, p_from: range.from, p_to: range.to }).then(({ data: result, error: failure }) => {
      if (current !== request.current) return;
      if (failure) setError(failure.message); else setData(result as unknown as CostReport);
      setLoading(false);
    });
    return () => { request.current++; };
  }, [projectId, allowed, range.from, range.to, refresh]);
  const dates = () => {
    const from = parseLabourDateInput(fromText), to = parseLabourDateInput(toText);
    if (!from || !to || from > to) { setDateError("Enter a valid date range in DD/MM/YYYY."); return; }
    setDateError(""); setRange({ from, to });
  };
  if (!allowed) return null;
  const t = data?.totals, m = data?.material_status;
  const kpis = t ? [["Own labour (site)", t.own_labour], ["Factory labour", t.factory_labour], ["Subcontract", t.subcontract], ["Material (frozen at submission)", t.material], ["Consumables and expenses", t.consumables_expenses], ["Total cost", t.total], ["Value earned (period)", t.value_earned_period], ["Value earned minus cost", t.value_minus_cost]] as const : [];
  return <section aria-label="Project cost report" className="min-w-0 space-y-5 pb-24 md:pb-6">
    <div className="flex flex-wrap justify-between gap-3 items-center"><h2 className="font-display text-xl font-bold">Cost</h2><Button variant="outline" className="min-h-11" disabled={!data || loading} onClick={() => data && XLSX.writeFile(costReportWorkbook(data), `Project_Cost_${data.from}_${data.to}.xlsx`)}><Download className="h-4 w-4 mr-2" />Download Excel</Button></div>
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-end gap-3"><div className="min-w-0 sm:w-44 space-y-1"><Label htmlFor="cost-from">From</Label><Input id="cost-from" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} className="min-h-11" value={fromText} onChange={e => setFromText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") dates(); }} /></div><div className="min-w-0 sm:w-44 space-y-1"><Label htmlFor="cost-to">To</Label><Input id="cost-to" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} className="min-h-11" value={toText} onChange={e => setToText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") dates(); }} /></div><div className="col-span-2 flex gap-3"><Button className="min-h-11" onClick={dates}>Apply</Button><Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="Refresh costs" disabled={loading} onClick={() => setRefresh(v => v + 1)}><RefreshCw className="h-4 w-4" /></Button></div></div>
    {dateError && <p role="alert" className="text-destructive text-sm">{dateError}</p>}
    {loading ? <div className="py-8 flex justify-center"><Loader2 aria-label="Loading costs" className="h-6 w-6 animate-spin text-muted-foreground" /></div> : error ? <p role="alert" className="text-destructive text-sm">{error}</p> : data && t && m && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(([label, value]) => <div key={label} className="min-w-0 bg-card border border-border rounded-md p-3"><p className="text-xs text-muted-foreground break-words">{label}</p><p className="text-base font-semibold mt-2 break-words tabular-nums">{costMoney(value)}</p>{label === "Value earned minus cost" && <p className="text-xs text-muted-foreground mt-2 break-words">Indicative: same period, excludes overheads and unrated material</p>}</div>)}</div>
      <p className="text-xs text-muted-foreground">Cumulative value earned to {costDate(data.to)}: {costMoney(t.value_earned_cumulative)}</p>
      {m.missing_count > 0 && <div className="border-l-4 border-warning bg-muted p-3 text-sm space-y-1"><p>{m.missing_count} quantity rows have no material rate</p><p className="text-xs text-muted-foreground">Value at BOQ rate: {costMoney(m.missing_boq_value)}</p><Button variant="link" className="min-h-11 p-0 text-primary" onClick={onOpenRates}>Open Rates</Button></div>}
      {m.correction_count > 0 && <div className="border-l-4 border-primary bg-muted p-3 text-sm break-words"><p>{m.correction_count} quantity rows were corrected after submission. Material is shown at the original quantity (difference {costMoney(m.correction_difference)}).</p><p className="text-xs text-muted-foreground mt-1">Site: {m.site_correction_count} · {costMoney(m.site_correction_difference)}; Factory: {m.factory_correction_count} · {costMoney(m.factory_correction_difference)}</p></div>}
      {m.not_captured_count > 0 && <p className="border-l-4 border-border bg-muted p-3 text-sm break-words">{m.not_captured_count} earlier quantity rows have no material snapshot (submitted before rates existed). Their material is not included.</p>}
      <p className="text-sm font-medium">Excess over BOQ: {costMoney(t.excess_value)}</p>
      {data.factory_unallocated && <p className="text-xs text-muted-foreground">Factory-level unallocated: {costMoney(data.factory_unallocated.cost)} · {costNumber(data.factory_unallocated.hours ?? 0)} hours. Not charged to this project.</p>}
      <section className="min-w-0 space-y-3" aria-label="Day by day"><h3 className="font-display text-base font-semibold">Day by day</h3>{data.days.length ? <Rows headers={["Date", "Own labour", "Factory labour", "Subcontract", "Material (frozen)", "Consumables and expenses", "Total", "Cumulative"]} rows={data.days.map(d => [costDate(d.work_date), costMoney(d.own_labour), costMoney(d.factory_labour), costMoney(d.subcontract), costMoney(d.material), costMoney(d.consumables_expenses), costMoney(d.total), costMoney(d.cumulative)])} /> : <p className="text-sm text-muted-foreground">No submitted reports in this date range.</p>}</section>
      {(["Site", "Factory"] as const).map(location => <section key={location} className="min-w-0" aria-label={location === "Site" ? "By task (site)" : "By module (factory)"}><h3 className="font-display text-base font-semibold">{location === "Site" ? "By task (site)" : "By module (factory)"}</h3>{data.groups.filter(g => g.location === location).map(g => <Group key={`${g.location}-${g.group_id}`} group={g} showPersonCost={data.can_view_person_cost} />)}{!data.groups.some(g => g.location === location) && <p className="text-sm text-muted-foreground py-3">Nothing recorded.</p>}</section>)}
    </>}
  </section>;
}