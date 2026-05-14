import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  project: any;
  projectId: string;
}

// ---------------------------------------------------------------------------
// Helper: parse DD/MM/YYYY → YYYY-MM-DD
// ---------------------------------------------------------------------------
function parseDDMMYYYY(s: string): string | null {
  if (!s) return null;
  const parts = String(s).trim().split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helper: convert a serial Excel date or a string to YYYY-MM-DD
// ---------------------------------------------------------------------------
function excelDateOrString(val: any): string | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = String(date.d).padStart(2, "0");
      const m = String(date.m).padStart(2, "0");
      return `${date.y}-${m}-${d}`;
    }
  }
  return parseDDMMYYYY(String(val));
}

// ---------------------------------------------------------------------------
// Sheet definitions for template generation
// ---------------------------------------------------------------------------
const PROJECT_DETAIL_LABELS = [
  "Project Name",
  "Client Name",
  "Client Phone",
  "Client Email",
  "Location",
  "Type",
  "Construction Type",
  "Contract Value (₹)",
  "Start Date (DD/MM/YYYY)",
  "Est. Completion (DD/MM/YYYY)",
  "Tender Margin %",
  "GFC Budget (₹)",
];

const BOQ_HEADERS = [
  "S.No",
  "Category",
  "Item Description",
  "Unit",
  "Tender Qty",
  "Actual Qty",
  "Wastage %",
  "BOQ Qty",
  "Material Rate (₹)",
  "Labour Rate (₹)",
  "OH Rate (₹)",
  "BOQ Rate (₹)",
  "Total Amount (₹)",
  "Margin %",
  "Scope",
];

const SCHEDULE_HEADERS = [
  "Stage #",
  "Task ID",
  "Task Name",
  "Task Type",
  "Duration (days)",
  "Predecessors",
  "Planned Start",
  "Planned Finish",
  "Responsible Role",
  "Notes",
];

// ---------------------------------------------------------------------------
// Download template
// ---------------------------------------------------------------------------
async function downloadTemplate(projectName: string) {
  const wb = XLSX.utils.book_new();

  // Sheet 1 – Project Details
  const sheet1Data: any[][] = PROJECT_DETAIL_LABELS.map((label) => [label, ""]);
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1["!cols"] = [{ wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Project Details");

  // Sheet 2 – BOQ + Margin
  const ws2 = XLSX.utils.aoa_to_sheet([BOQ_HEADERS]);
  ws2["!cols"] = BOQ_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws2, "BOQ + Margin");

  // Sheet 3 – Schedule
  const ws3 = XLSX.utils.aoa_to_sheet([SCHEDULE_HEADERS]);
  ws3["!cols"] = SCHEDULE_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws3, "Schedule");

  // Sheet 4 – Material Procurement Plan
  const ws4 = XLSX.utils.aoa_to_sheet([BOQ_HEADERS]);
  ws4["!cols"] = BOQ_HEADERS.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws4, "Material Procurement Plan");

  XLSX.writeFile(wb, `Project_Setup_Template_${projectName.replace(/\s+/g, "_")}.xlsx`);
}

// ---------------------------------------------------------------------------
// Sheet parsers
// ---------------------------------------------------------------------------
function parseProjectDetails(ws: XLSX.WorkSheet): Record<string, string> {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const result: Record<string, string> = {};
  rows.forEach((row) => {
    if (row[0] != null && row[1] != null) {
      result[String(row[0]).trim()] = String(row[1]).trim();
    }
  });
  return result;
}

function parseTableSheet(ws: XLSX.WorkSheet): string[][] {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
  // skip header row (index 0), return remaining non-empty rows
  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell != null && cell !== ""))
    .map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}

// ---------------------------------------------------------------------------
// Status types
// ---------------------------------------------------------------------------
type SheetStatus = "idle" | "parsing" | "writing" | "done" | "error";

interface SheetState {
  status: SheetStatus;
  error?: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProjectSetupUpload({ project, projectId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sheets, setSheets] = useState<Record<string, SheetState>>({
    details: { status: "idle" },
    boq: { status: "idle" },
    schedule: { status: "idle" },
    material: { status: "idle" },
  });

  function setSheetState(key: string, state: Partial<SheetState>) {
    setSheets((prev) => ({ ...prev, [key]: { ...prev[key], ...state } }));
  }

  // -------------------------------------------------------------------------
  // Handle file upload
  // -------------------------------------------------------------------------
  async function handleFile(file: File) {
    if (!file.name.endsWith(".xlsx")) {
      toast.error("Please upload a .xlsx file");
      return;
    }

    setUploading(true);
    setSheets({
      details: { status: "parsing" },
      boq: { status: "idle" },
      schedule: { status: "idle" },
      material: { status: "idle" },
    });

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: false });

      const sheetNames = wb.SheetNames;

      // ------------------------------------------------------------------
      // Sheet 1: Project Details
      // ------------------------------------------------------------------
      const ws1 = wb.Sheets[sheetNames[0]];
      if (!ws1) throw new Error("Sheet 1 (Project Details) not found");

      setSheetState("details", { status: "parsing" });
      const details = parseProjectDetails(ws1);

      setSheetState("details", { status: "writing" });

      const startDate = parseDDMMYYYY(details["Start Date (DD/MM/YYYY)"]);
      const endDate = parseDDMMYYYY(details["Est. Completion (DD/MM/YYYY)"]);

      const updatePayload: any = {
        name: details["Project Name"] || project.name,
        client_name: details["Client Name"] || null,
        client_phone: details["Client Phone"] || null,
        client_email: details["Client Email"] || null,
        location: details["Location"] || null,
        type: details["Type"] || null,
        construction_type: details["Construction Type"] || null,
        contract_value: details["Contract Value (₹)"]
          ? Number(details["Contract Value (₹)"].replace(/,/g, ""))
          : null,
        start_date: startDate,
        estimated_completion: endDate,
        tender_margin_pct: details["Tender Margin %"]
          ? Number(details["Tender Margin %"])
          : null,
        gfc_budget: details["GFC Budget (₹)"]
          ? Number(details["GFC Budget (₹)"].replace(/,/g, ""))
          : null,
      };

      const { error: projErr } = await (supabase.from("projects") as any)
        .update(updatePayload)
        .eq("id", projectId);

      if (projErr) throw new Error(`Project Details: ${projErr.message}`);
      setSheetState("details", { status: "done", count: 1 });

      // ------------------------------------------------------------------
      // Sheet 2: BOQ + Margin
      // ------------------------------------------------------------------
      const ws2 = wb.Sheets[sheetNames[1]];
      if (ws2) {
        setSheetState("boq", { status: "parsing" });
        const boqRows = parseTableSheet(ws2);

        setSheetState("boq", { status: "writing" });

        // Delete existing
        await (supabase.from("material_plan_items") as any)
          .delete()
          .eq("project_id", projectId)
          .eq("status", "planned")
          .neq("source", "material_plan");

        if (boqRows.length > 0) {
          const boqInserts = boqRows.map((col) => ({
            project_id: projectId,
            category: col[1] || null,
            material_name: col[2] || null,
            unit: col[3] || null,
            quantity: col[7] ? Number(col[7]) || 0 : 0,
            status: "planned",
            tender_qty: col[4] ? Number(col[4]) || null : null,
            boq_qty: col[7] ? Number(col[7]) || null : null,
            material_rate: col[8] ? Number(col[8]) || null : null,
            labour_rate: col[9] ? Number(col[9]) || null : null,
            oh_rate: col[10] ? Number(col[10]) || null : null,
            boq_rate: col[11] ? Number(col[11]) || null : null,
            total_amount: col[12] ? Number(col[12]) || null : null,
            margin_pct: col[13] ? Number(col[13]) || null : null,
            scope: col[14] || null,
          }));

          const { error: boqErr } = await (supabase.from("material_plan_items") as any)
            .insert(boqInserts);
          if (boqErr) throw new Error(`BOQ + Margin: ${boqErr.message}`);
        }
        setSheetState("boq", { status: "done", count: boqRows.length });
      } else {
        setSheetState("boq", { status: "done", count: 0 });
      }

      // ------------------------------------------------------------------
      // Sheet 3: Schedule
      // ------------------------------------------------------------------
      const ws3 = wb.Sheets[sheetNames[2]];
      if (ws3) {
        setSheetState("schedule", { status: "parsing" });
        const schedRows = parseTableSheet(ws3);

        setSheetState("schedule", { status: "writing" });

        // Delete existing
        await (supabase.from("project_tasks" as any) as any)
          .delete()
          .eq("project_id", projectId);

        if (schedRows.length > 0) {
          const schedInserts = schedRows.map((col) => ({
            project_id: projectId,
            stage_number: col[0] || null,
            task_id: col[1] || null,
            task_name: col[2] || null,
            task_type: col[3] || null,
            duration_days: Number(col[4]) || 0,
            predecessors: col[5] || null,
            planned_start: excelDateOrString(col[6]),
            planned_finish: excelDateOrString(col[7]),
            responsible_role: col[8] || null,
            notes: col[9] || null,
          }));

          const { error: schedErr } = await (supabase.from("project_tasks" as any) as any)
            .insert(schedInserts);
          if (schedErr) throw new Error(`Schedule: ${schedErr.message}`);
        }
        setSheetState("schedule", { status: "done", count: schedRows.length });
      } else {
        setSheetState("schedule", { status: "done", count: 0 });
      }

      // ------------------------------------------------------------------
      // Sheet 4: Material Procurement Plan
      // ------------------------------------------------------------------
      const ws4 = wb.Sheets[sheetNames[3]];
      if (ws4) {
        setSheetState("material", { status: "parsing" });

        // Check if BOQ sheet already uploaded items (count > 0)
        const { count: boqCount } = await (supabase.from("material_plan_items") as any)
          .select("id", { count: "exact", head: true })
          .eq("project_id", projectId)
          .neq("source", "material_plan");

        if ((boqCount ?? 0) > 0) {
          setSheetState("material", {
            status: "done",
            count: 0,
            error: "Skipped — BOQ sheet already uploaded items for this project.",
          });
        } else {
          const matRows = parseTableSheet(ws4);
          setSheetState("material", { status: "writing" });

          // Delete existing material_plan items
          await (supabase.from("material_plan_items") as any)
            .delete()
            .eq("project_id", projectId)
            .eq("source", "material_plan");

          if (matRows.length > 0) {
            const matInserts = matRows.map((col) => ({
              project_id: projectId,
              category: col[1] || null,
              material_name: col[2] || null,
              unit: col[3] || null,
              quantity: col[7] ? Number(col[7]) || 0 : 0,
              status: "planned",
              source: "material_plan",
              tender_qty: col[4] ? Number(col[4]) || null : null,
              boq_qty: col[7] ? Number(col[7]) || null : null,
              material_rate: col[8] ? Number(col[8]) || null : null,
              labour_rate: col[9] ? Number(col[9]) || null : null,
              oh_rate: col[10] ? Number(col[10]) || null : null,
              boq_rate: col[11] ? Number(col[11]) || null : null,
              total_amount: col[12] ? Number(col[12]) || null : null,
              margin_pct: col[13] ? Number(col[13]) || null : null,
              scope: col[14] || null,
            }));

            const { error: matErr } = await (supabase.from("material_plan_items") as any)
              .insert(matInserts);
            if (matErr) throw new Error(`Material Plan: ${matErr.message}`);
          }
          setSheetState("material", { status: "done", count: matRows.length });
        }
      } else {
        setSheetState("material", { status: "done", count: 0 });
      }

      toast.success("Project setup file uploaded successfully!");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // -------------------------------------------------------------------------
  // UI helpers
  // -------------------------------------------------------------------------
  function SheetStatusIcon({ state }: { state: SheetState }) {
    if (state.status === "parsing" || state.status === "writing") {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (state.status === "done") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (state.status === "error") {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
  }

  function sheetLabel(state: SheetState): string {
    if (state.status === "parsing") return "Parsing…";
    if (state.status === "writing") return "Writing to database…";
    if (state.status === "done") {
      const base = state.count != null ? `${state.count} rows written` : "Done";
      return state.error ? `${base} (${state.error})` : base;
    }
    if (state.status === "error") return state.error ?? "Error";
    return "Waiting";
  }

  const isActive = uploading;
  const anyStarted = Object.values(sheets).some((s) => s.status !== "idle");

  return (
    <div className="bg-card rounded-lg p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm text-foreground">Project Setup Template</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Download the 4-sheet template, fill it in, then upload to populate your project data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadTemplate(project?.name ?? "Project")}
            disabled={isActive}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download Template
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isActive}
          >
            {isActive ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5 mr-1" />
            )}
            Upload Setup File
          </Button>
        </div>
      </div>

      {anyStarted && (
        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
          {[
            { key: "details", label: "Sheet 1: Project Details" },
            { key: "boq", label: "Sheet 2: BOQ + Margin" },
            { key: "schedule", label: "Sheet 3: Schedule" },
            { key: "material", label: "Sheet 4: Material Procurement Plan" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <SheetStatusIcon state={sheets[key]} />
              <span className="font-medium text-foreground w-48 shrink-0">{label}</span>
              <span className="text-muted-foreground text-xs">{sheetLabel(sheets[key])}</span>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleFile(file);
            // Reset so the same file can be re-uploaded
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}
