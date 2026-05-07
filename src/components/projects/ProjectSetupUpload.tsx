import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Download, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [results, setResults] = useState<SheetResult[]>([]);

  if (!ALLOWED.includes(userRole ?? "")) return null;

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
    const wb = XLSX.utils.book_new();

    const billing = [
      ["#", "Milestone Description", "%", "GST Applicable (Y/N)", "Trigger Event"],
      [1, "Booking Advance", 10, "No", "Booking"],
      [2, "Shell & Core Phase 1", 30, "Yes", "Shell & Core Start"],
      [3, "Shell & Core Phase 2", 25, "Yes", "Shell & Core Complete"],
      [4, "Builder Finish", 15, "Yes", "Builder Finish"],
      [5, "Finishing Works", 15, "Yes", "Finishing Complete"],
      [6, "Handover", 5, "Yes", "Handover"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(billing), "Billing Milestones");

    const boq = [
      ["S.No", "Category", "Item Description", "Unit", "Tender Qty", "Actual Qty", "Wastage %", "BOQ Qty", "Material Rate", "Labour Rate", "OH Rate", "BOQ Rate", "Total Amount", "Margin %", "Scope"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(boq), "Tender BOQ");

    const sys = (productionSystem || "modular").toLowerCase();
    const { data: tmpl } = await (supabase.from("production_task_templates") as any)
      .select("stage_number, task_name, phase_name, typical_duration_days, predecessor_stage_numbers, display_order")
      .eq("production_system", sys)
      .order("display_order", { ascending: true });
    const scheduleRows: any[][] = [["Phase", "ID", "Name", "Duration", "Predecessors", "Planned Start", "Planned Finish"]];
    let lastPhase = "";
    (tmpl || []).forEach((t: any) => {
      if (t.phase_name && t.phase_name !== lastPhase) {
        scheduleRows.push([t.phase_name, "", "", "", "", "", ""]);
        lastPhase = t.phase_name;
      }
      const preds = Array.isArray(t.predecessor_stage_numbers) ? t.predecessor_stage_numbers.join(", ") : "";
      scheduleRows.push(["", t.stage_number || "", t.task_name || "", t.typical_duration_days ?? "", preds, "", ""]);
    });
    if (scheduleRows.length === 1) scheduleRows.push(["", "", `(No template tasks for system: ${sys})`, "", "", "", ""]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scheduleRows), "Project Schedule");

    const material: any[][] = [
      ["Section", "Material", "Tender Qty", "Unit", "PO Release Date", "Procurement Date", "Delivery Date"],
      ["Shell and Core", "Structural Steel — Beams, Columns, Framed Structure", "", "KG", "", "", ""],
      ["Shell and Core", "LGSF — Wall framing", "", "KG", "", "", ""],
      ["Shell and Core", "Deck Sheet 1.0mm — Floor & Roof", "", "KG", "", "", ""],
      ["Shell and Core", "Welded Wire Mesh 2.5mm 50mm C/C", "", "KG", "", "", ""],
      ["Shell and Core", "Chicken Wire Mesh 1mm 25mm", "", "KG", "", "", ""],
      ["Shell and Core", "EPS Thermocol Sheet", "", "Nos", "", "", ""],
      ["Shell and Core", "Self Drilling Screws", "", "Nos", "", "", ""],
      ["Shell and Core", "Roofing Concrete Plain Cement Mortar", "", "CFT", "", "", ""],
      ["Builder Finish", "Rockwool Slab 48kg 50mm — Inner Wall", "", "SFT", "", "", ""],
      ["Builder Finish", "Habit Board 13mm — Inner Wall", "", "SFT", "", "", ""],
      ["Builder Finish", "Toilet Cement Board", "", "SFT", "", "", ""],
      ["Builder Finish", "Shera Neu Wall Board 10mm — External", "", "SFT", "", "", ""],
      ["Builder Finish", "Gypsum Board 12.5mm — Ceiling", "", "SFT", "", "", ""],
      ["Builder Finish", "Internal Painting (Compound, Putty, Primer, Paint)", "", "SFT", "", "", ""],
      ["Builder Finish", "Shera Plank — Exterior Finish", "", "SFT", "", "", ""],
      ["Builder Finish", "Aluminium Foil", "", "SQM", "", "", ""],
      ["Builder Finish", "Aluminium Glass Windows", "", "SFT", "", "", ""],
      ["Builder Finish", "Aluminium Vents", "", "SFT", "", "", ""],
      ["Builder Finish", "Wooden Flooring", "", "SFT", "", "", ""],
      ["Builder Finish", "Vitrified Flooring and Tile Dadoing", "", "SFT", "", "", ""],
      ["Builder Finish", "Rain Water Gutter PVC", "", "KG", "", "", ""],
      ["Builder Finish", "Concealed Items — Electrical", "", "Lot", "", "", ""],
      ["Builder Finish", "Concealed Items — Plumbing", "", "Lot", "", "", ""],
      ["Builder Finish", "Plumbing Fixtures", "", "Lot", "", "", ""],
      ["Builder Finish", "Electrical Fixtures", "", "Lot", "", "", ""],
      ["Builder Finish", "Roof Screeding 50mm", "", "CFT", "", "", ""],
      ["Builder Finish", "AC Copper Piping 1.5MT", "", "MTR", "", "", ""],
      ["Builder Finish", "MS Flashing", "", "Lot", "", "", ""],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(material), "Material Plan");

    const scope: any[][] = [
      ["Area", "Item", "Scope"],
      ["Builder Finish", "Structure", "Habitainer"],
      ["Builder Finish", "Internal Wall Panelling", "Habitainer"],
      ["Builder Finish", "External Cladding", "Habitainer"],
      ["Builder Finish", "Flooring", "Habitainer"],
      ["Builder Finish", "Ceiling", "Habitainer"],
      ["Builder Finish", "Painting", "Habitainer"],
      ["Builder Finish", "MEP — Electrical", "Habitainer"],
      ["Builder Finish", "MEP — Plumbing", "Habitainer"],
      ["Builder Finish", "HVAC", "TBD"],
      ["Builder Finish", "Windows and Doors", "Habitainer"],
      ["Builder Finish", "Kitchen Fittings", "TBD"],
      ["Builder Finish", "Bathroom Fittings", "Habitainer"],
      ["Site-Related", "Foundation", "External"],
      ["Site-Related", "Compound Wall", "External"],
      ["Site-Related", "Site Levelling", "External"],
      ["Site-Related", "Landscaping", "TBD"],
      ["External Structures", "Pergola", "TBD"],
      ["External Structures", "Outdoor Deck", "TBD"],
      ["External Structures", "Boundary Wall", "External"],
      ["External Structures", "Swimming Pool", "Not in Scope"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scope), "Scope of Work");

    XLSX.writeFile(wb, "Project_Setup_Template.xlsx");
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
    const parsed: any[] = []; let sno = 0;
    dataRows.forEach(r => {
      const desc = String(r[2] || "").trim();
      if (!desc) return;
      sno++;
      const tenderQty = Number(r[4]) || 0, actualQty = Number(r[5]) || 0, wastagePct = Number(r[6]) || 0;
      const boqQty = Number(r[7]) || (actualQty * (1 + wastagePct / 100));
      const matRate = Number(r[8]) || 0, labRate = Number(r[9]) || 0, ohRate = Number(r[10]) || 0;
      const boqRate = Number(r[11]) || (matRate + labRate + ohRate);
      const totalAmt = Number(r[12]) || (boqQty * boqRate);
      const marginPct = r[13] != null && r[13] !== "" ? Number(r[13]) : 0;
      const scope = String(r[14] || "Factory").trim();
      parsed.push({ sno, category: String(r[1] || "Miscellaneous").trim(), item_description: desc, unit: String(r[3] || ""), tender_qty: tenderQty, actual_qty: actualQty, wastage_pct: wastagePct, boq_qty: boqQty, material_rate: matRate, labour_rate: labRate, oh_rate: ohRate, boq_rate: boqRate, total_amount: totalAmt, margin_pct: marginPct, scope });
    });
    if (parsed.length === 0) return { name: "BOQ", ok: true, count: 0, message: "No items" };
    const { data: prev } = await supabase.from("project_boq").select("version_number").eq("project_id", projectId).order("version_number", { ascending: false }).limit(1);
    const nextV = ((prev as any)?.[0]?.version_number ?? 0) + 1;
    const total = parsed.reduce((s, i) => s + i.total_amount, 0);
    const marginAmt = parsed.reduce((s, i) => s + (i.total_amount * (i.margin_pct || 0) / 100), 0);
    const blended = total > 0 ? (marginAmt / total) * 100 : 0;
    const factory = parsed.filter(i => i.scope === "Factory" || i.scope === "Both").reduce((s, i) => s + i.total_amount, 0);
    const civil = parsed.filter(i => i.scope === "On-Site Civil" || i.scope === "Both").reduce((s, i) => s + i.total_amount, 0);
    const { data: boq, error } = await supabase.from("project_boq").insert({ project_id: projectId, version_number: nextV, uploaded_by: userId, uploaded_by_name: userName, total_boq_value: total, blended_margin_pct: blended, factory_scope_value: factory, civil_scope_value: civil } as any).select().single();
    if (error || !boq) return { name: "BOQ", ok: false, count: 0, message: error?.message || "BOQ create failed" };
    const items = parsed.map(p => ({ boq_id: (boq as any).id, ...p }));
    for (let i = 0; i < items.length; i += 100) {
      const { error: e2 } = await supabase.from("project_boq_items").insert(items.slice(i, i + 100) as any);
      if (e2) return { name: "BOQ", ok: false, count: 0, message: e2.message };
    }
    const cats = new Set(parsed.map(p => p.category)).size;
    return { name: "BOQ", ok: true, count: parsed.length, message: `${parsed.length} items across ${cats} categories` };
  }

  async function processSchedule(ws: XLSX.WorkSheet | undefined): Promise<SheetResult> {
    if (!ws) return { name: "Schedule", ok: false, count: 0, message: "Sheet missing" };
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "dd/mm/yyyy" });
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      if (rows[i]?.some((c: any) => { const v = String(c).toLowerCase().trim(); return v === "name" || v === "id"; })) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return { name: "Schedule", ok: true, count: 0, message: "No header — skipped" };
    const headers = rows[headerIdx].map((h: any) => String(h ?? "").toLowerCase().trim());
    const c = {
      id: headers.findIndex(h => h === "id"),
      name: headers.findIndex(h => h === "name" || h.includes("task")),
      duration: headers.findIndex(h => h.includes("duration")),
      pred: headers.findIndex(h => h.includes("predecessor")),
      ps: headers.findIndex(h => h.includes("planned start")),
      pf: headers.findIndex(h => h.includes("planned finish")),
    };
    let currentPhase = "Pre-Production";
    const tasks: any[] = []; const skipped: string[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i]; if (!row || row.every((x: any) => !x || !String(x).trim())) continue;
      const colA = String(row[0] ?? "").trim(); const colB = c.id >= 0 ? String(row[c.id] ?? "").trim() : "";
      const nameVal = c.name >= 0 ? String(row[c.name] ?? "").trim() : "";
      if (colA && (!colB || isNaN(Number(colB.replace(/[.]/g, ""))))) {
        if (!nameVal || nameVal === colA) { currentPhase = colA; continue; }
      }
      if (!nameVal && !colB) continue;
      const ps = c.ps >= 0 ? parseDate(row[c.ps]) : null;
      const pf = c.pf >= 0 ? parseDate(row[c.pf]) : null;
      if (!ps || !pf) { skipped.push(`Row ${i + 1}: ${nameVal || colB}`); continue; }
      const predStr = c.pred >= 0 ? String(row[c.pred] ?? "") : "";
      const preds = predStr.split(",").map(s => s.trim().match(/^(\d+(?:\.\d+)?)/)?.[1] || s.trim()).filter(Boolean);
      tasks.push({
        project_id: projectId, task_id_in_schedule: colB || String(i - headerIdx), task_name: nameVal,
        phase: currentPhase, planned_start_date: ps, planned_finish_date: pf,
        duration_days: c.duration >= 0 ? parseInt(String(row[c.duration] ?? "0")) || 0 : 0,
        predecessor_ids: preds, status: "Upcoming", completion_percentage: 0, delay_days: 0, is_locked: preds.length > 0,
      });
    }
    if (tasks.length === 0) return { name: "Schedule", ok: true, count: 0, message: "No tasks" };
    await supabase.from("project_tasks").delete().eq("project_id", projectId);
    for (let i = 0; i < tasks.length; i += 50) await supabase.from("project_tasks").insert(tasks.slice(i, i + 50) as any);
    return { name: "Schedule", ok: true, count: tasks.length, message: `${tasks.length} tasks imported`, warnings: skipped.length ? [`${skipped.length} rows skipped (missing dates)`] : [] };
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
      out.push(await processBOQ(findSheet("Tender BOQ", "BOQ"), userId, userName));
      out.push(await processSchedule(findSheet("Project Schedule", "Schedule")));
      out.push(await processMaterial(findSheet("Material Plan", "Materials"), userId));
      if (userId) out.push(await processScope(findSheet("Scope of Work", "Scope"), userId));

      setResults(out);
      const totalImported = out.reduce((s, r) => s + (r.ok ? r.count : 0), 0);
      if (totalImported > 0) toast.success(`Project setup imported — ${totalImported} rows total`);
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
        <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-1.5">
          <Download className="h-4 w-4" /> Download Project Setup Template
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5" style={{ backgroundColor: "#006039", color: "white" }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload Project Setup
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Project Setup Import</DialogTitle>
            <DialogDescription>Each sheet is processed independently.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {busy && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Processing…</div>}
            {results.map(r => (
              <div key={r.name} className="text-sm flex items-start gap-2">
                {r.ok ? <Check className="h-4 w-4 mt-0.5 text-green-700" /> : <AlertTriangle className="h-4 w-4 mt-0.5 text-red-600" />}
                <div className="flex-1">
                  <div><span className="font-semibold">{r.name}:</span> {r.message}</div>
                  {r.warnings?.map((w, i) => (
                    <div key={i} className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {w}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
