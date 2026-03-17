import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { Tables } from "@/integrations/supabase/types";

export default function Projects() {
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [modulesByProject, setModulesByProject] = useState<Record<string, any[]>>({});
  const [handoversByProject, setHandoversByProject] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const [projRes, modRes, handoverRes] = await Promise.all([
      supabase.from("projects").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("modules").select("id, project_id, current_stage, production_status").eq("is_archived", false),
      supabase.from("handover_pack").select("project_id"),
    ]);
    setProjects(projRes.data ?? []);
    const grouped: Record<string, any[]> = {};
    (modRes.data ?? []).forEach((m: any) => {
      if (!grouped[m.project_id]) grouped[m.project_id] = [];
      grouped[m.project_id].push(m);
    });
    setModulesByProject(grouped);
    const hMap: Record<string, boolean> = {};
    (handoverRes.data ?? []).forEach((h: any) => { hMap[h.project_id] = true; });
    setHandoversByProject(hMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all construction projects</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm">
          <p className="text-card-foreground/60 text-sm">No projects yet. Click "New Project" to create one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              modules={modulesByProject[project.id] ?? []}
              hasHandover={!!handoversByProject[project.id]}
            />
          ))}
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProjects} />
    </div>
  );
}
