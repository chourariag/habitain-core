import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Loader2, MapPin, Calendar, Building2, Users, Box, BookOpen, FileText } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import { AddModuleDialog } from "@/components/projects/AddModuleDialog";
import { ModulePanelCard } from "@/components/projects/ModulePanelCard";
import { SiteDiary } from "@/components/site/SiteDiary";
import { HandoverPack } from "@/components/site/HandoverPack";
import { computeProjectStatus, PROJECT_STATUS_CONFIG } from "@/lib/project-status";

const EDIT_ROLES = ["planning_engineer", "super_admin", "managing_director"];
const STAGE_ADVANCE_ROLES = ["planning_engineer", "production_head", "super_admin", "managing_director"];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Tables<"projects"> | null>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [panels, setPanels] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasHandover, setHasHandover] = useState(false);

  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const canAdvanceStage = STAGE_ADVANCE_ROLES.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const [projectRes, modulesRes, roleRes, handoverRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("modules").select("*").eq("project_id", id).eq("is_archived", false).order("created_at", { ascending: true }),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return null;
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return data;
      }),
      supabase.from("handover_pack").select("id").eq("project_id", id).limit(1),
    ]);

    setProject(projectRes.data);
    setModules(modulesRes.data ?? []);
    setUserRole(roleRes as string | null);
    setHasHandover((handoverRes.data ?? []).length > 0);

    const moduleIds = (modulesRes.data ?? []).map((m: any) => m.id);
    if (moduleIds.length > 0) {
      const { data: panelsData } = await (supabase.from("panels" as any) as any)
        .select("*").in("module_id", moduleIds).eq("is_archived", false).order("created_at", { ascending: true });
      const grouped: Record<string, any[]> = {};
      (panelsData ?? []).forEach((p: any) => {
        if (!grouped[p.module_id]) grouped[p.module_id] = [];
        grouped[p.module_id].push(p);
      });
      setPanels(grouped);
    } else {
      setPanels({});
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
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

  const dynamicStatus = computeProjectStatus(modules, hasHandover);
  const statusCfg = PROJECT_STATUS_CONFIG[dynamicStatus];
  const totalPanels = Object.values(panels).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{project.name}</h1>
            <Badge className={statusCfg.badgeClass}>{statusCfg.label}</Badge>
          </div>
          {project.client_name && (
            <p className="text-muted-foreground mt-1">{project.client_name}</p>
          )}
        </div>
      </div>

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
          <span>{modules.length} module{modules.length !== 1 ? "s" : ""} · {totalPanels} panel{totalPanels !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules" className="gap-1.5"><Box className="h-4 w-4" /> Modules</TabsTrigger>
          <TabsTrigger value="site-diary" className="gap-1.5"><BookOpen className="h-4 w-4" /> Site Diary</TabsTrigger>
          <TabsTrigger value="handover" className="gap-1.5"><FileText className="h-4 w-4" /> Handover</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-4 w-4" /> Team</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Modules & Panels</h2>
            {canEdit && (
              <Button size="sm" onClick={() => setAddModuleOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Module
              </Button>
            )}
          </div>
          {modules.length === 0 ? (
            <div className="bg-card rounded-lg p-8 text-center shadow-sm">
              <p className="text-muted-foreground text-sm">
                {canEdit ? 'No modules yet. Click "Add Module" to create one.' : "No modules have been created for this project yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((m) => (
                <ModulePanelCard key={m.id} module={m} panels={panels[m.id] ?? []} projectId={id!} canEdit={canEdit} canAdvanceStage={canAdvanceStage} userRole={userRole} onPanelCreated={fetchData} onStageAdvanced={fetchData} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="site-diary" className="space-y-4">
          <SiteDiary projectId={id!} userRole={userRole} />
        </TabsContent>

        <TabsContent value="handover" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Handover</h2>
          <HandoverPack projectId={id!} clientName={project.client_name} userRole={userRole} installationComplete={modules.some((m: any) => m.production_status === "dispatched")} onHandedOver={fetchData} />
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
          <div className="bg-card rounded-lg p-8 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">Team assignment coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      <AddModuleDialog open={addModuleOpen} onOpenChange={setAddModuleOpen} projectId={id!} onCreated={fetchData} />
    </div>
  );
}
