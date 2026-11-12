import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rowsFromLabourMasterSheet, validateLabourMasterRows, type LabourMasterImportRow } from "@/lib/labour-master-excel";
import { attendanceWarningLabels, isValidLabourHours, LABOUR_ATTENDANCE_ROLES, LABOUR_MASTER_UPLOAD_ROLES, LABOUR_RATE_VIEW_ROLES, LABOUR_SCREEN_ROLES, requiresLabourAttendanceReason, requiresReasonForSavedAttendanceEdit } from "@/lib/labour-rules";
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
};

type StoredAttendance = { id: string; worker_id: string; hours: number; work_date: string };
type AttendanceWarning = { worker_id: string; has_other_project: boolean; total_hours: number; is_deactivated: boolean };

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);

export default function LabourPage() {
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { role } = useUserRole();
  const [tab, setTab] = useState("attendance");
  const [workers, setWorkers] = useState<LabourWorker[]>([]);
  const [rates, setRates] = useState<LabourWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const canManageAttendance = LABOUR_ATTENDANCE_ROLES.includes(role as (typeof LABOUR_ATTENDANCE_ROLES)[number]);
  const canUploadMaster = LABOUR_MASTER_UPLOAD_ROLES.includes(role as (typeof LABOUR_MASTER_UPLOAD_ROLES)[number]);
  const canViewMaster = LABOUR_SCREEN_ROLES.includes(role as (typeof LABOUR_SCREEN_ROLES)[number]);
  const canViewRates = LABOUR_RATE_VIEW_ROLES.includes(role as (typeof LABOUR_RATE_VIEW_ROLES)[number]);

  useEffect(() => {
    if (!canManageAttendance) setTab("master");
  }, [canManageAttendance]);

  const loadMaster = useCallback(async () => {
    if (!canViewMaster) return;
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

  if (!canViewMaster) {
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
        {canManageAttendance ? <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="attendance">Attendance</TabsTrigger><TabsTrigger value="master">Master</TabsTrigger></TabsList> : <TabsList className="grid w-full grid-cols-1"><TabsTrigger value="master">Master</TabsTrigger></TabsList>}
        {canManageAttendance && <TabsContent value="attendance"><AttendanceTab
          workers={directory}
          projects={projects}
          projectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          canEdit={canManageAttendance}
        /></TabsContent>}
        <TabsContent value="master"><MasterTab workers={directory} canUpload={canUploadMaster} canViewRates={canViewRates} onUploaded={loadMaster} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AttendanceTab({ workers, projects, projectId, onProjectChange, canEdit }: {
  workers: LabourWorker[];
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  onProjectChange: (id: string | null) => void;
  canEdit: boolean;
}) {
  const [workDate, setWorkDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, AttendanceRow>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<Array<{ workerName: string; text: string }>>([]);
  const loadDay = useCallback(async () => {
    setWarnings([]);
    setReason("");
    if (!projectId) { setRecentIds([]); setRows({}); return; }
    const recentFrom = format(subDays(parseISO(workDate), 13), "yyyy-MM-dd");
    const [{ data: daily }, { data: recent }] = await Promise.all([
      supabase.from("labour_attendance").select("id,worker_id,hours,work_date").eq("project_id", projectId).eq("work_date", workDate),
      supabase.from("labour_attendance").select("worker_id,work_date").eq("project_id", projectId).gte("work_date", recentFrom).lte("work_date", workDate).gt("hours", 0).order("work_date", { ascending: false }),
    ]);
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
      initialRows[id] = {
        worker,
        present: record ? Number(record.hours) > 0 : false,
        hours: record && Number(record.hours) > 0 ? Number(record.hours) : 8,
        savedHours: record ? Number(record.hours) : null,
      };
    });
    setRows(initialRows);
  }, [projectId, workDate, workers]);

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
    return workers.filter((worker) => !rows[worker.worker_id] &&
      `${worker.worker_code ?? ""} ${worker.name ?? ""} ${worker.contractor ?? ""} ${worker.skill_type ?? ""}`.toLowerCase().includes(normalizedSearch));
  }, [workers, rows, search]);

  const addVisibleWorker = (worker: LabourWorker) => setRows((current) => current[worker.worker_id] ? current : ({
    ...current,
    [worker.worker_id]: { worker, present: false, hours: 8, savedHours: null },
  }));

  const updateRow = (id: string, patch: Partial<AttendanceRow>) => setRows((current) => ({
    ...current,
    [id]: { ...current[id], ...patch },
  }));

  const saveAttendance = async () => {
    if (!projectId) { toast.error("Choose a project first."); return; }
    const selectedRows = Object.values(rows);
    if (selectedRows.some((row) => !isValidLabourHours(row.hours))) {
      toast.error("Hours must be between 0 and 16."); return;
    }
    const oldRecordEdited = selectedRows.some((row) => requiresReasonForSavedAttendanceEdit(row.savedHours, row.present ? row.hours : 0));
    if (requiresLabourAttendanceReason(workDate, new Date()) && !reason.trim()) {
      toast.error("Add a reason for attendance more than two days ago."); return;
    }
    if (oldRecordEdited && !reason.trim()) {
      toast.error("Add a reason for changing saved attendance."); return;
    }
    const rowsToSave = selectedRows.filter((row) => row.present || row.savedHours !== null);
    const payload = rowsToSave.map((row) => ({ worker_id: row.worker.worker_id, hours: row.present ? row.hours : 0 }));
    setSaving(true);
    const { data: warningRows, error: warningError } = await supabase.rpc("get_labour_attendance_warnings", {
      p_project_id: projectId,
      p_work_date: workDate,
      p_rows: payload,
    });
    if (warningError) {
      setSaving(false);
      toast.error(warningError.message);
      return;
    }
    const warningsByWorker = new Map(((warningRows ?? []) as AttendanceWarning[]).map((warning) => [warning.worker_id, warning]));
    const generatedWarnings = rowsToSave.flatMap((row) => {
      const warning = warningsByWorker.get(row.worker.worker_id);
      if (!warning || !row.present) return [];
      const labels = attendanceWarningLabels(warning);
      return labels.length ? [{ workerName: row.worker.name ?? "Worker", text: labels.join("; ") }] : [];
    });
    const { data, error } = await supabase.rpc("save_labour_attendance", {
      p_project_id: projectId,
      p_work_date: workDate,
      p_rows: payload,
      p_reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) { setWarnings(generatedWarnings); toast.error(error.message); return; }
    toast.success(`Attendance saved for ${format(parseISO(workDate), "dd/MM/yyyy")}.`);
    await loadDay();
    setWarnings(generatedWarnings);
    if (Number(data ?? 0) === 0) toast.message("No attendance values changed.");
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="labour-project">Project</Label><Select value={projectId ?? ""} onValueChange={(value) => onProjectChange(value || null)}><SelectTrigger id="labour-project"><SelectValue placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="labour-date">Work date</Label><Input id="labour-date" type="date" max={todayISO()} value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Selected date: {format(parseISO(workDate), "dd/MM/yyyy")}</p>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" aria-label="Search workers" placeholder="Search workers to add" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      {!projectId ? <p className="py-8 text-center text-sm text-muted-foreground">Select a project to record contract-labour attendance.</p> : visibleWorkers.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No recent workers. Search to add an active worker.</p> : (
        <div className="space-y-2">
          {visibleWorkers.map((worker) => {
            const row = rows[worker.worker_id] ?? { worker, present: false, hours: 8, savedHours: null };
            const hourlyRate = Number(worker.effective_hourly_rate ?? 0);
            return <div key={worker.worker_id} className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-3 rounded-md border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_120px_140px] sm:items-center">
              <div className="flex items-center gap-2"><Switch checked={row.present} disabled={!canEdit} onCheckedChange={(checked) => updateRow(worker.worker_id, { present: checked })} aria-label={`Present: ${worker.name ?? "worker"}`} /></div>
              <div className="min-w-0"><div className="break-words font-medium">{worker.name}</div><div className="break-words text-xs text-muted-foreground">{worker.worker_code} · {worker.contractor ?? "No contractor"} · {worker.skill_type}</div>{worker.status !== "active" && <Badge variant="outline" className="mt-1">{worker.status?.replace(/_/g, " ")}</Badge>}</div>
              <div className="space-y-1"><Label className="text-xs" htmlFor={`hours-${worker.worker_id}`}>Hours</Label><Input id={`hours-${worker.worker_id}`} type="number" min={0} max={16} step="0.5" value={row.hours} disabled={!canEdit || !row.present} onChange={(event) => updateRow(worker.worker_id, { hours: Number(event.target.value) })} /></div>
              <div className="text-xs text-muted-foreground">Amount <span className="block break-words font-semibold text-foreground">{inr(row.present ? row.hours * hourlyRate / 8 : 0)}</span></div>
            </div>;
          })}
        </div>
      )}
      {projectId && searchCandidates.length > 0 && <div className="space-y-2 border-t border-border pt-3"><p className="text-sm font-medium">Add workers</p>{searchCandidates.slice(0, 30).map((worker) => <div key={worker.worker_id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border p-3"><div className="min-w-0"><div className="break-words text-sm font-medium">{worker.name}</div><div className="break-words text-xs text-muted-foreground">{worker.worker_code} · {worker.contractor ?? "No contractor"} · {worker.skill_type}</div></div><Button size="sm" variant="outline" onClick={() => addVisibleWorker(worker)}>Add</Button></div>)}</div>}
      {canEdit && projectId && <div className="space-y-3 border-t border-border pt-3">
        {(workDate < todayISO() || workDate < format(subDays(new Date(), 2), "yyyy-MM-dd") || Object.values(rows).some((row) => requiresReasonForSavedAttendanceEdit(row.savedHours, row.present ? row.hours : 0))) && <div className="space-y-1.5"><Label htmlFor="attendance-reason">Reason for back-dating or editing</Label><Input id="attendance-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for dates over two days old or saved-entry edits" /></div>}
        <div className="flex justify-end"><Button onClick={saveAttendance} disabled={saving || !projectId} className="w-full sm:w-auto">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save attendance</Button></div>
      </div>}
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