import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPinned, Truck, BookOpen, FileText, Boxes, CheckCircle2, XCircle } from "lucide-react";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { SiteDiary } from "@/components/site/SiteDiary";
import { HandoverPack } from "@/components/site/HandoverPack";
import type { Tables } from "@/integrations/supabase/types";

export default function SiteHub() {
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [modules, setModules] = useState<Tables<"modules">[]>([]);
  const [panelsByModule, setPanelsByModule] = useState<Record<string, any[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [installationComplete, setInstallationComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [siteReadinessMap, setSiteReadinessMap] = useState<Record<string, boolean>>({});
  const [dispatchConditions, setDispatchConditions] = useState<Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);

    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const { data: projectsData } = await supabase
      .from("projects").select("*").eq("is_archived", false).order("created_at", { ascending: false });

    // Deduplicate by project ID
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

    // Fetch site readiness
    if (moduleIds.length) {
      const { data: readinessData } = await (supabase.from("site_readiness") as any)
        .select("module_id,is_complete").in("module_id", moduleIds).eq("is_complete", true);
      const map: Record<string, boolean> = {};
      (readinessData ?? []).forEach((r: any) => { map[r.module_id] = true; });
      setSiteReadinessMap(map);
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

      const conditions: Record<string, { qc: boolean; inspection: boolean; site: boolean; signoff: boolean }> = {};
      moduleIds.forEach((mId) => {
        const moduleInspections = inspectionsByModule[mId] ?? [];
        const hasOpenNCR = moduleInspections.some((i: any) => openNCRInspections.has(i.id));
        const hasPassStage = moduleInspections.some((i: any) => i.dispatch_decision === "PASS STAGE");
        conditions[mId] = {
          qc: !hasOpenNCR,
          inspection: hasPassStage,
          site: !!siteReadinessMap[mId],
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
    if (pm.some((m) => siteReadinessMap[m.id])) return { label: "Site Ready", tone: "success" as const };
    return { label: "Pending Dispatch", tone: "warning" as const };
  };

  const badgeClass = (tone: string) => {
    switch (tone) {
      case "warning": return "bg-warning text-warning-foreground";
      case "success": return "bg-primary text-primary-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const Cond = ({ met, label }: { met: boolean; label: string }) => (
    <div className="flex items-center gap-1.5 text-xs">
      {met ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Site Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Dispatch-to-handover workflows for active projects</p>
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
                <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-snappy ${isSelected ? "border-primary bg-card shadow-sm" : "border-border bg-card/80 hover:border-primary/30 hover:bg-card"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground truncate">{project.name}</h2>
                      <p className="text-xs mt-1 text-muted-foreground">Client: {project.client_name || "Not assigned"}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass(summary.tone)}>{summary.label}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground mt-1">{selectedProject.client_name ? `Client: ${selectedProject.client_name}` : "No client"}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass(getDispatchSummary(selectedProject.id).tone)}>
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
                    {selectedModules.length === 0 ? (
                      <Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">No modules added yet.</p></CardContent></Card>
                    ) : (
                      selectedModules.map((module) => {
                        const conds = dispatchConditions[module.id];
                        return (
                          <div key={module.id} className="space-y-2">
                            <ModulePanelCard module={module} panels={panelsByModule[module.id] ?? []} projectId={selectedProject.id} canEdit={false} canAdvanceStage={false} userRole={userRole} onPanelCreated={fetchData} onStageAdvanced={fetchData} />
                            {conds && (module.current_stage === "Dispatch" || module.current_stage === "QC Inspection") && (
                              <div className="bg-card border border-border rounded-md p-3 grid grid-cols-2 gap-2">
                                <Cond met={conds.qc} label="QC Passed" />
                                <Cond met={conds.inspection} label="Final Inspection" />
                                <Cond met={conds.site} label="Site Readiness" />
                                <Cond met={conds.signoff} label="Production Head Sign-off" />
                              </div>
                            )}
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
