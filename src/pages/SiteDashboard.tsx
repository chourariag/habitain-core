import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { HardHat, Package, ClipboardCheck, Truck, ArrowRight } from "lucide-react";

function SiteDashboardContent() {
  const { selectedProjectId, selectedProject } = useProjectContext();
  const [stats, setStats] = useState<{ inventoryItems: number; siteReady: boolean; openPunch: number }>({
    inventoryItems: 0, siteReady: false, openPunch: 0,
  });

  const load = useCallback(async () => {
    if (!selectedProjectId) return;
    const [invRes, readyRes, punchRes] = await Promise.all([
      (supabase.from("site_inventory") as any).select("id").eq("project_id", selectedProjectId),
      (supabase.from("site_readiness") as any).select("is_complete").eq("project_id", selectedProjectId).maybeSingle(),
      (supabase.from("punch_list_items") as any).select("id,status").eq("project_id", selectedProjectId).neq("status", "Closed"),
    ]);
    setStats({
      inventoryItems: (invRes.data ?? []).length,
      siteReady: !!readyRes.data?.is_complete,
      openPunch: (punchRes.data ?? []).length,
    });
  }, [selectedProjectId]);

  useEffect(() => { load(); }, [load]);

  if (!selectedProjectId) {
    return <div className="p-6"><p style={{ color: "#666" }}>Select a project.</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <MobileProjectSwitcher />
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Site Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>{selectedProject?.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} /> Site Readiness</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <Badge style={stats.siteReady ? { backgroundColor: "#E8F2ED", color: "#006039" } : { backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              {stats.siteReady ? "Ready" : "Pending"}
            </Badge>
            <Button asChild size="sm" variant="outline"><Link to="/site-hub">Open <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" style={{ color: "#006039" }} /> Site Inventory</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold" style={{ color: "#1A1A1A" }}>{stats.inventoryItems}</p>
            <Button asChild size="sm" variant="outline"><Link to="/site-hub">Open <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HardHat className="h-4 w-4" style={{ color: "#F40009" }} /> Open Punch Items</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-3xl font-bold" style={{ color: stats.openPunch ? "#F40009" : "#1A1A1A" }}>{stats.openPunch}</p>
            <Button asChild size="sm" variant="outline"><Link to="/site-hub">Open <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button asChild style={{ backgroundColor: "#006039" }}><Link to="/site-hub">Site Hub</Link></Button>
        <Button asChild variant="outline"><Link to="/dispatch-delivery"><Truck className="h-4 w-4 mr-1" /> Dispatch & Delivery</Link></Button>
      </div>
    </div>
  );
}

export default function SiteDashboard() {
  return <ProjectScopeGuard><SiteDashboardContent /></ProjectScopeGuard>;
}
