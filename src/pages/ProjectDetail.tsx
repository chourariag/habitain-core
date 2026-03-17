import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Loader2, MapPin, Calendar, Building2, Users, Box } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-warning/20 text-warning-foreground border-warning/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  completed: "bg-success/20 text-success-foreground border-success/30",
  on_hold: "bg-muted text-muted-foreground border-border",
};

const STAGE_COLORS: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success-foreground",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Tables<"projects"> | null>(null);
  const [modules, setModules] = useState<Tables<"modules">[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [moduleName, setModuleName] = useState("");
  const [panelId, setPanelId] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [projectRes, modulesRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("modules").select("*").eq("project_id", id).eq("is_archived", false).order("created_at", { ascending: false }),
    ]);
    setProject(projectRes.data);
    setModules(modulesRes.data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleName.trim() || !id) {
      toast.error("Module name is required");
      return;
    }
    setModuleLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("modules").insert({
        name: moduleName.trim(),
        panel_id: panelId.trim() || null,
        project_id: id,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Module added");
      setModuleName("");
      setPanelId("");
      setAddModuleOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add module");
    } finally {
      setModuleLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  const statusClass = STATUS_COLORS[project.status ?? "planning"] ?? STATUS_COLORS.planning;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{project.name}</h1>
            <Badge variant="outline" className={statusClass}>
              {(project.status ?? "planning").replace("_", " ")}
            </Badge>
          </div>
          {project.client_name && (
            <p className="text-muted-foreground mt-1">{project.client_name}</p>
          )}
        </div>
      </div>

      {/* Project Info Bar */}
      <div className="bg-card rounded-lg p-4 shadow-sm flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {project.location && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{project.location}</span>
          </div>
        )}
        {project.type && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>{project.type}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          <span>
            {project.start_date ? format(new Date(project.start_date), "MMM yyyy") : "TBD"}
            {" → "}
            {project.est_completion ? format(new Date(project.est_completion), "MMM yyyy") : "TBD"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Box className="h-4 w-4 shrink-0" />
          <span>{modules.length} module{modules.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules" className="gap-1.5">
            <Box className="h-4 w-4" /> Modules
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="h-4 w-4" /> Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Modules</h2>
            <Button size="sm" onClick={() => setAddModuleOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Module
            </Button>
          </div>

          {modules.length === 0 ? (
            <div className="bg-card rounded-lg p-8 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">No modules yet. Click "Add Module" to create one.</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-muted-foreground">Module</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Panel ID</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Current Stage</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="p-3 font-medium text-card-foreground">{m.name}</td>
                        <td className="p-3 text-muted-foreground">{m.panel_id ?? "—"}</td>
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
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Team assignment coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Module Dialog */}
      <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add Module</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddModule} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="modName">Module Name *</Label>
              <Input id="modName" value={moduleName} onChange={(e) => setModuleName(e.target.value)} placeholder="e.g. Module A-101" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="panelId">Panel ID</Label>
              <Input id="panelId" value={panelId} onChange={(e) => setPanelId(e.target.value)} placeholder="e.g. PNL-001" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAddModuleOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={moduleLoading}>{moduleLoading ? "Adding…" : "Add Module"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
