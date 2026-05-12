import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { Factory, ClipboardCheck, Package, Users, ArrowRight, AlertTriangle, BarChart3 } from "lucide-react";

const AZAD_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"];

function ProductionDashboardContent() {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const { role } = useUserRole();
  const isAzad = AZAD_ROLES.includes(role ?? "");

  const [stats, setStats] = useState<{
    activeStage: string;
    onTrack: number;
    delayed: number;
    blocked: number;
    openNcrs: number;
    openMaterialGates: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!selectedProjectId) return;
    const [tasksRes, ncrRes, gatesRes] = await Promise.all([
      supabase.from("project_tasks").select("id,task_name,status,delay_days").eq("project_id", selectedProjectId),
      (supabase.from("ncr_register") as any).select("id,status").eq("project_id", selectedProjectId).neq("status", "Closed"),
      (supabase.from("project_material_plan_items") as any).select("id,status").eq("project_id", selectedProjectId).neq("status", "Received"),
    ]);
    const tasks = tasksRes.data ?? [];
    const inProgress = tasks.find((t: any) => t.status === "In Progress");
    setStats({
      activeStage: inProgress?.task_name ?? "—",
      onTrack: tasks.filter((t: any) => (t.delay_days ?? 0) <= 0 && t.status !== "Completed").length,
      delayed: tasks.filter((t: any) => (t.delay_days ?? 0) > 0 && (t.delay_days ?? 0) <= 3).length,
      blocked: tasks.filter((t: any) => (t.delay_days ?? 0) > 3 || t.status === "Blocked").length,
      openNcrs: (ncrRes.data ?? []).length,
      openMaterialGates: (gatesRes.data ?? []).length,
    });
  }, [selectedProjectId]);

  useEffect(() => { load(); }, [load]);

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <p style={{ color: "#666" }}>Select a project to see its production dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <MobileProjectSwitcher />
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Production Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>{selectedProject?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Factory className="h-4 w-4" style={{ color: "#006039" }} /> Active Stage</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-semibold" style={{ color: "#1A1A1A" }}>{stats?.activeStage ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" style={{ color: "#006039" }} /> Schedule Health</CardTitle></CardHeader>
          <CardContent className="flex gap-3 flex-wrap">
            <Badge style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>{stats?.onTrack ?? 0} on track</Badge>
            <Badge style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>{stats?.delayed ?? 0} delayed</Badge>
            <Badge style={{ backgroundColor: "#FDE7E9", color: "#F40009" }}>{stats?.blocked ?? 0} blocked</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} /> Open NCRs</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold" style={{ color: stats?.openNcrs ? "#F40009" : "#1A1A1A" }}>{stats?.openNcrs ?? 0}</p>
            <Button asChild size="sm" variant="outline"><Link to="/qc">Open <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" style={{ color: "#D4860A" }} /> Material Gates Pending</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold" style={{ color: "#1A1A1A" }}>{stats?.openMaterialGates ?? 0}</p>
            <Button asChild size="sm" variant="outline"><Link to="/procurement">Open <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardContent>
        </Card>

        {isAzad && (
          <>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Factory className="h-4 w-4" style={{ color: "#006039" }} /> Floor Capacity</CardTitle></CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline" className="w-full"><Link to="/factory/floor-map">View Floor Map</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" style={{ color: "#006039" }} /> Team & Labour</CardTitle></CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline" className="w-full"><Link to="/production">Open Factory Floor</Link></Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button asChild style={{ backgroundColor: "#006039" }}><Link to="/production">Factory Floor</Link></Button>
        <Button asChild variant="outline"><Link to="/qc"><ClipboardCheck className="h-4 w-4 mr-1" /> QC & NCR</Link></Button>
        <Button asChild variant="outline"><Link to="/dispatch-delivery">Dispatch & Delivery</Link></Button>
      </div>
    </div>
  );
}

export default function ProductionDashboard() {
  return <ProjectScopeGuard><ProductionDashboardContent /></ProjectScopeGuard>;
}
