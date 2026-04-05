import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Loader2, Truck, BookOpen, FileText, Boxes, CheckCircle2, XCircle, ClipboardCheck, PenTool, PackagePlus, Package } from "lucide-react";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { SiteDiary } from "@/components/site/SiteDiary";
import { HandoverPack } from "@/components/site/HandoverPack";
import { SiteReadinessChecklist } from "@/components/site/SiteReadinessChecklist";
import { ModuleDrawingsTab } from "@/components/drawings/ModuleDrawingsTab";
import { MaterialRequestsPanel } from "@/components/materials/MaterialRequestsPanel";
import { DispatchPacksTab } from "@/components/site/DispatchPacksTab";
import { SiteReceiptChecklist } from "@/components/site/SiteReceiptChecklist";
import { SubcontractorSchedule } from "@/components/site/SubcontractorSchedule";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectChatButton } from "@/components/chat/ProjectChatButton";
import type { Tables } from "@/integrations/supabase/types";

function SiteHubContent() {
  const navigate = useNavigate();
  const { selectedProjectId, selectedProject } = useProjectContext();
  const [modules, setModules] = useState<Tables<"modules">[]>([]);
  const [panelsByModule, setPanelsByModule] = useState<Record<string, any[]>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [siteReady, setSiteReady] = useState(false);
  const [dispatchConditions, setDispatchConditions] = useState<Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }>>({});
  const [showReadinessChecklist, setShowReadinessChecklist] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);

    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const { data: modulesData } = await supabase
      .from("modules").select("*").eq("is_archived", false).eq("project_id", selectedProjectId).order("created_at", { ascending: true });

    const moduleIds = (modulesData ?? []).map((m) => m.id);

    const { data: panelsData } = moduleIds.length
      ? await (supabase.from("panels") as any).select("*").eq("is_archived", false).in("module_id", moduleIds).order("created_at", { ascending: true })
      : { data: [] };

    const groupedPanels: Record<string, any[]> = {};
    (panelsData ?? []).forEach((panel: any) => {
      if (!groupedPanels[panel.module_id]) groupedPanels[panel.module_id] = [];
      groupedPanels[panel.module_id].push(panel);
    });

    // Site readiness
    const { data: readinessData } = await (supabase.from("site_readiness") as any)
      .select("project_id,is_complete").eq("project_id", selectedProjectId).eq("is_complete", true);
    const isReady = (readinessData ?? []).length > 0;
    setSiteReady(isReady);

    // Dispatch conditions
    if (moduleIds.length) {
      const [ncrRes, inspRes, signoffRes] = await Promise.all([
        supabase.from("ncr_register").select("inspection_id,status").eq("is_archived", false).in("status", ["open", "critical_open"]),
        supabase.from("qc_inspections").select("id,module_id,dispatch_decision").in("module_id", moduleIds),
        supabase.from("dispatch_signoffs").select("module_id").in("module_id", moduleIds),
      ]);

      const openNCRInspections = new Set((ncrRes.data ?? []).map((n) => n.inspection_id));
      const inspectionsByModule: Record<string, any[]> = {};
      (inspRes.data ?? []).forEach((i) => {
        if (!inspectionsByModule[i.module_id]) inspectionsByModule[i.module_id] = [];
        inspectionsByModule[i.module_id].push(i);
      });
      const signoffSet = new Set((signoffRes.data ?? []).map((s) => s.module_id));

      const conditions: Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }> = {};
      moduleIds.forEach((mId) => {
        const moduleInspections = inspectionsByModule[mId] ?? [];
        const hasOpenNCR = moduleInspections.some((i: any) => openNCRInspections.has(i.id));
        const hasPassStage = moduleInspections.some((i: any) => i.dispatch_decision === "PASS STAGE");
        conditions[mId] = {
          qc: !hasOpenNCR,
          inspection: hasPassStage,
          site: isReady,
          signoff: signoffSet.has(mId),
        };
      });
      setDispatchConditions(conditions);
    }

    setModules(modulesData ?? []);
    setPanelsByModule(groupedPanels);
    setUserRole((await rolePromise) as string | null);
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("sitehub-modules")
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  useEffect(() => {
    const check = async () => {
      if (!modules.length) { setInstallationComplete(false); return; }
      const moduleIds = modules.map((m) => m.id);
      const { data } = await (supabase.from("installation_checklist") as any)
        .select("module_id,is_complete").in("module_id", moduleIds).eq("is_complete", true);
      const completedIds = new Set((data ?? []).map((r: any) => r.module_id));
      setInstallationComplete(moduleIds.every((id) => completedIds.has(id)));
    };
    check();
  }, [modules]);

  const getDispatchSummary = () => {
    if (!modules.length) return { label: "No modules", tone: "muted" as const };
    const dispatched = modules.filter((m) => m.production_status === "dispatched" || m.current_stage === "Dispatch").length;
    if (dispatched === modules.length) return { label: "Dispatched", tone: "success" as const };
    if (dispatched > 0) return { label: "Partially Dispatched", tone: "warning" as const };
    if (siteReady) return { label: "Site Ready", tone: "success" as const };
    return { label: "Pending Dispatch", tone: "warning" as const };
  };

  const badgeStyle = (tone: string): React.CSSProperties => {
    switch (tone) {
      case "warning": return { backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" };
      case "success": return { backgroundColor: "#E8F2ED", color: "#006039", border: "none" };
      default: return { backgroundColor: "#F5F5F5", color: "#666666", border: "none" };
    }
  };

  const canManageReadiness = ["site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? "");
  const canCreateDispatchPack = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director"].includes(userRole ?? "");

  const Cond = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#006039" }} /> : <XCircle className="h-3.5 w-3.5" style={{ color: "#F40009" }} />}
      <span style={{ color: met ? "#1A1A1A" : "#999999" }}>{label}</span>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const summary = getDispatchSummary();

  return (
    <div className="space-y-0">
      <MobileProjectSwitcher label="Project" />
      <div className="p-4 md:p-6 space-y-6">
      {selectedProjectId && selectedProject && (
        <ProjectChatButton projectId={selectedProjectId} projectName={selectedProject.name} projectType="production" />
      )}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Site Hub</h1>
          <p className="text-sm mt-1">
            <span className="font-bold" style={{ color: "#006039" }}>{selectedProject?.name}</span>
            <span style={{ color: "#666666" }}> — Dispatch-to-handover workflows</span>
          </p>
        </div>
        <Badge variant="outline" style={badgeStyle(summary.tone)}>{summary.label}</Badge>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="pipeline" className="gap-1.5"><Truck className="h-4 w-4" /> Dispatch Pipeline</TabsTrigger>
            <TabsTrigger value="drawings" className="gap-1.5"><PenTool className="h-4 w-4" /> Drawings</TabsTrigger>
            <TabsTrigger value="diary" className="gap-1.5"><BookOpen className="h-4 w-4" /> Site Diary</TabsTrigger>
            <TabsTrigger value="handover" className="gap-1.5"><FileText className="h-4 w-4" /> Handover Pack</TabsTrigger>
            <TabsTrigger value="materials" className="gap-1.5"><PackagePlus className="h-4 w-4" /> Material Requests</TabsTrigger>
            <TabsTrigger value="dispatch-packs" className="gap-1.5"><Package className="h-4 w-4" /> Dispatch Packs</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="pipeline" className="space-y-4">
          {/* Project-level Site Readiness */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <ClipboardCheck className="h-5 w-5 shrink-0" style={{ color: siteReady ? "#006039" : "#D4860A" }} />
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Site Readiness Checklist</h3>
                  <p className="text-xs" style={{ color: "#666666" }}>Applies to all modules in this project</p>
                </div>
              </div>
              {siteReady ? (
                <Badge variant="outline" className="shrink-0" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>Completed ✅</Badge>
              ) : (
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <Badge variant="outline" className="shrink-0" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>Not Started</Badge>
                  {canManageReadiness && (
                    <Button size="sm" variant="outline" className="shrink-0 text-xs" onClick={() => setShowReadinessChecklist(!showReadinessChecklist)}>
                      {showReadinessChecklist ? "Hide Checklist" : "Submit Checklist"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {showReadinessChecklist && !siteReady && (
              <SiteReadinessChecklist
                projectId={selectedProjectId!}
                userRole={userRole}
                onReadinessConfirmed={() => {
                  setShowReadinessChecklist(false);
                  fetchData();
                }}
              />
            )}
          </div>

          {modules.length === 0 ? (
            <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No modules added yet.</p></CardContent></Card>
          ) : (
            modules.map((module) => {
              const conds = dispatchConditions[module.id];
              return (
                <div key={module.id} className="space-y-2">
                  <ModulePanelCard module={module} panels={panelsByModule[module.id] ?? []} projectId={selectedProjectId!} canEdit={false} canAdvanceStage={false} userRole={userRole} onPanelCreated={fetchData} onStageAdvanced={fetchData} />
                  <div className="bg-card border border-border rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Cond met={conds?.qc ?? false} label="QC Passed" />
                      <Cond met={conds?.inspection ?? false} label="Final Inspection" />
                      <Cond met={conds?.site ?? false} label="Site Readiness" />
                      <Cond met={conds?.signoff ?? false} label="Production Head Sign-off" />
                    </div>
                    {conds?.qc && conds?.inspection && conds?.site && conds?.signoff && canCreateDispatchPack && module.production_status !== "dispatched" && (
                      <Button
                        size="sm"
                        className="w-full mt-2 font-display"
                        style={{ backgroundColor: "#006039" }}
                        onClick={() => navigate(`/site-hub/dispatch-pack?projectId=${selectedProjectId}&projectName=${encodeURIComponent(selectedProject?.name ?? "")}`)}
                      >
                        Create Dispatch Pack
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="drawings">
          <Card>
            <CardContent className="pt-6">
              <ModuleDrawingsTab projectId={selectedProjectId!} projectName={selectedProject?.name ?? ""} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diary"><SiteDiary projectId={selectedProjectId!} userRole={userRole} /></TabsContent>
        <TabsContent value="handover">
          <HandoverPack projectId={selectedProjectId!} clientName={selectedProject?.client_name ?? null} userRole={userRole} installationComplete={installationComplete} onHandedOver={fetchData} />
        </TabsContent>
        <TabsContent value="materials">
          <MaterialRequestsPanel projectId={selectedProjectId!} />
        </TabsContent>
        <TabsContent value="dispatch-packs">
          <DispatchPacksTab projectId={selectedProjectId!} />
        </TabsContent>
      </Tabs>
    </div>
    </div>
  );
}

export default function SiteHub() {
  return (
    <ProjectScopeGuard>
      <SiteHubContent />
    </ProjectScopeGuard>
  );
}
