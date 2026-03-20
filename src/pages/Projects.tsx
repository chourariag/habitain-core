import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { ProjectCommandCard } from "@/components/projects/ProjectCommandCard";
import type { Tables } from "@/integrations/supabase/types";

export default function Projects() {
  const [projects, setProjects] = useState<Tables<"projects">[]>([]);
  const [modulesByProject, setModulesByProject] = useState<Record<string, any[]>>({});
  const [handoversByProject, setHandoversByProject] = useState<Record<string, boolean>>({});
  const [delaysByProject, setDelaysByProject] = useState<Record<string, number>>({});
  const [ncrsByProject, setNcrsByProject] = useState<Record<string, number>>({});
  const [siteReadyByProject, setSiteReadyByProject] = useState<Record<string, boolean>>({});
  const [dqsByProject, setDqsByProject] = useState<Record<string, number>>({});
  const [approvalsByProject, setApprovalsByProject] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const [projRes, modRes, handoverRes, schedRes, ncrRes, readyRes, dqRes, stageRes] = await Promise.all([
      supabase.from("projects").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("modules").select("id, project_id, current_stage, production_status").eq("is_archived", false),
      supabase.from("handover_pack").select("project_id"),
      supabase.from("module_schedule").select("module_id, stage_name, target_end").not("target_end", "is", null),
      supabase.from("ncr_register").select("inspection_id, status").eq("is_archived", false).in("status", ["open", "critical_open"]),
      (supabase.from("site_readiness") as any).select("project_id, is_complete").eq("is_complete", true),
      supabase.from("design_queries").select("project_id, status").eq("is_archived", false).in("status", ["open", "under_review"]),
      supabase.from("design_stages").select("project_id, status").in("status", ["submitted_to_client"]),
    ]);

    const allProjects = projRes.data ?? [];
    setProjects(allProjects);

    // Group modules by project
    const grouped: Record<string, any[]> = {};
    (modRes.data ?? []).forEach((m: any) => {
      if (!grouped[m.project_id]) grouped[m.project_id] = [];
      grouped[m.project_id].push(m);
    });
    setModulesByProject(grouped);

    // Handovers
    const hMap: Record<string, boolean> = {};
    (handoverRes.data ?? []).forEach((h: any) => { hMap[h.project_id] = true; });
    setHandoversByProject(hMap);

    // Delays: modules where target_end has passed and module is still in that stage
    const moduleProjectMap: Record<string, string> = {};
    (modRes.data ?? []).forEach((m: any) => { moduleProjectMap[m.id] = m.project_id; });
    const moduleStageMap: Record<string, string> = {};
    (modRes.data ?? []).forEach((m: any) => { moduleStageMap[m.id] = m.current_stage ?? ""; });

    const today = new Date().toISOString().split("T")[0];
    const delayMap: Record<string, number> = {};
    (schedRes.data ?? []).forEach((s: any) => {
      const projId = moduleProjectMap[s.module_id];
      if (!projId) return;
      const currentStage = moduleStageMap[s.module_id];
      if (s.stage_name === currentStage && s.target_end < today) {
        delayMap[projId] = (delayMap[projId] ?? 0) + 1;
      }
    });
    setDelaysByProject(delayMap);

    // Open NCRs — need to map inspection → module → project
    const inspModuleIds = new Set((ncrRes.data ?? []).map((n: any) => n.inspection_id));
    if (inspModuleIds.size > 0) {
      const { data: inspData } = await supabase
        .from("qc_inspections")
        .select("id, module_id")
        .in("id", Array.from(inspModuleIds));
      const ncrMap: Record<string, number> = {};
      (inspData ?? []).forEach((i: any) => {
        const projId = moduleProjectMap[i.module_id];
        if (projId) ncrMap[projId] = (ncrMap[projId] ?? 0) + 1;
      });
      setNcrsByProject(ncrMap);
    } else {
      setNcrsByProject({});
    }

    // Site readiness
    const readyMap: Record<string, boolean> = {};
    (readyRes.data ?? []).forEach((r: any) => { readyMap[r.project_id] = true; });
    setSiteReadyByProject(readyMap);

    // Design queries
    const dqMap: Record<string, number> = {};
    (dqRes.data ?? []).forEach((d: any) => { dqMap[d.project_id] = (dqMap[d.project_id] ?? 0) + 1; });
    setDqsByProject(dqMap);

    // Pending client approvals
    const appMap: Record<string, number> = {};
    (stageRes.data ?? []).forEach((s: any) => { appMap[s.project_id] = (appMap[s.project_id] ?? 0) + 1; });
    setApprovalsByProject(appMap);

    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Projects</h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>Command centre — all construction projects</p>
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
        <div className="rounded-lg p-8 text-center" style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <p className="text-sm" style={{ color: "#666666" }}>No projects yet. Click "New Project" to create one.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <ProjectCommandCard
              key={project.id}
              project={project}
              modules={modulesByProject[project.id] ?? []}
              hasHandover={!!handoversByProject[project.id]}
              delays={delaysByProject[project.id] ?? 0}
              openNCRs={ncrsByProject[project.id] ?? 0}
              siteReady={!!siteReadyByProject[project.id]}
              pendingDQs={dqsByProject[project.id] ?? 0}
              pendingApprovals={approvalsByProject[project.id] ?? 0}
            />
          ))}
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProjects} />
    </div>
  );
}
