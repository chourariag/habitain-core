import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Factory, PenTool, PackagePlus } from "lucide-react";
import { SupervisorDailyLog } from "@/components/production/SupervisorDailyLog";
import { ModuleSchedule } from "@/components/production/ModuleSchedule";
import { ModuleDrawingsTab } from "@/components/drawings/ModuleDrawingsTab";
import { MaterialRequestsPanel } from "@/components/materials/MaterialRequestsPanel";
import type { Tables } from "@/integrations/supabase/types";

type ModuleWithProject = Tables<"modules"> & { projects: { name: string } | null };

const STAGE_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-primary text-primary-foreground",
  hold: "bg-warning/20 text-warning-foreground",
  dispatched: "bg-primary text-primary-foreground",
};

export default function Production() {
  const [modules, setModules] = useState<ModuleWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState("modules");

  const fetchModules = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("modules")
      .select("*, projects(name)")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setModules((data as ModuleWithProject[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchModules(); }, [fetchModules]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("production-modules")
      .on("postgres_changes", { event: "*", schema: "public", table: "modules" }, () => { fetchModules(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_production_logs" }, () => { fetchModules(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchModules]);

  // Group modules by project
  const projects = useMemo(() => {
    const map: Record<string, { id: string; name: string; modules: ModuleWithProject[] }> = {};
    modules.forEach((m) => {
      if (!map[m.project_id]) {
        map[m.project_id] = { id: m.project_id, name: m.projects?.name ?? "Unknown", modules: [] };
      }
      map[m.project_id].modules.push(m);
    });
    return Object.values(map);
  }, [modules]);

  // Auto-select first project
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Production</h1>
        <p className="text-muted-foreground text-sm mt-1">Module production tracking & daily supervisor logs</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : modules.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No modules yet. Create a project and add modules first.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Project selector */}
          <div className="space-y-2">
            {projects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => { setSelectedProjectId(proj.id); setProjectTab("modules"); }}
                className={`w-full rounded-lg border p-3 text-left transition-all ${proj.id === selectedProjectId ? "border-primary bg-card shadow-sm" : "border-border bg-card/80 hover:border-primary/30"}`}
              >
                <p className="font-semibold text-foreground text-sm">{proj.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{proj.modules.length} modules</p>
              </button>
            ))}
          </div>

          {/* Project detail */}
          <div className="space-y-4 min-w-0">
            {selectedProject ? (
              <Tabs value={projectTab} onValueChange={setProjectTab}>
                <TabsList>
                  <TabsTrigger value="modules" className="gap-1.5"><Factory className="h-4 w-4" /> Modules</TabsTrigger>
                  <TabsTrigger value="drawings" className="gap-1.5"><PenTool className="h-4 w-4" /> Drawings</TabsTrigger>
                  <TabsTrigger value="materials" className="gap-1.5"><PackagePlus className="h-4 w-4" /> Material Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="modules" className="space-y-3">
                  {selectedProject.modules.map((m) => (
                    <div key={m.id} className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
                        onClick={() => setExpandedModule(expandedModule === m.id ? null : m.id)}
                      >
                        <Factory className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-foreground">{m.module_code || m.name}</span>
                          <p className="text-xs text-muted-foreground">{m.projects?.name ?? "—"} · {m.current_stage ?? "—"}</p>
                        </div>
                        <Badge variant="outline" className={STAGE_COLORS[m.production_status ?? "not_started"]}>
                          {(m.production_status ?? "not_started").replace(/_/g, " ")}
                        </Badge>
                      </button>

                      {expandedModule === m.id && (
                        <div className="border-t border-border p-4 space-y-4">
                          <SupervisorDailyLog
                            moduleId={m.id}
                            moduleName={m.name}
                            moduleCode={m.module_code}
                            currentStage={m.current_stage}
                            userRole={userRole}
                          />
                          <ModuleSchedule
                            moduleId={m.id}
                            currentStage={m.current_stage}
                            userRole={userRole}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="drawings">
                  <div className="bg-card rounded-lg border border-border p-4">
                    <ModuleDrawingsTab
                      projectId={selectedProject.id}
                      projectName={selectedProject.name}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="materials">
                  <MaterialRequestsPanel projectId={selectedProject.id} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="bg-card rounded-lg p-8 text-center shadow-sm">
                <p className="text-muted-foreground text-sm">Select a project.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
