import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "@/lib/safe-xlsx";
import { format, parseISO, subDays } from "date-fns";
import { AlertTriangle, Download, FileSpreadsheet, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolboxCamera, type CapturedPhoto } from "@/components/labour/ToolboxCamera";
import { FactoryAttendance } from "@/components/labour/FactoryAttendance";
import { canWriteFactory } from "@/lib/factory-report";
import { TIER1_ROLES } from "@/lib/roles";
import { hasSitePin, SITE_LOCATION_MISSING } from "@/lib/project-location";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rowsFromLabourMasterSheet, validateLabourMasterRows, type LabourMasterImportRow } from "@/lib/labour-master-excel";
import { attendanceWarningLabels, isValidLabourHours, LABOUR_ATTENDANCE_ROLES, LABOUR_DIRECTORY_VIEW_ROLES, LABOUR_MASTER_UPLOAD_ROLES, LABOUR_RATE_VIEW_ROLES, labourAuditReasonForSave, parseLabourDateInput, requiresLabourAttendanceReason, requiresReasonForSavedAttendanceEdit } from "@/lib/labour-rules";
const MASTER_HEADERS = ["worker_code", "name", "contractor", "skill_type", "hourly_rate", "monthly_salary", "status"];

type LabourWorker = {
  worker_id: string;
  worker_code: string | null;
  name: string | null;
  contractor: string | null;
  skill_type: string | null;
  status: string | null;
  deactivated_at: string | null;
  hourly_rate?: number | null;
  monthly_salary?: number | null;
  effective_hourly_rate?: number | null;
};

type AttendanceRow = {
  worker: LabourWorker;
  present: boolean;
  hours: number;
  savedHours: number | null;
  confirmed: boolean;
  exception: boolean;
  eveningHours: number;
};

type StoredAttendance = { id: string; worker_id: string; hours: number; work_date: string; hours_confirmed?: boolean; no_photo_exception?: boolean };
type AttendanceWarning = { worker_id: string; has_other_project: boolean; total_hours: number; is_deactivated: boolean };

const todayISO = () => istTodayISO();
const istTodayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const PHOTO_EXCEPTION_ROLES = ["head_of_projects", "super_admin", ...TIER1_ROLES] as const;
const canUsePhotoException = (role: string | null) => !!role && (PHOTO_EXCEPTION_ROLES as readonly string[]).includes(role);
const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function LabourPage() {
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { role } = useUserRole();
  const [tab, setTab] = useState("attendance");
  const [workers, setWorkers] = useState<LabourWorker[]>([]);
  const [rates, setRates] = useState<LabourWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const canManageAttendance = LABOUR_ATTENDANCE_ROLES.includes(role as (typeof LABOUR_ATTENDANCE_ROLES)[number]);
  const canFactory = canWriteFactory(role);
  const [location,setLocation] = useState(new URLSearchParams(window.location.search).get("location") === "factory" ? "factory" : "site");
  const canUploadMaster = LABOUR_MASTER_UPLOAD_ROLES.includes(role as (typeof LABOUR_MASTER_UPLOAD_ROLES)[number]);
  const canViewMaster = LABOUR_DIRECTORY_VIEW_ROLES.includes(role as (typeof LABOUR_DIRECTORY_VIEW_ROLES)[number]);
  const canViewRates = LABOUR_RATE_VIEW_ROLES.includes(role as (typeof LABOUR_RATE_VIEW_ROLES)[number]);

  useEffect(() => {
    setTab(canManageAttendance || canFactory ? "attendance" : "master");
    if (canFactory && !canManageAttendance) setLocation("factory");
  }, [canManageAttendance,canFactory]);

  const loadMaster = useCallback(async () => {
    if (!canViewMaster) { setLoading(false); return; }
    setLoading(true);
    const directoryQuery = supabase.from("labour_worker_directory").select("worker_id,worker_code,name,contractor,skill_type,status,deactivated_at").order("worker_code");
    const rateQuery = canViewRates
      ? supabase.from("labour_worker_rates").select("worker_id,worker_code,name,contractor,skill_type,status,hourly_rate,monthly_salary,effective_hourly_rate").order("worker_code")
      : Promise.resolve({ data: null, error: null });
    const [{ data: directory, error: directoryError }, { data: rateData, error: rateError }] = await Promise.all([directoryQuery, rateQuery]);
    if (directoryError) toast.error(directoryError.message);
    if (rateError) toast.error(rateError.message);
    setWorkers((directory ?? []) as LabourWorker[]);
    setRates((rateData ?? []) as LabourWorker[]);
    setLoading(false);
  }, [canViewMaster, canViewRates]);

  useEffect(() => { void loadMaster(); }, [loadMaster]);

  if (!canViewMaster && !canFactory) {
    return <div className="mx-auto max-w-5xl px-4 pb-24 md:px-6"><h1 className="font-display text-2xl font-bold">Labour</h1><p className="mt-3 text-sm text-muted-foreground">This section is not available for your role.</p></div>;
  }

  const rateById = new Map(rates.map((worker) => [worker.worker_id, worker]));
  const directory = workers.map((worker) => ({ ...worker, ...(rateById.get(worker.worker_id) ?? {}) }));

  return (
    <div className="mx-auto max-w-5xl min-w-0 px-4 pb-24 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3 py-2">
        <div className="min-w-0"><h1 className="font-display text-2xl font-bold">Labour</h1><p className="mt-1 text-sm text-muted-foreground">Contract labour attendance and master register</p></div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />}
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mt-4 min-w-0">
        {canManageAttendance || canFactory ? <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="master">Master</TabsTrigger></TabsList> : <TabsList className="grid w-full grid-cols-1"><TabsTrigger value="master">Master</TabsTrigger></TabsList>}
        {(canManageAttendance || canFactory) && <TabsContent value="attendance">
          {canFactory && <div className="mb-4 space-y-1"><Label>Location</Label><Select value={location} onValueChange={setLocation}><SelectTrigger aria-label="Attendance location"><SelectValue /></SelectTrigger><SelectContent>{canManageAttendance && <SelectItem value="site">Projects</SelectItem>}<SelectItem value="factory">Factory</SelectItem></SelectContent></Select></div>}
          {location === "factory" && canFactory ? <FactoryAttendance role={role}/> : <AttendanceTab
          workers={directory}
          projects={projects}
          projectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          canEdit={canManageAttendance}
          role={role}
        />}</TabsContent>}
        <TabsContent value="master"><MasterTab workers={directory} canUpload={canUploadMaster} canViewRates={canViewRates} onUploaded={loadMaster} /></TabsContent>
      </Tabs>
    </div>
  );
}

type DayPhoto = { id: string; storage_path: string; captured_at: string; flags: Record<string, unknown> | null; url?: string };

function AttendanceTab({ workers, projects, projectId, onProjectChange, canEdit, role }: {
  workers: LabourWorker[];
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  onProjectChange: (id: string | null) => void;
  canEdit: boolean;
  role: string | null;
}) {
  const [workDate, setWorkDate] = useState(todayISO());
  const [dateText, setDateText] = useState(format(new Date(), "dd/MM/yyyy"));
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<Array<{ workerName: string; text: string }>>([]);
  const [photos, setPhotos] = useState<DayPhoto[]>([]);
  const [standardHours, setStandardHours] = useState(8);
  const [confirming, setConfirming] = useState(false);
  const [pinProject, setPinProject] = useState<string | null>(null);
  const [pinReady, setPinReady] = useState(false);
  const locationBlocks = pinProject !== projectId || !pinReady;
  useEffect(() => {
    let current = true;
    setPinReady(false); setPinProject(null);
    if (projectId) void supabase.from("projects").select("site_lat,site_lng").eq("id", projectId).maybeSingle().then(({ data }) => {
      if (current) { setPinReady(!!data && hasSitePin(data.site_lat, data.site_lng)); setPinProject(projectId); }
    });
    return () => { current = false; };
  }, [projectId]);
  const isToday = workDate === istTodayISO();
  const hasPhoto = photos.length > 0;
  const canException = canUsePhotoException(role);
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";

  useEffect(() => { void supabase.rpc("get_labour_standard_hours").then(({ data }) => { if (data != null) setStandardHours(Number(data)); }); }, []);

  const loadDay = useCallback(async () => {
    setWarnings([]);
    setReason("");
    if (!projectId) { setRecentIds([]); setRows({}); setPhotos([]); return; }
    const recentFrom = format(subDays(parseISO(workDate), 13), "yyyy-MM-dd");
    const [{ data: daily }, { data: recent }, { data: photoRows }] = await Promise.all([
      supabase.from("labour_attendance").select("id,worker_id,hours,work_date,hours_confirmed,no_photo_exception").eq("project_id", projectId).eq("work_date", workDate),
      supabase.from("labour_attendance").select("worker_id,work_date").eq("project_id", projectId).gte("work_date", recentFrom).lte("work_date", workDate).gt("hours", 0).order("work_date", { ascending: false }),
      supabase.from("labour_attendance_photos").select("id,storage_path,captured_at,flags").eq("project_id", projectId).eq("work_date", workDate).order("captured_at"),
    ]);
    const list = (photoRows ?? []) as DayPhoto[];
    const signed = await Promise.all(list.map(async (ph) => {
      const { data } = await supabase.storage.from("attendance-photos").createSignedUrl(ph.storage_path, 3600);
      return { ...ph, url: data?.signedUrl };
    }));
    setPhotos(signed);
    const saved = (daily ?? []) as StoredAttendance[];
    const recentWorkerIds = [...new Set((recent ?? []).map((row) => row.worker_id))];
    const includedIds = [...new Set([...recentWorkerIds, ...saved.map((row) => row.worker_id)])];
    setRecentIds(includedIds);
    const workerMap = new Map(workers.map((worker) => [worker.worker_id, worker]));
    const initialRows: Record<string, AttendanceRow> = {};
    includedIds.forEach((id) => {
      const worker = workerMap.get(id);
      if (!worker) return;
      const record = saved.find((row) => row.worker_id === id);
      const savedHours = record ? Number(record.hours) : null;
      initialRows[id] = {
        worker,
        present: savedHours !== null && savedHours > 0,
        hours: savedHours && savedHours > 0 ? savedHours : standardHours,
        savedHours,
        confirmed: Boolean(record?.hours_confirmed),
        exception: Boolean(record?.no_photo_exception),
        eveningHours: savedHours && savedHours > 0 ? savedHours : standardHours,
      };
    });
    setRows(initialRows);
  }, [projectId, workDate, workers, standardHours]);

  useEffect(() => { void loadDay(); }, [loadDay]);

  const visibleWorkers = useMemo(() => {
    const included = Object.values(rows).map((row) => row.worker);
    return included.sort((a, b) => {
      const priority = Number(!recentIds.includes(a.worker_id)) - Number(!recentIds.includes(b.worker_id));
      return priority || (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [rows, recentIds]);

  const searchCandidates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return [];
    return workers.filter((worker) => worker.status === "active" && !rows[worker.worker_id] &&
      `${worker.worker_code ?? ""} ${worker.name ?? ""} ${worker.contractor ?? ""} ${worker.skill_type ?? ""}`.toLowerCase().includes(normalizedSearch));
  }, [workers, rows, search]);

  const addVisibleWorker = (worker: LabourWorker) => setRows((current) => current[worker.worker_id] ? current : ({
    ...current,
    [worker.worker_id]: { worker, present: false, hours: standardHours, savedHours: null, confirmed: false, exception: false, eveningHours: standardHours },
  }));

  const updateRow = (id: string, patch: Partial<AttendanceRow>) => setRows((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const onCaptured = async (p: CapturedPhoto) => {
    if (!projectId) return;
    if (locationBlocks) { toast.error(SITE_LOCATION_MISSING); return; }
    const path = `${projectId}/${istTodayISO()}/${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage.from("attendance-photos").upload(path, p.blob, { contentType: "image/jpeg" });
    if (upErr) { toast.error(`Photo upload failed: ${upErr.message}`); return; }
    const { error } = await supabase.rpc("add_attendance_photo", { p_project_id: projectId, p_storage_path: path, p_captured_at: p.capturedAt, p_lat: p.lat, p_lng: p.lng, p_accuracy_m: p.accuracy });
    if (error) { toast.error(error.message); return; }
    toast.success("Toolbox talk photo saved.");
    await loadDay();
  };

  const needsPhotoException = !isToday && !hasPhoto;
  const photoGateBlocks = locationBlocks || (isToday ? !hasPhoto : (!hasPhoto && !canException));

  const saveAttendance = async () => {
    if (!projectId) { toast.error("Choose a project first."); return; }
    if (locationBlocks) { toast.error(SITE_LOCATION_MISSING); return; }
    const parsedWorkDate = parseLabourDateInput(dateText);
    if (!parsedWorkDate) { toast.error("Enter the date as DD/MM/YYYY."); return; }
    if (parsedWorkDate !== workDate) { toast.error("Finish entering a valid date before saving."); return; }
    if (workDate > istTodayISO()) { toast.error("Future attendance cannot be saved."); return; }
    if (photoGateBlocks) { toast.error("Take the toolbox talk photo first."); return; }
    if (needsPhotoException && reason.trim().length < 10) { toast.error("No toolbox talk photo for this day. Enter a reason of at least 10 characters."); return; }
    const selectedRows = Object.values(rows);
    const nextHours = (row: AttendanceRow) => row.present ? (row.savedHours && row.savedHours > 0 ? row.savedHours : standardHours) : 0;
    const oldRecordEdited = selectedRows.some((row) => requiresReasonForSavedAttendanceEdit(row.savedHours, nextHours(row)));
    if (requiresLabourAttendanceReason(workDate, new Date()) && !reason.trim()) { toast.error("Add a reason for attendance more than two days ago."); return; }
    if (oldRecordEdited && !reason.trim()) { toast.error("Add a reason for changing saved attendance."); return; }
    const rowsToSave = selectedRows.filter((row) => row.present || row.savedHours !== null);
    const payload = rowsToSave.map((row) => ({ worker_id: row.worker.worker_id, hours: nextHours(row) }));
    setSaving(true);
    const { data: warningRows, error: warningError } = await supabase.rpc("get_labour_attendance_warnings", { p_project_id: projectId, p_work_date: workDate, p_rows: payload });
    if (warningError) { setSaving(false); toast.error(warningError.message); return; }
    const warningsByWorker = new Map(((warningRows ?? []) as AttendanceWarning[]).map((warning) => [warning.worker_id, warning]));
    const generatedWarnings = rowsToSave.flatMap((row) => {
      const warning = warningsByWorker.get(row.worker.worker_id);
      if (!warning || !row.present) return [];
      const labels = attendanceWarningLabels(warning);
      return labels.length ? [{ workerName: row.worker.name ?? "Worker", text: labels.join("; ") }] : [];
    });
    const auditReason = needsPhotoException ? reason.trim() : labourAuditReasonForSave(workDate, new Date(), oldRecordEdited, reason);
    const { data, error } = await supabase.rpc("save_labour_attendance", { p_project_id: projectId, p_work_date: workDate, p_rows: payload, p_reason: auditReason });
    setSaving(false);
    if (error) { setWarnings(generatedWarnings); toast.error(error.message); return; }
    toast.success(`Attendance saved for ${format(parseISO(workDate), "dd/MM/yyyy")}.`);
    await loadDay();
    setWarnings(generatedWarnings);
    if (Number(data ?? 0) === 0) toast.message("No attendance values changed.");
  };

  const confirmHours = async (items: Array<{ worker_id: string; hours: number }>) => {
    if (!projectId || items.length === 0) return;
    if (items.some((i) => !isValidLabourHours(i.hours))) { toast.error("Hours must be between 0 and 16."); return; }
    setConfirming(true);
    const { data, error } = await supabase.rpc("confirm_labour_hours", { p_project_id: projectId, p_work_date: workDate, p_rows: items });
    setConfirming(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Hours confirmed for ${Number(data ?? 0)} worker${Number(data) === 1 ? "" : "s"}.`);
    await loadDay();
  };

  const presentSaved = visibleWorkers.map((w) => rows[w.worker_id]).filter((r): r is AttendanceRow => Boolean(r && r.savedHours && r.savedHours > 0));
  const unconfirmed = presentSaved.filter((r) => !r.confirmed);

  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="labour-project">Project</Label><Select value={projectId ?? ""} onValueChange={(value) => onProjectChange(value || null)}><SelectTrigger id="labour-project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="labour-date">Work date</Label><Input id="labour-date" inputMode="numeric" maxLength={10} placeholder="DD/MM/YYYY" value={dateText} onChange={(event) => { const value = event.target.value; setDateText(value); const parsed = parseLabourDateInput(value); if (parsed) setWorkDate(parsed); }} onBlur={() => { if (!parseLabourDateInput(dateText)) setDateText(format(parseISO(workDate), "dd/MM/yyyy")); }} /></div>
      </div>

      {projectId && locationBlocks && <p role="alert" className="text-sm text-destructive">{pinProject !== projectId ? "Checking site location…" : SITE_LOCATION_MISSING}</p>}

      {projectId && <section className="space-y-3 rounded-md border border-border p-3" aria-label="Toolbox talk photo">
        <h2 className="font-display text-base font-semibold">Step 1 · Toolbox talk photo</h2>
        <p className="text-xs text-muted-foreground">Take at least 1 photo (up to 3) live with the camera during the toolbox talk. GPS is required.</p>
        {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((ph) => <figure key={ph.id} className="min-w-0 space-y-1">
          <div className="aspect-video overflow-hidden rounded bg-muted">{ph.url ? <img src={ph.url} alt="Toolbox talk" className="h-full w-full object-cover" /> : null}</div>
          <figcaption className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">{format(new Date(ph.captured_at), "HH:mm")}
            {ph.flags?.far_from_site ? <Badge variant="destructive" className="px-1 text-[10px]">Far from site</Badge> : null}
            {ph.flags?.low_accuracy ? <Badge variant="outline" className="px-1 text-[10px]">Low GPS accuracy</Badge> : null}
          </figcaption>
        </figure>)}</div>}
        {canEdit && !locationBlocks && isToday && photos.length < 3 && <ToolboxCamera projectName={projectName} onCaptured={onCaptured} />}
        {!isToday && !hasPhoto && <p className="text-sm text-muted-foreground break-words">No toolbox talk photo was taken on this day. Photos can only be taken on the day itself.{canException ? " You can still record attendance with a reason (logged as an exception)." : " Ask the Head of Projects to record it as an exception."}</p>}
      </section>}

      {projectId && <h2 className="font-display text-base font-semibold">Step 2 · Mark workers</h2>}
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search workers" placeholder="Search workers to add" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {!projectId ? <p className="py-8 text-center text-sm text-muted-foreground">Select a project to record contract-labour attendance.</p> : visibleWorkers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No recent workers. Search to add an active worker.</p> : (
        <div className="space-y-2">
          {visibleWorkers.map((worker) => {
            const row = rows[worker.worker_id];
            if (!row) return null;
            return <div key={worker.worker_id} className="flex min-w-0 flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid="attendance-row">
              <div className="min-w-0"><div className="break-words font-medium">{worker.name}</div><div className="break-words text-xs text-muted-foreground">{worker.worker_code} · {worker.contractor ?? "No contractor"} · {worker.skill_type}</div>
                <div className="mt-1 flex flex-wrap gap-1">{worker.status !== "active" && <Badge variant="outline">{worker.status?.replace(/_/g, " ")}</Badge>}{row.exception && <Badge variant="outline" className="border-warning text-warning">No photo · exception</Badge>}</div></div>
              <div className="grid shrink-0 grid-cols-2 gap-2" role="group" aria-label={`Attendance for ${worker.name ?? "worker"}`}>
                <Button size="sm" variant={row.present ? "default" : "outline"} disabled={!canEdit || photoGateBlocks} onClick={() => updateRow(worker.worker_id, { present: true })}>Present</Button>
                <Button size="sm" variant={!row.present ? "secondary" : "outline"} disabled={!canEdit || photoGateBlocks} onClick={() => updateRow(worker.worker_id, { present: false })}>Absent</Button>
              </div>
            </div>;
          })}
        </div>
      )}
      {projectId && searchCandidates.length > 0 && <div className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">Add workers</p>{searchCandidates.slice(0, 30).map((worker) => <div key={worker.worker_id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><div className="break-words text-sm font-medium">{worker.name}</div><div className="break-words text-xs text-muted-foreground">{worker.worker_code} · {worker.contractor ?? "No contractor"} · {worker.skill_type}</div></div><Button size="sm" variant="outline" onClick={() => addVisibleWorker(worker)}>Add</Button></div>)}</div>}
      {canEdit && projectId && <div className="space-y-3 border-t border-border pt-3">
        {(needsPhotoException && canException || workDate < format(subDays(new Date(), 2), "yyyy-MM-dd") || Object.values(rows).some((row) => requiresReasonForSavedAttendanceEdit(row.savedHours, row.present ? (row.savedHours && row.savedHours > 0 ? row.savedHours : standardHours) : 0))) && <div className="space-y-1.5"><Label htmlFor="attendance-reason">{needsPhotoException ? "Reason for recording without a toolbox talk photo (min 10 characters)" : "Reason for back-dating or editing"}</Label><Input id="attendance-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this being recorded late or changed?" /></div>}
        <p className="text-xs text-muted-foreground">Present workers get the standard shift of {standardHours} hours. Confirm actual hours in the evening below.</p>
        <div className="flex justify-end"><Button onClick={saveAttendance} disabled={saving || !projectId || photoGateBlocks} className="w-full sm:w-auto">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save attendance</Button></div>
      </div>}

      {projectId && presentSaved.length > 0 && <section className="space-y-2 border-t border-border pt-3" aria-label="Evening hours">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><h2 className="font-display text-base font-semibold">Evening · Confirm hours</h2>
          {canEdit && unconfirmed.length > 0 && <Button size="sm" variant="outline" disabled={confirming} onClick={() => void confirmHours(unconfirmed.map((r) => ({ worker_id: r.worker.worker_id, hours: standardHours })))}>Confirm all at standard hours</Button>}</div>
        {presentSaved.map((row) => {
          const rate = Number(row.worker.effective_hourly_rate ?? 0);
          return <div key={row.worker.worker_id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_96px_120px_auto] sm:items-end" data-testid="hours-row">
            <div className="col-span-2 min-w-0 sm:col-span-1"><div className="break-words font-medium">{row.worker.name}</div><div className="text-xs text-muted-foreground">{row.confirmed ? "Hours confirmed" : "Not confirmed yet"}</div></div>
            <div className="space-y-1"><Label className="text-xs" htmlFor={`eh-${row.worker.worker_id}`}>Hours</Label><Input id={`eh-${row.worker.worker_id}`} type="number" min={0} max={16} step="0.5" value={row.eveningHours} disabled={!canEdit} onChange={(e) => updateRow(row.worker.worker_id, { eveningHours: Number(e.target.value) })} /></div>
            <div className="min-w-0 text-xs text-muted-foreground">Amount <span className="block break-words font-semibold text-foreground">{inr(row.eveningHours * rate)}</span></div>
            {canEdit && <Button size="sm" className="col-span-2 sm:col-span-1" variant={row.confirmed ? "outline" : "default"} disabled={confirming} onClick={() => void confirmHours([{ worker_id: row.worker.worker_id, hours: row.eveningHours }])}>Confirm hours</Button>}
          </div>;
        })}
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-muted p-3 text-sm font-semibold"><span>Day total</span><span className="break-words">{inr(presentSaved.reduce((sum, r) => sum + r.eveningHours * Number(r.worker.effective_hourly_rate ?? 0), 0))}</span></div>
      </section>}

      {warnings.length > 0 && <div className="space-y-2">{warnings.map((warning, index) => <Alert key={`${warning.workerName}-${index}`}><AlertTriangle className="h-4 w-4" /><AlertTitle>{warning.workerName}</AlertTitle><AlertDescription>{warning.text}</AlertDescription></Alert>)}</div>}
      {!canEdit && <p className="text-sm text-muted-foreground">Read-only access</p>}
    </div>
  );
}

function MasterTab({ workers, canUpload, canViewRates, onUploaded }: { workers: LabourWorker[]; canUpload: boolean; canViewRates: boolean; onUploaded: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [pendingRows, setPendingRows] = useState<LabourMasterImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const visibleRows = useMemo(() => workers.filter((worker) => `${worker.worker_code ?? ""} ${worker.name ?? ""} ${worker.contractor ?? ""} ${worker.skill_type ?? ""} ${worker.status ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [workers, search]);

  const downloadWorkbook = (rows: Array<Array<string | number | null | undefined>>, fileName: string) => {
    const sheet = XLSX.utils.aoa_to_sheet([MASTER_HEADERS, ...rows]);
    sheet["!cols"] = [{ wch: 16 }, { wch: 26 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Labour Master");
    XLSX.writeFile(workbook, fileName);
  };

  const downloadTemplate = () => downloadWorkbook([
    ["LW-EXAMPLE", "Example worker — replace or remove", "", "Example skill", "", "", "active"],
  ], "Labour_Master_Template.xlsx");

  const downloadCurrent = async () => {
    setBusy(true);
    const query = canViewRates
      ? supabase.from("labour_worker_rates").select("worker_code,name,contractor,skill_type,hourly_rate,monthly_salary,status").order("worker_code")
      : supabase.from("labour_worker_directory").select("worker_code,name,contractor,skill_type,status").order("worker_code");
    const { data, error } = await query;
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const exportRows = (data ?? []) as Array<Record<string, string | number | null>>;
    const rows = canViewRates
      ? exportRows.map((worker) => [worker.worker_code, worker.name, worker.contractor, worker.skill_type, worker.hourly_rate, worker.monthly_salary, worker.status])
      : exportRows.map((worker) => [worker.worker_code, worker.name, worker.contractor, worker.skill_type, "", "", worker.status]);
    downloadWorkbook(rows, "Labour_Master_Current.xlsx");
  };

  const processFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    setPendingRows([]);
    setPreviewCount(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
      const sheet = workbook.Sheets["Labour Master"] ?? workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("The workbook needs a Labour Master sheet.");
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
      const parsedRows = rowsFromLabourMasterSheet(grid);
      if (parsedRows.length === 0) throw new Error("No worker rows were found.");
      const validation = validateLabourMasterRows(parsedRows, workers, [...new Set(workers.map((worker) => worker.contractor).filter((name): name is string => Boolean(name)))]);
      setErrors(validation.errors);
      setPendingRows(validation.prepared);
      setPreviewCount(parsedRows.length);
      toast.success(`Dry run complete: ${parsedRows.length} rows checked.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Could not read this workbook."]);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const commitUpload = async () => {
    if (errors.length || !pendingRows.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("commit_labour_master_upload", { p_rows: pendingRows as unknown as import("@/integrations/supabase/types").Json });
    setBusy(false);
    if (error) { toast.error(error.message); setErrors([error.message]); return; }
    toast.success(`${Number(data ?? 0)} worker rows saved.`);
    setPendingRows([]);
    setPreviewCount(null);
    await onUploaded();
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={downloadCurrent} disabled={busy}><Download className="mr-2 h-4 w-4" />Download Current Master</Button>
        {canUpload && <>
          <Button variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="mr-2 h-4 w-4" />Download Template</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="mr-2 h-4 w-4" />Upload Master</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void processFile(event.target.files?.[0])} aria-label="Upload labour master workbook" />
        </>}
      </div>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search labour master" placeholder="Search code, worker, contractor, skill, status" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {previewCount !== null && <div className="space-y-3 rounded-md border border-border p-3" role="status">
        <p className="font-medium">Dry run: {previewCount} rows checked · {pendingRows.length} ready to save · {errors.length} errors</p>
        {errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{errors.map((error, index) => <li key={`${error}-${index}`} className="break-words">{error}</li>)}</ul>}
        <div className="flex flex-wrap gap-2"><Button onClick={commitUpload} disabled={busy || errors.length > 0 || pendingRows.length === 0}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Commit upload</Button><Button variant="outline" onClick={() => { setPreviewCount(null); setErrors([]); setPendingRows([]); }}>Cancel</Button></div>
      </div>}
      {errors.length > 0 && previewCount === null && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Upload not ready</AlertTitle><AlertDescription><ul className="list-disc space-y-1 pl-5">{errors.map((error, index) => <li key={`${error}-${index}`} className="break-words">{error}</li>)}</ul></AlertDescription></Alert>}
      <div className="space-y-2">
        {visibleRows.map((worker) => {
          const hourlyRate = Number(worker.effective_hourly_rate ?? 0);
          return <div key={worker.worker_id} className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center">
            <div className="col-span-2 min-w-0 sm:col-span-1"><div className="break-words font-medium">{worker.name}</div><div className="break-words text-xs text-muted-foreground">{worker.worker_code}</div></div>
            <div className="min-w-0"><div className="text-[11px] text-muted-foreground">Contractor</div><div className="break-words text-sm">{worker.contractor ?? "—"}</div></div>
            <div className="min-w-0"><div className="text-[11px] text-muted-foreground">Skill</div><div className="break-words text-sm">{worker.skill_type ?? "—"}</div></div>
            {canViewRates && <div className="min-w-0"><div className="text-[11px] text-muted-foreground">Rate / hour</div><div className="break-words text-sm">{inr(hourlyRate)}</div></div>}
            <div className="min-w-0"><div className="text-[11px] text-muted-foreground">Status</div><Badge variant={worker.status === "active" ? "secondary" : "outline"}>{worker.status?.replace(/_/g, " ") ?? "—"}</Badge></div>
          </div>;
        })}
        {visibleRows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No workers match this search.</p>}
      </div>
      {canUpload && <p className="text-xs text-muted-foreground">Upload changes are applied only after a successful dry run. Missing rows are retained; status changes record who made the change and when.</p>}
    </div>
  );
}