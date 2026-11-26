import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ClipboardPaste, Save, LockKeyhole, Pencil, Archive, Download, Loader2, Check, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "@/lib/safe-xlsx";
import { useUserRole } from "@/hooks/useUserRole";
import { canShowBoqEntry } from "@/lib/boq-writers";
import { BOQ_ENTRY_FIELDS, BOQ_ENTRY_LABELS, emptyBoqRow, entryFromLine, parseBoqPaste, mapBoqPaste, boqCurrency, boqTimestamp, type BoqEntryRow, type BoqState, type BoqPreview, type BoqWarning, type EntryField } from "@/lib/boq-entry";

export function BoqEntry({ projectId }: { projectId: string }) {
  const { role, isImpersonating } = useUserRole();
  const [data, setData] = useState<BoqState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  const [total, setTotal] = useState("");
  const [source, setSource] = useState("");
  const [editor, setEditor] = useState<BoqEntryRow | null>(null);
  const [revision, setRevision] = useState(false);
  const [staged, setStaged] = useState<BoqEntryRow[]>([]);
  const [reason, setReason] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(false);
  const [mapping, setMapping] = useState(BOQ_ENTRY_FIELDS.map((_, i) => i));
  const [preview, setPreview] = useState<BoqPreview[]>([]);
  const [pasteRows, setPasteRows] = useState<BoqEntryRow[]>([]);
  const [pasteIssues, setPasteIssues] = useState<string[]>([]);
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({});
  const [confirmFinal, setConfirmFinal] = useState(false);

  useEffect(() => {
    setRevision(false); setStaged([]); setEditor(null); setPasteOpen(false); setConfirmFinal(false);
  }, [role, isImpersonating]);

  const applyState = (state: BoqState) => {
    setData(state);
    setTotal(state.header?.control_total == null ? "" : String(state.header.control_total));
    setSource(state.header?.source_note ?? "");
  };
  const load = useCallback(async () => {
    setBusy(true); setError("");
    const { data: result, error: failure } = await supabase.rpc("boq1_get", { p_project: projectId });
    if (failure) setError(failure.message); else applyState(result as unknown as BoqState);
    setBusy(false);
  }, [projectId]);
  useEffect(() => { setData(null); setEditor(null); setRevision(false); setStaged([]); void load(); }, [load]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  const mutate = async (action: string, payload: Record<string, unknown>): Promise<BoqState | null> => {
    setBusy(true); setError("");
    try {
      const { data: result, error: failure } = await supabase.rpc("boq1_mutate", { p_project: projectId, p_action: action, p_payload: payload as never, p_expected_version: data?.header?.entry_version });
      if (failure) throw failure;
      const state = result as unknown as BoqState;
      applyState(state);
      const failures = state.save_results?.filter(r => r.errors.length) ?? [];
      if (failures.length) { setError(failures.map(r => `Row ${r.row}: ${r.errors.join(" ")}`).join("\n")); toast.error(`${failures.length} rows were not saved.`); }
      else toast.success(action === "finalise" ? "BOQ finalised and locked." : action === "revise" ? "Balanced revision saved and logged." : action === "acknowledge" ? "Warning acknowledged." : "BOQ saved.");
      return state;
    } catch (failure: unknown) {
      const message = failure && typeof failure === "object" && "message" in failure ? String(failure.message) : "The BOQ could not be saved.";
      setError(message); toast.error(message); return null;
    } finally { setBusy(false); }
  };
  const canWrite = desktop && canShowBoqEntry(data?.can_write ?? false, role, isImpersonating) && (!data?.header || data.header.entry_mode === "fresh");
  const editing = canWrite && (data?.header?.status !== "final" || revision);
  const stage = (rows: BoqEntryRow[]) => setStaged(old => [...old.filter(r => !rows.some(next => next.id && next.id === r.id)), ...rows]);
  const saveRow = async () => {
    if (!editor) return;
    if (revision) { stage([editor]); setEditor(null); return; }
    const result = await mutate("save", { rows: [editor] });
    if (result && !result.save_results?.some(r => r.errors.length)) setEditor(null);
  };
  const validatePaste = async (chosenMapping = mapping, includesHeader = hasHeader) => {
    setBusy(true); setError("");
    try {
      const parsed = parseBoqPaste(paste); setGrid(parsed);
      const mapped = mapBoqPaste(parsed, chosenMapping, includesHeader); setPasteRows(mapped.rows); setPasteIssues(mapped.issues);
      const { data: result, error: failure } = await supabase.rpc("boq1_mutate", { p_project: projectId, p_action: "preview", p_payload: { rows: mapped.rows } as never, p_expected_version: data?.header?.entry_version });
      if (failure) throw failure;
      setPreview((result as unknown as { rows: BoqPreview[] }).rows.map(row => ({ ...row, errors: [...row.errors, ...mapped.issues.filter(issue => issue.startsWith(`Row ${row.row + (includesHeader ? 1 : 0)}:`))] })));
    } catch (failure: unknown) { setPasteIssues([failure && typeof failure === "object" && "message" in failure ? String(failure.message) : "Paste could not be read."]); setPreview([]); }
    finally { setBusy(false); }
  };
  const savePaste = async () => {
    const validRows = pasteRows.filter((_, i) => !preview[i]?.errors.length);
    if (!validRows.length) return;
    if (revision) { stage(validRows); setPasteOpen(false); return; }
    const state = await mutate("save", { rows: validRows });
    if (state && !state.save_results?.some(r => r.errors.length)) {
      const skipped = preview.filter(r => r.errors.length).length;
      toast.success(`${validRows.length} rows saved${skipped ? `; ${skipped} rows skipped. Correct them before retrying.` : "."}`);
      if (skipped) { setPasteRows(pasteRows.filter((_, i) => preview[i]?.errors.length)); setPreview(preview.filter(r => r.errors.length)); }
      else { setPasteOpen(false); setPaste(""); setPreview([]); }
    }
  };
  const dropdown = (field: EntryField, options: string[], value: string, update: (value: string) => void) => (
    <Select value={value || "__empty__"} onValueChange={v => update(v === "__empty__" ? "" : v)}>
      <SelectTrigger className="h-11 min-w-0 text-xs" aria-label={BOQ_ENTRY_LABELS[BOQ_ENTRY_FIELDS.indexOf(field)]}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="__empty__">Select…</SelectItem>{[...new Set([...options, ...(value ? [value] : [])])].filter(Boolean).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
    </Select>
  );
  const fieldEditor = (field: EntryField) => {
    if (!editor) return null;
    const update = (value: string) => setEditor(old => old ? { ...old, [field]: value } : old);
    if (field === "unit") return dropdown(field, data?.units ?? [], editor[field], update);
    if (field === "category") return dropdown(field, data?.categories ?? [], editor[field], update);
    if (field === "scope") return dropdown(field, data?.scopes ?? [], editor[field], update);
    if (field === "work_location") return dropdown(field, ["factory", "site"], editor[field], update);
    return <Input className="h-11 min-w-0 text-xs" aria-label={BOQ_ENTRY_LABELS[BOQ_ENTRY_FIELDS.indexOf(field)]} value={editor[field]} onChange={e => update(e.target.value)} inputMode={["sno", "boq_qty", "boq_rate"].includes(field) ? "decimal" : "text"} />;
  };
  const warningView = (lineId: string, w: BoqWarning) => <div key={w.key ?? w.kind} className="flex min-w-0 flex-wrap items-start gap-2 border-t border-border py-2 text-xs text-warning">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="min-w-0 flex-1 break-words"><p>{w.message}</p>{w.kind === "outlier" && <p>Median {boqCurrency(w.median_rate)} · {w.project_count} projects</p>}</div>
    {w.acknowledged ? <span className="flex items-center gap-1 text-primary"><Check className="h-4 w-4" /> Acknowledged</span> : canWrite && <div className="flex max-w-full flex-wrap gap-2">
      <Input className="h-11 w-40 text-xs" aria-label={`Note for ${w.kind} warning on ${lineId}`} placeholder="Optional note" value={ackNotes[lineId + w.key] ?? ""} onChange={e => setAckNotes(old => ({ ...old, [lineId + w.key]: e.target.value }))} />
      <Button variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => void mutate("acknowledge", { line_id: lineId, warning_key: w.key, note: ackNotes[lineId + w.key] ?? "" })}><Check className="mr-1 h-4 w-4" /> Acknowledge</Button>
    </div>}
  </div>;
  const exportBoq = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([ [...BOQ_ENTRY_LABELS, "Amount (INR)"], ...data.lines.map(line => [...BOQ_ENTRY_FIELDS.map(field => line[field]), line.total_amount]) ]), "BOQ");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Control total (INR)", "Source note", "Status", "Sum (INR)", "Difference (INR)"], [data.header?.control_total, data.header?.source_note, data.header?.status, data.sum, data.difference]]), "Control");
    XLSX.writeFile(wb, "Project_BOQ.xlsx");
  };

  if (!data) return <section className="min-w-0 space-y-4" aria-label="BOQ"><h2 className="font-display text-xl font-bold">BOQ</h2>{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <><p role="alert" className="break-words text-destructive">{error}</p><Button onClick={() => void load()}>Retry</Button></>}</section>;
  return <section className="min-w-0 space-y-5 pb-3" aria-label="BOQ entry">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-bold">BOQ</h2><Badge variant="outline">{data.header?.status === "final" ? "Final · locked" : data.header?.entry_mode === "legacy" ? "Existing BOQ · read-only" : "Draft"}</Badge>{!desktop ? <Badge variant="outline">Read-only on phone</Badge> : !canShowBoqEntry(data.can_write, role, isImpersonating) && <Badge variant="outline">Read-only</Badge>}</div>
      <Button variant="outline" className="min-h-11" onClick={exportBoq} disabled={!data.header}><Download className="mr-2 h-4 w-4" /> Download BOQ</Button>
    </div>
    {error && <p role="alert" className="whitespace-pre-line break-words rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
    {data.header?.entry_mode === "legacy" && <p className="text-sm text-muted-foreground">Existing BOQ lines are unchanged. Fresh entry is available on projects without a BOQ.</p>}
    {!desktop && <p className="text-sm text-muted-foreground">BOQ entry and revisions are available on a desktop.</p>}
    <section className="space-y-3 border-b border-border pb-5">
      <h3 className="font-display font-semibold">1. Signed-document control total</h3>
      <div className="grid min-w-0 gap-4 md:grid-cols-[220px_1fr_auto]">
        <div className="space-y-2"><Label htmlFor="boq-control">Control total (₹)</Label>{editing ? <Input id="boq-control" className="h-11" inputMode="decimal" value={total} onChange={e => setTotal(e.target.value)} /> : <p className="break-words font-mono text-sm">{boqCurrency(data.header?.control_total)}</p>}</div>
        <div className="min-w-0 space-y-2"><Label htmlFor="boq-source">Contract No. / date / document name</Label>{editing ? <Input id="boq-source" className="h-11" value={source} onChange={e => setSource(e.target.value)} /> : <p className="break-words text-sm">{data.header?.source_note || "—"}</p>}</div>
        {editing && !revision && <Button className="mt-auto min-h-11" disabled={busy || !total.trim() || !source.trim()} onClick={() => void mutate(data.header ? "save" : "create", { control_total: total, source_note: source })}><Save className="mr-2 h-4 w-4" /> Save control total</Button>}
      </div>
      {data.header?.final_at && <p className="text-xs text-muted-foreground">Finalised on {boqTimestamp(data.header.final_at)}</p>}
    </section>
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display font-semibold">2. BOQ lines</h3><div className="flex flex-wrap gap-2">
        {editing && data.header && <><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setEditor(emptyBoqRow())}><Plus className="mr-1 h-4 w-4" /> Add row</Button><Button variant="outline" className="min-h-11" onClick={() => { setPasteOpen(true); setPreview([]); }}><ClipboardPaste className="mr-1 h-4 w-4" /> Paste rows</Button></>}
        {canWrite && data.header?.status === "final" && !revision && <Button variant="outline" className="min-h-11" onClick={() => { setRevision(true); setReason(""); setStaged([]); }}><Pencil className="mr-1 h-4 w-4" /> Make revision</Button>}
      </div></div>
      {revision && <div className="space-y-3 border-y border-border py-4"><Label htmlFor="boq-reason">Revision reason (required)</Label><Input id="boq-reason" value={reason} onChange={e => setReason(e.target.value)} /><p className="text-sm text-muted-foreground">Reported quantities and frozen rates are protected. Used lines cannot be removed or changed below reported quantities.</p><p className="text-sm text-muted-foreground">{staged.length} line changes pending</p><div className="flex flex-wrap gap-2"><Button disabled={busy || !reason.trim()} onClick={async () => { const state = await mutate("revise", { rows: staged, control_total: total, source_note: source, reason }); if (state) { setRevision(false); setStaged([]); setEditor(null); } }}><Save className="mr-1 h-4 w-4" /> Save balanced revision</Button><Button variant="ghost" onClick={() => { setRevision(false); setStaged([]); setEditor(null); applyState(data); }}><X className="mr-1 h-4 w-4" /> Cancel</Button></div>{staged.map((row, i) => <p key={row.id ?? i} className="break-words text-xs">{row.remove ? "Remove" : "Change"} item {row.sno}: {row.item_description}</p>)}</div>}
      {desktop ? <div className="max-h-[55vh] max-w-full overflow-auto rounded-md border border-border" onPaste={e => { if (editing && e.clipboardData.getData("text").includes("\t")) { e.preventDefault(); setPaste(e.clipboardData.getData("text")); setPasteOpen(true); setPreview([]); } }}>
        <Table className="min-w-[980px] table-fixed text-xs"><TableHeader className="sticky top-0 z-10 bg-card"><TableRow><TableHead className="w-16">Item</TableHead><TableHead className="w-52">Description</TableHead><TableHead className="w-20">Unit</TableHead><TableHead className="w-24 text-right">Quantity</TableHead><TableHead className="w-28 text-right">Rate (₹)</TableHead><TableHead className="w-32 text-right">Amount (₹)</TableHead><TableHead className="w-28">Category</TableHead><TableHead className="w-28">Scope</TableHead><TableHead className="w-24">Location</TableHead><TableHead className="w-28">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{data.lines.map(line => <TableRow key={line.id}><TableCell className="align-top">{line.sno}</TableCell><TableCell className="whitespace-normal break-words align-top"><p className="font-medium">{line.item_description}</p>{line.warnings.map(w => warningView(line.id, w))}</TableCell><TableCell className="break-words align-top">{line.unit}</TableCell><TableCell className="text-right align-top">{line.boq_qty}</TableCell><TableCell className="text-right align-top">{boqCurrency(line.boq_rate)}</TableCell><TableCell className="text-right align-top font-medium">{boqCurrency(line.total_amount)}</TableCell><TableCell className="break-words align-top">{line.category}</TableCell><TableCell className="break-words align-top">{line.scope}</TableCell><TableCell className="align-top">{line.work_location}</TableCell><TableCell className="align-top">{editing && <div className="flex"><Button variant="ghost" size="icon" className="h-11 w-11" title="Edit line" aria-label={`Edit item ${line.sno}`} onClick={() => setEditor(entryFromLine(line))}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-11 w-11" title="Archive line" aria-label={`Archive item ${line.sno}`} onClick={() => { const row = { ...entryFromLine(line), remove: true }; if (revision) stage([row]); else void mutate("save", { rows: [row] }); }}><Archive className="h-4 w-4" /></Button></div>}</TableCell></TableRow>)}
            {editor && <TableRow>{BOQ_ENTRY_FIELDS.slice(0, 5).map(field => <TableCell key={field} className="px-1">{fieldEditor(field)}</TableCell>)}<TableCell className="text-right text-muted-foreground">On save</TableCell>{BOQ_ENTRY_FIELDS.slice(5).map(field => <TableCell key={field} className="px-1">{fieldEditor(field)}</TableCell>)}<TableCell><div className="flex"><Button size="icon" className="h-11 w-11" aria-label="Save line" disabled={busy} onClick={() => void saveRow()}><Save className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="h-11 w-11" aria-label="Cancel line" onClick={() => setEditor(null)}><X className="h-4 w-4" /></Button></div></TableCell></TableRow>}
          </TableBody></Table>
      </div> : <div className="min-w-0 divide-y divide-border">{data.lines.map(line => <article key={line.id} className="min-w-0 space-y-2 py-4"><h4 className="break-words text-sm font-semibold">{line.sno}. {line.item_description}</h4><p className="break-words text-xs text-muted-foreground">{line.category} · {line.scope} · {line.work_location}</p><p className="break-words text-sm">{line.boq_qty} {line.unit} · {boqCurrency(line.boq_rate)}</p><p className="break-words font-mono text-sm font-medium">{boqCurrency(line.total_amount)}</p>{line.warnings.map(w => warningView(line.id,w))}</article>)}</div>}
      {!data.lines.length && <p className="py-8 text-sm text-muted-foreground">No BOQ lines entered.</p>}
    </section>
    <div className="sticky bottom-20 z-20 grid min-w-0 grid-cols-2 gap-3 border-y border-border bg-background px-3 py-4 shadow-sm md:bottom-0 md:grid-cols-[1fr_1fr_1fr_auto_auto]" aria-label="BOQ control bar">
      <div><p className="text-xs text-muted-foreground">Control total</p><p className="break-words font-mono text-sm font-semibold">{boqCurrency(data.header?.control_total)}</p></div><div><p className="text-xs text-muted-foreground">Sum of lines</p><p className="break-words font-mono text-sm font-semibold">{boqCurrency(data.sum)}</p></div><div><p className="text-xs text-muted-foreground">Difference</p><p className={`break-words font-mono text-sm font-semibold ${data.difference != null && Number(data.difference) !== 0 ? "text-destructive" : "text-primary"}`}>{boqCurrency(data.difference)}</p></div><div><p className="text-xs text-muted-foreground">Lines</p><p className="text-sm font-semibold">{data.line_count}</p></div>
      {canWrite && data.header?.status === "draft" && <Button className="col-span-2 min-h-11 md:col-span-1" disabled={busy || !data.can_finalise || !!editor} onClick={() => setConfirmFinal(true)}><LockKeyhole className="mr-2 h-4 w-4" /> Finalise BOQ</Button>}
    </div>
    {data.audit.length>0 && <details className="border-t border-border py-3"><summary className="cursor-pointer font-medium">BOQ history</summary><div className="space-y-3 pt-3">{data.audit.map(a => <p key={a.id} className="break-words text-xs">{a.action.replaceAll("_"," ")} · {boqTimestamp(a.created_at)}{a.reason ? ` · ${a.reason}` : ""}</p>)}</div></details>}
    <Dialog open={confirmFinal && desktop} onOpenChange={setConfirmFinal}><DialogContent><DialogHeader><DialogTitle>Finalise this BOQ?</DialogTitle></DialogHeader><p className="text-sm">The control total and {data.line_count} lines will be locked. Later changes require a balanced revision and a reason. Unacknowledged warnings do not prevent finalisation.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmFinal(false)}>Cancel</Button><Button disabled={busy} onClick={async () => { if (await mutate("finalise", {})) setConfirmFinal(false); }}><LockKeyhole className="mr-2 h-4 w-4" /> Finalise and lock</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={pasteOpen && desktop} onOpenChange={setPasteOpen}><DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Paste client BOQ rows</DialogTitle></DialogHeader><Label htmlFor="boq-paste">Item no · Description · Unit · Quantity · Rate · Category · Scope · Work location</Label><Textarea id="boq-paste" className="min-h-32 font-mono text-xs" value={paste} onChange={e => { setPaste(e.target.value); setPreview([]); setGrid([]); }} /><div className="flex items-center gap-2"><Checkbox id="boq-heading" checked={hasHeader} onCheckedChange={value => { setHasHeader(value === true); setPreview([]); if (grid.length) void validatePaste(mapping, value === true); }} /><Label htmlFor="boq-heading">First row contains headings</Label></div>
      {grid.length>0 && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{BOQ_ENTRY_FIELDS.map((field,i) => <div key={field}><Label>{BOQ_ENTRY_LABELS[i]}</Label><Select value={String(mapping[i])} onValueChange={v => { const next = mapping.map((n,j) => j === i ? Number(v) : n); setMapping(next); setPreview([]); void validatePaste(next, hasHeader); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{grid[0].map((cell,j) => <SelectItem key={j} value={String(j)}>{j+1}. {hasHeader ? cell : `Column ${j+1}`}</SelectItem>)}</SelectContent></Select></div>)}</div>}
      <Button variant="outline" disabled={busy || !paste.trim()} onClick={() => void validatePaste()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Review rows</Button>
      {pasteIssues.map((issue,i) => <p key={i} role="alert" className="text-sm text-destructive">{issue}</p>)}
      {preview.length>0 && <><p className="text-sm font-medium">{preview.length} rows · {preview.filter(r => !r.errors.length).length} valid · {preview.filter(r => r.errors.length).length} with errors</p><div className="max-h-72 divide-y divide-border overflow-y-auto">{preview.map((row,i) => <div key={i} className="space-y-1 py-3 text-xs"><p className="font-medium">Row {row.row + (hasHeader ? 1 : 0)} · {pasteRows[i]?.item_description}</p><p>Amount {boqCurrency(Number((row.values as unknown as {total_amount?: number})?.total_amount))}</p>{row.errors.map((message,j) => <p key={j} className="text-destructive">{message}</p>)}{row.warnings.map((w,j) => <p key={j} className="text-warning">{w.message}{w.kind === "outlier" ? ` Median ${boqCurrency(w.median_rate)} · ${w.project_count} projects.` : ""}</p>)}</div>)}</div></>}
      <DialogFooter><Button variant="outline" onClick={() => setPasteOpen(false)}>Cancel</Button><Button disabled={busy || !preview.length || !preview.some(r => !r.errors.length)} onClick={() => void savePaste()}><Save className="mr-2 h-4 w-4" />{revision ? "Stage valid rows" : "Save reviewed valid rows"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}