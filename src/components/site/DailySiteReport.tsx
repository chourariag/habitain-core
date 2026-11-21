import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Camera, ImageIcon, Loader2, RotateCw, CheckCircle2, AlertTriangle, Plus, Split, ChevronDown, ChevronRight, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import {
  NO_ELEVATIONS_MSG, FLAG_LABEL, PHOTO_LABEL, allowedReportDates, exceedsBoq, parsePct, submitBlockers,
} from "@/lib/site-report-rules";
import { compressPhoto, readPhotoMeta, type PhotoMeta } from "@/lib/site-report-photo";
import { siteReportErrorMessage } from "@/lib/site-report-errors";
import {
  type QtyRow, type SubRate, findRate, rowAmount, rowProblem, quantityPayload, contractorsMissingHeadcount,
} from "@/lib/site-report-subcontract";

import { TaskWorkerChips } from "@/components/site/TaskWorkerChips";
import { allocatedHours, calculatedProgress, isTodaysTask, workerAllocationProblems, type PresentWorker, type TaskWorker } from "@/lib/site-report-task-workers";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Expense = { id: string; kind: "consumable" | "expense"; description: string; amount_inr: string };
type Task = { id: string; code: string; name: string; pct: number; planned_start: string; planned_finish?: string | null; previous_report?: boolean; in_report?: boolean; actual_start: string | null };
type Boq = { id: string; task_id: string; description: string; unit: string | null; boq_qty: number; cumulative: number; progress_weight: number };
type Photo = { id: string; kind: string; elevation_id?: string | null; storage_path: string; flags: string[]; gps_source: string };
type Data = {
  can_write: boolean; today: string;
  report: null | { id: string; status: string | null; notes: string | null; site_clean: boolean; site_clean_photo_path: string | null; submitted_by: string | null; submitted_at: string | null };
  tasks: Task[]; boq: Boq[];
  progress: { task_id: string; pct: number | null; remarks: string | null; task_status?: "ongoing" | "completed" }[];
  labour: { task_id: string; hours: number }[];
  quantities: { id: string; boq_item_id: string | null; contractor_id: string | null; extra_work_description: string | null; unit: string | null; today_qty: number; remarks: string | null; amount_inr: number | null }[];
  rates?: SubRate[];
  contractors?: { id: string; name: string }[];
  headcount?: { contractor_id: string; headcount: number }[];
  can_see_rates?: boolean;
  photos: Photo[];
  elevations: { id: string; name: string; drawing_ref: string | null }[];
  can_manage_elevations: boolean;
  attendance: { workers: number; hours: number };
  present_workers?: PresentWorker[]; task_workers?: TaskWorker[]; task_worker_task_ids?: string[]; expenses?: {id:string; kind:"consumable"|"expense"; description:string; amount_inr:number}[]; unconfirmed_workers?: number;
};
type Pending = { file: Blob; meta: PhotoMeta; gallery: boolean; error?: string; busy?: boolean };

const istToday = () => format(new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000), "yyyy-MM-dd");
const ddmmyyyy = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const slotKey = (p: { kind: string; elevation_id?: string | null }) => p.kind === "elevation" && p.elevation_id ? `elevation:${p.elevation_id}` : p.kind;
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export function DailySiteReport({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(istToday());
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [taskWorkers, setTaskWorkers] = useState<TaskWorker[]>([]);
  const [workerTaskIds, setWorkerTaskIds] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<Record<string, "ongoing" | "completed">>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [addedTasks, setAddedTasks] = useState<string[]>([]);
  const [showOtherTasks, setShowOtherTasks] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [qrows, setQrows] = useState<QtyRow[]>([]);
  const [headcount, setHeadcount] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [siteClean, setSiteClean] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hoursBlock, setHoursBlock] = useState<string | null>(null);
  const [summary, setSummary] = useState<null | { tasks_updated: number; tasks_skipped?: { code: string }[]; quantity_lines: number; photos: number }>(null);
  const reportId = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: d, error } = await rpc("get_site_report", { p_project_id: projectId, p_date: date });
    setLoading(false);
    if (error) { console.error(error); toast.error("Could not load the report. Please try again."); return; }
    const v = d as Data;
    setData(v);
    reportId.current = v.report?.id ?? null;
    setNotes(v.report?.notes ?? "");
    setSiteClean(!!v.report?.site_clean);
    setPct(Object.fromEntries(v.progress.filter((p) => p.pct != null).map((p) => [p.task_id, String(p.pct)])));
    setTaskWorkers((v.task_workers ?? []).map(r => ({...r,hours:Number(r.hours)})));
    setWorkerTaskIds(v.task_worker_task_ids ?? []);
    setTaskStatus(Object.fromEntries(v.progress.map(p => [p.task_id,p.task_status ?? "ongoing"])));
    setRemarks(Object.fromEntries(v.progress.map(p => [p.task_id,p.remarks ?? ""])));
    setExpenses((v.expenses ?? []).map(e => ({...e,amount_inr:String(e.amount_inr)})));
    setOpenTask(null); setAddedTasks([]);
    setQrows(v.quantities.filter((q) => Number(q.today_qty) > 0 || q.contractor_id || !q.boq_item_id).map((q) => ({
      key: q.id, boq_item_id: q.boq_item_id, contractor_id: q.contractor_id, extra_work_description: q.extra_work_description ?? "",
      unit: q.unit ?? "", today_qty: Number(q.today_qty) > 0 ? String(q.today_qty) : "",
    })));
    setHeadcount(Object.fromEntries((v.headcount ?? []).map((h) => [h.contractor_id, String(h.headcount)])));
    setSummary(null);
  }, [projectId, date]);

  useEffect(() => { load(); }, [load]);

  // signed thumbnails
  useEffect(() => {
    if (!data?.photos.length) { setThumbs({}); return; }
    (async () => {
      const out: Record<string, string> = {};
      for (const p of data.photos) {
        const { data: s } = await supabase.storage.from("site-report-photos").createSignedUrl(p.storage_path, 3600);
        if (s?.signedUrl) out[slotKey(p)] = s.signedUrl;
      }
      setThumbs(out);
    })();
  }, [data?.photos]);

  const today = data?.today ?? istToday();
  const dates = allowedReportDates(today);
  const submitted = data?.report?.status === "submitted";
  const canEdit = !!data?.can_write;

  const workedTaskIds = useMemo(() => [...new Set([
    ...Object.entries(pct).filter(([,v]) => parsePct(v) != null).map(([id]) => id),
    ...Object.keys(taskStatus), ...taskWorkers.map(r => r.task_id),
    ...qrows.filter(r => Number(r.today_qty)>0).map(r => data?.boq.find(b => b.id === r.boq_item_id)?.task_id).filter((id): id is string => !!id),
  ])], [pct,taskStatus,taskWorkers,qrows,data?.boq]);

  const taskPct = useCallback((id: string) => calculatedProgress((data?.boq ?? []).filter(b => b.task_id === id).map(b => ({cumulative:Number(b.cumulative),today:qrows.filter(r => r.boq_item_id === b.id).reduce((n,r) => n+(Number(r.today_qty)||0),0),progress_weight:Number(b.progress_weight)})),parsePct(pct[id] ?? ""),taskStatus[id] === "completed"),[data?.boq,qrows,pct,taskStatus]);
  const buildPayload = useCallback(() => ({
    notes, site_clean: siteClean,
    progress: workedTaskIds.map(task_id => ({ task_id, pct: taskPct(task_id), task_status:taskStatus[task_id] ?? "ongoing", remarks:remarks[task_id] ?? "" })),
    task_workers:taskWorkers,
    task_worker_task_ids:[...new Set([...workerTaskIds,...taskWorkers.map(r => r.task_id)])],
    quantities: quantityPayload(qrows, data?.rates ?? []),
    expenses:expenses.filter(e => e.description.trim()).map(e => ({...e,amount_inr:Number(e.amount_inr)})),
    headcount: Object.entries(headcount).filter(([, v]) => v.trim() !== "").map(([contractor_id, v]) => ({ contractor_id, headcount: Math.min(Math.max(Math.round(Number(v) || 0), 0), 500) })),
  }), [notes,siteClean,workedTaskIds,taskPct,taskStatus,remarks,taskWorkers,workerTaskIds,qrows,expenses,headcount,data?.rates]);

  const saveNow = useCallback(async () => {
    if (!canEdit) return null;
    if (workerAllocationProblems(data?.present_workers ?? [],taskWorkers).length) { setSaveState("error"); return null; }
    if (expenses.some(e => !e.description.trim() || !e.amount_inr.trim() || !Number.isFinite(Number(e.amount_inr)) || Number(e.amount_inr)<0)) { setSaveState("error"); return null; }
    setSaveState("saving");
    const { data: id, error } = await rpc("save_site_report_draft", { p_project_id: projectId, p_date: date, p_payload: buildPayload() });
    if (error) { setSaveState("error"); console.error("save_site_report_draft failed:", error); toast.error(siteReportErrorMessage(error)); return null; }
    reportId.current = id as string; dirty.current = false; setSaveState("saved");
    return id as string;
  }, [canEdit, projectId, date, buildPayload, data?.present_workers, taskWorkers, expenses]);

  // autosave on every change (debounced)
  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveNow(); }, 900);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [pct, taskWorkers, taskStatus, remarks, expenses, qrows, headcount, notes, siteClean, saveNow]);
  const touch = () => { dirty.current = true; };

  const uploadPending = async (kind: string, p: Pending) => {
    setPending((s) => ({ ...s, [kind]: { ...p, busy: true, error: undefined } }));
    try {
      const id = reportId.current ?? (await saveNow());
      if (!id) throw new Error("Could not save the draft");
      const elevId = kind.startsWith("elevation:") ? kind.slice(10) : null;
      const path = elevId ? `${projectId}/${id}/elevation-${elevId}-${Date.now()}.jpg` : `${projectId}/${id}/${kind}-${Date.now()}.jpg`;
      const up = await supabase.storage.from("site-report-photos").upload(path, p.file, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const meta = { p_storage_path: path, p_exif_taken_at: p.meta.takenAt, p_gps_lat: p.meta.lat, p_gps_lng: p.meta.lng, p_gps_source: p.meta.source, p_from_gallery: p.gallery };
      const { error } = elevId
        ? await rpc("add_site_report_elevation_photo", { p_report_id: id, p_elevation_id: elevId, ...meta })
        : await rpc("add_site_report_photo", { p_report_id: id, p_kind: kind, ...meta });
      if (error) throw error;
      setPending((s) => { const n = { ...s }; delete n[kind]; return n; });
      const { data: d } = await rpc("get_site_report", { p_project_id: projectId, p_date: date });
      if (d) setData((prev) => prev ? { ...prev, photos: (d as Data).photos, report: (d as Data).report } : (d as Data));
    } catch (e: any) {
      console.error("site report photo upload failed:", e);
      setPending((s) => ({ ...s, [kind]: { ...p, busy: false, error: "Upload failed. Please retry." } }));
    }
  };

  const onPick = async (kind: string, file: File | undefined, gallery: boolean) => {
    if (!file) return;
    setPending((s) => ({ ...s, [kind]: { file, meta: { takenAt: null, lat: null, lng: null, source: "none" }, gallery, busy: true } }));
    const meta = await readPhotoMeta(file); // EXIF read BEFORE compression
    let blob: Blob;
    try { blob = await compressPhoto(file); } catch { blob = file; }
    await uploadPending(kind, { file: blob, meta, gallery });
  };

  const submit = async () => {
    setSubmitting(true);
    const id = await saveNow();
    if (!id) { setSubmitting(false); return; }
    const { data: res, error } = await rpc("submit_site_report", { p_report_id: id });
    setSubmitting(false);
    if (error) {
      console.error("submit_site_report failed:", error);
      const msg = siteReportErrorMessage(error);
      if (msg.startsWith("Confirm hours for ")) { setHoursBlock(msg); const fresh = await rpc("get_site_report", {p_project_id:projectId,p_date:date}); if (fresh.data) setData(prev => prev ? {...prev,unconfirmed_workers:(fresh.data as Data).unconfirmed_workers} : prev); toast.error(msg); return; }
      toast.error(msg); return;
    }
    setHoursBlock(null);
    await load();
    setSummary(res);
    toast.success("Daily report submitted");
  };

  if (loading && !data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const photoByKind = Object.fromEntries(data.photos.map((p) => [slotKey(p), p]));
  const elevations = data.elevations ?? [];
  const workers = data.present_workers ?? [];
  const allocationProblems = workerAllocationProblems(workers,taskWorkers);
  const todayTasks = data.tasks.filter(t => isTodaysTask(t,date) || workedTaskIds.includes(t.id) || addedTasks.includes(t.id));
  const tasks = todayTasks.filter(t => !taskSearch || `${t.code} ${t.name}`.toLowerCase().includes(taskSearch.toLowerCase()));
  const otherTasks = data.tasks.filter(t => Number(t.pct)<100 && !todayTasks.some(x => x.id===t.id) && (!taskSearch || `${t.code} ${t.name}`.toLowerCase().includes(taskSearch.toLowerCase())));
  const taskProblems = workedTaskIds.filter(id => {const lines=data.boq.filter(b => b.task_id===id);return !lines.some(b => Number(b.progress_weight)>0) && taskPct(id)==null && taskStatus[id]!=="completed" && !taskWorkers.some(r => r.task_id===id) && !qrows.some(r => lines.some(b => b.id===r.boq_item_id) && Number(r.today_qty)>0);});
  const blockers = submitBlockers({tasksWithProgress:workedTaskIds.length-taskProblems.length,notes,unconfirmedWorkers:Number(data.unconfirmed_workers ?? 0)});
  blockers.push(...allocationProblems);
  if (expenses.some(e => !e.description.trim() || !e.amount_inr.trim() || !Number.isFinite(Number(e.amount_inr)) || Number(e.amount_inr)<0)) blockers.push("Enter a description and a non-negative amount for each expense.");
  if ((data.rates ?? []).length || (data.contractors ?? []).length) {
    for (const p of new Set(qrows.map((r) => rowProblem(r, data.rates ?? [])).filter(Boolean) as string[])) blockers.push(p);
  }
  const readOnly = !canEdit;

  const rates = data.rates ?? [];
  const contractors = data.contractors ?? [];
  const contractorName = (id: string | null) => contractors.find((c) => c.id === id)?.name ?? "Contractor";
  const rowsFor = (bid: string): QtyRow[] => {
    const rows = qrows.filter((r) => r.boq_item_id === bid);
    return rows.length ? rows : [{ key: `own:${bid}`, boq_item_id: bid, contractor_id: null, extra_work_description: "", unit: "", today_qty: "" }];
  };
  const otherRows = qrows.filter((r) => !r.boq_item_id);
  const missingHeadcount = contractorsMissingHeadcount(qrows, headcount);
  const upsertRow = (row: QtyRow, patch: Partial<QtyRow>) => {
    touch();
    setQrows((s) => s.some((r) => r.key === row.key) ? s.map((r) => r.key === row.key ? { ...r, ...patch } : r) : [...s, { ...row, ...patch }]);
  };
  const splitRow = (bid: string) => {
    touch();
    setQrows((s) => {
      const base = s.some((r) => r.boq_item_id === bid) ? s : [...s, rowsFor(bid)[0]];
      const used = new Set(base.filter((r) => r.boq_item_id === bid).map((r) => r.contractor_id));
      const next = contractors.find((c) => !used.has(c.id));
      if (!next) { toast.error("Every contractor already has a row for this item."); return s; }
      return [...base, { key: crypto.randomUUID(), boq_item_id: bid, contractor_id: next.id, extra_work_description: "", unit: "", today_qty: "" }];
    });
  };
  const addOther = () => { touch(); setQrows((s) => [...s, { key: crypto.randomUUID(), boq_item_id: null, contractor_id: null, extra_work_description: "", unit: "", today_qty: "" }]); };
  const setDoneBy = (row: QtyRow, cid: string | null) => {
    if (row.boq_item_id && qrows.some((r) => r.key !== row.key && r.boq_item_id === row.boq_item_id && r.contractor_id === cid)) {
      toast.error("This item already has a row for that choice."); return;
    }
    upsertRow(row, { contractor_id: cid, ...(row.boq_item_id ? {} : { extra_work_description: "", unit: "" }) });
  };

  // plain render function (not a component) so inputs keep focus while typing
  const renderQtyRow = (row: QtyRow, unit: string, other?: boolean) => {
    const rate = findRate(row, rates);
    const amount = rowAmount(row, rates);
    const problem = rowProblem(row, rates);
    const descOptions = other && row.contractor_id ? rates.filter((r) => r.contractor_id === row.contractor_id && !r.boq_item_id) : [];
    return (
      <div key={row.key} className="rounded-md bg-muted/40 p-2 space-y-2 min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 items-end">
          <div className="min-w-0">
            <label className="text-[11px] text-muted-foreground block">Done by</label>
            <select className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={row.contractor_id ?? ""} disabled={readOnly}
              aria-label="Done by" onChange={(e) => setDoneBy(row, e.target.value || null)}>
              <option value="">ALTREE labour</option>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground block">Today{(rate?.unit ?? unit) ? ` (${rate?.unit ?? unit})` : ""}</label>
            <Input inputMode="decimal" type="number" min={0} value={row.today_qty} disabled={readOnly} aria-label="Quantity today"
              onChange={(e) => upsertRow(row, { today_qty: e.target.value })} />
          </div>
        </div>
        {other && (row.contractor_id ? (
          <select className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm" value={row.extra_work_description} disabled={readOnly}
            aria-label="Work" onChange={(e) => upsertRow(row, { extra_work_description: e.target.value, unit: rates.find((r) => r.id && r.work_description === e.target.value && r.contractor_id === row.contractor_id)?.unit ?? "" })}>
            <option value="">Choose work with a rate</option>
            {descOptions.map((r) => <option key={r.id} value={r.work_description ?? ""}>{r.work_description}</option>)}
          </select>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <Input placeholder="What was done" value={row.extra_work_description} disabled={readOnly} aria-label="Other work description"
              onChange={(e) => upsertRow(row, { extra_work_description: e.target.value })} />
            <Input placeholder="Unit" value={row.unit} disabled={readOnly} aria-label="Unit" onChange={(e) => upsertRow(row, { unit: e.target.value })} />
          </div>
        ))}
        {other && !row.contractor_id && <p className="text-[11px] text-muted-foreground">Own-labour other work is for information only.</p>}
        {row.contractor_id && amount != null && data.can_see_rates !== false && (
          <p className="text-xs break-words">₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            {rate?.rate_type === "lump_sum" && <span className="text-muted-foreground"> · package {Number(rate.used_qty)} of {Number(rate.package_qty)} done</span>}</p>
        )}
        {problem && <p className="text-xs text-destructive flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /><span className="break-words">{problem}</span></p>}
      </div>
    );
  };

  const PhotoSlot = ({ kind, label, sub }: { kind: string; label?: string; sub?: string | null }) => {
    const ph = photoByKind[kind] as Photo | undefined; const pd = pending[kind];
    return (
      <div className="rounded-md border border-border p-2 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0"><span className="text-sm font-semibold break-words block">{label ?? PHOTO_LABEL[kind]}</span>{sub && <span className="text-xs text-muted-foreground break-words block">Drawing: {sub}</span>}</span>
          {ph ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <span className="text-xs text-muted-foreground">Optional</span>}
        </div>
        {thumbs[kind] && ph && <div className="relative aspect-video w-full overflow-hidden rounded"><img src={thumbs[kind]} alt={`${label ?? PHOTO_LABEL[kind]} photo`} className="absolute inset-0 h-full w-full object-cover" /></div>}
        {ph?.flags?.length ? <div className="flex flex-wrap gap-1">{ph.flags.map((f) => <Badge key={f} variant="outline" className="text-[10px] border-warning text-warning">{FLAG_LABEL[f] ?? f}</Badge>)}</div> : null}
        {pd?.busy && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</div>}
        {pd?.error && (
          <div className="space-y-1">
            <p className="text-xs text-destructive break-words">{pd.error}</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => uploadPending(kind, pd)}><RotateCw className="h-3 w-3 mr-1" /> Retry</Button>
          </div>
        )}
        {!readOnly && (
          <div className="grid grid-cols-2 gap-1">
            <label className="inline-flex items-center justify-center gap-1 rounded-md bg-primary text-primary-foreground text-xs h-9 cursor-pointer">
              <Camera className="h-3.5 w-3.5" /> Camera
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPick(kind, e.target.files?.[0], false); e.target.value = ""; }} />
            </label>
            <label className="inline-flex items-center justify-center gap-1 rounded-md border border-border text-xs h-9 cursor-pointer">
              <ImageIcon className="h-3.5 w-3.5" /> Gallery
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { onPick(kind, e.target.files?.[0], true); e.target.value = ""; }} />
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 max-w-2xl mx-auto w-full min-w-0 pb-16 md:pb-0">
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Report date</span>
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Report date">
              {dates.map((d) => <option key={d} value={d}>{ddmmyyyy(d)}{d === today ? " (today)" : ""}</option>)}
            </select>
            <Badge variant={submitted ? "default" : "outline"}>{submitted ? "Submitted" : data.report ? "Draft" : "Not started"}</Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Draft saved" : saveState === "error" ? "Not saved – will retry on next change" : ""}
            </span>
          </div>
          {submitted && data.report?.submitted_at && <p className="text-xs text-muted-foreground">Submitted {format(new Date(data.report.submitted_at), "dd/MM/yyyy HH:mm")}. Changes are recorded in the edit history.</p>}
          {readOnly && <p className="text-xs text-muted-foreground">View only.</p>}
        </CardContent>
      </Card>

      <div className="sticky top-0 z-20 border-y border-border bg-background py-2" aria-label="Report checklist">
        <div className="grid grid-cols-4 gap-1">
          {([['Tasks',Math.max(taskProblems.length,workedTaskIds.length ? 0 : notes.trim().length<5 ? 1 : 0)],['Quantities',qrows.filter(r => rowProblem(r,data.rates ?? [])).length],['Labour',allocationProblems.length],['Hours confirmed',Number(data.unconfirmed_workers ?? 0)]] as [string,number][]).map(([label,count]) => <Button key={label} size="sm" variant="outline" className="h-auto min-h-10 px-1 text-[10px] whitespace-normal gap-1" onClick={() => {
            let tid:string|undefined;
            if(label==='Quantities') { const q=qrows.find(r => rowProblem(r,data.rates ?? []));tid=data.boq.find(b => b.id===q?.boq_item_id)?.task_id; }
            if(label==='Tasks') tid=taskProblems[0] ?? tasks[0]?.id;
            if(label==='Labour') tid=taskWorkers.find(r => allocationProblems.length && workers.find(w=>w.worker_id===r.worker_id && allocatedHours(taskWorkers,w.worker_id)>Number(w.attendance_hours)))?.task_id;
            if(tid) {setOpenTask(tid);setAddedTasks(prev=>[...new Set([...prev,tid])]);setTaskSearch('');requestAnimationFrame(()=>document.getElementById(`task-${tid}`)?.scrollIntoView({behavior:'smooth',block:'start'}));}
            else document.getElementById(label==='Hours confirmed'?'hours-confirmed':label==='Labour'?'manpower':'other-work')?.scrollIntoView({behavior:'smooth'});
          }}><span className={count ? 'text-warning' : 'text-primary'}>{count ? count : '✓'}</span>{label}</Button>)}
        </div>
        {blockers.length>0 && <Button variant="ghost" size="sm" className="h-7 w-full text-xs text-warning" onClick={()=>setChecklistOpen(true)}><ListChecks className="mr-1 h-3.5 w-3.5" />{blockers.length} checks before submit</Button>}
      </div>
      <Sheet open={checklistOpen} onOpenChange={setChecklistOpen}><SheetContent side="bottom" className="max-h-[60dvh] overflow-y-auto"><SheetHeader><SheetTitle>Before submit</SheetTitle></SheetHeader><ul className="list-disc pl-4 py-3 text-sm space-y-2">{blockers.map(b=><li key={b}>{b}</li>)}</ul>{Number(data.unconfirmed_workers)>0 && <Link to="/labour" className="text-primary underline">Open People</Link>}</SheetContent></Sheet>
      <div id="hours-confirmed" className="scroll-mt-28">{Number(data.unconfirmed_workers)>0 && <p className="text-sm text-warning">Confirm hours for {data.unconfirmed_workers} workers in People. <Link to="/labour" className="underline">Open People</Link></p>}</div>
      {hoursBlock && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm break-words">
          {hoursBlock} <Link to="/labour" className="font-medium underline">Open People</Link>
        </div>
      )}
      {summary && (
        <Card className="border-primary">
          <CardContent className="p-3 text-sm space-y-1">
            <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Report submitted for {ddmmyyyy(date)}</p>
            <p>Tasks updated: {summary.tasks_updated}</p>
            {!!summary.tasks_skipped?.length && <p className="text-warning">Not applied (a later report exists): {summary.tasks_skipped.map((x) => x.code).join(", ")}</p>}
            <p>Quantity lines: {summary.quantity_lines}</p>
            <p>Photos: {summary.photos}</p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3 min-w-0" aria-label="Today's tasks">
        <Input placeholder="Search tasks" value={taskSearch} aria-label="Search tasks" onChange={e=>setTaskSearch(e.target.value)} />
        {tasks.length===0 && <p className="text-sm text-muted-foreground">No tasks for this date.</p>}
        {tasks.map(t=>{
          const lines=data.boq.filter(b=>b.task_id===t.id);const after=taskPct(t.id);const expanded=openTask===t.id;
          const manual=!lines.some(b=>Number(b.progress_weight)>0);
          const showWorkers=lines.length===0 || qrows.some(r=>!r.contractor_id && Number(r.today_qty)>0 && lines.some(b=>b.id===r.boq_item_id)) || taskWorkers.some(r=>r.task_id===t.id);
          return <div key={t.id} id={`task-${t.id}`} className="scroll-mt-28 rounded-md border border-border min-w-0">
            <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal p-3 gap-2" aria-expanded={expanded} onClick={()=>setOpenTask(expanded?null:t.id)}>
              {expanded?<ChevronDown className="h-4 w-4 shrink-0"/>:<ChevronRight className="h-4 w-4 shrink-0"/>}
              <span className="min-w-0 flex-1 text-left"><span className="block text-xs text-muted-foreground">{t.code}</span><span className="block text-sm break-words">{t.name}</span><span className="block text-xs text-muted-foreground">Now {Number(t.pct)||0}% → {after ?? (Number(t.pct)||0)}%</span></span>
              <Badge variant={taskStatus[t.id]==='completed'?'default':'outline'} className="shrink-0 text-[10px]">{taskStatus[t.id]==='completed'?'Completed':'Ongoing'}</Badge>
            </Button>
            {expanded && <div className="border-t border-border p-3 space-y-4 min-w-0">
              {lines.map(b=>{const rows=rowsFor(b.id);const total=rows.reduce((n,r)=>n+(Number(r.today_qty)||0),0);return <div key={b.id} className="space-y-2 min-w-0" id={`quantity-${b.id}`}>
                <p className="text-sm break-words">{b.description}</p><p className="text-xs text-muted-foreground">BOQ {Number(b.boq_qty)} {b.unit} / so far {Number(b.cumulative)} {b.unit}</p>
                {rows.map(r=>renderQtyRow(r,b.unit ?? ''))}
                {exceedsBoq(Number(b.boq_qty),Number(b.cumulative),total) && <p className="text-xs text-warning">Total would exceed BOQ quantity</p>}
                {!readOnly && contractors.length>0 && <Button size="sm" variant="ghost" className="max-w-full h-auto whitespace-normal text-xs" onClick={()=>splitRow(b.id)}><Split className="mr-1 h-3.5 w-3.5 shrink-0"/>Split to another contractor</Button>}
              </div>;})}
              {showWorkers && <TaskWorkerChips taskId={t.id} workers={workers} rows={taskWorkers} readOnly={readOnly} onChange={rows=>{touch();setWorkerTaskIds(prev=>[...new Set([...prev,t.id])]);setTaskWorkers(rows);}}/>}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Status</label>
                <div className="flex gap-2">{(['ongoing','completed'] as const).map(status=><Button key={status} size="sm" variant={(taskStatus[t.id] ?? 'ongoing')===status?'default':'outline'} disabled={readOnly} onClick={()=>{touch();setTaskStatus(prev=>({...prev,[t.id]:status}));}}>{status==='ongoing'?'Ongoing':'Completed'}</Button>)}</div>
                {manual ? <div><label className="text-xs text-muted-foreground" htmlFor={`pct-${t.id}`}>% after today</label><Input id={`pct-${t.id}`} type="number" inputMode="decimal" min={0} max={100} value={pct[t.id] ?? ''} disabled={readOnly || taskStatus[t.id]==='completed'} onChange={e=>{touch();setPct(prev=>({...prev,[t.id]:e.target.value}));}}/></div> : <p className="text-sm">Progress: {after ?? 0}%</p>}
                {after!=null && after<Number(t.pct) && <p className="text-xs text-warning">Lower than current progress</p>}
                <Textarea aria-label={`${t.name} remarks`} rows={2} placeholder="Remarks (optional)" value={remarks[t.id] ?? ''} disabled={readOnly} onChange={e=>{touch();setRemarks(prev=>({...prev,[t.id]:e.target.value}));}}/>
              </div>
              <Button variant="outline" className="w-full" onClick={()=>setOpenTask(null)}><CheckCircle2 className="mr-1 h-4 w-4"/>Done</Button>
            </div>}
          </div>;
        })}
        <Button size="sm" variant="outline" onClick={()=>setShowOtherTasks(!showOtherTasks)}><Plus className="mr-1 h-4 w-4"/>Add another task</Button>
        {(showOtherTasks || taskSearch) && <div className="space-y-1">{otherTasks.map(t=><Button key={t.id} variant="ghost" className="w-full justify-start h-auto whitespace-normal text-left" onClick={()=>{setAddedTasks(prev=>[...prev,t.id]);setOpenTask(t.id);setTaskSearch('');setShowOtherTasks(false);}}><Plus className="mr-2 h-4 w-4 shrink-0"/><span className="break-words">{t.code} · {t.name}</span></Button>)}</div>}
      </section>
      <section id="other-work" className="space-y-2 scroll-mt-28">
        <h3 className="text-sm font-semibold">Other work (not in BOQ)</h3>
        {otherRows.map(r=>renderQtyRow(r,r.unit,true))}
        {!readOnly && <Button size="sm" variant="outline" onClick={addOther}><Plus className="mr-1 h-4 w-4"/>Other work</Button>}
      </section>

      {contractors.length > 0 && (
        <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Subcontractor headcount today</CardTitle></CardHeader>
          <CardContent className="p-3 pt-1 space-y-2">
            {contractors.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border p-2 min-w-0">
                <p className="text-sm flex-1 min-w-0 break-words">{c.name}</p>
                <div className="w-24 shrink-0">
                  <label className="text-[11px] text-muted-foreground" htmlFor={`hc-${c.id}`}>People</label>
                  <Input id={`hc-${c.id}`} inputMode="numeric" type="number" min={0} max={500} step={1} value={headcount[c.id] ?? ""} disabled={readOnly}
                    onChange={(e) => { touch(); setHeadcount((s) => ({ ...s, [c.id]: e.target.value })); }} />
                </div>
              </div>
            ))}
            {missingHeadcount.length > 0 && (
              <p className="text-xs text-warning flex items-start gap-1"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="break-words">Quantities recorded but no headcount: {missingHeadcount.map((id) => contractorName(id)).join(", ")}</span></p>
            )}
          </CardContent>
        </Card>
      )}

      <section id="manpower" className="space-y-2 scroll-mt-28">
        <h3 className="text-sm font-semibold">Manpower for the day</h3>
        <div className="flex flex-wrap gap-2">{workers.map(w=>{const allocated=allocatedHours(taskWorkers,w.worker_id);return <Badge key={w.worker_id} variant="outline" className={`max-w-full whitespace-normal break-words ${allocated===0?'text-muted-foreground':allocated===Number(w.attendance_hours)?'text-primary border-primary':'text-warning border-warning'}`}>{w.name} · {allocated}/{Number(w.attendance_hours)} h{allocated===0?' · idle':''}</Badge>;})}</div>
        {!workers.length && <p className="text-sm text-muted-foreground">No present workers. <Link to="/labour" className="text-primary underline">Open People</Link></p>}
        {workers.some(w=>allocatedHours(taskWorkers,w.worker_id)<Number(w.attendance_hours)) && <p className="text-xs text-warning">Some attendance hours are unallocated.</p>}
      </section>
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Consumables &amp; site expenses</CardTitle></CardHeader>
        <CardContent className="p-3 space-y-3">
          {expenses.map(e=><div key={e.id} className="space-y-2 border-b border-border pb-3 min-w-0">
            <div className="flex flex-wrap gap-1">{(['consumable','expense'] as const).map(kind=><Button key={kind} size="sm" variant={e.kind===kind?'default':'outline'} disabled={readOnly} onClick={()=>{touch();setExpenses(prev=>prev.map(x=>x.id===e.id?{...x,kind}:x));}}>{kind==='consumable'?'Consumable':'Expense'}</Button>)}{!readOnly && <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" title="Remove expense" aria-label="Remove expense" onClick={()=>{touch();setExpenses(prev=>prev.filter(x=>x.id!==e.id));}}><X className="h-4 w-4"/></Button>}</div>
            <Input aria-label="Expense description" placeholder="Description" value={e.description} disabled={readOnly} onChange={ev=>{touch();setExpenses(prev=>prev.map(x=>x.id===e.id?{...x,description:ev.target.value}:x));}}/>
            <label className="block text-xs text-muted-foreground">Amount (₹)<Input aria-label="Expense amount" placeholder="0" type="number" inputMode="decimal" min={0} step={0.01} value={e.amount_inr} disabled={readOnly} onChange={ev=>{touch();setExpenses(prev=>prev.map(x=>x.id===e.id?{...x,amount_inr:ev.target.value}:x));}}/></label>
          </div>)}
          {!readOnly && <Button size="sm" variant="outline" onClick={()=>{touch();setExpenses(prev=>[...prev,{id:crypto.randomUUID(),kind:'consumable',description:'',amount_inr:''}]);}}><Plus className="mr-1 h-4 w-4"/>Add</Button>}
        </CardContent>
      </Card>
      <Card>
        <details><summary className="cursor-pointer p-3 text-base font-semibold">Photos (optional)</summary>
        <CardContent className="p-3 pt-1 grid grid-cols-1 min-[400px]:grid-cols-2 gap-2">
          {elevations.length === 0 ? (
            <div className="text-sm space-y-1 col-span-full">
              <p>{NO_ELEVATIONS_MSG}</p>
              {data.can_manage_elevations && <Link to={`/projects/${projectId}?tab=setup`} className="text-primary underline">Open project Setup to add elevations</Link>}
            </div>
          ) : elevations.map((e) => <PhotoSlot key={e.id} kind={`elevation:${e.id}`} label={e.name} sub={e.drawing_ref} />)}
          {data.photos.filter((p) => p.kind.startsWith("elevation") && !(p.kind === "elevation" && elevations.some((e) => e.id === p.elevation_id))).map((p) => (
            <div key={p.id} className="rounded-md border border-border p-2 space-y-1 min-w-0">
              <span className="text-sm font-semibold">{PHOTO_LABEL[p.kind] ?? "Earlier elevation"}</span>
              {thumbs[slotKey(p)] && <div className="relative aspect-video w-full overflow-hidden rounded"><img src={thumbs[slotKey(p)]} alt="Stored elevation photo" className="absolute inset-0 h-full w-full object-cover" /></div>}
            </div>
          ))}
        </CardContent>

        <CardContent className="p-3 pt-1 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={siteClean} disabled={readOnly} onCheckedChange={(v) => { touch(); setSiteClean(v === true); }} /> Site is clean at end of day
          </label>
          <PhotoSlot kind="site_clean" />
        </CardContent>
        </details>
      </Card>

      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1">
          <Textarea rows={3} value={notes} disabled={readOnly} placeholder="If no work happened today, say why"
            onChange={(e) => { touch(); setNotes(e.target.value); }} />
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="fixed bottom-16 left-4 right-4 md:sticky md:bottom-0 md:left-auto md:right-auto z-20 bg-background border-t border-border py-2 space-y-2">
          <Button className="w-full h-11" disabled={blockers.length > 0 || submitting} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{submitted ? "Re-submit report" : "Submit report"}
          </Button>
        </div>
      )}
    </div>
  );
}
