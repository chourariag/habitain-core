import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Download, Link2, Loader2, LockKeyhole, Plus, Save, Split, Copy, X, History } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "@/lib/safe-xlsx";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { canShowBoqEntry } from "@/lib/boq-writers";
import { boqCurrency, boqTimestamp } from "@/lib/boq-entry";
import { boqEntryQueryKey, boqLinksQueryKey } from "@/lib/boq-query-keys";
import { boqLockedLinkNotice, filterLinkLines, LINK_ACTION_LABEL, LINK_STATUS_LABEL, linkQty, unitKey, unitName, type LinkFilter, type LinkLine, type LinkState, type UnitRef } from "@/lib/boq-links";

type ShareDraft = { task_id: string; share_pct: string };
type Change = { kind: "split"; boq_item_id: string; allocations: (UnitRef & { quantity: string })[]; label: string } | { kind: "shares"; boq_item_id: string; unit_kind: string; unit_label: string; shares: ShareDraft[]; label: string };

const chipClass: Record<string, string> = {
  complete: "border-primary text-primary", broken: "border-destructive text-destructive", skipped: "text-muted-foreground",
  not_started: "text-muted-foreground", split_incomplete: "border-warning text-warning", shares_incomplete: "border-warning text-warning",
};
const errorText = (e: unknown) => e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "The links could not be saved.";

export function BoqLinks({ projectId }: { projectId: string }) {
  const { role, isImpersonating } = useUserRole();
  const [params, setParams] = useSearchParams();
  const view = (params.get("links") ?? "lines") as "lines" | "budget" | "history";
  const filter = (params.get("linkFilter") ?? "all") as LinkFilter;
  const setParam = (key: string, value: string) => setParams(old => { const next = new URLSearchParams(old); next.set(key, value); return next; }, { replace: true });
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [mutationBusy, setMutationBusy] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [split, setSplit] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, ShareDraft[]>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const [copyNotes, setCopyNotes] = useState<string[]>([]);
  const [staged, setStaged] = useState<Change[]>([]);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reason, setReason] = useState("");

  const { data: queryData, error: queryError, isFetching, refetch } = useQuery<LinkState>({
    queryKey: boqLinksQueryKey(projectId),
    queryFn: async () => {
      const { data: result, error: failure } = await supabase.rpc("boq2_get", { p_project: projectId });
      if (failure) throw failure;
      return result as unknown as LinkState;
    },
  });
  const data = queryData ?? null;
  const busy = mutationBusy || isFetching;
  const queryErrorText = queryError && typeof queryError === "object" && "message" in queryError ? String(queryError.message) : queryError ? "The links could not be loaded." : "";
  const displayError = error || queryErrorText;
  const load = useCallback(async () => { setError(""); await refetch(); }, [refetch]);
  useEffect(() => { setOpenLine(null); setStaged([]); }, [projectId]);
  useEffect(() => { setStaged([]); setOpenLine(null); }, [role, isImpersonating]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);

  const locked = data?.set.status === "locked";
  const lockedNotice = data ? boqLockedLinkNotice(data) : null;
  const canWrite = desktop && !data?.blocked_reason && canShowBoqEntry(data?.can_write ?? false, role, isImpersonating);
  const line = data?.lines.find(l => l.id === openLine) ?? null;

  const openDetail = (l: LinkLine) => {
    setOpenLine(l.id); setCopyNotes([]);
    setSplit(Object.fromEntries(l.allocations.map(a => [unitKey(a), String(a.quantity)])));
    const grouped: Record<string, ShareDraft[]> = {};
    l.links.forEach(k => { (grouped[unitKey(k)] ??= []).push({ task_id: k.task_id, share_pct: String(k.share_pct) }); });
    setShares(grouped); setSearch({});
  };

  const mutate = async (action: string, payload: Record<string, unknown>, success: string) => {
    setMutationBusy(true); setError("");
    try {
      const { data: result, error: failure } = await supabase.rpc("boq2_mutate", { p_project: projectId, p_action: action, p_payload: payload as never, p_expected_version: data?.set.version ?? 0 });
      if (failure) throw failure;
      queryClient.setQueryData(boqLinksQueryKey(projectId), result as unknown as LinkState);
      await queryClient.invalidateQueries({ queryKey: boqEntryQueryKey(projectId) });
      toast.success(success); return true;
    } catch (failure) { const m = errorText(failure); setError(m); toast.error(m); return false; }
    finally { setMutationBusy(false); }
  };

  const splitPayload = (): (UnitRef & { quantity: string })[] => (data?.units ?? []).filter(u => split[unitKey(u)] !== undefined && split[unitKey(u)] !== "").map(u => ({ ...u, quantity: split[unitKey(u)] }));
  const saveSplit = async () => {
    if (!line) return;
    const allocations = splitPayload();
    if (locked) { setStaged(old => [...old.filter(c => !(c.kind === "split" && c.boq_item_id === line.id)), { kind: "split", boq_item_id: line.id, allocations, label: `Item ${line.sno}: quantity split` }]); toast.success("Added to the revision."); return; }
    await mutate("save_split", { boq_item_id: line.id, allocations }, "Quantity split saved.");
  };
  const saveShares = async (u: UnitRef) => {
    if (!line) return;
    const rows = (shares[unitKey(u)] ?? []).filter(r => r.task_id);
    if (locked) { setStaged(old => [...old.filter(c => !(c.kind === "shares" && c.boq_item_id === line.id && unitKey(c) === unitKey(u))), { kind: "shares", boq_item_id: line.id, ...u, shares: rows, label: `Item ${line.sno}: ${unitName(u)} shares` }]); toast.success("Added to the revision."); return; }
    await mutate("save_shares", { boq_item_id: line.id, ...u, shares: rows }, `${unitName(u)} shares saved.`);
  };
  const equalSplit = async () => {
    if (!line) return;
    const chosen = (data?.units ?? []).filter(u => split[unitKey(u)] !== undefined);
    if (!chosen.length) { setError("Tick the units to split across first."); return; }
    const { data: result, error: failure } = await supabase.rpc("boq2_suggest_equal_split", { p_project: projectId, p_item: line.id, p_units: chosen as never });
    if (failure) { setError(failure.message); return; }
    const next = { ...split };
    (result as unknown as (UnitRef & { quantity: number })[]).forEach(r => { next[unitKey(r)] = String(r.quantity); });
    setSplit(next); toast.success("Equal split filled in. Save to apply.");
  };
  const copyShares = async (from: UnitRef) => {
    if (!line) return;
    const targets = line.allocations.filter(a => unitKey(a) !== unitKey(from)).map(a => ({ unit_kind: a.unit_kind, unit_label: a.unit_label }));
    if (!targets.length) { setError("Split the quantity to more than one unit first."); return; }
    const { data: result, error: failure } = await supabase.rpc("boq2_suggest_copy_shares", { p_project: projectId, p_item: line.id, p_from_kind: from.unit_kind, p_from_label: from.unit_label, p_targets: targets as never });
    if (failure) { setError(failure.message); return; }
    const next = { ...shares }; const notes: string[] = [];
    (result as unknown as (UnitRef & { shares: { task_id: string; share_pct: number }[]; unmatched: { code: string; reason: string }[] })[]).forEach(r => {
      next[unitKey(r)] = r.shares.map(s => ({ task_id: s.task_id, share_pct: String(s.share_pct) }));
      r.unmatched.forEach(m => notes.push(`${unitName(r)}: ${m.code} has ${m.reason}.`));
    });
    setShares(next); setCopyNotes(notes); toast.success("Shares filled in for the other units. Save each unit to apply.");
  };
  const submitRevision = async () => {
    const changes = staged.map(c => c.kind === "split" ? { kind: "split", boq_item_id: c.boq_item_id, allocations: c.allocations } : { kind: "shares", boq_item_id: c.boq_item_id, unit_kind: c.unit_kind, unit_label: c.unit_label, shares: c.shares });
    if (await mutate("revise", { reason, changes }, "Revision saved and logged.")) { setStaged([]); setReason(""); setReviseOpen(false); }
  };
  const exportBudgets = () => {
    if (!data) return;
    const rows = data.task_budgets.map(t => ({ Unit: unitName(t), "Task code": t.code, Task: t.task_name, "BOQ lines": t.lines, "Budget (INR)": Number(t.budget) }));
    const units = data.unit_budgets.map(u => ({ Unit: unitName(u), "Budget (INR)": Number(u.budget) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Task budgets");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units), "Unit budgets");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "BOQ total (INR)": Number(data.totals.boq_total), "Linked (INR)": Number(data.totals.linked), "Unlinked (INR)": Number(data.totals.unlinked) }]), "Totals");
    XLSX.writeFile(wb, "boq-task-budgets.xlsx");
  };

  const visible = useMemo(() => filterLinkLines(data?.lines ?? [], filter), [data, filter]);

  if (!data) return <section className="min-w-0 space-y-3" aria-label="BOQ links"><h2 className="font-display text-xl font-bold">BOQ links</h2>{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><p role="alert" className="break-words text-destructive">{displayError}</p><Button className="min-h-11" onClick={() => void load()}>Retry</Button></>}</section>;

  const t = data.totals;
  return <section className="min-w-0 space-y-4 pb-3" aria-label="BOQ links">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-bold">BOQ links</h2>
        <Badge variant="outline">{locked ? "Locked" : "Draft"}</Badge>
        {!desktop ? <Badge variant="outline">Read-only on phone</Badge> : !canWrite && <Badge variant="outline">Read-only</Badge>}
      </div>
      {canWrite && !locked && <span title={data.can_lock ? "" : data.lock_reason ?? ""}><Button className="min-h-11" disabled={busy || !data.can_lock} onClick={() => void mutate("lock", {}, "Links locked.")}><LockKeyhole className="mr-2 h-4 w-4" /> Lock links</Button></span>}
      {canWrite && locked && <Button className="min-h-11" variant="outline" disabled={busy || !staged.length} onClick={() => setReviseOpen(true)}>Submit revision ({staged.length})</Button>}
    </div>
    {canWrite && !locked && !data.can_lock && data.lock_reason && <p className="break-words text-sm text-muted-foreground">Lock is available when every line is fully linked: {data.lock_reason}</p>}
    {locked && data.set.locked_at && <p className="text-sm text-muted-foreground">Locked on {boqTimestamp(data.set.locked_at)}{data.set.locked_by_name ? ` by ${data.set.locked_by_name}` : ""}. Changes need a revision with a reason.</p>}
    {data.blocked_reason && <p role="status" className="rounded-md border border-warning p-3 text-sm text-warning">{data.blocked_reason}</p>}
    {data.revision_needed && lockedNotice && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive p-3 text-sm text-destructive"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p className="min-w-0 break-words">{lockedNotice}</p></div>}
    {locked && !data.revision_needed && lockedNotice && <p className="text-sm text-muted-foreground">{lockedNotice}</p>}
    {displayError && <p role="alert" className="whitespace-pre-line break-words rounded-md border border-destructive p-3 text-sm text-destructive">{displayError}</p>}

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {[["BOQ total", boqCurrency(t.boq_total)], ["Linked value", boqCurrency(t.linked)], ["Unlinked value", boqCurrency(t.unlinked)], ["Lines fully linked", `${t.lines_complete} of ${t.lines_needed}`]].map(([label, value]) =>
        <div key={label} className="min-w-0 rounded-md bg-card p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words font-semibold">{value}</p></div>)}
    </div>

    {data.broken.length > 0 && <div className="space-y-1 rounded-md border border-destructive p-3 text-sm">
      <p className="font-semibold text-destructive">Broken links</p>
      {data.broken.map((b, i) => <p key={i} className="break-words">Item {b.sno} · {unitName(b)} · {b.code ?? "unit"}: {b.reason}</p>)}
    </div>}

    <div className="flex flex-wrap gap-2" role="tablist">
      {([["lines", "Lines"], ["budget", "Task budgets"], ["history", "History"]] as const).map(([key, label]) => <Button key={key} role="tab" aria-selected={view === key} variant={view === key ? "default" : "outline"} className="min-h-11" onClick={() => setParam("links", key)}>{label}</Button>)}
    </div>

    {view === "lines" && <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {([["all", "All"], ["needs_work", "Needs work"], ["broken", "Broken"]] as const).map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? "secondary" : "ghost"} className="min-h-11" onClick={() => setParam("linkFilter", key)}>{label}</Button>)}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Value</TableHead><TableHead className="text-right">Linked</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {visible.map(l => <TableRow key={l.id} className="cursor-pointer" onClick={() => openDetail(l)}>
              <TableCell>{l.sno}</TableCell>
              <TableCell className="min-w-48 max-w-md"><p className="break-words">{l.description}</p>{l.legacy_task_hint && <p className="text-xs text-muted-foreground">Old task reference (hint only): {l.legacy_task_hint}</p>}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{linkQty(l.qty)} {l.unit}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{boqCurrency(l.value)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{boqCurrency(l.linked)}</TableCell>
              <TableCell><Badge variant="outline" className={chipClass[l.status]}>{LINK_STATUS_LABEL[l.status]}</Badge></TableCell>
            </TableRow>)}
            {!visible.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No lines here.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>}

    {view === "budget" && <div className="space-y-3">
      <div className="flex justify-end"><Button variant="outline" className="min-h-11" onClick={exportBudgets} disabled={!data.task_budgets.length}><Download className="mr-2 h-4 w-4" /> Download budgets</Button></div>
      {data.unit_budgets.map(u => <div key={unitKey(u)} className="rounded-md border">
        <div className="flex flex-wrap justify-between gap-2 bg-card p-3 font-semibold"><span>{unitName(u)}</span><span>{boqCurrency(u.budget)}</span></div>
        <div className="overflow-x-auto"><Table><TableBody>
          {data.task_budgets.filter(tb => unitKey(tb) === unitKey(u)).map(tb => <TableRow key={tb.task_id}><TableCell className="whitespace-nowrap">{tb.code}</TableCell><TableCell className="min-w-40 break-words">{tb.task_name}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{tb.lines} line(s)</TableCell><TableCell className="whitespace-nowrap text-right">{boqCurrency(tb.budget)}</TableCell></TableRow>)}
        </TableBody></Table></div>
      </div>)}
      {!data.unit_budgets.length && <p className="text-sm text-muted-foreground">No task budgets yet. Link BOQ lines to tasks to see them.</p>}
      <p className="text-sm">Linked {boqCurrency(t.linked)} of BOQ total {boqCurrency(t.boq_total)} · difference {boqCurrency(t.unlinked)}</p>
    </div>}

    {view === "history" && <div className="space-y-2">
      {data.audit.map(a => <div key={a.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold"><History className="mr-1 inline h-4 w-4" />{LINK_ACTION_LABEL[a.action] ?? a.action}</span><span className="text-muted-foreground">{boqTimestamp(a.created_at)} · {a.actor}</span></div>{a.reason && <p className="mt-1 break-words">Reason: {a.reason}</p>}{a.boq_item_id && <p className="text-xs text-muted-foreground">Item {data.lines.find(l => l.id === a.boq_item_id)?.sno ?? "(not in current BOQ)"}</p>}</div>)}
      {!data.audit.length && <p className="text-sm text-muted-foreground">No changes yet.</p>}
    </div>}

    {locked && staged.length > 0 && <div className="space-y-1 rounded-md border border-warning p-3 text-sm"><p className="font-semibold">Revision changes waiting to be submitted</p>{staged.map((c, i) => <div key={i} className="flex items-center justify-between gap-2"><span className="break-words">{c.label}</span><Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Remove change" onClick={() => setStaged(old => old.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button></div>)}</div>}

    <Dialog open={!!line} onOpenChange={o => { if (!o) setOpenLine(null); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        {line && <>
          <DialogHeader><DialogTitle className="break-words">Item {line.sno} · {line.description}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm"><span>Quantity {linkQty(line.qty)} {line.unit}</span><span>Rate {boqCurrency(line.rate)}</span><span>Value {boqCurrency(line.value)}</span><span>Linked {boqCurrency(line.linked)}</span><Badge variant="outline" className={chipClass[line.status]}>{LINK_STATUS_LABEL[line.status]}</Badge></div>
          {line.legacy_task_hint && <p className="text-xs text-muted-foreground">Old task reference (hint only, not a link): {line.legacy_task_hint}</p>}
          {line.qty === 0 ? <p className="text-sm text-muted-foreground">This line has zero quantity and is skipped.</p> : <>
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Step 1 · Split the quantity across units</h3>{canWrite && <Button variant="outline" size="sm" className="min-h-11" onClick={() => void equalSplit()}><Split className="mr-1 h-4 w-4" /> Equal split across ticked units</Button>}</div>
              <p className="text-xs text-muted-foreground">Saved split: {linkQty(line.allocated)} of {linkQty(line.qty)} {line.unit}. The server checks that units add up exactly to the line quantity.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.units.map(u => { const k = unitKey(u); const on = split[k] !== undefined; return <div key={k} className="flex min-w-0 items-center gap-2">
                  <Checkbox id={`u-${k}`} disabled={!canWrite} checked={on} onCheckedChange={c => setSplit(old => { const n = { ...old }; if (c) n[k] = n[k] ?? ""; else delete n[k]; return n; })} />
                  <Label htmlFor={`u-${k}`} className="min-w-0 flex-1 break-words">{unitName(u)}</Label>
                  <Input className="h-11 w-28" inputMode="decimal" aria-label={`Quantity for ${unitName(u)}`} disabled={!canWrite || !on} value={split[k] ?? ""} onChange={e => setSplit(old => ({ ...old, [k]: e.target.value }))} />
                </div>; })}
              </div>
              {canWrite && <Button className="min-h-11" disabled={busy} onClick={() => void saveSplit()}><Save className="mr-1 h-4 w-4" /> {locked ? "Add split to revision" : "Save split"}</Button>}
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <h3 className="font-semibold">Step 2 · Share each unit across its tasks</h3>
              {!line.allocations.length && <p className="text-sm text-muted-foreground">Save a quantity split first.</p>}
              {line.allocations.map(a => { const k = unitKey(a); const rows = shares[k] ?? []; const q = (search[k] ?? "").toLowerCase();
                const options = data.tasks.filter(tk => unitKey(tk) === k && !rows.some(r => r.task_id === tk.id) && (`${tk.code} ${tk.task_name}`.toLowerCase().includes(q)));
                return <div key={k} className="space-y-2 border-t pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{unitName(a)} · {linkQty(a.quantity)} {line.unit}{a.unit_missing && <span className="ml-2 text-destructive">Unit no longer in the schedule</span>}</p><p className="text-xs text-muted-foreground">Saved shares total {Number(a.share_total).toFixed(2)}% (must be exactly 100.00%)</p></div>
                  {rows.map((r, i) => { const tk = data.tasks.find(x => x.id === r.task_id); const saved = line.links.find(x => x.task_id === r.task_id && unitKey(x) === k);
                    return <div key={r.task_id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 break-words text-sm">{tk ? `${tk.code} · ${tk.task_name}` : saved ? `${saved.code ?? "Task"} · ${saved.task_name ?? ""}` : "Task"}{saved?.problem && <span className="block text-destructive">Broken: {saved.problem}</span>}</span>
                      <Input className="h-11 w-24" inputMode="decimal" aria-label="Share percent" disabled={!canWrite} value={r.share_pct} onChange={e => setShares(old => ({ ...old, [k]: rows.map((x, j) => j === i ? { ...x, share_pct: e.target.value } : x) }))} /><span className="text-sm">%</span>
                      {saved && !saved.problem && <span className="w-28 text-right text-sm text-muted-foreground">{boqCurrency(saved.budget)}</span>}
                      {canWrite && <Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Remove task" onClick={() => setShares(old => ({ ...old, [k]: rows.filter((_, j) => j !== i) }))}><X className="h-4 w-4" /></Button>}
                    </div>; })}
                  {canWrite && <div className="flex flex-wrap items-center gap-2">
                    <Input className="h-11 w-56" placeholder="Search tasks in this unit" value={search[k] ?? ""} onChange={e => setSearch(old => ({ ...old, [k]: e.target.value }))} />
                    <select aria-label={`Add task to ${unitName(a)}`} className="h-11 min-w-0 max-w-full rounded-md border bg-background px-2 text-sm" value="" onChange={e => { if (e.target.value) setShares(old => ({ ...old, [k]: [...rows, { task_id: e.target.value, share_pct: "" }] })); }}>
                      <option value="">Add a task ({options.length})</option>
                      {options.slice(0, 200).map(tk => <option key={tk.id} value={tk.id}>{tk.code} · {tk.task_name}</option>)}
                    </select>
                  </div>}
                  {canWrite && <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="min-h-11" disabled={busy} onClick={() => void saveShares(a)}><Save className="mr-1 h-4 w-4" /> {locked ? "Add shares to revision" : "Save shares"}</Button>
                    {line.allocations.length > 1 && <Button size="sm" variant="outline" className="min-h-11" disabled={busy || !line.links.some(x => unitKey(x) === k)} onClick={() => void copyShares(a)}><Copy className="mr-1 h-4 w-4" /> Apply the same shares to other units</Button>}
                  </div>}
                </div>; })}
              {copyNotes.length > 0 && <div className="rounded-md border border-warning p-2 text-xs text-warning">{copyNotes.map((n, i) => <p key={i}>{n}</p>)}</div>}
            </div>
          </>}
          {displayError && <p role="alert" className="break-words text-sm text-destructive">{displayError}</p>}
        </>}
      </DialogContent>
    </Dialog>

    <Dialog open={reviseOpen} onOpenChange={setReviseOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit revision</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">{staged.map((c, i) => <p key={i}><Link2 className="mr-1 inline h-4 w-4" />{c.label}</p>)}</div>
        <Label htmlFor="boq-link-reason">Reason (required)</Label>
        <Textarea id="boq-link-reason" value={reason} onChange={e => setReason(e.target.value)} />
        <p className="text-xs text-muted-foreground">The revision is saved only if every line stays fully split and shared.</p>
        <DialogFooter><Button variant="outline" className="min-h-11" onClick={() => setReviseOpen(false)}>Cancel</Button><Button className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={() => void submitRevision()}><Plus className="mr-1 h-4 w-4" /> Save revision</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
