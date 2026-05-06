import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { ArrowLeft, Plus, Loader2, MapPin, Calendar, Building2, Box, FileText, Phone, Mail, DollarSign, CreditCard, BarChart2, GitMerge, ClipboardList, Download, ExternalLink, Package } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { AddModuleDialog } from "@/components/projects/AddModuleDialog";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { HandoverPack } from "@/components/site/HandoverPack";
import { BillingMilestones } from "@/components/finance/BillingMilestones";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";
import { useProjectContext } from "@/contexts/ProjectContext";

const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const STAGE_ADVANCE_ROLES = ["planning_engineer", "production_head", "super_admin", "managing_director"];

const COST_CATEGORIES = [
  { key: "materials", label: "Materials", pct: 0.52 },
  { key: "labour", label: "Labour & Fabrication", pct: 0.20 },
  { key: "logistics", label: "Logistics", pct: 0.06 },
  { key: "mep", label: "MEP & Electrical", pct: 0.12 },
  { key: "overhead", label: "Overhead", pct: 0.10 },
];

const MODULAR_TASKS = [
  ["", "ID", "Task Name", "Duration (days)", "Predecessors", "Planned Start", "Planned Finish"],
  ["", "1", "Project Initiation", "", "", "", ""],
  ["", "1.1", "Client brief and requirements capture", "", "", "", ""],
  ["", "1.2", "Site survey and feasibility study", "", "", "", ""],
  ["", "1.3", "Schematic design and concept approval", "", "", "", ""],
  ["", "1.4", "Structural & MEP design coordination", "", "", "", ""],
  ["", "1.5", "GFC drawing preparation", "", "", "", ""],
  ["", "1.6", "Internal design review", "", "", "", ""],
  ["", "1.7", "[SIGN-OFF] GFC Issue", "", "", "", ""],
  ["", "2", "Procurement & Materials", "", "", "", ""],
  ["", "2.1", "Bill of Quantities preparation", "", "", "", ""],
  ["", "2.2", "Vendor RFQ and comparison", "", "", "", ""],
  ["", "2.3", "Purchase orders raised", "", "", "", ""],
  ["", "2.4", "Materials received at factory", "", "", "", ""],
  ["", "3", "Factory Production", "", "", "", ""],
  ["", "3A.1", "Steel sorting and cutting", "", "", "", ""],
  ["", "3A.2", "Section welding", "", "", "", ""],
  ["", "3B.1", "Main frame fabrication", "", "", "", ""],
  ["", "3B.2", "Secondary structure installation", "", "", "", ""],
  ["", "3C.1", "Flooring system installation", "", "", "", ""],
  ["", "3C.2", "Ceiling system installation", "", "", "", ""],
  ["", "3D.1", "Wall panel installation", "", "", "", ""],
  ["", "3D.2", "Insulation and vapour barrier", "", "", "", ""],
  ["", "3E.1", "MEP rough-in", "", "", "", ""],
  ["", "3E.2", "MEP first fix inspection", "", "", "", ""],
  ["", "3F.1", "[QC] Pre-pour inspection", "", "", "", ""],
  ["", "3F.2", "Concrete / screed pour", "", "", "", ""],
  ["", "3G.1", "Finishes and joinery", "", "", "", ""],
  ["", "3G.2", "Fixtures and fittings", "", "", "", ""],
  ["", "4", "Quality Assurance", "", "", "", ""],
  ["", "4.1", "[QC] Module structural inspection", "", "", "", ""],
  ["", "4.2", "[QC] MEP functional test", "", "", "", ""],
  ["", "4.3", "[QC] Finishes walkthrough", "", "", "", ""],
  ["", "4.4", "[SIGN-OFF] Module QC sign-off", "", "", "", ""],
  ["", "5", "Client Milestone Billing", "", "", "", ""],
  ["", "5.1", "[PAYMENT] Design stage claim", "", "", "", ""],
  ["", "5.2", "[PAYMENT] Frame completion claim", "", "", "", ""],
  ["", "5.3", "[PAYMENT] Module completion claim", "", "", "", ""],
  ["", "5.4", "[PAYMENT] Handover claim", "", "", "", ""],
  ["", "6", "Dispatch & Installation", "", "", "", ""],
  ["", "6.1", "[QC] Pre-dispatch inspection", "", "", "", ""],
  ["", "6.2", "[SIGN-OFF] Quality sign-off", "", "", "", ""],
  ["", "6.3", "Module loading and transport", "", "", "", ""],
  ["", "6.4", "Site preparation and crane lift", "", "", "", ""],
  ["", "6.5", "Module setting and connection", "", "", "", ""],
  ["", "6.6", "Site services connection", "", "", "", ""],
  ["", "7", "Handover", "", "", "", ""],
  ["", "7.1", "Final snagging walkthrough", "", "", "", ""],
  ["", "7.2", "Client acceptance sign-off", "", "", "", ""],
  ["", "7.3", "As-built documentation issued", "", "", "", ""],
];

const PANELISED_TASKS = [
  ["", "ID", "Task Name", "Duration (days)", "Predecessors", "Planned Start", "Planned Finish"],
  ["", "1", "Design & Engineering", "", "", "", ""],
  ["", "1.1", "Panel layout and design", "", "", "", ""],
  ["", "1.2", "Structural engineering sign-off", "", "", "", ""],
  ["", "1.3", "[SIGN-OFF] GFC Issue for panels", "", "", "", ""],
  ["", "2", "Procurement", "", "", "", ""],
  ["", "2.1", "LGSF steel procurement", "", "", "", ""],
  ["", "2.2", "Sheathing boards and insulation procurement", "", "", "", ""],
  ["", "2.3", "Materials received at factory", "", "", "", ""],
  ["", "3", "Panel Production", "", "", "", ""],
  ["", "3.1", "LGSF frame assembly", "", "", "", ""],
  ["", "3.2", "Moisture barrier installation", "", "", "", ""],
  ["", "3.3", "Sheathing board fixing", "", "", "", ""],
  ["", "3.4", "Insulation packing", "", "", "", ""],
  ["", "3.5", "Internal lining board", "", "", "", ""],
  ["", "3.6", "MEP pre-wire rough-in", "", "", "", ""],
  ["", "3.7", "[QC] Panel flatness and dimension check", "", "", "", ""],
  ["", "3.8", "[QC] MEP continuity test", "", "", "", ""],
  ["", "3.9", "[SIGN-OFF] Panel QC sign-off", "", "", "", ""],
  ["", "4", "Billing Milestones", "", "", "", ""],
  ["", "4.1", "[PAYMENT] Design and procurement claim", "", "", "", ""],
  ["", "4.2", "[PAYMENT] Panel frame completion claim", "", "", "", ""],
  ["", "4.3", "[PAYMENT] Panel completion claim", "", "", "", ""],
  ["", "4.4", "[PAYMENT] Site installation claim", "", "", "", ""],
  ["", "5", "Dispatch & Site Installation", "", "", "", ""],
  ["", "5.1", "[QC] Pre-dispatch panel inspection", "", "", "", ""],
  ["", "5.2", "Panel loading and transport", "", "", "", ""],
  ["", "5.3", "Site foundation and slab check", "", "", "", ""],
  ["", "5.4", "Panel erection and bracing", "", "", "", ""],
  ["", "5.5", "External cladding and waterproofing", "", "", "", ""],
  ["", "5.6", "Site MEP second fix", "", "", "", ""],
  ["", "6", "Handover", "", "", "", ""],
  ["", "6.1", "Final snagging walkthrough", "", "", "", ""],
  ["", "6.2", "Client acceptance sign-off", "", "", "", ""],
  ["", "6.3", "As-built documentation issued", "", "", "", ""],
];

function downloadScheduleTemplate(projectName: string, constructionType: string) {
  const tasks = constructionType?.toLowerCase().includes("panel") ? PANELISED_TASKS : MODULAR_TASKS;
  import("xlsx").then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet([[""], ...tasks]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule");
    XLSX.writeFile(wb, `${projectName.replace(/\s+/g, "_")}_Schedule_Template.xlsx`);
  });
}

function BudgetSummary({ project, projectId, onViewGRNs, onManualEntry }: {
  project: any; projectId: string; onViewGRNs: () => void; onManualEntry: () => void;
}) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [receivedCount, setReceivedCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: ms }, { count }] = await Promise.all([
        (supabase.from("billing_milestones" as any) as any).select("amount, status").eq("project_id", projectId),
        (supabase.from("material_requests" as any) as any).select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "received"),
      ]);
      setMilestones(ms ?? []);
      setReceivedCount(count ?? 0);
    })();
  }, [projectId]);

  const proj = project as any;
  const contractValue = proj.contract_value ? Number(proj.contract_value) : 0;
  const gfcBudget = proj.gfc_budget ? Number(proj.gfc_budget) : 0;
  const totalBilled = milestones.filter((m) => m.status === "invoiced" || m.status === "paid").reduce((s: number, m: any) => s + (m.amount ?? 0), 0);
  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s: number, m: any) => s + (m.amount ?? 0), 0);
  const balance = contractValue - totalBilled;
  const marginVsContract = contractValue > 0 && gfcBudget > 0 ? ((contractValue - gfcBudget) / contractValue) * 100 : null;

  const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";

  const tiles = [
    { label: "Contract Value", value: fmt(contractValue), color: "#1A1A1A" },
    { label: "GFC Budget", value: fmt(gfcBudget), color: "#1A1A1A" },
    { label: "Billed to Client", value: fmt(totalBilled), color: "#D4860A" },
    { label: "Received", value: fmt(totalPaid), color: "#006039" },
    { label: "Balance to Bill", value: contractValue > 0 ? fmt(balance) : "—", color: balance < 0 ? "#F40009" : "#1A1A1A" },
    { label: "Margin vs Contract", value: marginVsContract !== null ? `${marginVsContract.toFixed(1)}%` : "—", color: marginVsContract !== null && marginVsContract > 0 ? "#006039" : "#999" },
  ];

  const budgetSplit: Record<string, number> = gfcBudget > 0 ? {
    materials: Math.round(gfcBudget * 0.52),
    labour: Math.round(gfcBudget * 0.20),
    logistics: Math.round(gfcBudget * 0.06),
    mep: Math.round(gfcBudget * 0.12),
    overhead: Math.round(gfcBudget * 0.10),
  } : {};

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-4" style={{ backgroundColor: "#F7F7F7" }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border p-3 bg-white">
              <p className="text-xs" style={{ color: "#666" }}>{t.label}</p>
              <p className="text-base font-bold font-display mt-0.5" style={{ color: t.color }}>{t.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs mb-3" style={{ color: "#999" }}>
          GRNs recorded in Procurement automatically update this project&apos;s cost tracking.
          {receivedCount > 0 ? ` ${receivedCount} GRN${receivedCount !== 1 ? "s" : ""} recorded.` : ""}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={onManualEntry}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Manual Entry
          </Button>
          <button type="button" className="text-xs flex items-center gap-1 hover:underline" style={{ color: "#006039" }} onClick={onViewGRNs}>
            View all GRNs for this project <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {gfcBudget > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ backgroundColor: "#F7F7F7", color: "#666" }}>
            Project Cost Analysis
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                  <th className="text-left px-4 py-2 font-semibold">Category</th>
                  <th className="text-right px-4 py-2 font-semibold">GFC Budget</th>
                  <th className="text-right px-4 py-2 font-semibold">Spent CTD</th>
                  <th className="text-right px-4 py-2 font-semibold">Balance</th>
                  <th className="text-right px-4 py-2 font-semibold">Client Price</th>
                  <th className="text-right px-4 py-2 font-semibold">Gross Margin</th>
                </tr>
              </thead>
              <tbody>
                {COST_CATEGORIES.map((cat) => {
                  const budget = budgetSplit[cat.key] ?? 0;
                  const clientShare = contractValue > 0 ? Math.round(contractValue * cat.pct) : 0;
                  const grossMarginPct = clientShare > 0 ? ((clientShare - budget) / clientShare) * 100 : 0;
                  return (
                    <tr key={cat.key} style={{ borderBottom: "1px solid #F0F0F0" }}>
                      <td className="px-4 py-2 font-medium" style={{ color: "#1A1A1A" }}>{cat.label}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#666" }}>₹{budget.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#999" }}>—</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#006039" }}>₹{budget.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: "#1A1A1A" }}>₹{clientShare.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right font-bold" style={{ color: grossMarginPct > 0 ? "#006039" : "#F40009" }}>{grossMarginPct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: "#E8F2ED" }}>
                  <td className="px-4 py-2 font-bold" style={{ color: "#006039" }}>Total</td>
                  <td className="px-4 py-2 text-right font-bold font-mono" style={{ color: "#006039" }}>{fmt(gfcBudget)}</td>
                  <td className="px-4 py-2 text-right font-mono" style={{ color: "#999" }}>—</td>
                  <td className="px-4 py-2 text-right font-bold font-mono" style={{ color: "#006039" }}>{fmt(gfcBudget)}</td>
                  <td className="px-4 py-2 text-right font-bold font-mono" style={{ color: "#006039" }}>{fmt(contractValue)}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: marginVsContract !== null && marginVsContract > 0 ? "#006039" : "#999" }}>
                    {marginVsContract !== null ? `${marginVsContract.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2 text-[10px]" style={{ color: "#999" }}>Spent CTD updates as GRNs are recorded. Estimates based on standard GFC budget allocation.</p>
        </div>
      )}
    </div>
  );
}

function ProjectVariationsTab({ projectId, navigate }: { projectId: string; navigate: ReturnType<typeof useNavigate> }) {
  const [variations, setVariations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("variations" as any) as any)
        .select("id, title, status, cost_impact, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(20);
      setVariations(data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  const statusColor: Record<string, string> = {
    pending: "#D4860A", approved: "#006039", rejected: "#F40009", draft: "#999",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Variations</h2>
        <Button size="sm" variant="outline" onClick={() => navigate("/variations")}>
          <ExternalLink className="h-3.5 w-3.5 mr-1" />Open Variation Register
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : variations.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No variations recorded for this project.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                <th className="text-left px-4 py-2 font-semibold text-xs">Title</th>
                <th className="text-right px-4 py-2 font-semibold text-xs">Cost Impact</th>
                <th className="text-center px-4 py-2 font-semibold text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {variations.map((v) => (
                <tr key={v.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                  <td className="px-4 py-2 font-medium" style={{ color: "#1A1A1A" }}>{v.title}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: "#666" }}>
                    {v.cost_impact != null ? `₹${Number(v.cost_impact).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                      style={{ backgroundColor: `${statusColor[v.status] ?? "#999"}22`, color: statusColor[v.status] ?? "#999" }}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectMaterialsTab({ projectId, projectName, navigate }: { projectId: string; projectName: string; navigate: ReturnType<typeof useNavigate> }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("material_plan_items" as any) as any)
        .select("id, item_description, category, unit, boq_qty, material_rate, total_amount")
        .eq("project_id", projectId)
        .order("category", { ascending: true })
        .limit(50);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Material Plan</h2>
        <Button size="sm" variant="outline" onClick={() => navigate(`/procurement?project=${projectId}`)}>
          <ExternalLink className="h-3.5 w-3.5 mr-1" />Open in Procurement
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No material plan uploaded yet. Go to Procurement to upload a BOQ.</p>
          <Button size="sm" className="mt-3" onClick={() => navigate(`/procurement?project=${projectId}`)}>
            <Package className="h-3.5 w-3.5 mr-1" />Go to Procurement
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7", borderBottom: "1px solid #E0E0E0" }}>
                  <th className="text-left px-3 py-2 font-semibold">Category</th>
                  <th className="text-left px-3 py-2 font-semibold">Item Description</th>
                  <th className="text-center px-3 py-2 font-semibold">Unit</th>
                  <th className="text-right px-3 py-2 font-semibold">BOQ Qty</th>
                  <th className="text-right px-3 py-2 font-semibold">Rate</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F0F0F0" }}>
                    <td className="px-3 py-2" style={{ color: "#666" }}>{item.category ?? "—"}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{item.item_description}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "#666" }}>{item.unit ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: "#666" }}>{item.boq_qty ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: "#666" }}>
                      {item.material_rate != null ? `₹${Number(item.material_rate).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "#006039" }}>
                      {item.total_amount != null ? `₹${Number(item.total_amount).toLocaleString("en-IN")}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setSelectedProjectId } = useProjectContext();
  const [project, setProject] = useState<Tables<"projects"> | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [panels, setPanels] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasHandover, setHasHandover] = useState(false);

  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const canAdvanceStage = STAGE_ADVANCE_ROLES.includes(userRole ?? "");

  useEffect(() => {
    if (id) setSelectedProjectId(id);
  }, [id, setSelectedProjectId]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [projectRes, modulesRes, roleRes, handoverRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("modules").select("*").eq("project_id", id).eq("is_archived", false).order("created_at", { ascending: true }),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null;
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return data;
      }),
      supabase.from("handover_pack").select("id").eq("project_id", id).limit(1),
    ]);

    setProject(projectRes.data);
    setModules(modulesRes.data ?? []);
    setUserRole(roleRes as string | null);
    setHasHandover((handoverRes.data ?? []).length > 0);

    const moduleIds = (modulesRes.data ?? []).map((m: any) => m.id);
    if (moduleIds.length > 0) {
      const { data: panelsData } = await (supabase.from("panels") as any)
        .select("*").in("module_id", moduleIds).eq("is_archived", false).order("created_at", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (panelsData ?? []).forEach((p: any) => {
        if (!grouped[p.module_id]) grouped[p.module_id] = [];
        grouped[p.module_id].push(p);
      });
      setPanels(grouped);
    } else {
      setPanels({});
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects</Button>
      </div>
    );
  }

  const dynamicStatus = computeProjectStatus(modules, hasHandover);
  const statusCfg = PROJECT_STATUS_CONFIG[dynamicStatus];
  const totalPanels = Object.values(panels).reduce((sum, arr) => sum + arr.length, 0);
  const proj = project as any;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{project.name}</h1>
            <Badge className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
          </div>
          {project.client_name && <p className="text-muted-foreground mt-1">{project.client_name}</p>}
        </div>
      </div>

      <div className="bg-card rounded-lg p-4 shadow-sm flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {project.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" /><span>{project.location}</span>
          </div>
        )}
        {project.type && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" /><span>{project.type}{proj.construction_type ? ` · ${proj.construction_type}` : ""}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>{project.start_date ? format(new Date(project.start_date), "MMM yyyy") : "TBD"} → {project.est_completion ? format(new Date(project.est_completion), "MMM yyyy") : "TBD"}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Box className="h-4 w-4 shrink-0" />
          <span>{modules.length} module{modules.length !== 1 ? "s" : ""} · {totalPanels} panel{totalPanels !== 1 ? "s" : ""}</span>
        </div>
        {proj.client_phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" /><span>{proj.client_phone}</span>
          </div>
        )}
        {proj.client_email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" /><a href={`mailto:${proj.client_email}`} className="hover:underline">{proj.client_email}</a>
          </div>
        )}
      </div>

      <Tabs defaultValue="modules">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="modules" className="gap-1.5"><Box className="h-4 w-4" />Modules</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="h-4 w-4" />Billing</TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5"><BarChart2 className="h-4 w-4" />Schedule</TabsTrigger>
            <TabsTrigger value="materials" className="gap-1.5"><Package className="h-4 w-4" />Materials</TabsTrigger>
            <TabsTrigger value="variations" className="gap-1.5"><GitMerge className="h-4 w-4" />Variations</TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5"><DollarSign className="h-4 w-4" />Budget</TabsTrigger>
            <TabsTrigger value="scope" className="gap-1.5"><ClipboardList className="h-4 w-4" />Scope</TabsTrigger>
            <TabsTrigger value="handover" className="gap-1.5"><FileText className="h-4 w-4" />Handover</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="modules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Modules & Panels</h2>
            {canEdit && (
              <Button size="sm" onClick={() => setAddModuleOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Module</Button>
            )}
          </div>
          {modules.length === 0 ? (
            <div className="bg-card rounded-lg p-8 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">{canEdit ? 'No modules yet. Click "Add Module" to create one.' : "No modules have been created."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((m) => (
                <ModulePanelCard key={m.id} module={m} panels={panels[m.id] ?? []} projectId={id!} canEdit={canEdit} canAdvanceStage={canAdvanceStage} userRole={userRole} onPanelCreated={fetchData} onStageAdvanced={fetchData} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Billing Milestones</h2>
          <BillingMilestones
            projectId={id!}
            contractValue={proj.contract_value ? Number(proj.contract_value) : 0}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Project Schedule</h2>
            <Button size="sm" variant="outline" onClick={() => downloadScheduleTemplate(project.name, proj.construction_type ?? "")}>
              <Download className="h-3.5 w-3.5 mr-1" />Download Schedule Template
            </Button>
          </div>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm space-y-3">
            <BarChart2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Upload your filled schedule template to enable Gantt tracking.</p>
            <p className="text-xs" style={{ color: "#999" }}>
              Template includes tasks pre-tagged with [QC], [SIGN-OFF], and [PAYMENT] milestones for your{" "}
              {proj.construction_type ?? "project"} build type.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          <ProjectMaterialsTab projectId={id!} projectName={project.name} navigate={navigate} />
        </TabsContent>

        <TabsContent value="variations" className="space-y-4">
          <ProjectVariationsTab projectId={id!} navigate={navigate} />
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Project Budget</h2>
          <BudgetSummary
            project={project}
            projectId={id!}
            onViewGRNs={() => navigate(`/procurement?project=${id}`)}
            onManualEntry={() => {}}
          />
        </TabsContent>

        <TabsContent value="scope" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Scope of Work</h2>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">Scope document upload and management coming soon.</p>
          </div>
        </TabsContent>

        <TabsContent value="handover" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Handover</h2>
          <HandoverPack projectId={id!} clientName={project.client_name} userRole={userRole} installationComplete={modules.some((m: any) => m.production_status === "dispatched")} onHandedOver={fetchData} />
        </TabsContent>
      </Tabs>

      <AddModuleDialog open={addModuleOpen} onOpenChange={setAddModuleOpen} projectId={id!} onCreated={fetchData} />
    </div>
  );
}
