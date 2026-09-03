import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { fetchRoleHolderName } from "@/hooks/useRoleHolderName";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { EDIT_ROLES } from "@/lib/design-schedule";

/**
 * Design Schedule — Excel download / upload.
 *
 * Deliberately mirrors ProjectSetupUpload's mechanism rather than inventing a
 * second upload system: the shipped template in /public/templates is loaded with
 * ExcelJS so grey (pre-filled) cells keep their styling, Sheet 2 stays blank for
 * the design team, and the upload is parsed with `xlsx` using the same
 * DD/MM/YYYY `parseDate` convention.
 *
 * Rows are matched to `design_stage_definitions.template_row` — never by name —
 * so renaming a stage never silently re-points a row.
 */

type Def = {
  id: string;
  stage_code: string;
  stage_name: string;
  stage_order: number;
  template_row: number | null;
  proof_type: string | null;
  design_schedule_section: string | null;
  combined_gate_codes: string[] | null;
  is_combined_child: boolean;
  is_mandatory: boolean;
};

type Stage = { id: string; stage_definition_id: string; status: string };

const parseDate = (val: any): string | null => {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return format(val, "yyyy-MM-dd");
  if (typeof val === "number") {
    // Excel serial date
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
  }
  const s = String(val).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  const yr = m[3].length === 2 ? "20" + m[3] : m[3];
  const day = Number(m[1]), mon = Number(m[2]);
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return null;
  return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const norm = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function DesignScheduleUpload({
  projectId, pipeline, userRole, onImported,
}: {
  projectId: string;
  pipeline: "habitainer" | "ads";
  userRole: string | null;
  onImported?: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; applied: number; errors: string[]; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!EDIT_ROLES.includes(userRole ?? "")) return null;
  if (pipeline !== "habitainer") return null;

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const { data: proj } = await (supabase.from("projects") as any)
        .select("id, name, client_name, division, production_system")
        .eq("id", projectId).single();

      const yr = String(new Date().getFullYear()).slice(-2);
      const prefix = String(proj?.name || "").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
      const seq = String(projectId).replace(/-/g, "").slice(0, 3).toUpperCase();
      const code = `${prefix}/${yr}/${seq}`;

      const res = await fetch("/templates/Design_Schedule_Template.xlsx", { cache: "no-cache" });
      if (!res.ok) throw new Error("Template file not found");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await res.arrayBuffer());

      const ws = wb.getWorksheet("Design Schedule Details");
      if (ws) {
        const fills: Array<[string, any]> = [
          ["Project Code", code],
          ["Project Name", proj?.name || ""],
          ["Division", proj?.division || "Habitainer"],
          ["Production System", proj?.production_system || ""],
          ["Client Name", proj?.client_name || ""],
          // Role-resolved, never a hardcoded name. Falls back to the Head of
          // Operations (Design) when no one holds operations_architect.
          ["Operations Architect", await (async () => {
            const primary = await fetchRoleHolderName("operations_architect", "");
            return primary || await fetchRoleHolderName("head_operations");
          })()],
        ];
        const matchRow = (label: string): number | null => {
          const want = label.toLowerCase();
          for (let r = 1; r <= ws.rowCount; r++) {
            const v = String(ws.getCell(r, 1).value ?? "").trim().toLowerCase();
            if (v === want || v.startsWith(want)) return r;
          }
          return null;
        };
        for (const [label, value] of fills) {
          const r = matchRow(label);
          if (r) ws.getCell(r, 2).value = value as any;
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Design_Schedule_${code.replace(/\//g, "-")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Design Schedule template downloaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate template");
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    const errors: string[] = [];
    const warnings: string[] = [];
    let applied = 0;

    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = wb.SheetNames.find(n => norm(n) === "design schedule") ?? wb.SheetNames[1] ?? wb.SheetNames[0];
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: "" });

      const { data: defData, error: defErr } = await (supabase.from("design_stage_definitions") as any)
        .select("id, stage_code, stage_name, stage_order, template_row, proof_type, design_schedule_section, combined_gate_codes, is_combined_child, is_mandatory")
        .eq("pipeline_type", pipeline)
        .order("stage_order");
      if (defErr) throw defErr;
      const defs = (defData ?? []) as Def[];
      const byRow = new Map<number, Def>();
      const byCode = new Map<string, Def>();
      for (const d of defs) {
        byCode.set(d.stage_code, d);
        if (d.template_row) byRow.set(d.template_row, d);
      }

      const { data: stageData } = await (supabase.from("project_design_stages") as any)
        .select("id, stage_definition_id, status").eq("project_id", projectId);
      const stages = (stageData ?? []) as Stage[];
      const stageByDef = new Map(stages.map(s => [s.stage_definition_id, s]));

      // Parse rows
      type Parsed = { def: Def; date: string | null; notes: string; na: boolean };
      const parsed: Parsed[] = [];
      const seen = new Set<number>();

      for (const r of rows) {
        const rowNo = Number(String(r[0] ?? "").trim());
        if (!Number.isFinite(rowNo) || rowNo <= 0) continue;
        const def = byRow.get(rowNo);
        if (!def) { errors.push(`Row ${rowNo} ("${String(r[1] ?? "").trim()}") does not exist in the Design Schedule — the template has been altered.`); continue; }
        if (seen.has(rowNo)) { errors.push(`Row ${rowNo} appears more than once.`); continue; }
        seen.add(rowNo);

        // Proof Type is read-only on upload.
        const proof = String(r[4] ?? "").trim();
        if (def.proof_type && proof && norm(proof) !== norm(def.proof_type)) {
          errors.push(`Row ${rowNo} (${def.stage_code}): Proof Type changed from "${def.proof_type}" to "${proof}". Proof Type is read-only.`);
          continue;
        }

        const notes = String(r[5] ?? "").trim();
        const na = norm(notes) === "n/a" || norm(notes) === "na";
        const rawDate = r[3];
        const hasDate = String(rawDate ?? "").trim() !== "";

        if (!hasDate) {
          if (!na && def.is_mandatory) warnings.push(`Row ${rowNo} (${def.stage_code} · ${def.stage_name}): no Planned Date entered — skipped.`);
          if (na) parsed.push({ def, date: null, notes, na });
          continue;
        }

        const date = parseDate(rawDate);
        if (!date) { errors.push(`Row ${rowNo} (${def.stage_code}): Planned Date "${rawDate}" is not a valid DD/MM/YYYY date.`); continue; }

        parsed.push({ def, date, notes, na });
      }


      // Sequence check — a stage cannot be planned to complete before its predecessor.
      const ordered = [...parsed].sort((a, b) => (a.def.template_row ?? 0) - (b.def.template_row ?? 0));
      let prev: Parsed | null = null;
      for (const p of ordered) {
        if (p.na || !p.date) continue;
        if (prev?.date && p.date < prev.date) {
          errors.push(
            `Row ${p.def.template_row} (${p.def.stage_code}) is planned for ${format(new Date(p.date), "dd/MM/yyyy")}, before its predecessor ` +
            `Row ${prev.def.template_row} (${prev.def.stage_code}) on ${format(new Date(prev.date), "dd/MM/yyyy")}. ` +
            `Design Schedule stages run sequentially.`
          );
        }
        prev = p;
      }

      if (errors.length > 0) {
        setResult({ ok: false, applied: 0, errors, warnings });
        setUploading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Apply. Combined Gate rows write the same date to BOTH underlying
      // preliminary checkpoints — they are independent records, not the Final rows.
      // Single source of truth for the planned target date is `planned_date`;
      // the legacy start/end range fields are cleared so nothing renders a
      // stale range alongside the new single date.
      const writeOne = async (def: Def, p: Parsed) => {
        const payload: any = {
          planned_date: p.date,
          planned_start_date: null,
          planned_end_date: null,
          updated_by: user?.id ?? null,
        };

        if (p.notes) payload.notes = p.notes;
        if (p.na && !def.is_mandatory) payload.status = "Skipped";

        const existing = stageByDef.get(def.id);
        const res = existing
          ? await (supabase.from("project_design_stages") as any).update(payload).eq("id", existing.id)
          : await (supabase.from("project_design_stages") as any).insert({
              project_id: projectId, stage_definition_id: def.id, status: "Not Started", ...payload,
            });
        if (res.error) throw new Error(`${def.stage_code}: ${res.error.message}`);
      };

      for (const p of ordered) {
        await writeOne(p.def, p);
        applied++;
        for (const childCode of p.def.combined_gate_codes ?? []) {
          const child = byCode.get(childCode);
          if (!child) { warnings.push(`Combined Gate ${p.def.stage_code}: checkpoint ${childCode} not found.`); continue; }
          await writeOne(child, p);
          warnings.push(`Combined Gate ${p.def.stage_code} also set ${child.stage_code} · ${child.stage_name}.`);
        }
      }

      setResult({ ok: true, applied, errors: [], warnings });
      toast.success(`Design Schedule imported — ${applied} stages updated`);
      onImported?.();
    } catch (e: any) {
      setResult({ ok: false, applied, errors: [e?.message ?? "Upload failed"], warnings });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium">Design Schedule — Excel</p>
            <p className="text-xs text-muted-foreground">
              Download the template (grey fields pre-filled from this project), fill a single Planned Date per stage in DD/MM/YYYY, then upload.
              Proof Type is read-only. Combined Gate rows set both preliminary checkpoints.
            </p>

          </div>
          <Button variant="outline" onClick={downloadTemplate} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download Design Schedule Template
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload Design Schedule
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </CardContent>
      </Card>

      <Dialog open={!!result} onOpenChange={v => !v && setResult(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.ok
                ? <><CheckCircle2 className="h-5 w-5" style={{ color: "#006039" }} /> Design Schedule imported</>
                : <><AlertTriangle className="h-5 w-5" style={{ color: "#F40009" }} /> Upload rejected</>}
            </DialogTitle>
            <DialogDescription>
              {result?.ok
                ? `${result.applied} stage rows updated. Nothing was marked Completed — status changes still go through the normal gate.`
                : "No changes were saved. Fix the rows below and re-upload."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-3 text-sm">
            {result?.errors?.length ? (
              <div>
                <p className="font-medium" style={{ color: "#F40009" }}>Errors</p>
                <ul className="list-disc pl-5 space-y-1">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : null}
            {result?.warnings?.length ? (
              <div>
                <p className="font-medium" style={{ color: "#D4860A" }}>Notes</p>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DesignScheduleUpload;
