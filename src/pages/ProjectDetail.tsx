import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { ArrowLeft, Plus, Loader2, MapPin, Calendar, Building2, Users, Box, BookOpen, FileText, Phone, Mail, DollarSign } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { AddModuleDialog } from "@/components/projects/AddModuleDialog";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { SiteDiary } from "@/components/site/SiteDiary";
import { HandoverPack } from "@/components/site/HandoverPack";
import { BillingMilestones } from "@/components/finance/BillingMilestones";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";
import { useProjectContext } from "@/contexts/ProjectContext";

const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const STAGE_ADVANCE_ROLES = ["planning_engineer", "production_head", "super_admin", "managing_director"];

const COST_CATEGORIES = [
  { key: "materials", label: "Materials" },
  { key: "labour", label: "Labour & Fabrication" },
  { key: "logistics", label: "Logistics" },
  { key: "mep", label: "MEP & Electrical" },
  { key: "overhead", label: "Overhead" },
];

function BudgetSummary({ project, projectId, onAddGRN }: { project: any; projectId: string; onAddGRN: () => void }) {
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

  // Project P&L breakdown — estimated from GFC budget split
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
        <p className="text-xs mb-3" style={{ color: "#999" }}>GRNs recorded in Procurement automatically update this project's cost tracking. {receivedCount > 0 ? `${receivedCount} GRN${receivedCount !== 1 ? "s" : ""} recorded.` : ""}</p>
        <Button size="sm" variant="outline" onClick={onAddGRN}>
          <Plus className="h-3.5 w-3.5 mr-1" />Add GRN
        </Button>
      </div>

      {/* Project P&L breakdown */}
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
                  const clientShare = contractValue > 0 ? Math.round(contractValue * (budget / (gfcBudget || 1))) : 0;
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

  // Sync sidebar project selector with URL param
  useEffect(() => {
    if (id) {
      setSelectedProjectId(id);
    }
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
            <TabsTrigger value="modules" className="gap-1.5"><Box className="h-4 w-4" /> Modules</TabsTrigger>
            <TabsTrigger value="budget" className="gap-1.5"><DollarSign className="h-4 w-4" /> Budget</TabsTrigger>
            <TabsTrigger value="site-diary" className="gap-1.5"><BookOpen className="h-4 w-4" /> Site Diary</TabsTrigger>
            <TabsTrigger value="handover" className="gap-1.5"><FileText className="h-4 w-4" /> Handover</TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5"><Users className="h-4 w-4" /> Team</TabsTrigger>
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

        <TabsContent value="budget" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Project Budget</h2>
          <BudgetSummary project={project} projectId={id!} onAddGRN={() => navigate(`/procurement?project=${id}`)} />
          <BillingMilestones
            projectId={id!}
            contractValue={proj.contract_value ? Number(proj.contract_value) : 0}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="site-diary" className="space-y-4">
          <SiteDiary projectId={id!} userRole={userRole} />
        </TabsContent>

        <TabsContent value="handover" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Handover</h2>
          <HandoverPack projectId={id!} clientName={project.client_name} userRole={userRole} installationComplete={modules.some((m: any) => m.production_status === "dispatched")} onHandedOver={fetchData} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Team assignment coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      <AddModuleDialog open={addModuleOpen} onOpenChange={setAddModuleOpen} projectId={id!} onCreated={fetchData} />
    </div>
  );
}
