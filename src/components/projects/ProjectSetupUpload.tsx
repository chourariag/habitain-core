import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import { dispatchProjectImported } from "@/lib/use-project-import";
import { toast } from "sonner";
import { format } from "date-fns";
import { buildBoqWorksheet } from "@/lib/xlsx-templates";
import { FACTORY_STAGES } from "@/lib/hstack-stages";

interface Props {
  projectId: string;
  userRole: string | null;
  productionSystem?: string | null;
  onImported?: () => void;
}

const ALLOWED = ["super_admin", "managing_director", "finance_director", "finance_manager", "planning_engineer", "costing_engineer", "principal_architect", "architecture_director", "head_operations"];

interface SheetResult { name: string; ok: boolean; count: number; message: string; warnings?: string[]; }

const parseDate = (val: any): string | null => {
  if (!val) return null;
  if (val instanceof Date) return format(val, "yyyy-MM-dd");
  const s = String(val).trim();
  const parts = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (parts) {
    const yr = parts[3].length === 2 ? "20" + parts[3] : parts[3];
    return `${yr}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
};

export function ProjectSetupUpload({ projectId, userRole, productionSystem, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<SheetResult[]>([]);

  if (!ALLOWED.includes(userRole ?? "")) return null;

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const wb = XLSX.utils.book_new();

      // Fetch project + module list for pre-fill
      const { data: proj } = await (supabase.from("projects") as any)
        .select("id, name, client_name, division, production_system, contract_value, start_date, est_completion, location")
        .eq("id", projectId).single();
      const sys = (proj?.production_system || productionSystem || "modular").toLowerCase();

      const { data: mods } = await (supabase.from("modules") as any)
        .select("id, name, module_code")
        .eq("project_id", projectId).eq("is_archived", false)
        .order("name", { ascending: true });
      const moduleNames: string[] = (mods || []).map((m: any) => m.name || m.module_code || "").filter(Boolean);
      if (moduleNames.length === 0) moduleNames.push("M1");

      const modIdSet = new Set((mods || []).map((m: any) => m.id));
      const { data: panelRows } = await (supabase.from("panels") as any).select("id, module_id");
      const panelCount = (panelRows || []).filter((p: any) => modIdSet.has(p.module_id)).length;

      // Auto project code from name + year + short id (display only)
      const yr = String(new Date().getFullYear()).slice(-2);
      const prefix = String(proj?.name || "").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase().padEnd(4, "X");
      const seq = String(projectId).replace(/-/g, "").slice(0, 3).toUpperCase();
      const projectCode = `${prefix}/${yr}/${seq}`;

      const fmt = (d: any) => d ? format(new Date(d), "dd/MM/yyyy") : "";

      // ── Sheet 1: Project Details (pre-filled) ──
      const detailRows: any[][] = [
        ["THE HABITAINER — PROJECT SETUP TEMPLATE  |  Fill and upload to HStack"],
        ["Version 1.0  |  Project Details (grey fields) are pre-filled from HStack. Fill white fields only. Upload via Projects → [Project] → Overview → Upload Project Setup."],
        ["  🔒 Grey = Pre-filled from HStack (do not change)      ✏ White = Fill this in"],
        [],
        ["  PROJECT IDENTIFICATION"],
        ["Project Code", projectCode],
        ["Project Name", proj?.name || ""],
        ["Division", proj?.division || ""],
        ["Production System", sys],
        ["Client Name", proj?.client_name || ""],
        ["Client Email", ""],
        ["Client Phone", ""],
        ["Site Location", proj?.location || ""],
        ["Site City", ""],
        ["Site State", ""],
        ["Sales Owner", proj?.division === "ADS" ? "Karan Awtaney" : "John Kunnath"],
        ["Project Manager", "Suraj Rao"],
        [],
        ["  COMMERCIAL DETAILS"],
        ["Contract Value (₹)", Number(proj?.contract_value) || 0],
        ["Contract Start Date", fmt(proj?.start_date)],
        ["Expected Delivery Date", fmt(proj?.est_completion)],
        ["Number of Modules", moduleNames.length],
        ["Number of Panels", panelCount],
        ["GST Applicable", "Yes"],
        [],
        ["  TEAM (System Defaults)"],
        ["Operations Head", "Azad"],
        ["Site Installation Manager", "Awaiz"],
        ["Planning Engineer", "Karthik"],
        ["Costing / QS", "Nakeem"],
        ["Procurement", "Venkat"],
      ];
      const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
      detailWs["!cols"] = [{ wch: 28 }, { wch: 38 }];
      detailWs["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      ];
      XLSX.utils.book_append_sheet(wb, detailWs, "Project Details");

      // ── Sheet 2: BOQ + Margin ──
      XLSX.utils.book_append_sheet(wb, buildBoqWorksheet(30), "BOQ + Margin");

      // ── Sheet 3: Project Schedule (factory stages × modules) ──
      const schRows: any[][] = [
        [`HStack — Project Schedule  |  Stages only  |  System: ${sys}  |  Fill Planned Start + End for each module`],
        [`Site stages (Erection → Handover) are entered by Awaiz in Site Hub → Schedule, 14 days before dispatch. Do NOT add them here.`],
        [`Notes column: enter "N/A" to exclude an optional stage for that module. Blank = in scope.`],
        [],
        ["Stage #", "Stage Name", "Module #", "Planned Start (DD/MM/YYYY)", "Planned End (DD/MM/YYYY)", "Notes / N/A"],
      ];
      for (const stage of FACTORY_STAGES) {
        const label = stage.parallel
          ? `${stage.name}  (∥ ${stage.parallel})`
          : stage.name + (stage.na_eligible ? "  (mark N/A if not in scope)" : "");
        for (const mn of moduleNames) {
          schRows.push([stage.number, label, mn, "", "", ""]);
        }
      }
      const schWs = XLSX.utils.aoa_to_sheet(schRows);
      schWs["!cols"] = [{ wch: 8 }, { wch: 38 }, { wch: 12 }, { wch: 22 }, { wch: 22 }, { wch: 24 }];
      schWs["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      ];
      XLSX.utils.book_append_sheet(wb, schWs, "Project Schedule");

      // ── Sheet 4: Material Plan ──
      const material: any[][] = [
        ["Section", "Material", "Tender Qty", "Unit", "PO Release Date", "Procurement Date", "Delivery Date"],
        ["Shell and Core", "Structural Steel — Beams, Columns, Framed Structure", "", "KG", "", "", ""],
        ["Shell and Core", "LGSF — Wall framing", "", "KG", "", "", ""],
        ["Shell and Core", "Deck Sheet 1.0mm — Floor & Roof", "", "KG", "", "", ""],
        ["Shell and Core", "Welded Wire Mesh 2.5mm 50mm C/C", "", "KG", "", "", ""],
        ["Shell and Core", "EPS Thermocol Sheet", "", "Nos", "", "", ""],
        ["Builder Finish", "Rockwool Slab 48kg 50mm — Inner Wall", "", "SFT", "", "", ""],
        ["Builder Finish", "Habit Board 13mm — Inner Wall", "", "SFT", "", "", ""],
        ["Builder Finish", "Shera Neu Wall Board 10mm — External", "", "SFT", "", "", ""],
        ["Builder Finish", "Gypsum Board 12.5mm — Ceiling", "", "SFT", "", "", ""],
        ["Builder Finish", "Internal Painting (Compound, Putty, Primer, Paint)", "", "SFT", "", "", ""],
        ["Builder Finish", "Aluminium Glass Windows", "", "SFT", "", "", ""],
        ["Builder Finish", "Wooden Doors (internal)", "", "Nos", "", "", ""],
        ["Site", "Foundation Bolts and Anchor Plates", "", "Nos", "", "", ""],
        ["Site", "Crane Hire (site erection)", "", "Days", "", "", ""],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(material), "Material Plan");

      const safeName = (proj?.name || "Project").replace(/[^A-Za-z0-9]+/g, "_");
      XLSX.writeFile(wb, `Project_Setup_${safeName}.xlsx`);
    } catch (err: any) {
      toast.error(err?.message || "Template download failed");
    } finally {
      setDownloading(false);
    }
  };

  async function processBilling(ws: XLSX.WorkSheet | undefined): Promise<SheetResult> {
    if (!ws) return { name: "Billing", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return { name: "Billing", ok: true, count: 0, message: "Sheet empty — skipped" };
    const milestones = rows
      .filter(r => r["Milestone Description"] || r["Description"])
      .map((r, i) => ({
        project_id: projectId,
        milestone_number: Number(r["#"]) || i + 1,
        description: String(r["Milestone Description"] || r["Description"] || `Milestone ${i + 1}`),
        percentage: Number(r["%"]) || 0,
        amount_excl_gst: 0,
        gst_amount: 0,
        amount_incl_gst: 0,
        gst_applicable: String(r["GST Applicable (Y/N)"] || r["GST Applicable"] || "Y").toUpperCase().startsWith("Y"),
        trigger_event: String(r["Trigger Event"] || "Custom"),
        status: "pending",
      }));
    if (milestones.length === 0) return { name: "Billing", ok: true, count: 0, message: "No rows" };
    await supabase.from("project_billing_milestones").delete().eq("project_id", projectId);
    const { error } = await supabase.from("project_billing_milestones").insert(milestones as any);
    if (error) return { name: "Billing", ok: false, count: 0, message: error.message };
    return { name: "Billing", ok: true, count: milestones.length, message: `${milestones.length} milestones imported` };
  }

  async function processBOQ(ws: XLSX.WorkSheet | undefined, userId: string | null, userName: string | null): Promise<SheetResult> {
    if (!ws) return { name: "BOQ", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = rows.findIndex(r => r && r.some((c: any) => String(c).toLowerCase().includes("item description")));
    if (headerIdx === -1) return { name: "BOQ", ok: true, count: 0, message: "No header — skipped" };
    const dataRows = rows.slice(headerIdx + 1);
    // New column order: 0 S.No | 1 Category | 2 Item Description | 3 Unit |
    // 4 Tender Qty | 5 GFC Qty | 6 Wastage % | 7 BOQ Qty |
    // 8 Material Rate | 9 Labour Rate | 10 OH Rate | 11 BOQ Rate |
    // 12 Tender Amount | 13 GFC Amount | 14 Margin % | 15 Scope
    const parsed: any[] = []; let sno = 0;
    let hasAnyGfc = false;
    dataRows.forEach(r => {
      const desc = String(r[2] || "").trim();
      if (!desc) return;
      sno++;
      const tenderQty = r[4] === "" || r[4] == null ? 0 : Number(r[4]) || 0;
      const gfcQty = r[5] === "" || r[5] == null ? 0 : Number(r[5]) || 0;
      const wastagePct = Number(r[6]) || 0;
      const boqQty = Number(r[7]) || (gfcQty * (1 + wastagePct / 100));
      const matRate = Number(r[8]) || 0, labRate = Number(r[9]) || 0, ohRate = Number(r[10]) || 0;
      const boqRate = Number(r[11]) || (matRate + labRate + ohRate);
      const tenderAmt = Number(r[12]) || (tenderQty * boqRate);
      const gfcAmt = Number(r[13]) || (boqQty * boqRate);
      const marginPct = r[14] != null && r[14] !== "" ? Number(r[14]) : 0;
      const scope = String(r[15] || "Factory").trim();
      if (gfcQty > 0) hasAnyGfc = true;
      parsed.push({
        sno, category: String(r[1] || "Miscellaneous").trim(), item_description: desc, unit: String(r[3] || ""),
        tender_qty: tenderQty, actual_qty: gfcQty, wastage_pct: wastagePct, boq_qty: boqQty,
        material_rate: matRate, labour_rate: labRate, oh_rate: ohRate, boq_rate: boqRate,
        tender_amount: tenderAmt, gfc_amount: gfcAmt, total_amount: gfcAmt || tenderAmt,
        margin_pct: marginPct, scope,
      });
    });
    if (parsed.length === 0) return { name: "BOQ", ok: true, count: 0, message: "No items" };

    // Detect H1 sign-off (from design_stages)
    const { data: signoffs } = await (supabase as any).from("design_stages")
      .select("id").eq("project_id", projectId).eq("stage_name", "H1").eq("status", "completed").limit(1);
    const hasH1 = (signoffs as any[] | null)?.length ? true : false;

    const { data: prev } = await supabase.from("project_boq").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
    const nextV = ((prev as any)?.[0]?.version_number ?? 0) + 1;
    const tenderTotal = parsed.reduce((s, i) => s + (i.tender_amount || 0), 0);
    const gfcTotal = parsed.reduce((s, i) => s + (i.gfc_amount || 0), 0);
    const total = gfcTotal || tenderTotal;
    const marginAmt = parsed.reduce((s, i) => s + ((i.gfc_amount || i.tender_amount) * (i.margin_pct || 0) / 100), 0);
    const blended = total > 0 ? (marginAmt / total) * 100 : 0;
    const factory = parsed.filter(i => i.scope === "Factory" || i.scope === "Both").reduce((s, i) => s + (i.gfc_amount || i.tender_amount), 0);
    const civil = parsed.filter(i => i.scope === "On-Site Civil" || i.scope === "Both").reduce((s, i) => s + (i.gfc_amount || i.tender_amount), 0);
    const gfcPending = hasAnyGfc && !hasH1;
    const { data: boq, error } = await supabase.from("project_boq").insert({
      project_id: projectId, version_number: nextV, uploaded_by: userId, uploaded_by_name: userName,
      total_boq_value: total, blended_margin_pct: blended, factory_scope_value: factory, civil_scope_value: civil,
      tender_total_value: tenderTotal, gfc_total_value: gfcTotal, gfc_pending_h1: gfcPending,
    } as any).select().single();
    if (error || !boq) return { name: "BOQ", ok: false, count: 0, message: error?.message || "BOQ create failed" };
    const items = parsed.map(p => ({ boq_id: (boq as any).id, ...p }));
    for (let i = 0; i < items.length; i += 100) {
      const { error: e2 } = await supabase.from("project_boq_items").insert(items.slice(i, i + 100) as any);
      if (e2) return { name: "BOQ", ok: false, count: 0, message: e2.message };
    }
    const cats = new Set(parsed.map(p => p.category)).size;
    let msg = `${parsed.length} items across ${cats} categories`;
    if (!hasAnyGfc) msg += " — Tender only (GFC pending)";
    else if (gfcPending) msg += " — GFC stored, pending H1 sign-off";
    return { name: "BOQ", ok: true, count: parsed.length, message: msg };
  }

  async function processSchedule(ws: XLSX.WorkSheet | undefined): Promise<SheetResult> {
    if (!ws) return { name: "Schedule", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });

    // Find header row containing "Stage #" + "Module #"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i] || [];
      const lower = r.map((c: any) => String(c ?? "").toLowerCase());
      if (lower.some(c => c.includes("stage #")) && lower.some(c => c.includes("module"))) {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) return { name: "Schedule", ok: true, count: 0, message: "Stages-only header not found — sheet skipped" };

    const stageRows: any[] = [];
    const skipped: string[] = [];
    const sys = (productionSystem || "modular").toLowerCase();

    // Pre-load module name → id map
    const { data: mods } = await (supabase.from("modules") as any)
      .select("id, name, module_code")
      .eq("project_id", projectId)
      .eq("is_archived", false);
    const moduleMap = new Map<string, string>();
    (mods || []).forEach((m: any) => {
      if (m.name) moduleMap.set(String(m.name).trim().toLowerCase(), m.id);
      if (m.module_code) moduleMap.set(String(m.module_code).trim().toLowerCase(), m.id);
    });

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]; if (!row || row.every((x: any) => !x || !String(x).trim())) continue;
      const stageNum = parseInt(String(row[0] ?? "").trim(), 10);
      if (!stageNum || stageNum < 1 || stageNum > 15) continue;
      const stageName = String(row[1] ?? "").trim().split("(")[0].trim();
      const moduleName = String(row[2] ?? "").trim();
      const ps = parseDate(row[3]);
      const pe = parseDate(row[4]);
      const notes = String(row[5] ?? "").trim();
      const isNa = /^n\/?a$/i.test(notes) || /\bN\/A\b/i.test(notes);

      if (!isNa && (!ps || !pe)) {
        skipped.push(`Stage ${stageNum} ${stageName} / ${moduleName}`);
        continue;
      }
      stageRows.push({
        project_id: projectId,
        module_id: moduleMap.get(moduleName.toLowerCase()) ?? null,
        stage_number: stageNum,
        stage_name: stageName,
        planned_start: isNa ? null : ps,
        planned_end: isNa ? null : pe,
        status: isNa ? "N/A" : "Upcoming",
        is_na: isNa,
      });
    }

    if (stageRows.length === 0) return { name: "Schedule", ok: true, count: 0, message: "No stage rows" };

    // Replace project_stages for this project (factory rows only — site rows are entered in Site Hub)
    await (supabase as any).from("project_stages").delete().eq("project_id", projectId).lte("stage_number", 15);
    for (let i = 0; i < stageRows.length; i += 50) {
      await (supabase as any).from("project_stages").insert(stageRows.slice(i, i + 50));
    }

    // Auto-clone all factory templates (stage_number 1–15) as project_tasks for each non-N/A stage row.
    // Templates use sub-stage numbers like "1.1", "1.2"; match by integer prefix to the schedule stage #.
    const { data: tmpl } = await (supabase.from("production_task_templates") as any)
      .select("stage_number, task_name, phase_name, stage_name, responsible_role, escalation_role, is_qc_gate, is_payment_milestone, special_note, display_order, task_type")
      .eq("production_system", sys)
      .order("display_order", { ascending: true });

    const stagePrefix = (s: any) => {
      const n = parseInt(String(s ?? "").split(".")[0], 10);
      return Number.isFinite(n) ? n : null;
    };

    const tasksToInsert: any[] = [];
    for (const sr of stageRows) {
      if (sr.is_na) continue;
      const stageTpl = (tmpl || []).filter((t: any) => {
        if (sr.stage_name && t.stage_name && t.stage_name === sr.stage_name) return true;
        return stagePrefix(t.stage_number) === sr.stage_number;
      });
      for (const t of stageTpl) {
        tasksToInsert.push({
          project_id: projectId,
          task_id_in_schedule: t.stage_number,
          task_name: t.task_name,
          phase: t.phase_name,
          stage_name: t.stage_name,
          planned_start_date: sr.planned_start,
          planned_finish_date: sr.planned_end,
          duration_days: 0,
          predecessor_ids: [],
          responsible_role: t.responsible_role,
          escalation_role: t.escalation_role,
          status: "Upcoming",
          completion_percentage: 0,
          delay_days: 0,
          is_locked: false,
          task_type: t.task_type,
          is_qc_gate: !!t.is_qc_gate,
          is_payment_milestone: !!t.is_payment_milestone,
          special_note: t.special_note,
          display_order: t.display_order,
          stage_number: t.stage_number,
        });
      }
    }

    // Fallback: if no templates matched (e.g. system has no sub-stage templates yet),
    // still create one project_task per stage row so the Schedule tab renders immediately.
    if (tasksToInsert.length === 0) {
      for (const sr of stageRows) {
        if (sr.is_na) continue;
        tasksToInsert.push({
          project_id: projectId,
          task_id_in_schedule: String(sr.stage_number),
          task_name: sr.stage_name,
          phase: sr.stage_number <= 2 ? "Pre-Production" : sr.stage_number <= 12 ? "Production" : "Dispatch",
          stage_name: sr.stage_name,
          planned_start_date: sr.planned_start,
          planned_finish_date: sr.planned_end,
          duration_days: 0,
          predecessor_ids: [],
          status: "Upcoming",
          completion_percentage: 0,
          delay_days: 0,
          is_locked: false,
          display_order: sr.stage_number,
          stage_number: String(sr.stage_number),
        });
      }
    }

    await supabase.from("project_tasks").delete().eq("project_id", projectId);
    for (let i = 0; i < tasksToInsert.length; i += 100) {
      await supabase.from("project_tasks").insert(tasksToInsert.slice(i, i + 100) as any);
    }

    const naCount = stageRows.filter(s => s.is_na).length;
    const msg = `${stageRows.length} stages imported (${naCount} marked N/A), ${tasksToInsert.length} tasks cloned`;
    return { name: "Schedule", ok: true, count: stageRows.length, message: msg, warnings: skipped.length ? [`${skipped.length} rows skipped (missing dates)`] : [] };
  }


  async function processMaterial(ws: XLSX.WorkSheet | undefined, userId: string | null): Promise<SheetResult> {
    if (!ws) return { name: "Materials", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return { name: "Materials", ok: true, count: 0, message: "Sheet empty" };
    const items = rows.filter(r => r["Material"] || r["Material Description"]).map((r, i) => ({
      item_id: String(i + 1),
      section: String(r["Section"] || "Shell and Core"),
      material_description: String(r["Material"] || r["Material Description"]),
      tender_qty: Number(r["Tender Qty"]) || null,
      unit: String(r["Unit"] || "") || null,
      planned_po_release_date: parseDate(r["PO Release Date"]),
      planned_procurement_date: parseDate(r["Procurement Date"]),
      planned_delivery_date: parseDate(r["Delivery Date"]),
      status: "Planned",
    }));
    if (items.length === 0) return { name: "Materials", ok: true, count: 0, message: "No items" };
    const { data: prev } = await (supabase.from("project_material_plans") as any).select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(1);
    const nextV = ((prev as any)?.[0]?.version ?? 0) + 1;
    const { data: plan, error } = await (supabase.from("project_material_plans") as any).insert({ project_id: projectId, version: nextV, uploaded_by: userId ?? "" }).select("id").single();
    if (error || !plan) return { name: "Materials", ok: false, count: 0, message: error?.message || "Plan create failed" };
    const withPlan = items.map(it => ({ ...it, plan_id: (plan as any).id }));
    for (let i = 0; i < withPlan.length; i += 50) await (supabase.from("project_material_plan_items") as any).insert(withPlan.slice(i, i + 50));
    return { name: "Materials", ok: true, count: items.length, message: `${items.length} items imported` };
  }

  async function processScope(ws: XLSX.WorkSheet | undefined, userId: string): Promise<SheetResult> {
    if (!ws) return { name: "Scope", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rows.length === 0) return { name: "Scope", ok: true, count: 0, message: "Sheet empty" };
    const items = rows.filter(r => r["Item"]).map((r, i) => {
      const scopeVal = String(r["Scope"] || "").toLowerCase();
      let resp: string = "not_in_scope";
      if (scopeVal.includes("habit")) resp = "habitainer";
      else if (scopeVal.includes("external")) resp = "external_contractor";
      else if (scopeVal.includes("tbd")) resp = "not_in_scope";
      return {
        section_label: String(r["Area"] || "Builder Finish"),
        item_name: String(r["Item"]),
        responsibility: resp,
        sort_order: i,
      };
    });
    if (items.length === 0) return { name: "Scope", ok: true, count: 0, message: "No items" };

    const { data: existing } = await supabase.from("project_scope_of_work").select("id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let scopeId = (existing as any)?.id;
    if (!scopeId) {
      const { data, error } = await supabase.from("project_scope_of_work").insert({ project_id: projectId, created_by: userId } as any).select("id").single();
      if (error) return { name: "Scope", ok: false, count: 0, message: error.message };
      scopeId = (data as any).id;
    }
    await supabase.from("project_scope_items").delete().eq("scope_id", scopeId);
    const sectionMap: Record<string, string> = {
      "design": "design_consultants", "consultants": "design_consultants",
      "builder": "builder_finish", "finish": "builder_finish",
      "external": "external_structures", "structures": "external_structures",
      "site": "site_related",
    };
    const payload = items.map(it => {
      const lower = it.section_label.toLowerCase();
      let section = "builder_finish";
      for (const [k, v] of Object.entries(sectionMap)) if (lower.includes(k)) { section = v; break; }
      return { scope_id: scopeId, section, item_name: it.item_name, responsibility: it.responsibility, sort_order: it.sort_order };
    });
    const { error } = await supabase.from("project_scope_items").insert(payload as any);
    if (error) return { name: "Scope", ok: false, count: 0, message: error.message };
    return { name: "Scope", ok: true, count: items.length, message: `${items.length} items imported` };
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setResults([]); setOpen(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const findSheet = (...names: string[]) => {
        for (const n of names) {
          const found = wb.SheetNames.find(s => s.toLowerCase().trim() === n.toLowerCase());
          if (found) return wb.Sheets[found];
        }
        return undefined;
      };
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("auth_user_id", userId || "").maybeSingle();
      const userName = (prof as any)?.full_name || user?.email || null;

      const out: SheetResult[] = [];
      out.push(await processBilling(findSheet("Billing Milestones", "Billing")));
      out.push(await processBOQ(findSheet("BOQ + Margin", "Tender BOQ", "BOQ"), userId, userName));
      out.push(await processSchedule(findSheet("Project Schedule", "Schedule")));
      out.push(await processMaterial(findSheet("Material Plan", "Materials"), userId));
      if (userId) out.push(await processScope(findSheet("Scope of Work", "Scope"), userId));

      setResults(out);
      const totalImported = out.reduce((s, r) => s + (r.ok ? r.count : 0), 0);
      if (totalImported > 0) {
        toast.success(`Project setup imported — ${totalImported} rows total`);
        // Stamp the project so individual upload buttons hide on every tab
        await (supabase.from("projects") as any)
          .update({ setup_uploaded_at: new Date().toISOString(), setup_uploaded_by_name: userName })
          .eq("id", projectId);
      }
      // Notify every tab on this page so they refetch immediately
      dispatchProjectImported(projectId);
      onImported?.();
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={downloadTemplate} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Project Setup Template
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5" style={{ backgroundColor: "#006039", color: "white" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Project Setup
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {busy ? "Processing Project Setup…" : results.length > 0 && results.every(r => r.ok)
                ? "Project Setup uploaded successfully"
                : "Project Setup Import"}
            </DialogTitle>
            <DialogDescription>
              {busy ? "Reading every sheet and writing to the project tabs." : "Each sheet was processed independently."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {busy && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</div>}
            {results.map(r => (
              <div key={r.name} className="text-sm flex items-start gap-2">
                {r.ok ? <Check className="h-4 w-4 mt-0.5" style={{ color: "#006039" }} /> : <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: "#F40009" }} />}
                <div className="flex-1">
                  <div>
                    <span className="font-semibold">
                      {r.name === "Billing" ? "Billing" :
                        r.name === "BOQ" ? "BOQ" :
                        r.name === "Schedule" ? "Schedule" :
                        r.name === "Materials" ? "Materials" :
                        r.name === "Scope" ? "Scope" : r.name}:
                    </span>{" "}
                    {r.ok && r.count > 0 ? (
                      <>
                        <span className="font-mono">{r.count}</span>{" "}
                        {r.name === "Billing" ? "milestone" + (r.count > 1 ? "s" : "") + " loaded" :
                          r.name === "BOQ" ? "items loaded" :
                          r.name === "Schedule" ? "stages loaded" :
                          r.name === "Materials" ? "items loaded" :
                          r.name === "Scope" ? "items loaded" : r.message}
                      </>
                    ) : r.message}
                  </div>
                  {r.warnings?.map((w, i) => (
                    <div key={i} className="text-xs flex items-center gap-1" style={{ color: "#D4860A" }}><AlertTriangle className="h-3 w-3" /> {w}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {!busy && results.some(r => r.ok && r.count > 0) && (
              <Button size="sm" style={{ backgroundColor: "#006039", color: "white" }} onClick={() => { setOpen(false); navigate(`/projects/${projectId}`); }}>
                Go to Project <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
