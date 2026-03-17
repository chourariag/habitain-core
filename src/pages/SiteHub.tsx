import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, MapPinned, Truck, BookOpen, FileText, Boxes } from "lucide-react";
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

  const fetchData = useCallback(async () => {
    setLoading(true);

    const rolePromise = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return null;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      return data;
    });

    const { data: projectsData } = await supabase
      .from("projects")
      .select("*")
      .eq("is_archived", false)
      .neq("status", "handed_over")
      .order("created_at", { ascending: false });

    const activeProjects = projectsData ?? [];
    const projectIds = activeProjects.map((project) => project.id);

    const { data: modulesData } = projectIds.length
      ? await supabase
          .from("modules")
          .select("*")
          .eq("is_archived", false)
          .in("project_id", projectIds)
          .order("created_at", { ascending: true })
      : { data: [] };

    const moduleIds = (modulesData ?? []).map((module) => module.id);
    const { data: panelsData } = moduleIds.length
      ? await (supabase.from("panels" as any) as any)
          .select("*")
          .eq("is_archived", false)
          .in("module_id", moduleIds)
          .order("created_at", { ascending: true })
      : { data: [] };

    const groupedPanels: Record<string, any[]> = {};
    (panelsData ?? []).forEach((panel: any) => {
      if (!groupedPanels[panel.module_id]) groupedPanels[panel.module_id] = [];
      groupedPanels[panel.module_id].push(panel);
    });

    setProjects(activeProjects);
    setModules(modulesData ?? []);
    setPanelsByModule(groupedPanels);
    setUserRole((await rolePromise) as string | null);
    setSelectedProjectId((current) => current && activeProjects.some((project) => project.id === current) ? current : activeProjects[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const selectedModules = useMemo(
    () => modules.filter((module) => module.project_id === selectedProjectId),
    [modules, selectedProjectId]
  );

  useEffect(() => {
    const checkInstallationCompletion = async () => {
      if (!selectedModules.length) {
        setInstallationComplete(false);
        return;
      }

      const moduleIds = selectedModules.map((module) => module.id);
      const { data } = await (supabase.from("installation_checklist" as any) as any)
        .select("module_id,is_complete")
        .in("module_id", moduleIds)
        .eq("is_complete", true);

      const completedIds = new Set((data ?? []).map((record: any) => record.module_id));
      setInstallationComplete(moduleIds.every((id) => completedIds.has(id)));
    };

    checkInstallationCompletion();
  }, [selectedModules]);

  const getDispatchSummary = (projectId: string) => {
    const projectModules = modules.filter((module) => module.project_id === projectId);
    const total = projectModules.length;
    const dispatched = projectModules.filter((module) => module.production_status === "dispatched").length;

    if (!total) {
      return { label: "No modules", tone: "muted" as const };
    }

    if (dispatched === 0) {
      return { label: "Pending dispatch", tone: "warning" as const };
    }

    if (dispatched === total) {
      return { label: "All dispatched", tone: "success" as const };
    }

    return { label: `${dispatched}/${total} dispatched`, tone: "primary" as const };
  };

  const badgeClass = (tone: "muted" | "warning" | "success" | "primary") => {
    switch (tone) {
      case "warning":
        return "bg-warning/15 text-warning border-warning/30";
      case "success":
        return "bg-success/15 text-success border-success/30";
      case "primary":
        return "bg-primary/15 text-primary border-primary/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Site Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Dispatch-to-handover workflows for active projects</p>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No active projects available in Site Hub yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {projects.map((project) => {
              const summary = getDispatchSummary(project.id);
              const isSelected = project.id === selectedProjectId;

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full rounded-lg border p-4 text-left transition-snappy ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/30 hover:bg-accent/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground truncate">{project.name}</h2>
                      <p className="text-xs text-muted-foreground mt-1">{project.client_name || "No client assigned"}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass(summary.tone)}>
                      {summary.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                    {project.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPinned className="h-3.5 w-3.5" /> {project.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Boxes className="h-3.5 w-3.5" /> {modules.filter((module) => module.project_id === project.id).length} modules
                    </span>
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
                      <p className="text-sm text-muted-foreground mt-1">{selectedProject.client_name || "No client assigned"}</p>
                    </div>
                    <Badge variant="outline" className={badgeClass(getDispatchSummary(selectedProject.id).tone)}>
                      {getDispatchSummary(selectedProject.id).label}
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="pipeline" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="pipeline" className="gap-1.5">
                      <Truck className="h-4 w-4" /> Dispatch Pipeline
                    </TabsTrigger>
                    <TabsTrigger value="diary" className="gap-1.5">
                      <BookOpen className="h-4 w-4" /> Site Diary
                    </TabsTrigger>
                    <TabsTrigger value="handover" className="gap-1.5">
                      <FileText className="h-4 w-4" /> Handover Pack
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="pipeline" className="space-y-4">
                    {selectedModules.length === 0 ? (
                      <Card>
                        <CardContent className="py-10 text-center">
                          <p className="text-sm text-muted-foreground">No modules have been added to this project yet.</p>
                        </CardContent>
                      </Card>
                    ) : (
                      selectedModules.map((module) => (
                        <ModulePanelCard
                          key={module.id}
                          module={module}
                          panels={panelsByModule[module.id] ?? []}
                          projectId={selectedProject.id}
                          canEdit={false}
                          canAdvanceStage={false}
                          userRole={userRole}
                          onPanelCreated={fetchData}
                          onStageAdvanced={fetchData}
                        />
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="diary" className="space-y-4">
                    <SiteDiary projectId={selectedProject.id} userRole={userRole} />
                  </TabsContent>

                  <TabsContent value="handover" className="space-y-4">
                    <HandoverPack
                      projectId={selectedProject.id}
                      clientName={selectedProject.client_name}
                      userRole={userRole}
                      installationComplete={installationComplete}
                      onHandedOver={fetchData}
                    />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-muted-foreground">Select a project to open its site pipeline.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
