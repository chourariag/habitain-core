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
import { Camera, ImageIcon, Loader2, RotateCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  NO_ELEVATIONS_MSG, FLAG_LABEL, PHOTO_LABEL, allowedReportDates, exceedsBoq, labourBalance, parsePct, submitBlockers,
} from "@/lib/site-report-rules";
import { compressPhoto, readPhotoMeta, type PhotoMeta } from "@/lib/site-report-photo";

type Task = { id: string; code: string; name: string; pct: number; planned_start: string; actual_start: string | null };
type Boq = { id: string; task_id: string; description: string; unit: string | null; boq_qty: number; cumulative: number };
type Photo = { id: string; kind: string; elevation_id?: string | null; storage_path: string; flags: string[]; gps_source: string };
type Data = {
  can_write: boolean; today: string;
  report: null | { id: string; status: string | null; notes: string | null; site_clean: boolean; site_clean_photo_path: string | null; submitted_by: string | null; submitted_at: string | null };
  tasks: Task[]; boq: Boq[];
  progress: { task_id: string; pct: number | null; remarks: string | null }[];
  labour: { task_id: string; hours: number }[];
  quantities: { boq_item_id: string; today_qty: number; remarks: string | null }[];
  photos: Photo[];
  elevations: { id: string; name: string; drawing_ref: string | null }[];
  can_manage_elevations: boolean;
  attendance: { workers: number; hours: number };
};
type Pending = { file: Blob; meta: PhotoMeta; gallery: boolean; error?: string; busy?: boolean };

const istToday = () => format(new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000), "yyyy-MM-dd");
const ddmmyyyy = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");
const FAIL_MSG = "Could not save the report. Please try again.";
const slotKey = (p: { kind: string; elevation_id?: string | null }) => p.kind === "elevation" && p.elevation_id ? `elevation:${p.elevation_id}` : p.kind;
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args);

export function DailySiteReport({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(istToday());
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [hours, setHours] = useState<Record<string, string>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [siteClean, setSiteClean] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [boqSearch, setBoqSearch] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<null | { tasks_updated: number; tasks_skipped?: { code: string }[]; quantity_lines: number; photos: number }>(null);
  const reportId = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);
  const cleared = useRef<{ hours: Set<string>; qty: Set<string> }>({ hours: new Set(), qty: new Set() });

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
    setHours(Object.fromEntries(v.labour.map((l) => [l.task_id, String(l.hours)])));
    setQty(Object.fromEntries(v.quantities.map((q) => [q.boq_item_id, String(q.today_qty)])));
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

  const workedTaskIds = useMemo(
    () => Object.entries(pct).filter(([, v]) => parsePct(v) != null).map(([k]) => k),
    [pct],
  );

  const buildPayload = useCallback(() => ({
    notes, site_clean: siteClean,
    progress: Object.entries(pct).map(([task_id, v]) => ({ task_id, pct: parsePct(v) })),
    // entries removed from a cleared task are sent once as 0 so previously saved values do not linger
    labour: [...Object.entries(hours).map(([task_id, v]) => ({ task_id, hours: Math.max(Number(v) || 0, 0) })),
      ...[...cleared.current.hours].filter((id) => !(id in hours)).map((task_id) => ({ task_id, hours: 0 }))],
    quantities: [...Object.entries(qty).map(([boq_item_id, v]) => ({ boq_item_id, today_qty: Math.max(Number(v) || 0, 0) })),
      ...[...cleared.current.qty].filter((id) => !(id in qty)).map((boq_item_id) => ({ boq_item_id, today_qty: 0 }))],
  }), [notes, siteClean, pct, hours, qty]);

  const saveNow = useCallback(async () => {
    if (!canEdit) return null;
    setSaveState("saving");
    const { data: id, error } = await rpc("save_site_report_draft", { p_project_id: projectId, p_date: date, p_payload: buildPayload() });
    if (error) { setSaveState("error"); console.error("save_site_report_draft failed:", error); toast.error(FAIL_MSG); return null; }
    reportId.current = id as string; dirty.current = false; cleared.current = { hours: new Set(), qty: new Set() }; setSaveState("saved");
    return id as string;
  }, [canEdit, projectId, date, buildPayload]);

  // autosave on every change (debounced)
  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { saveNow(); }, 900);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [pct, hours, qty, notes, siteClean, saveNow]);
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
    if (error) { console.error("submit_site_report failed:", error); toast.error(error.message?.includes(NO_ELEVATIONS_MSG) ? NO_ELEVATIONS_MSG : FAIL_MSG); return; }
    await load();
    setSummary(res);
    toast.success("Daily report submitted");
  };

  if (loading && !data) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const photoByKind = Object.fromEntries(data.photos.map((p) => [slotKey(p), p]));
  const elevations = data.elevations ?? [];
  const tasks = data.tasks.filter((t) => !taskSearch || `${t.code} ${t.name}`.toLowerCase().includes(taskSearch.toLowerCase()));
  const bal = labourBalance(Number(data.attendance?.hours ?? 0), workedTaskIds.map((id) => Number(hours[id]) || 0));
  const blockers = submitBlockers({
    elevations, photoElevationIds: data.photos.filter((p) => p.kind === "elevation" && p.elevation_id).map((p) => p.elevation_id as string), siteClean, siteCleanPhoto: !!photoByKind.site_clean,
    tasksWithProgress: workedTaskIds.length, notes,
  });
  const readOnly = !canEdit;

  const PhotoSlot = ({ kind, label, sub }: { kind: string; label?: string; sub?: string | null }) => {
    const ph = photoByKind[kind] as Photo | undefined; const pd = pending[kind];
    return (
      <div className="rounded-md border border-border p-2 space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0"><span className="text-sm font-semibold break-words block">{label ?? PHOTO_LABEL[kind]}</span>{sub && <span className="text-xs text-muted-foreground break-words block">Drawing: {sub}</span>}</span>
          {ph ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" /> : <span className="text-xs text-muted-foreground">Required</span>}
        </div>
        {thumbs[kind] && ph && <img src={thumbs[kind]} alt={`${label ?? PHOTO_LABEL[kind]} photo`} className="w-full aspect-video object-cover rounded" />}
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
    <div className="space-y-3 max-w-2xl mx-auto w-full min-w-0">
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

      {/* 1. Tasks */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">1. Tasks</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1 space-y-2">
          <Input placeholder="Search tasks" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
          {data.tasks.length === 0 && <p className="text-sm text-muted-foreground">No construction tasks are due by this date. Tasks come from the Project Setup upload.</p>}
          {tasks.map((t) => {
            const v = pct[t.id] ?? ""; const parsed = parsePct(v); const bad = v !== "" && parsed == null;
            const lower = parsed != null && parsed < t.pct;
            const future = t.planned_start && t.planned_start > date;
            return (
              <div key={t.id} className="rounded-md border border-border space-y-1 min-w-0">
              <div className="p-2 flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">{t.code}</p>
                  <p className="text-sm font-medium break-words">{t.name}</p>
                  <p className="text-xs text-muted-foreground">Now {t.pct}%</p>
                  {future && <Badge variant="outline" className="text-[10px] mt-1">Starts {ddmmyyyy(t.planned_start)}</Badge>}
                </div>
                <div className="w-24 shrink-0">
                  <label className="text-[11px] text-muted-foreground">% after today</label>
                  <Input inputMode="decimal" type="number" min={0} max={100} value={v} disabled={readOnly}
                    className={bad ? "border-destructive" : ""}
                    onChange={(e) => {
                      touch(); const val = e.target.value;
                      setPct((s) => ({ ...s, [t.id]: val }));
                      if (val.trim() === "") {
                        const lineIds = data.boq.filter((b) => b.task_id === t.id).map((b) => b.id);
                        setQty((s) => { const n = { ...s }; lineIds.forEach((id) => { if (id in n) { cleared.current.qty.add(id); delete n[id]; } }); return n; });
                        setHours((s) => { if (!(t.id in s)) return s; cleared.current.hours.add(t.id); const n = { ...s }; delete n[t.id]; return n; });
                      }
                    }} />
                </div>
              </div>
              {lower && <p className="text-xs text-warning flex items-center gap-1 -mt-1 px-2"><AlertTriangle className="h-3 w-3" /> Lower than current progress</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 2. Quantities */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">2. Quantities</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1 space-y-3">
          {workedTaskIds.length === 0 ? <p className="text-sm text-muted-foreground">Enter progress on a task to record its quantities.</p> : (
            <Input placeholder="Search BOQ lines" value={boqSearch} onChange={(e) => setBoqSearch(e.target.value)} />
          )}
          {workedTaskIds.map((tid) => {
            const t = data.tasks.find((x) => x.id === tid); if (!t) return null;
            const lines = data.boq.filter((b) => b.task_id === tid && (!boqSearch || b.description.toLowerCase().includes(boqSearch.toLowerCase())));
            return (
              <div key={tid} className="space-y-2">
                <p className="text-sm font-semibold break-words">{t.code} · {t.name}</p>
                {lines.length === 0 && <p className="text-xs text-muted-foreground">No BOQ lines linked to this task.</p>}
                {lines.map((b) => {
                  const today = Number(qty[b.id]) || 0; const over = exceedsBoq(Number(b.boq_qty), Number(b.cumulative), today);
                  return (
                    <div key={b.id} className="rounded-md border border-border p-2 space-y-1 min-w-0">
                      <p className="text-sm break-words">{b.description}</p>
                      <div className="flex items-end gap-2">
                        <p className="text-xs text-muted-foreground flex-1 min-w-0">BOQ {Number(b.boq_qty)} {b.unit ?? ""} · So far {Number(b.cumulative)}</p>
                        <div className="w-24 shrink-0">
                          <label className="text-[11px] text-muted-foreground">Today</label>
                          <Input inputMode="decimal" type="number" min={0} value={qty[b.id] ?? ""} disabled={readOnly}
                            onChange={(e) => { touch(); setQty((s) => ({ ...s, [b.id]: e.target.value })); }} />
                        </div>
                      </div>
                      {over && <p className="text-xs text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Total would exceed BOQ quantity</p>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 3. Labour */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">3. Labour</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1 space-y-2">
          {Number(data.attendance?.workers ?? 0) === 0 ? (
            <p className="text-sm">No labour attendance recorded for {ddmmyyyy(date)}. <Link to="/labour" className="text-primary underline">Open Labour</Link> to record it.</p>
          ) : (
            <p className="text-sm">Workers present: <b>{data.attendance.workers}</b> · Total hours: <b>{Number(data.attendance.hours)}</b></p>
          )}
          {workedTaskIds.map((tid) => {
            const t = data.tasks.find((x) => x.id === tid); if (!t) return null;
            return (
              <div key={tid} className="flex items-center gap-2 rounded-md border border-border p-2 min-w-0">
                <p className="text-sm flex-1 min-w-0 break-words">{t.code} · {t.name}</p>
                <div className="w-24 shrink-0">
                  <label className="text-[11px] text-muted-foreground">Hours</label>
                  <Input inputMode="decimal" type="number" min={0} value={hours[tid] ?? ""} disabled={readOnly}
                    onChange={(e) => { touch(); setHours((s) => ({ ...s, [tid]: e.target.value })); }} />
                </div>
              </div>
            );
          })}
          {workedTaskIds.length > 0 && (
            <div className="text-xs space-y-0.5">
              <p>Allocated: {bal.allocated} h</p>
              {bal.unallocated > 0 && <p className="text-warning">Unallocated hours: {bal.unallocated}</p>}
              {bal.over > 0 && <p className="text-warning">Over-allocated hours: {bal.over}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Photos */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">4. Elevation photos</CardTitle></CardHeader>
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
              {thumbs[slotKey(p)] && <img src={thumbs[slotKey(p)]} alt="Stored elevation photo" className="w-full aspect-video object-cover rounded" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 5. Site clean */}
      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">5. Site clean</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={siteClean} disabled={readOnly} onCheckedChange={(v) => { touch(); setSiteClean(v === true); }} /> Site is clean at end of day
          </label>
          <PhotoSlot kind="site_clean" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 pb-1"><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent className="p-3 pt-1">
          <Textarea rows={3} value={notes} disabled={readOnly} placeholder="If no work happened today, say why"
            onChange={(e) => { touch(); setNotes(e.target.value); }} />
        </CardContent>
      </Card>

      {!readOnly && (
        <div className="space-y-2 pb-6">
          {blockers.length > 0 && <ul className="text-xs text-muted-foreground list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
          <Button className="w-full h-11" disabled={blockers.length > 0 || submitting} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{submitted ? "Re-submit report" : "Submit report"}
          </Button>
        </div>
      )}
    </div>
  );
}
