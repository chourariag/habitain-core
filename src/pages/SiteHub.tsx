import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPinned, Truck, BookOpen, FileText, Boxes, CheckCircle2, XCircle, ClipboardCheck, PenTool } from "lucide-react";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { SiteDiary } from "@/components/site/SiteDiary";
import { HandoverPack } from "@/components/site/HandoverPack";
import { SiteReadinessChecklist } from "@/components/site/SiteReadinessChecklist";
import type { Tables } from "@/integrations/supabase/types";

export default function SiteHub() {
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [modules, setModules] = useState<Tables<"modules">[]>([]);
  const [panelsByModule, setPanelsByModule] = useState<Record<string, any[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectReadinessMap, setProjectReadinessMap] = useState<Record<string, boolean>>({});
  const [dispatchConditions, setDispatchConditions] = useState<Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }>>({});
  const [showReadinessChecklist, setShowReadinessChecklist] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const { data: projectsData } = await supabase
      .from("projects").select("*").eq("is_archived", false).order("created_at", { ascending: false });

    const seen = new Set<string>();
    const activeProjects = (projectsData ?? []).filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const projectIds = activeProjects.map((p) => p.id);

    const { data: modulesData } = projectIds.length
      ? await supabase.from("modules").select("*").eq("is_archived", false).in("project_id", projectIds).order("created_at", { ascending: true })
      : { data: [] };

    const moduleIds = (modulesData ?? []).map((m) => m.id);
    const { data: panelsData } = moduleIds.length
      ? await (supabase.from("panels") as any).select("*").eq("is_archived", false).in("module_id", moduleIds).order("created_at", { ascending: true })
      : { data: [] };

    const groupedPanels: Record<string, any[]> = {};
    (panelsData ?? []).forEach((panel: any) => {
      if (!groupedPanels[panel.module_id]) groupedPanels[panel.module_id] = [];
      groupedPanels[panel.module_id].push(panel);
    });

    // Fetch project-level site readiness
    let readinessMap: Record<string, boolean> = {};
    if (projectIds.length) {
      const { data: readinessData } = await (supabase.from("site_readiness") as any)
        .select("project_id,is_complete").in("project_id", projectIds).eq("is_complete", true);
      (readinessData ?? []).forEach((r: any) => { if (r.project_id) readinessMap[r.project_id] = true; });
      setProjectReadinessMap(readinessMap);
    }

    // Fetch dispatch conditions for pipeline view
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

      // Map modules to their project for site readiness
      const moduleProjectMap: Record<string, string> = {};
      (modulesData ?? []).forEach((m) => { moduleProjectMap[m.id] = m.project_id; });

      const conditions: Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }> = {};
      moduleIds.forEach((mId) => {
        const moduleInspections = inspectionsByModule[mId] ?? [];
        const hasOpenNCR = moduleInspections.some((i: any) => openNCRInspections.has(i.id));
        const hasPassStage = moduleInspections.some((i: any) => i.dispatch_decision === "PASS STAGE");
        const projId = moduleProjectMap[mId];
        conditions[mId] = {
          qc: !hasOpenNCR,
          inspection: hasPassStage,
          site: !!readinessMap[projId],
          signoff: signoffSet.has(mId),
        };
      });
      setDispatchConditions(conditions);
    }

    setProjects(activeProjects);
    setModules(modulesData ?? []);
    setPanelsByModule(groupedPanels);
    setUserRole((await rolePromise) as string | null);
    setSelectedProjectId((current) => current && activeProjects.some((p) => p.id === current) ? current : activeProjects[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("sitehub-modules")
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) ?? null, [projects, selectedProjectId]);
  const selectedModules = useMemo(() => modules.filter((m) => m.project_id === selectedProjectId), [modules, selectedProjectId]);

  useEffect(() => {
    const check = async () => {
      if (!selectedModules.length) { setInstallationComplete(false); return; }
      const moduleIds = selectedModules.map((m) => m.id);
      const { data } = await (supabase.from("installation_checklist") as any)
        .select("module_id,is_complete").in("module_id", moduleIds).eq("is_complete", true);
      const completedIds = new Set((data ?? []).map((r: any) => r.module_id));
      setInstallationComplete(moduleIds.every((id) => completedIds.has(id)));
    };
    check();
  }, [selectedModules]);

  const getDispatchSummary = (projectId: string) => {
    const pm = modules.filter((m) => m.project_id === projectId);
    if (!pm.length) return { label: "No modules", tone: "muted" as const };
    const dispatched = pm.filter((m) => m.production_status === "dispatched" || m.current_stage === "Dispatch").length;
    if (dispatched === pm.length) return { label: "Dispatched", tone: "success" as const };
    if (dispatched > 0) return { label: "Partially Dispatched", tone: "warning" as const };
    if (projectReadinessMap[projectId]) return { label: "Site Ready", tone: "success" as const };
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
  const projectSiteReady = selectedProjectId ? projectReadinessMap[selectedProjectId] : false;

  const Cond = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#006039" }} /> : <XCircle className="h-3.5 w-3.5" style={{ color: "#F40009" }} />}
      <span style={{ color: met ? "#1A1A1A" : "#999999" }}>{label}</span>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Site Hub</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>Dispatch-to-handover workflows for active projects</p>
      </div>

      {projects.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No active projects.</p></CardContent></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {projects.map((project) => {
              const summary = getDispatchSummary(project.id);
              const isSelected = project.id === selectedProjectId;
              return (
                <button key={project.id} type="button" onClick={() => { setSelectedProjectId(project.id); setShowReadinessChecklist(false); }}
                  className={`w-full rounded-lg border p-4 text-left transition-all ${isSelected ? "border-[#006039] bg-card shadow-sm" : "border-border bg-card/80 hover:border-[#006039]/30 hover:bg-card"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground truncate">{project.name}</h2>
                      <p className="text-xs mt-1" style={{ color: "#666666" }}>Client: {project.client_name || "Not assigned"}</p>
                    </div>
                    <Badge variant="outline" style={badgeStyle(summary.tone)}>{summary.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: "#666666" }}>
                    {project.location && <span className="inline-flex items-center gap-1"><MapPinned className="h-3.5 w-3.5" /> {project.location}</span>}
                    <span className="inline-flex items-center gap-1"><Boxes className="h-3.5 w-3.5" /> {modules.filter((m) => m.project_id === project.id).length} modules</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-4 min-w-0">
            {selectedProject ? (
              <>
                <div className="bg-card border border-border rounded-lg p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-foreground">{selectedProject.name}</h2>
                      <p className="text-sm mt-1" style={{ color: "#666666" }}>{selectedProject.client_name ? `Client: ${selectedProject.client_name}` : "No client"}</p>
                    </div>
                    <Badge variant="outline" style={badgeStyle(getDispatchSummary(selectedProject.id).tone)}>
                      {getDispatchSummary(selectedProject.id).label}
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="pipeline" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="pipeline" className="gap-1.5"><Truck className="h-4 w-4" /> Dispatch Pipeline</TabsTrigger>
                    <TabsTrigger value="diary" className="gap-1.5"><BookOpen className="h-4 w-4" /> Site Diary</TabsTrigger>
                    <TabsTrigger value="handover" className="gap-1.5"><FileText className="h-4 w-4" /> Handover Pack</TabsTrigger>
                  </TabsList>

                  <TabsContent value="pipeline" className="space-y-4">
                    {/* Project-level Site Readiness */}
                    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ClipboardCheck className="h-5 w-5" style={{ color: projectSiteReady ? "#006039" : "#F40009" }} />
                          <div>
                            <h3 className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Site Readiness Checklist</h3>
                            <p className="text-xs" style={{ color: "#666666" }}>Applies to all modules in this project</p>
                          </div>
                        </div>
                        {projectSiteReady ? (
                          <Badge variant="outline" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>Completed ✅</Badge>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" style={{ backgroundColor: "#FFF0F0", color: "#F40009", border: "none" }}>Not Started</Badge>
                            {canManageReadiness && (
                              <Button size="sm" variant="outline" onClick={() => setShowReadinessChecklist(!showReadinessChecklist)}>
                                {showReadinessChecklist ? "Hide Checklist" : "Submit Checklist"}
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {showReadinessChecklist && !projectSiteReady && (
                        <SiteReadinessChecklist
                          projectId={selectedProject.id}
                          userRole={userRole}
                          onReadinessConfirmed={() => {
                            setShowReadinessChecklist(false);
                            fetchData();
                          }}
                        />
                      )}
                    </div>

                    {selectedModules.length === 0 ? (
                      <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No modules added yet.</p></CardContent></Card>
                    ) : (
                      selectedModules.map((module) => {
                        const conds = dispatchConditions[module.id];
                        return (
                          <div key={module.id} className="space-y-2">
                            <ModulePanelCard module={module} panels={panelsByModule[module.id] ?? []} projectId={selectedProject.id} canEdit={false} canAdvanceStage={false} userRole={userRole} onPanelCreated={fetchData} onStageAdvanced={fetchData} />

                            <div className="bg-card border border-border rounded-md p-3">
                              <div className="grid grid-cols-2 gap-2">
                                <Cond met={conds?.qc ?? false} label="QC Passed" />
                                <Cond met={conds?.inspection ?? false} label="Final Inspection" />
                                <Cond met={conds?.site ?? false} label="Site Readiness" />
                                <Cond met={conds?.signoff ?? false} label="Production Head Sign-off" />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  <TabsContent value="diary"><SiteDiary projectId={selectedProject.id} userRole={userRole} /></TabsContent>
                  <TabsContent value="handover">
                    <HandoverPack projectId={selectedProject.id} clientName={selectedProject.client_name} userRole={userRole} installationComplete={installationComplete} onHandedOver={fetchData} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">Select a project.</p></CardContent></Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
