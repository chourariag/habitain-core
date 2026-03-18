import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Factory } from "lucide-react";
import { SupervisorDailyLog } from "@/components/production/SupervisorDailyLog";
import { ModuleSchedule } from "@/components/production/ModuleSchedule";
import { ModuleDrawingsTab } from "@/components/drawings/ModuleDrawingsTab";
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Production</h1>
        <p className="text-muted-foreground text-sm mt-1">Module production tracking & daily supervisor logs</p>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-3">Active Modules</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No modules yet. Create a project and add modules first.</p>
          </div>
        ) : (
          <div className="space-y-3">
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
          </div>
        )}
      </div>
    </div>
  );
}
