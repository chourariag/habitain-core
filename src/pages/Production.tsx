import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Factory, Smartphone } from "lucide-react";
import { KioskScreen } from "@/components/production/KioskScreen";
import type { Tables } from "@/integrations/supabase/types";

type ModuleWithProject = Tables<"modules"> & { projects: { name: string } | null };

const STAGE_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success-foreground",
};

export default function Production() {
  const [modules, setModules] = useState<ModuleWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [kioskOpen, setKioskOpen] = useState(false);

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

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  if (kioskOpen) {
    return <KioskScreen onExit={() => setKioskOpen(false)} />;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Production</h1>
          <p className="text-muted-foreground text-sm mt-1">Module production tracking & labour kiosk</p>
        </div>
      </div>

      {/* Kiosk Entry */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 rounded-lg p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Smartphone className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h2 className="font-display text-lg font-semibold text-foreground">Labour Kiosk</h2>
          <p className="text-muted-foreground text-sm">Factory floor workers log work via phone OTP</p>
        </div>
        <Button size="lg" onClick={() => setKioskOpen(true)} className="gap-2">
          <Factory className="h-5 w-5" />
          Open Kiosk Mode
        </Button>
      </div>

      {/* Active Modules */}
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-3">Active Modules</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-card-foreground/60 text-sm">No modules yet. Create a project and add modules first.</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium text-muted-foreground">Module</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Project</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Current Stage</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-3 font-medium text-card-foreground">{m.name}</td>
                      <td className="p-3 text-muted-foreground">{m.projects?.name ?? "—"}</td>
                      <td className="p-3 text-card-foreground">{m.current_stage ?? "—"}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={STAGE_COLORS[m.production_status ?? "not_started"]}>
                          {(m.production_status ?? "not_started").replace("_", " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
