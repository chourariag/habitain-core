import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Download, FileSpreadsheet, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  validateProjectSetupRows,
  type ProjectSetupWorkbookRows,
  type SetupSheetRow,
  type SetupValidationResult,
} from "@/lib/project-setup-excel";

const UPLOAD_ROLES = ["planning_head", "managing_director", "super_admin"];
const SHEET_COLUMNS: Record<keyof ProjectSetupWorkbookRows, string[]> = {
  schedule: ["task_code", "task_name", "planned_start", "planned_end", "responsible_role"],
  boq: ["sno", "item_description", "unit", "boq_qty", "boq_rate", "category", "task_code"],
  materials: ["material_description", "unit", "planned_qty", "planned_po_release_date", "planned_delivery_date", "section", "task_code"],
};

type SetupTab = "Schedule" | "BOQ" | "Material Plan";

interface Props {
  projectId: string;
  userRole: string | null;
}

interface HeaderRow {
  id: string;
  version: number;
}

interface UnmappedRow {
  section: string;
  version: number;
  row_key: string;
  description: string;
  unit: string;
}

function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function makeTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheets: Array<[string, string[], Record<string, unknown>]> = [
    ["Schedule", SHEET_COLUMNS.schedule, {
      task_code: "__TEMPLATE_EXAMPLE__",
      task_name: "Example row — replace or remove",
      planned_start: "01/01/2026",
      planned_end: "02/01/2026",
      responsible_role: "planning_head",
    }],
    ["BOQ", SHEET_COLUMNS.boq, {
      sno: 1,
      item_description: "Example row — replace or remove",
      unit: "kg",
      boq_qty: 0,
      boq_rate: 0,
      category: "Example category",
      task_code: "__TEMPLATE_EXAMPLE__",
    }],
    ["Material Plan", SHEET_COLUMNS.materials, {
      material_description: "Example row — replace or remove",
      unit: "kg",
      planned_qty: 0,
      planned_po_release_date: "01/01/2026",
      planned_delivery_date: "02/01/2026",
      section: "Example section",
      task_code: "__TEMPLATE_EXAMPLE__",
    }],
  ];
  for (const [name, columns, example] of sheets) {
    const worksheet = XLSX.utils.json_to_sheet([example], { header: columns });
    XLSX.utils.sheet_add_aoa(worksheet, [columns], { origin: "A1" });
    worksheet["!cols"] = columns.map((column) => ({ wch: Math.max(column.length + 3, 18) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return workbook;
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string, columns: string[]): { rows: SetupSheetRow[]; errors: string[] } {
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return { rows: [], errors: [`Missing “${sheetName}” sheet.`] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: true, blankrows: false });
  const header = (matrix[0] ?? []).map(normalizeHeader);
  const missing = columns.filter((column) => !header.includes(column));
  if (missing.length) return { rows: [], errors: [`${sheetName} sheet is missing columns: ${missing.join(", ")}.`] };
  const indexes = new Map(columns.map((column) => [column, header.indexOf(column)]));
  const dateColumns = new Set(["planned_start", "planned_end", "planned_po_release_date", "planned_delivery_date"]);
  const result = matrix.slice(1).flatMap((values, index) => {
    if (!values.some((value) => String(value ?? "").trim())) return [];
    const mapped: Record<string, unknown> = {};
    for (const column of columns) {
      const value = values[indexes.get(column) ?? -1];
      if (dateColumns.has(column) && typeof value === "number" && Number.isFinite(value)) {
        const excelDate = XLSX.SSF.parse_date_code(value);
        mapped[column] = excelDate ? `${String(excelDate.d).padStart(2, "0")}/${String(excelDate.m).padStart(2, "0")}/${excelDate.y}` : value;
      } else {
        mapped[column] = value;
      }
    }
    return [{ rowNumber: index + 2, values: mapped }];
  });
  return { rows: result, errors: [] };
}

function displayDate(value: string | null | undefined) {
  if (!value) return "—";
  const parts = value.slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}

function currency(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—";
}

function matchesSearch(query: string, values: unknown[]) {
  const needle = query.trim().toLocaleLowerCase();
  return !needle || values.some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
}

export function ProjectSetupWorkbook({ projectId, userRole }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [boqRows, setBoqRows] = useState<any[]>([]);
  const [materialRows, setMaterialRows] = useState<any[]>([]);
  const [unmappedRows, setUnmappedRows] = useState<UnmappedRow[]>([]);
  const [activeTab, setActiveTab] = useState<SetupTab>("Schedule");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<SetupValidationResult | null>(null);
  const [workbookRows, setWorkbookRows] = useState<ProjectSetupWorkbookRows | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [committing, setCommitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = UPLOAD_ROLES.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_project_setup_status", { p_project_id: projectId });
      if (error) throw error;
      const status = data as { tasks?: any[]; boq?: any[]; materials?: any[]; unmapped?: UnmappedRow[] };
      setTasks(status.tasks ?? []);
      setBoqRows(status.boq ?? []);
      setMaterialRows(status.materials ?? []);
      setUnmappedRows(status.unmapped ?? []);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not load project setup data.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const downloadTemplate = () => downloadWorkbook(makeTemplate(), "Project_Setup_Template.xlsx");

  const runDryRun = async () => {
    if (!file) {
      toast.error("Choose a workbook first.");
      return;
    }
    setChecking(true);
    setFileErrors([]);
    setValidation(null);
    setWorkbookRows(null);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const schedule = sheetRows(workbook, "Schedule", SHEET_COLUMNS.schedule);
      const boq = sheetRows(workbook, "BOQ", SHEET_COLUMNS.boq);
      const materials = sheetRows(workbook, "Material Plan", SHEET_COLUMNS.materials);
      const rows = { schedule: schedule.rows, boq: boq.rows, materials: materials.rows };
      const errors = [...schedule.errors, ...boq.errors, ...materials.errors];
      if (rows.schedule.length + rows.boq.length + rows.materials.length === 0) {
        errors.push("The workbook has no data rows.");
      }
      setWorkbookRows(rows);
      setFileErrors(errors);
      const result = validateProjectSetupRows(rows, tasks.map((task) => task.task_id_in_schedule).filter(Boolean));
      setValidation(result);
    } catch (error: any) {
      setFileErrors([error?.message ?? "The workbook could not be read."]);
    } finally {
      setChecking(false);
    }
  };

  const commitUpload = async () => {
    if (!validation || !workbookRows || fileErrors.length || validation.errors.length) return;
    const { schedule, boq, materials } = validation.prepared;
    if (schedule.length + boq.length + materials.length === 0) {
      toast.error("No non-example rows to import.");
      return;
    }
    setCommitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("commit_project_setup_upload_validated", {
        p_project_id: projectId,
        p_schedule_rows: schedule,
        p_boq_rows: boq,
        p_material_rows: materials,
      });
      if (error) throw error;
      const summary = data as { schedule_count: number; boq_count: number; material_count: number };
      toast.success(`Committed: ${summary.schedule_count} Schedule, ${summary.boq_count} BOQ, ${summary.material_count} Material Plan rows.`);
      setFile(null);
      setValidation(null);
      setWorkbookRows(null);
      setFileErrors([]);
      if (fileRef.current) fileRef.current.value = "";
      await fetchData();
    } catch (error: any) {
      toast.error(error?.message ?? "The workbook could not be committed.");
    } finally {
      setCommitting(false);
    }
  };

  const downloadUnmapped = () => {
    const workbook = XLSX.utils.book_new();
    const rows = unmappedRows.map((row) => ({
      table: row.section,
      version: row.version,
      row_key: row.row_key,
      description: row.description,
      unit: row.unit,
      schedule_task_id: "",
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Unmapped");
    downloadWorkbook(workbook, "Project_Setup_Unmapped.xlsx");
  };

  const filteredTasks = useMemo(() => tasks.filter((row) => matchesSearch(search, [row.task_id_in_schedule, row.task_name, row.responsible_role, row.status])), [tasks, search]);
  const filteredBoq = useMemo(() => boqRows.filter((row) => matchesSearch(search, [row.sno, row.item_description, row.category, row.unit, row.task_code, row.task_name])), [boqRows, search]);
  const filteredMaterials = useMemo(() => materialRows.filter((row) => matchesSearch(search, [row.item_id, row.material_description, row.section, row.unit, row.task_code, row.task_name])), [materialRows, search]);
  const unmappedBoqCount = unmappedRows.filter((row) => row.section === "BOQ").length;
  const unmappedMaterialCount = unmappedRows.filter((row) => row.section === "Material Plan").length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-w-0 space-y-4">
      {canUpload && (
        <section className="space-y-3 border-b border-border pb-4" aria-label="Upload project setup workbook">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate} className="max-w-full gap-2">
              <Download className="h-4 w-4 shrink-0" /> Download Template
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setValidation(null);
                setWorkbookRows(null);
                setFileErrors([]);
              }}
              aria-label="Choose project setup workbook"
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="max-w-full gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0" /> Choose Workbook
            </Button>
            <Button onClick={() => void runDryRun()} disabled={!file || checking || committing} className="max-w-full gap-2">
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Validate Workbook
            </Button>
          </div>
          <p className="break-words text-sm text-muted-foreground">{file?.name ?? "No workbook selected. Remove the example row from each sheet before validating."}</p>
          {(validation || fileErrors.length > 0) && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <h3 className="font-medium">Dry run</h3>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <p>Schedule rows: {workbookRows?.schedule.length ?? 0} ({validation?.prepared.schedule.length ?? 0} valid)</p>
                <p>BOQ rows: {workbookRows?.boq.length ?? 0} ({validation?.prepared.boq.length ?? 0} valid)</p>
                <p>Material rows: {workbookRows?.materials.length ?? 0} ({validation?.prepared.materials.length ?? 0} valid)</p>
              </div>
              {(fileErrors.length > 0 || (validation?.errors.length ?? 0) > 0) ? (
                <div className="max-h-64 space-y-1 overflow-y-auto text-sm text-destructive" role="alert">
                  {[...fileErrors, ...(validation?.errors ?? [])].map((error, index) => <p key={`${index}-${error}`} className="break-words">{error}</p>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">No errors found. No data has been written yet.</p>}
              <Button onClick={() => void commitUpload()} disabled={!validation || !workbookRows || fileErrors.length > 0 || validation.errors.length > 0 || committing || checking} className="max-w-full">
                {committing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Commit valid rows
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-medium">BOQ Unmapped ({unmappedBoqCount})</span>
          <span className="font-medium">Material Plan Unmapped ({unmappedMaterialCount})</span>
          {unmappedRows.length > 0 && (
            <Button variant="outline" size="sm" onClick={downloadUnmapped} className="max-w-full gap-2">
              <Download className="h-4 w-4 shrink-0" /> Download list
            </Button>
          )}
        </div>
        {!canUpload && <span className="text-sm text-muted-foreground">Read-only</span>}
      </section>

      <div className="flex min-w-0 flex-wrap gap-2" role="tablist" aria-label="Project setup lists">
        {(["Schedule", "BOQ", "Material Plan"] as SetupTab[]).map((tab) => (
          <Button key={tab} variant={activeTab === tab ? "default" : "outline"} size="sm" onClick={() => setActiveTab(tab)} role="tab" aria-selected={activeTab === tab}>
            {tab}
          </Button>
        ))}
      </div>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeTab.toLowerCase()}`} className="pl-9" aria-label={`Search ${activeTab}`} />
      </div>

      {activeTab === "Schedule" && (
        <div className="min-w-0 divide-y divide-border" role="tabpanel">
          {filteredTasks.map((row) => (
            <article key={row.id} className="min-w-0 space-y-1 py-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-medium">{row.task_name}</p>
                <span className="max-w-full break-all text-xs text-muted-foreground">{row.task_id_in_schedule || "No task code"}</span>
              </div>
              <p className="break-words text-sm text-muted-foreground">{displayDate(row.planned_start_date)} – {displayDate(row.planned_finish_date)} · {row.responsible_role || "Role unassigned"}</p>
              <p className="break-words text-xs text-muted-foreground">{row.status}</p>
            </article>
          ))}
          {filteredTasks.length === 0 && <p className="py-6 text-sm text-muted-foreground">No schedule rows match this search.</p>}
        </div>
      )}

      {activeTab === "BOQ" && (
        <div className="min-w-0 divide-y divide-border" role="tabpanel">
          {filteredBoq.map((row) => (
            <article key={row.id} className="min-w-0 space-y-1 py-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-medium">{row.sno}. {row.item_description}</p>
                <span className="max-w-full break-words text-xs text-muted-foreground">{row.task_name === "—" ? "Unmapped" : `${row.task_code} · ${row.task_name}`}</span>
              </div>
              <p className="break-words text-sm text-muted-foreground">{row.category || "—"} · {row.unit || "—"} · Qty {row.boq_qty} · {currency(row.boq_rate)}</p>
            </article>
          ))}
          {filteredBoq.length === 0 && <p className="py-6 text-sm text-muted-foreground">No BOQ rows match this search.</p>}
        </div>
      )}

      {activeTab === "Material Plan" && (
        <div className="min-w-0 divide-y divide-border" role="tabpanel">
          {filteredMaterials.map((row) => (
            <article key={row.id} className="min-w-0 space-y-1 py-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 break-words font-medium">{row.material_description}</p>
                <span className="max-w-full break-words text-xs text-muted-foreground">{row.task_name === "—" ? "Unmapped" : `${row.task_code} · ${row.task_name}`}</span>
              </div>
              <p className="break-words text-sm text-muted-foreground">{row.section || "—"} · {row.unit || "—"} · Planned qty {row.tender_qty ?? "—"}</p>
              <p className="break-words text-xs text-muted-foreground">PO release {displayDate(row.planned_po_release_date)} · Delivery {displayDate(row.planned_delivery_date)}</p>
            </article>
          ))}
          {filteredMaterials.length === 0 && <p className="py-6 text-sm text-muted-foreground">No Material Plan rows match this search.</p>}
        </div>
      )}
    </div>
  );
}