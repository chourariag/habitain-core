import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Loader2, Factory, PenTool, PackagePlus, LayoutGrid, Table as TableIcon, BarChart3, CalendarDays } from "lucide-react";
import { GanttChart } from "@/components/production/GanttChart";
import { SupervisorDailyLog } from "@/components/production/SupervisorDailyLog";
import { ModuleSchedule } from "@/components/production/ModuleSchedule";
import { ModuleDrawingsTab } from "@/components/drawings/ModuleDrawingsTab";
import { MaterialRequestsPanel } from "@/components/materials/MaterialRequestsPanel";
import { ProductionKanban } from "@/components/production/ProductionKanban";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectChatButton } from "@/components/chat/ProjectChatButton";
import { DeliveryChecklistButton } from "@/components/production/DeliveryChecklistButton";
import { WeeklyManpowerPlanner } from "@/components/production/WeeklyManpowerPlanner";
import { DryAssemblyCheck } from "@/components/production/DryAssemblyCheck";
import { ScheduleConflictBanner } from "@/components/production/ScheduleConflictBanner";
import { FactoryCapacityCard } from "@/components/production/FactoryCapacityCard";
import { StageVelocityMonitor } from "@/components/production/StageVelocityMonitor";
import { useUserRole } from "@/hooks/useUserRole";
import { MyTasksSection } from "@/components/tasks/MyTasksSection";
import type { Tables } from "@/integrations/supabase/types";

type ModuleWithProject = Tables<"modules"> & { projects: { name: string } | null };

const STAGE_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-primary text-primary-foreground",
  hold: "bg-warning/20 text-warning-foreground",
  dispatched: "bg-primary text-primary-foreground",
};

function ProductionContent() {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const { role: userRole, userId } = useUserRole();
  const [modules, setModules] = useState<ModuleWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState("modules");
  const [viewMode, setViewMode] = useState<"table" | "board" | "gantt">(() => {
    try { return (sessionStorage.getItem("prodViewMode") as "table" | "board" | "gantt") ?? "table"; } catch { return "table"; }
  });

  const setView = (mode: "table" | "board" | "gantt") => {
    setViewMode(mode);
    try { sessionStorage.setItem("prodViewMode", mode); } catch {}
  };

  const fetchModules = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    const { data } = await supabase
      .from("modules")
      .select("*, projects(name)")
      .eq("is_archived", false)
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false });
    setModules((data as ModuleWithProject[] | null) ?? []);
    setLoading(false);
  }, [selectedProjectId]);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  // Determine if all modules completed Stage 1 (Sub-Frame)
  const allStage1Complete = modules.length > 0 && modules.every(m => {
    const stageIdx = m.current_stage ? ["Sub-Frame","MEP Rough-In","Insulation","Drywall","Paint","MEP Final","Windows & Doors","Finishing","QC Inspection","Dispatch"].indexOf(m.current_stage) : -1;
    return stageIdx > 0 || m.production_status === "completed";
  });

  useEffect(() => {
    const channel = supabase
      .channel("production-modules")
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => { fetchModules(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_production_logs" }, () => { fetchModules(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchModules]);

  return (
    <div className="space-y-0">
      <MobileProjectSwitcher label="Project" />
      <div className="p-4 md:p-6 space-y-6">
        {selectedProjectId && selectedProject && (
          <ProjectChatButton projectId={selectedProjectId} projectName={selectedProject.name} projectType="production" />
        )}
        {selectedProjectId && (
         <div className="flex items-center justify-between gap-2 flex-wrap">
            <DeliveryChecklistButton projectId={selectedProjectId} />
            <DryAssemblyCheck
              projectId={selectedProjectId}
              projectName={selectedProject?.name ?? ""}
              userRole={userRole}
              userId={userId}
              allStage1Complete={allStage1Complete}
              onUnlocked={fetchModules}
            />
          </div>
        )}
        {selectedProjectId && (
          <ScheduleConflictBanner projectId={selectedProjectId} userRole={userRole} />
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Production</h1>
            <p className="text-sm mt-1">
              <span className="font-bold" style={{ color: "#006039" }}>{selectedProject?.name}</span>
              <span style={{ color: "#666666" }}> — Module production tracking</span>
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" style={{ backgroundColor: "#F7F7F7" }}>
            <Button variant="ghost" size="sm" className={viewMode === "table" ? "bg-background shadow-sm" : ""} onClick={() => setView("table")}>
              <TableIcon className="h-4 w-4 mr-1" /> Table
            </Button>
            <Button variant="ghost" size="sm" className={viewMode === "board" ? "bg-background shadow-sm" : ""} onClick={() => setView("board")}>
              <LayoutGrid className="h-4 w-4 mr-1" /> Board
            </Button>
            <Button variant="ghost" size="sm" className={viewMode === "gantt" ? "bg-background shadow-sm" : ""} onClick={() => setView("gantt")}>
              <BarChart3 className="h-4 w-4 mr-1" /> Gantt
            </Button>
          </div>
        </div>

        {/* My Factory Tasks */}
        <MyTasksSection userRole={userRole} phaseFilter={["Factory Production"]} title="My Factory Tasks" showProjectName={false} />

        {/* Factory Intelligence Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FactoryCapacityCard userRole={userRole} />
          <StageVelocityMonitor userRole={userRole} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : modules.length === 0 ? (
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No modules yet. Create modules from the project detail page.</p>
          </div>
        ) : viewMode === "gantt" ? (
          <GanttChart projectId={selectedProjectId!} modules={modules} userRole={userRole} productionSystem={(selectedProject as any)?.production_system ?? null} />
        ) : viewMode === "board" ? (
          <ProductionKanban modules={modules} onRefresh={fetchModules} productionSystem={(selectedProject as any)?.production_system ?? null} />
        ) : (
          <Tabs value={projectTab} onValueChange={setProjectTab}>
            <ScrollableTabsWrapper>
              <TabsList>
                <TabsTrigger value="modules" className="gap-1.5"><Factory className="h-4 w-4" /> Modules</TabsTrigger>
                <TabsTrigger value="manpower" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Manpower</TabsTrigger>
                <TabsTrigger value="drawings" className="gap-1.5"><PenTool className="h-4 w-4" /> Drawings</TabsTrigger>
                <TabsTrigger value="materials" className="gap-1.5"><PackagePlus className="h-4 w-4" /> Material Requests</TabsTrigger>
              </TabsList>
            </ScrollableTabsWrapper>

            <TabsContent value="modules" className="space-y-3">
              {modules.map((m) => (
                <div key={m.id} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
                    onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)}
                  >
                    <Factory className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground">{m.module_code || m.name}</span>
                      <p className="text-xs text-muted-foreground">{m.current_stage ?? "—"}</p>
                    </div>
                    <Badge variant="outline" className={STAGE_COLORS[m.production_status ?? "not_started"]}>
                      {(m.production_status ?? "not_started").replace(/_/g, " ")}
                    </Badge>
                  </button>

                  {expandedModule === m.id && (
                    <div className="border-t border-border p-4 space-y-4">
                      <SupervisorDailyLog moduleId={m.id} moduleName={m.name} moduleCode={m.module_code} currentStage={m.current_stage} userRole={userRole} />
                      <ModuleSchedule moduleId={m.id} currentStage={m.current_stage} userRole={userRole} />
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="manpower">
              <WeeklyManpowerPlanner projectId={selectedProjectId!} userRole={userRole} />
            </TabsContent>

            <TabsContent value="drawings">
              <div className="bg-card rounded-lg border border-border p-4">
                <ModuleDrawingsTab projectId={selectedProjectId!} projectName={selectedProject?.name ?? ""} />
              </div>
            </TabsContent>

            <TabsContent value="materials">
              <MaterialRequestsPanel projectId={selectedProjectId!} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default function Production() {
  return (
    <ProjectScopeGuard>
      <ProductionContent />
    </ProjectScopeGuard>
  );
}
