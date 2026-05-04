import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { downloadXlsx, logAudit, readXlsx } from "@/lib/super-admin";
import { toast } from "sonner";

type DataSet = {
  key: string;
  name: string;
  table: string;
  columns: { excel: string; db: string }[];
  conflictKey?: string;
  destructive?: boolean;
};

const SETS: DataSet[] = [
  { key: "boq", name: "BOQ Master Template", table: "production_task_templates",
    columns: [
      { excel: "Stage #", db: "stage_number" },
      { excel: "Phase", db: "phase_name" },
      { excel: "Task Type", db: "task_type" },
      { excel: "Task Name", db: "task_name" },
      { excel: "Production System", db: "production_system" },
      { excel: "Responsible Role", db: "responsible_role" },
      { excel: "Duration (days)", db: "typical_duration_days" },
    ] },
  { key: "labour", name: "Labour Contractor Rates", table: "labour_workers",
    columns: [
      { excel: "Worker Name", db: "name" },
      { excel: "Skill Type", db: "skill_type" },
      { excel: "Department", db: "department" },
      { excel: "Monthly Salary (₹)", db: "monthly_salary" },
      { excel: "Date Joined (YYYY-MM-DD)", db: "date_joined" },
    ] },
  { key: "subcon", name: "Subcontractor Register", table: "subcontractors",
    columns: [
      { excel: "Company Name", db: "company_name" },
      { excel: "Contact Person", db: "contact_person" },
      { excel: "Phone", db: "phone" },
      { excel: "Email", db: "email" },
      { excel: "Work Type", db: "work_type" },
      { excel: "Factory or Site", db: "factory_or_site" },
      { excel: "Pricing Type", db: "pricing_type" },
      { excel: "Typical Rate (₹)", db: "typical_rate" },
    ] },
  { key: "clients", name: "Client Master", table: "clients_master",
    columns: [
      { excel: "Company Name", db: "company_name" },
      { excel: "Contact Person", db: "contact_person" },
      { excel: "Address", db: "address" },
      { excel: "Email", db: "email" },
      { excel: "Phone", db: "phone" },
      { excel: "GSTIN", db: "gstin" },
    ], conflictKey: "company_name" },
  { key: "statutory", name: "Statutory Calendar", table: "statutory_calendar",
    columns: [
      { excel: "Filing Name", db: "filing_name" },
      { excel: "Due Day", db: "due_day" },
      { excel: "Due Month (1-12, blank=any)", db: "due_month" },
      { excel: "Recurrence (monthly/quarterly/annually)", db: "recurrence" },
      { excel: "Applies To", db: "applies_to" },
      { excel: "Notes", db: "notes" },
    ] },
  { key: "benchmarks", name: "Material Rate Benchmark", table: "material_rate_benchmarks",
    columns: [
      { excel: "Category", db: "category" },
      { excel: "Material Name", db: "material_name" },
      { excel: "Unit", db: "unit" },
      { excel: "Benchmark Rate (₹)", db: "benchmark_rate" },
      { excel: "Source", db: "source" },
    ], conflictKey: "category,material_name" },
  { key: "inventory", name: "Opening Inventory", table: "inventory_items",
    destructive: true,
    columns: [
      { excel: "Material Name", db: "material_name" },
      { excel: "Category", db: "category" },
      { excel: "Unit", db: "unit" },
      { excel: "Opening Stock", db: "current_stock" },
      { excel: "Reorder Level", db: "reorder_level" },
    ] },
];

export function DataBankTab() {
  const [activeUpload, setActiveUpload] = useState<{ set: DataSet; rows: Record<string, unknown>[] } | null>(null);
  const [confirmDestructive, setConfirmDestructive] = useState<DataSet | null>(null);

  const { data: uploadLog, refetch } = useQuery({
    queryKey: ["master-data-uploads"],
    queryFn: async () => {
      const { data } = await supabase.from("master_data_uploads" as never).select("*").order("uploaded_at", { ascending: false }).limit(50);
      return (data as unknown as Array<{ id: string; data_set: string; uploaded_at: string; record_count: number; file_name: string | null }>) || [];
    },
  });

  async function handleDownload(set: DataSet) {
    const { data } = await supabase.from(set.table as never).select("*").limit(2000);
    const rows = ((data as unknown as Record<string, unknown>[]) || []).map(r => {
      const out: Record<string, unknown> = {};
      set.columns.forEach(c => { out[c.excel] = r[c.db] ?? ""; });
      return out;
    });
    if (rows.length === 0) {
      const blank: Record<string, unknown> = {};
      set.columns.forEach(c => blank[c.excel] = "");
      rows.push(blank);
    }
    downloadXlsx(rows, `${set.name.replace(/\s+/g,"_")}.xlsx`, set.name.slice(0, 28));
  }

  async function handleUpload(set: DataSet, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = "";
    if (set.destructive) { setConfirmDestructive(set); }
    const rows = await readXlsx(file);
    setActiveUpload({ set, rows });
  }

  async function applyUpload() {
    if (!activeUpload) return;
    const { set, rows } = activeUpload;
    const payload = rows.map(r => {
      const out: Record<string, unknown> = {};
      set.columns.forEach(c => {
        const v = r[c.excel];
        out[c.db] = v === "" ? null : v;
      });
      return out;
    }).filter(p => Object.values(p).some(v => v !== null && v !== ""));

    try {
      if (set.destructive) {
        await supabase.from(set.table as never).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      let result;
      if (set.conflictKey) {
        result = await supabase.from(set.table as never).upsert(payload as never, { onConflict: set.conflictKey } as never);
      } else {
        result = await supabase.from(set.table as never).insert(payload as never);
      }
      if (result.error) throw result.error;

      await supabase.from("master_data_uploads" as never).insert({
        data_set: set.name, record_count: payload.length, file_name: `${set.key}.xlsx`,
      } as never);
      await logAudit({ section: "Data Bank", action: "upload", entity: set.name, new_value: { rows: payload.length, destructive: set.destructive || false } });
      toast.success(`${set.name}: ${payload.length} rows applied`);
      setActiveUpload(null); setConfirmDestructive(null); refetch();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data Set</TableHead>
            <TableHead>Last Uploaded</TableHead>
            <TableHead>Records</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {SETS.map(set => {
              const last = uploadLog?.find(l => l.data_set === set.name);
              return (
                <TableRow key={set.key}>
                  <TableCell className="font-medium">
                    {set.name}
                    {set.destructive && <span className="ml-2 inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> destructive</span>}
                  </TableCell>
                  <TableCell className="text-xs">{last ? new Date(last.uploaded_at).toLocaleString("en-GB") : "—"}</TableCell>
                  <TableCell>{last?.record_count ?? "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={()=>handleDownload(set)}><Download className="h-3.5 w-3.5" /> Download</Button>
                    <label><input type="file" accept=".xlsx" className="hidden" onChange={(e)=>handleUpload(set, e)} /><Button asChild size="sm"><span><Upload className="h-3.5 w-3.5" /> Upload</span></Button></label>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!activeUpload} onOpenChange={(o)=>!o && setActiveUpload(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply {activeUpload?.set.name}?</DialogTitle></DialogHeader>
          <div className="space-y-2 text-sm">
            <p>{activeUpload?.rows.length} rows in the uploaded file.</p>
            {activeUpload?.set.destructive && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <p>This will reset all {activeUpload.set.name.toLowerCase()} balances to the uploaded values. <strong>This cannot be undone.</strong></p>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setActiveUpload(null)}>Cancel</Button>
            <Button variant={activeUpload?.set.destructive ? "destructive" : "default"} onClick={applyUpload}>Apply</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
