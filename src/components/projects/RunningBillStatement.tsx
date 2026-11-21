import { useCallback, useEffect, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLabourDateInput } from "@/lib/labour-rules";
import { approximateAllocationNote, taskAllocationLabel, runningBillSheets, totalsOf, type RunningBill } from "@/lib/running-bill";

const inr = (v: number | null | undefined) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v ?? 0));
const num = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(Number(v)));
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <section className="min-w-0 space-y-2 rounded-lg border border-border p-3" aria-label={title}>
    <h3 className="font-display text-base font-semibold">{title}</h3>
    {note && <p className="text-xs text-muted-foreground break-words">{note}</p>}
    {children}
  </section>;
}
function T({ head, rows, foot }: { head: string[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return <div className="max-w-full overflow-x-auto" data-testid="rb-table-scroll">
    <table className="w-full min-w-max text-xs">
      <thead><tr className="border-b border-border text-left text-muted-foreground">{head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((r, i) => <tr key={i} className="border-b border-border/60">{r.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1.5">{c}</td>)}</tr>) : <tr><td colSpan={head.length} className="px-2 py-4 text-center text-muted-foreground">Nothing recorded up to this date.</td></tr>}</tbody>
      {foot && rows.length > 0 && <tfoot><tr className="font-semibold">{foot.map((c, j) => <td key={j} className="whitespace-nowrap px-2 py-1.5">{c}</td>)}</tr></tfoot>}
    </table>
  </div>;
}

export function RunningBillStatement({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [asOf, setAsOf] = useState(istToday());
  const [asOfText, setAsOfText] = useState(format(parseISO(istToday()), "dd/MM/yyyy"));
  const [bill, setBill] = useState<RunningBill | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_running_bill", { p_project_id: projectId, p_as_of: asOf });
    setLoading(false);
    if (error) { toast.error(error.message); setBill(null); return; }
    setBill(data as unknown as RunningBill);
  }, [projectId, asOf]);
  useEffect(() => { void load(); }, [load]);

  const download = () => {
    if (!bill) return;
    const wb = XLSX.utils.book_new();
    Object.entries(runningBillSheets(bill)).forEach(([name, aoa]) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = aoa[0].map((_, i) => ({ wch: Math.min(40, Math.max(10, ...aoa.map((r) => String(r[i] ?? "").length + 2))) }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    XLSX.writeFile(wb, `Running_Bill_${projectName.replace(/[^A-Za-z0-9]+/g, "_")}_${format(parseISO(asOf), "dd-MM-yyyy")}.xlsx`);
  };

  const t = bill ? totalsOf(bill) : null;
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="space-y-1"><Label htmlFor="rb-asof">As of</Label>
          <Input id="rb-asof" className="w-36" inputMode="numeric" maxLength={10} placeholder="DD/MM/YYYY" value={asOfText}
            onChange={(e) => { setAsOfText(e.target.value); const p = parseLabourDateInput(e.target.value); if (p) setAsOf(p); }}
            onBlur={() => { if (!parseLabourDateInput(asOfText)) setAsOfText(format(parseISO(asOf), "dd/MM/yyyy")); }} /></div>
        <Button variant="outline" onClick={download} disabled={!bill}><Download className="mr-2 h-4 w-4" />Download Excel</Button>
      </div>
      <p className="text-xs text-muted-foreground break-words">Counts submitted site and factory work dated on or before {format(parseISO(asOf), "dd/MM/yyyy")}{bill ? ` (${bill.reports} site report${bill.reports === 1 ? "" : "s"})` : ""}.</p>
      {loading && !bill && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {bill && t && <>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Totals">
          {[["Value earned (A)", t.value], ["Own labour cost (B)", t.labour], ["Factory labour cost (B2)",bill.totals.factory_labour_cost||0], ["Subcontract cost accrued (C)", t.sub]].map(([l, v]) =>
            <div key={l as string} className="min-w-0 rounded-md border border-border bg-muted p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="break-words text-lg font-semibold">{inr(v as number)}</div></div>)}
        </div>
        {bill.totals.excess_value > 0 && <p className="text-sm text-warning break-words">Excess over BOQ (needs a variation): Rs {num(bill.totals.excess_value)}</p>}
        <Section title="A · Work done by BOQ item">
          <T head={["BOQ code", "Description", "Unit", "BOQ qty", "Qty to date", "Billable qty", "Excess", "Own labour", "Subcontract", "Of which factory", "% done", "BOQ rate", "Value earned"]}
            rows={bill.work.map((r) => [r.sno ?? "", r.item_description ?? "", r.unit ?? "", num(r.boq_qty), num(r.qty), num(r.billable_qty), num(r.excess_qty), num(r.own_qty), num(r.sub_qty), num(r.factory_qty||0), r.pct_done == null ? "—" : `${r.pct_done}%`, inr(r.boq_rate), inr(r.value)])}
            foot={["Total", "", "", "", "", "", "", "", "", "", "", "", inr(t.value)]} />
        </Section>
        <Section title="B · Own labour cost" note="Hours × each worker's effective hourly rate, on days with a submitted report.">
          <T head={["Date", "Workers", "Hours", "Amount", "Cumulative"]} rows={bill.labour_by_day.map((r) => [format(parseISO(r.work_date), "dd/MM/yyyy"), r.workers, num(r.hours), inr(r.amount), inr(r.cumulative)])} foot={["Total", "", "", inr(t.labour), ""]} />
          <h4 className="pt-2 text-sm font-medium">By labour contractor</h4>
          <T head={["Contractor", "Workers", "Hours", "Amount"]} rows={bill.labour_by_contractor.map((r) => [r.contractor, r.workers, num(r.hours), inr(r.amount)])} />
          <h4 className="pt-2 text-sm font-medium">Cost by task</h4>
          <T head={["Task code", "Task", "Task hours", "Amount", "Allocation"]} rows={bill.labour_by_task.map((r) => [r.code, r.task, num(r.task_hours), inr(r.amount), taskAllocationLabel(r)])} />
          {bill.labour_by_task.some(r => taskAllocationLabel(r) === "Approximate") && <p className="text-xs text-muted-foreground break-words">{approximateAllocationNote}</p>}
        </Section>
        <Section title="B2 · Factory labour allocated to this project"><T head={["Module","Name","Hours","Labour cost"]} rows={(bill.factory_labour||[]).map(m=>[m.module_code||"",m.name,num(m.hours),inr(m.amount)])} foot={["Total","","",inr(bill.totals.factory_labour_cost)]}/></Section>
        <Section title="C · Subcontract cost accrued" note="Summed from the amounts fixed when each report was submitted.">
          <T head={["Contractor", "BOQ code", "Item / package", "Location", "Unit", "Type", "Qty to date", "Rate used", "Accrued", "Lump sum", "% consumed"]}
            rows={bill.subcontract.map((r) => [r.contractor, r.boq_code, r.item ?? "", r.location||"Site", r.unit ?? "", r.rate_type === "lump_sum" ? "Lump sum" : "Per unit", num(r.qty), r.rate_used == null ? "—" : inr(r.rate_used), inr(r.amount), r.lump_sum == null ? "—" : inr(r.lump_sum), r.pct_consumed == null ? "—" : `${r.pct_consumed}%`])}
            foot={["Total", "", "", "", "", "", "", "", inr(t.sub), "", ""]} />
        </Section>
      </>}
    </div>
  );
}
