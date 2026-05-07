import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  ClipboardList, ShieldCheck, AlertTriangle, CheckSquare,
  Database, Users, Download, Plus, Loader2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, ROLE_TIERS, type AppRole } from "@/lib/roles";
import { format } from "date-fns";

/* ─── Task Master ─── */

const PRODUCTION_SYSTEMS = ["Modular", "Panel-based", "Hybrid", "All"];
const TASK_TYPES = ["Task", "QC Gate", "Sign-off", "Payment", "Milestone"];
const PHASES = ["Design", "Procurement", "Factory Production", "QC", "Dispatch", "Site Installation", "Handover"];

function downloadTaskMasterTemplate(tasks: any[]) {
  import("xlsx").then((XLSX) => {
    const headers = ["Stage #", "Phase", "Task Type", "Task Name", "Production System", "Responsible Role", "Responsible User", "Predecessor Stage #s", "Typical Duration", "Notes"];
    const rows = tasks.map((t) => [
      t.stage_number ?? "", t.phase ?? "", t.task_type ?? "", t.task_name ?? "",
      t.production_system ?? "All", t.responsible_role ?? "", t.responsible_user ?? "",
      t.predecessor_stages ?? "", t.typical_duration ?? "", t.notes ?? "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Task Master");
    XLSX.writeFile(wb, "HStack_TaskMaster.xlsx");
  });
}

function TaskMasterTab() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    stage_number: "", phase: "", task_type: "Task", task_name: "",
    production_system: "All", responsible_role: "", typical_duration: "", notes: "",
  });

  useEffect(() => {
    (supabase.from("task_master" as any) as any).select("*").order("stage_number", { ascending: true })
      .then(({ data }: any) => { setTasks(data ?? []); setLoading(false); });
  }, []);

  const handleSave = async () => {
    if (!form.task_name.trim() || !form.stage_number.trim()) {
      toast.error("Stage # and Task Name are required"); return;
    }
    setSaving(true);
    const { client } = await getAuthedClient();
    const { error } = await (client.from("task_master" as any) as any).insert({
      stage_number: form.stage_number,
      phase: form.phase,
      task_type: form.task_type,
      task_name: form.task_name.trim(),
      production_system: form.production_system,
      responsible_role: form.responsible_role || null,
      typical_duration: form.typical_duration || null,
      notes: form.notes || null,
    });
    if (error) { toast.error(error.message); } else {
      toast.success("Task added");
      setAddOpen(false);
      setForm({ stage_number: "", phase: "", task_type: "Task", task_name: "", production_system: "All", responsible_role: "", typical_duration: "", notes: "" });
      const { data } = await (supabase.from("task_master" as any) as any).select("*").order("stage_number");
      setTasks(data ?? []);
    }
    setSaving(false);
  };

  const SAMPLE_TASKS = [
    { stage_number: "1.1", phase: "Design", task_type: "Task", task_name: "Client brief and requirements capture", production_system: "All", responsible_role: "planning_engineer", typical_duration: "3", notes: "" },
    { stage_number: "1.7", phase: "Design", task_type: "Sign-off", task_name: "[SIGN-OFF] GFC Issue", production_system: "All", responsible_role: "principal_architect", typical_duration: "1", notes: "Triggers factory unlock" },
    { stage_number: "3A.1", phase: "Factory Production", task_type: "Task", task_name: "Steel sorting and cutting", production_system: "Modular", responsible_role: "factory_floor_supervisor", typical_duration: "2", notes: "" },
    { stage_number: "3F.1", phase: "QC", task_type: "QC Gate", task_name: "[QC] Pre-pour inspection", production_system: "Modular", responsible_role: "qc_inspector", typical_duration: "1", notes: "" },
    { stage_number: "4.4", phase: "QC", task_type: "Sign-off", task_name: "[SIGN-OFF] Module QC sign-off", production_system: "Modular", responsible_role: "qc_inspector", typical_duration: "1", notes: "" },
    { stage_number: "5.1", phase: "Dispatch", task_type: "Payment", task_name: "[PAYMENT] Design stage claim", production_system: "All", responsible_role: "finance_manager", typical_duration: "1", notes: "" },
    { stage_number: "6.2", phase: "Dispatch", task_type: "Sign-off", task_name: "[SIGN-OFF] Quality sign-off", production_system: "All", responsible_role: "qc_inspector", typical_duration: "1", notes: "" },
  ];
  const displayTasks = tasks.length > 0 ? tasks : SAMPLE_TASKS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Task Master</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadTaskMasterTemplate(displayTasks)}>
            <Download className="h-3.5 w-3.5 mr-1" />Download
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039", color: "#fff" }}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Task
          </Button>
        </div>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                  {["Stage #", "Phase", "Type", "Task Name", "System", "Responsible Role", "Duration"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTasks.map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F0F0F0" }}>
                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: "#006039" }}>{t.stage_number}</td>
                    <td className="px-3 py-2" style={{ color: "#666" }}>{t.phase}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{
                        backgroundColor: t.task_type === "QC Gate" ? "#FFF0F0" : t.task_type === "Sign-off" ? "#E8F2ED" : t.task_type === "Payment" ? "#FFF8E8" : "#F5F5F5",
                        color: t.task_type === "QC Gate" ? "#F40009" : t.task_type === "Sign-off" ? "#006039" : t.task_type === "Payment" ? "#D4860A" : "#666",
                      }}>{t.task_type}</span>
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{t.task_name}</td>
                    <td className="px-3 py-2" style={{ color: "#666" }}>{t.production_system}</td>
                    <td className="px-3 py-2" style={{ color: "#666" }}>{ROLE_LABELS[t.responsible_role as AppRole] ?? t.responsible_role ?? "—"}</td>
                    <td className="px-3 py-2" style={{ color: "#666" }}>{t.typical_duration ? `${t.typical_duration}d` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1"><Label className="text-xs">Stage # *</Label><Input value={form.stage_number} onChange={(e) => setForm((p) => ({ ...p, stage_number: e.target.value }))} placeholder="e.g. 3A.1" /></div>
            <div className="space-y-1"><Label className="text-xs">Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setForm((p) => ({ ...p, phase: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{PHASES.map((ph) => <SelectItem key={ph} value={ph}>{ph}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Task Name *</Label><Input value={form.task_name} onChange={(e) => setForm((p) => ({ ...p, task_name: e.target.value }))} placeholder="Task name" /></div>
            <div className="space-y-1"><Label className="text-xs">Task Type</Label>
              <Select value={form.task_type} onValueChange={(v) => setForm((p) => ({ ...p, task_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Production System</Label>
              <Select value={form.production_system} onValueChange={(v) => setForm((p) => ({ ...p, production_system: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRODUCTION_SYSTEMS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Responsible Role</Label>
              <Select value={form.responsible_role} onValueChange={(v) => setForm((p) => ({ ...p, responsible_role: v }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{Object.entries(ROLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Typical Duration (days)</Label><Input type="number" value={form.typical_duration} onChange={(e) => setForm((p) => ({ ...p, typical_duration: e.target.value }))} placeholder="e.g. 3" /></div>
            <div className="space-y-1 col-span-2"><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: "#006039", color: "#fff" }}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Roles & Access ─── */

const MODULES = ["Dashboard", "Projects", "Production", "QC", "Procurement", "Design", "Sales", "Finance", "HR", "Admin", "Variations", "Client Portal", "SOP Library"];

function RolesAccessTab() {
  const roles = Object.entries(ROLE_LABELS) as [AppRole, string][];

  const downloadMatrix = () => {
    import("xlsx").then((XLSX) => {
      const headers = ["Role", ...MODULES];
      const rows = roles.map(([role, label]) => [label, ...MODULES.map(() => "ON")]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Roles & Access");
      XLSX.writeFile(wb, "HStack_RolesAccess.xlsx");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Roles & Access Matrix</h2>
        <Button size="sm" variant="outline" onClick={downloadMatrix}>
          <Download className="h-3.5 w-3.5 mr-1" />Download Matrix
        </Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-[#F7F7F7] min-w-[180px]">Role</th>
                {MODULES.map((m) => <th key={m} className="px-2 py-2 font-semibold whitespace-nowrap">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.map(([role, label]) => (
                <tr key={role} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td className="px-3 py-2 font-medium sticky left-0 bg-white" style={{ color: "#1A1A1A" }}>{label}</td>
                  {MODULES.map((m) => {
                    const hasAccess = ["managing_director", "super_admin"].includes(role) || (
                      (m === "Finance" && ["finance_director", "finance_manager", "accounts_executive"].includes(role)) ||
                      (m === "Production" && ["production_head", "factory_floor_supervisor", "fabrication_foreman", "qc_inspector", "planning_engineer", "electrical_installer", "elec_plumbing_installer"].includes(role)) ||
                      (m === "Procurement" && ["procurement", "stores_executive", "head_operations", "costing_engineer"].includes(role)) ||
                      (m === "Design" && ["principal_architect", "project_architect", "structural_architect", "architecture_director"].includes(role)) ||
                      (m === "Sales" && ["sales_director"].includes(role)) ||
                      (m === "HR" && ["hr_executive"].includes(role)) ||
                      (m === "Admin" && ["hr_executive", "head_operations"].includes(role)) ||
                      (m === "Dashboard" || m === "Projects" || m === "SOP Library")
                    );
                    return (
                      <td key={m} className="px-2 py-2 text-center">
                        <Switch checked={hasAccess} onCheckedChange={() => toast.info("Role access configuration coming soon")} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Escalation Matrix ─── */

const ESCALATION_RULES = [
  { type: "Overdue Material Delivery", l1_owner: "Stores Executive (Vijay)", l1_sla: "4h", l2_owner: "Planning Engineer (Karthik)", l2_sla: "8h", l3_owner: "Managing Director (Gaurav)", l3_sla: "24h" },
  { type: "Open NCR — Critical", l1_owner: "Factory Supervisor (Rakesh)", l1_sla: "2h", l2_owner: "Production Head (Azad)", l2_sla: "4h", l3_owner: "MD (Gaurav)", l3_sla: "8h" },
  { type: "Open NCR — Standard", l1_owner: "Factory Supervisor (Rakesh)", l1_sla: "4h", l2_owner: "Production Head (Azad)", l2_sla: "8h", l3_owner: "—", l3_sla: "—" },
  { type: "Design Query — High", l1_owner: "Project Architect (Venkat)", l1_sla: "2h", l2_owner: "Principal Architect (Karan)", l2_sla: "4h", l3_owner: "MD (Gaurav)", l3_sla: "8h" },
  { type: "Invoice Overdue", l1_owner: "Finance Manager (Mary)", l1_sla: "24h", l2_owner: "Finance Director (Shiv)", l2_sla: "48h", l3_owner: "MD (Gaurav)", l3_sla: "72h" },
  { type: "Site Punch List Item", l1_owner: "Site Mgr (Awaiz)", l1_sla: "4h", l2_owner: "Head Ops (Suraj)", l2_sla: "8h", l3_owner: "—", l3_sla: "—" },
];

function EscalationMatrixTab() {
  const [rules, setRules] = useState(ESCALATION_RULES.map((r, i) => ({ ...r, id: i, editing: false })));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Escalation Matrix</h2>
        <Button size="sm" onClick={() => toast.info("Add escalation rule coming soon")} style={{ backgroundColor: "#006039", color: "#fff" }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add Rule
        </Button>
      </div>
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                {["Alert Type", "L1 Owner", "L1 SLA", "L2 Owner", "L2 SLA", "L3 Owner", "L3 SLA", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{r.type}</td>
                  <td className="px-3 py-2" style={{ color: "#666" }}>{r.l1_owner}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#D4860A" }}>{r.l1_sla}</td>
                  <td className="px-3 py-2" style={{ color: "#666" }}>{r.l2_owner}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#D4860A" }}>{r.l2_sla}</td>
                  <td className="px-3 py-2" style={{ color: "#666" }}>{r.l3_owner}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#D4860A" }}>{r.l3_sla}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" className="h-6 text-xs px-2"
                      onClick={() => toast.info("Edit escalation rule coming soon")}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Approvals ─── */

const APPROVAL_RULES = [
  { process: "PO Approval", raised_by: "Procurement / Stores", approver_l1: "Planning Engineer", approver_l2: "Finance Director (>₹50k)", threshold: "₹50,000" },
  { process: "Work Order", raised_by: "Production Head / Site Mgr", approver_l1: "Planning Engineer", approver_l2: "Finance Director (>₹50k)", threshold: "₹50,000" },
  { process: "Variation", raised_by: "Planning Engineer", approver_l1: "Sales Director", approver_l2: "MD (>₹1L)", threshold: "₹1,00,000" },
  { process: "Discount >15%", raised_by: "Sales Executive", approver_l1: "Sales Director", approver_l2: "MD", threshold: "15%" },
  { process: "Add User", raised_by: "HR Executive / Manager", approver_l1: "MD", approver_l2: "—", threshold: "—" },
  { process: "Deactivate User", raised_by: "HR Executive / Manager", approver_l1: "MD", approver_l2: "—", threshold: "—" },
  { process: "Create Project (Habitainer)", raised_by: "Planning Head (Suraj)", approver_l1: "Sales Director (John)", approver_l2: "—", threshold: "—" },
  { process: "Create Project (ADS)", raised_by: "Planning Head (Suraj)", approver_l1: "Principal Architect (Karan)", approver_l2: "—", threshold: "—" },
  { process: "Archive Project", raised_by: "Director", approver_l1: "MD", approver_l2: "—", threshold: "—" },
];

function ApprovalsTab() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Approval Rules</h2>
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                {["Process", "Raised By", "L1 Approver", "L2 Approver", "Threshold"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPROVAL_RULES.map((r) => (
                <tr key={r.process} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td className="px-3 py-2 font-semibold" style={{ color: "#1A1A1A" }}>{r.process}</td>
                  <td className="px-3 py-2" style={{ color: "#666" }}>{r.raised_by}</td>
                  <td className="px-3 py-2 font-medium" style={{ color: "#006039" }}>{r.approver_l1}</td>
                  <td className="px-3 py-2" style={{ color: "#666" }}>{r.approver_l2}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#D4860A" }}>{r.threshold}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Data Bank ─── */

const DATA_BANK_SETS = [
  { name: "BOQ Master", description: "Master bill of quantities for all work types", table: "boq_master" },
  { name: "Labour Contractor Rates", description: "Standard rates for labour contractors", table: "labour_contractor_rates" },
  { name: "Subcontractor Register", description: "Approved subcontractor details and rates", table: "subcontractors" },
  { name: "Client Master", description: "Client contact and project history", table: "clients" },
  { name: "Statutory Calendar", description: "GST, TDS, PF and other compliance deadlines", table: "statutory_calendar" },
  { name: "Material Rate Benchmark", description: "Standard material rate benchmarks by category", table: "material_rates" },
  { name: "Opening Inventory", description: "Initial stock counts for store items", table: "inventory_items" },
];

function downloadDataTemplate(name: string) {
  import("xlsx").then((XLSX) => {
    const templateMap: Record<string, string[][]> = {
      "BOQ Master": [["Category", "Description", "Unit", "Standard Rate (₹)", "Notes"]],
      "Labour Contractor Rates": [["Company Name", "Worker Type", "Daily Rate (₹)", "OT Rate/hr (₹)", "Effective Date"]],
      "Subcontractor Register": [["Sub ID", "Name", "Work Type", "Contact", "GSTIN", "PAN", "Rate/Unit", "Unit", "Notes"]],
      "Client Master": [["Client Name", "Contact Person", "Phone", "Email", "Address", "GSTIN"]],
      "Statutory Calendar": [["Compliance Type", "Due Day (monthly)", "Frequency", "Notes"]],
      "Material Rate Benchmark": [["Category", "Item Description", "Unit", "Benchmark Rate (₹)", "Last Updated"]],
      "Opening Inventory": [["Item Code", "Item Name", "Category", "Unit", "Opening Qty", "Location"]],
    };
    const rows = templateMap[name] ?? [["Column 1", "Column 2", "Column 3"]];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, name);
    XLSX.writeFile(wb, `${name.replace(/\s+/g, "_")}_Template.xlsx`);
  });
}

function DataBankTab() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Data Bank</h2>
      <p className="text-sm" style={{ color: "#666" }}>Master data sets that drive calculations, dropdowns, and benchmarks across HStack.</p>
      <div className="grid gap-3">
        {DATA_BANK_SETS.map((ds) => (
          <div key={ds.name} className="rounded-xl border p-4 flex items-center justify-between gap-4" style={{ backgroundColor: "#F7F7F7" }}>
            <div>
              <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{ds.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "#666" }}>{ds.description}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => downloadDataTemplate(ds.name)}>
                <Download className="h-3.5 w-3.5 mr-1" />Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.info(`Upload ${ds.name} coming soon`)}>
                <Upload className="h-3.5 w-3.5 mr-1" />Upload
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Users ─── */

function UsersTab() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("*").order("display_name", { ascending: true })
      .then(({ data }) => { setProfiles(data ?? []); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Users ({profiles.length})</h2>
      </div>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                  {["Name", "Role", "Department", "Status", "Last Login"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const roleLabel = ROLE_LABELS[p.role as AppRole] ?? p.role ?? "—";
                  const tier = Object.entries(ROLE_TIERS).find(([, roles]) => roles.includes(p.role as AppRole))?.[0] ?? "—";
                  const isActive = p.is_active !== false;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{p.display_name ?? "—"}</td>
                      <td className="px-3 py-2" style={{ color: "#666" }}>{roleLabel}</td>
                      <td className="px-3 py-2" style={{ color: "#666" }}>{tier}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{
                          backgroundColor: isActive ? "#E8F2ED" : "#F5F5F5",
                          color: isActive ? "#006039" : "#999",
                        }}>{isActive ? "Active" : "Inactive"}</span>
                      </td>
                      <td className="px-3 py-2 font-mono" style={{ color: "#999" }}>
                        {p.last_login ? format(new Date(p.last_login), "dd/MM/yyyy") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */

export default function SuperAdmin() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Super Admin</h1>
        <p className="text-muted-foreground text-sm mt-1">System configuration, access control, and master data management.</p>
      </div>

      <Tabs defaultValue="task-master">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="task-master" className="gap-1.5"><ClipboardList className="h-4 w-4" />Task Master</TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5"><ShieldCheck className="h-4 w-4" />Roles & Access</TabsTrigger>
            <TabsTrigger value="escalation" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Escalation Matrix</TabsTrigger>
            <TabsTrigger value="approvals" className="gap-1.5"><CheckSquare className="h-4 w-4" />Approvals</TabsTrigger>
            <TabsTrigger value="data-bank" className="gap-1.5"><Database className="h-4 w-4" />Data Bank</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="h-4 w-4" />Users</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="task-master" className="mt-4"><TaskMasterTab /></TabsContent>
        <TabsContent value="roles" className="mt-4"><RolesAccessTab /></TabsContent>
        <TabsContent value="escalation" className="mt-4"><EscalationMatrixTab /></TabsContent>
        <TabsContent value="approvals" className="mt-4"><ApprovalsTab /></TabsContent>
        <TabsContent value="data-bank" className="mt-4"><DataBankTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
