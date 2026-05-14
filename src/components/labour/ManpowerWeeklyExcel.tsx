import { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Upload, AlertCircle, Calendar, Check } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, addDays } from "date-fns";

type Location = "factory" | "site";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VALID_MARKS = ["P", "A", "H", "L", "OT"];

interface Props { location: Location; projectId?: string | null; }

const ATT_COLOR: Record<string, string> = {
  P: "#006039", A: "#F40009", OT: "#1D4ED8", H: "#9CA3AF", L: "#D4860A",
};

export function ManpowerWeeklyExcel({ location, projectId }: Props) {
  const { user } = useAuth();
  const { role } = useUserRole();
  const fileRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(() => {
    if (!role) return false;
    if (["super_admin", "managing_director", "planning_head", "head_operations"].includes(role)) return true;
    if (location === "factory" && role === "production_head") return true;
    if (location === "site" && role === "site_installation_mgr") return true;
    return false;
  }, [role, location]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }));
  const [plan, setPlan] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEnd = addDays(weekStart, 5);
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  useEffect(() => { void loadAll(); }, [weekStartStr, location, projectId]);

  async function loadAll() {
    setLoading(true);
    const dept = location === "factory" ? ["factory", "both"] : ["site", "both"];
    const { data: w } = await supabase.from("labour_workers")
      .select("id, name, skill_type, department, contractor_id, labour_contractors(company_name)")
      .eq("status", "active").in("department", dept).order("name");
    setWorkers(w ?? []);

    let q = supabase.from("manpower_plans").select("*")
      .eq("location", location).eq("week_starting", weekStartStr);
    q = projectId ? q.eq("project_id", projectId) : q.is("project_id", null);
    const { data: p } = await q.maybeSingle();
    setPlan(p ?? null);
    if (p) {
      const [{ data: en }, { data: sb }] = await Promise.all([
        supabase.from("manpower_plan_entries").select("*, labour_workers(name)").eq("plan_id", p.id),
        supabase.from("manpower_subcontractor_plan").select("*").eq("plan_id", p.id),
      ]);
      setEntries(en ?? []); setSubs(sb ?? []);
    } else { setEntries([]); setSubs([]); }
    setLoading(false);
  }

  async function downloadTemplate() {
    setBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Manpower Plan", { properties: { defaultRowHeight: 18 } });

      ws.mergeCells("A1:K1"); ws.getCell("A1").value = "The Habitainer";
      ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF006039" } };
      ws.getCell("A1").alignment = { horizontal: "center" };
      ws.mergeCells("A2:K2"); ws.getCell("A2").value = "WEEKLY MANPOWER PLAN";
      ws.getCell("A2").font = { bold: true, size: 12 };
      ws.getCell("A2").alignment = { horizontal: "center" };

      ws.getCell("A3").value = "Week Starting (Mon):";
      ws.getCell("B3").value = weekStartStr; ws.getCell("B3").font = { bold: true };
      ws.getCell("D3").value = "Week Ending (Sat):";
      ws.getCell("E3").value = weekEndStr; ws.getCell("E3").font = { bold: true };
      ws.getCell("A4").value = "Location:"; ws.getCell("B4").value = location.toUpperCase();
      ws.getCell("D4").value = "Submitted By:"; ws.getCell("E4").value = user?.email ?? "";

      const headers = ["Worker Name", "Company", "Role/Trade", ...DAY_LABELS, "Total Days", "Notes"];
      const headerRow = ws.getRow(6);
      headers.forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF006039" } };
        c.alignment = { horizontal: "center" };
      });
      headerRow.commit();

      const startRow = 7;
      workers.forEach((w, i) => {
        const r = ws.getRow(startRow + i);
        r.getCell(1).value = w.name;
        r.getCell(2).value = w.labour_contractors?.company_name ?? "—";
        r.getCell(3).value = w.skill_type;
        // lock the identity cells
        [1, 2, 3].forEach((col) => { r.getCell(col).protection = { locked: true }; });
        // attendance cells
        for (let d = 0; d < 6; d++) {
          const cell = r.getCell(4 + d);
          cell.value = "";
          cell.protection = { locked: false };
          cell.dataValidation = {
            type: "list", allowBlank: false,
            formulae: ['"P,A,H,L,OT"'],
            showErrorMessage: true,
            errorTitle: "Invalid",
            error: "Use P, A, H, L or OT only.",
          };
          cell.alignment = { horizontal: "center" };
        }
        const rowNum = startRow + i;
        r.getCell(10).value = { formula: `COUNTIF(D${rowNum}:I${rowNum},"P")+COUNTIF(D${rowNum}:I${rowNum},"OT")` } as any;
        r.getCell(10).protection = { locked: true };
        r.getCell(11).protection = { locked: false };
      });

      // Summary rows
      const sumRow = startRow + workers.length + 1;
      ws.getCell(`A${sumRow}`).value = "Planned Headcount per Day";
      ws.getCell(`A${sumRow}`).font = { bold: true };
      for (let d = 0; d < 6; d++) {
        const col = String.fromCharCode(68 + d); // D..I
        ws.getCell(`${col}${sumRow}`).value = {
          formula: `COUNTIF(${col}${startRow}:${col}${startRow + workers.length - 1},"P")+COUNTIF(${col}${startRow}:${col}${startRow + workers.length - 1},"OT")`,
        } as any;
        ws.getCell(`${col}${sumRow}`).font = { bold: true };
      }
      ws.getCell(`A${sumRow + 1}`).value = "Total Planned Man-days";
      ws.getCell(`J${sumRow + 1}`).value = { formula: `SUM(J${startRow}:J${startRow + workers.length - 1})` } as any;
      ws.getCell(`J${sumRow + 1}`).font = { bold: true };

      // Subcontractor section
      const subStart = sumRow + 4;
      ws.getCell(`A${subStart}`).value = "SUBCONTRACTOR PLAN";
      ws.getCell(`A${subStart}`).font = { bold: true, size: 12, color: { argb: "FF006039" } };
      const subHeaders = ["Sub Name", "Trade", "Planned Start", "Planned End", "Scope of Work", "Days on Site"];
      const sh = ws.getRow(subStart + 1);
      subHeaders.forEach((h, i) => {
        const c = sh.getCell(i + 1);
        c.value = h; c.font = { bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F2ED" } };
      });
      for (let i = 0; i < 12; i++) {
        const r = ws.getRow(subStart + 2 + i);
        for (let c = 1; c <= 6; c++) r.getCell(c).protection = { locked: false };
      }

      // Column widths
      [28, 22, 18, 6, 6, 6, 6, 6, 6, 12, 30].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

      // Sheet protection (worker identity locked, attendance editable)
      await ws.protect("habitainer", {
        selectLockedCells: true, selectUnlockedCells: true, formatCells: false,
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ManpowerPlan_${location === "factory" ? "Factory" : "Site"}_Week${format(weekStart, "dd-MM-yyyy")}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch (e: any) {
      toast.error(`Download failed: ${e.message ?? e}`);
    } finally { setBusy(false); }
  }

  async function handleUpload(file: File) {
    if (!user) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets["Manpower Plan"] || wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("Sheet 'Manpower Plan' not found.");
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

      // Header row at index 5 (row 6); data starts at index 6
      const errors: string[] = [];
      const workerByName = new Map<string, any>(workers.map((w) => [w.name.trim().toLowerCase(), w]));
      const planEntries: any[] = [];
      let totalManDays = 0;

      for (let i = 6; i < rows.length; i++) {
        const r = rows[i];
        const name = (r?.[0] ?? "").toString().trim();
        if (!name) break; // end of worker block
        if (name.toUpperCase() === "PLANNED HEADCOUNT PER DAY") break;
        const w = workerByName.get(name.toLowerCase());
        if (!w) { errors.push(`Row ${i + 1}: worker "${name}" not in Labour Register`); continue; }
        const marks = [3, 4, 5, 6, 7, 8].map((c) => (r?.[c] ?? "").toString().trim().toUpperCase());
        marks.forEach((m, di) => {
          if (!VALID_MARKS.includes(m)) errors.push(`Row ${i + 1} (${name}) ${DAY_LABELS[di]}: "${m || "blank"}" — must be P/A/H/L/OT`);
        });
        const totalDays = marks.filter((m) => m === "P" || m === "OT").length;
        if (totalDays > 6) errors.push(`Row ${i + 1} (${name}): total > 6 days`);
        totalManDays += totalDays;
        planEntries.push({
          worker_id: w.id,
          monday: marks[0], tuesday: marks[1], wednesday: marks[2],
          thursday: marks[3], friday: marks[4], saturday: marks[5],
          total_days: totalDays, notes: (r?.[10] ?? "").toString().trim() || null,
        });
      }

      // Subcontractor section
      const subStartIdx = rows.findIndex((r) => (r?.[0] ?? "").toString().toUpperCase() === "SUBCONTRACTOR PLAN");
      const planSubs: any[] = [];
      if (subStartIdx >= 0) {
        for (let i = subStartIdx + 2; i < rows.length; i++) {
          const r = rows[i]; const sub = (r?.[0] ?? "").toString().trim();
          if (!sub) continue;
          planSubs.push({
            sub_name: sub,
            trade: (r?.[1] ?? "").toString().trim() || null,
            planned_start: parseDate(r?.[2]), planned_end: parseDate(r?.[3]),
            scope: (r?.[4] ?? "").toString().trim() || null,
            days_on_site: Number(r?.[5]) || 0,
          });
        }
      }

      if (errors.length) {
        toast.error(`${errors.length} validation error${errors.length > 1 ? "s" : ""}.`);
        console.warn("Manpower upload validation errors:", errors);
        const detail = errors.slice(0, 8).join("\n") + (errors.length > 8 ? `\n…and ${errors.length - 8} more (see console)` : "");
        alert(`Upload rejected. Fix and retry:\n\n${detail}`);
        setBusy(false); return;
      }
      if (planEntries.length === 0) { toast.error("No worker rows found in template"); setBusy(false); return; }

      // Late if past Sat 18:00 of the planning week
      const deadline = new Date(weekEnd); deadline.setHours(18, 0, 0, 0);
      const isLate = new Date() > deadline;

      // Upsert plan
      const { data: existing } = await supabase.from("manpower_plans").select("id")
        .eq("location", location).eq("week_starting", weekStartStr).maybeSingle();
      let planId = existing?.id;
      if (planId) {
        await supabase.from("manpower_plan_entries").delete().eq("plan_id", planId);
        await supabase.from("manpower_subcontractor_plan").delete().eq("plan_id", planId);
        await supabase.from("manpower_plans").update({
          submitted_by: user.id, submitted_at: new Date().toISOString(),
          is_late: isLate, total_planned_mandays: totalManDays, status: "submitted",
        }).eq("id", planId);
      } else {
        const { data: ins, error } = await supabase.from("manpower_plans").insert({
          week_starting: weekStartStr, week_ending: weekEndStr, location,
          project_id: projectId ?? null, submitted_by: user.id, is_late: isLate,
          total_planned_mandays: totalManDays, status: "submitted",
        }).select("id").single();
        if (error) throw error;
        planId = ins.id;
      }

      await supabase.from("manpower_plan_entries").insert(planEntries.map((e) => ({ ...e, plan_id: planId })));
      if (planSubs.length) {
        await supabase.from("manpower_subcontractor_plan").insert(planSubs.map((s) => ({ ...s, plan_id: planId })));
      }

      // Notify Suraj + MD
      const { data: dirs } = await supabase.from("profiles")
        .select("auth_user_id").in("role", ["managing_director", "super_admin", "head_operations", "planning_head"])
        .eq("is_active", true);
      if (dirs?.length) {
        await supabase.from("notifications").insert(dirs.map((d: any) => ({
          recipient_id: d.auth_user_id,
          category: "manpower_plan",
          type: "info",
          title: `Manpower Plan submitted — ${location === "factory" ? "Factory" : "Site"}`,
          content: `Week of ${weekStartStr}. ${planEntries.length} workers, ${totalManDays} man-days${isLate ? " (LATE)" : ""}.`,
          body: `Week of ${weekStartStr}. ${planEntries.length} workers, ${totalManDays} man-days${isLate ? " (LATE)" : ""}.`,
          navigate_to: location === "factory" ? "/production" : "/sitehub",
        })));
      }

      toast.success(`Plan saved${isLate ? " (marked LATE)" : ""}`);
      void loadAll();
    } catch (e: any) {
      toast.error(`Upload failed: ${e.message ?? e}`);
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Prev</Button>
          <span className="font-mono text-sm">{format(weekStart, "dd MMM")} – {format(weekEnd, "dd MMM yyyy")}</span>
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Download Template
          </Button>
          {canSubmit && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}
                style={{ backgroundColor: "#006039", color: "white" }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Upload Plan
              </Button>
            </>
          )}
        </div>
      </div>

      {!canSubmit && (
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground" style={{ backgroundColor: "#F7F7F7" }}>
          You can view but not submit {location} manpower plans.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !plan ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center bg-background">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No plan submitted for this week. Download the template, fill it in, and upload.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4" style={{ color: "#006039" }} />
            <span>Submitted {format(new Date(plan.submitted_at), "dd MMM HH:mm")}</span>
            {plan.is_late && <Badge variant="outline" style={{ color: "#F40009", borderColor: "#F40009" }}>LATE</Badge>}
            <span className="text-muted-foreground">· {plan.total_planned_mandays} man-days planned</span>
          </div>

          <div className="rounded-lg border border-border bg-background overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7" }}>
                  {["Worker", ...DAY_LABELS, "Total"].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-semibold" style={{ color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-2 py-1.5">{e.labour_workers?.name ?? "—"}</td>
                    {DAYS.map((d) => {
                      const v = (e[d] ?? "").toString().toUpperCase();
                      return (
                        <td key={d} className="px-2 py-1.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{ color: ATT_COLOR[v] ?? "#999", backgroundColor: (ATT_COLOR[v] ?? "#999") + "1A" }}>
                            {v || "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 font-mono">{e.total_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subs.length > 0 && (
            <div className="rounded-lg border border-border bg-background overflow-x-auto">
              <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#666", backgroundColor: "#F7F7F7" }}>
                Subcontractor Plan
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Sub", "Trade", "Start", "End", "Scope", "Days"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold" style={{ color: "#666" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-2 py-1.5">{s.sub_name}</td>
                      <td className="px-2 py-1.5">{s.trade ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.planned_start ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.planned_end ?? "—"}</td>
                      <td className="px-2 py-1.5">{s.scope ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{s.days_on_site ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseDate(v: any): string | null {
  if (!v) return null;
  const s = v.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
}
