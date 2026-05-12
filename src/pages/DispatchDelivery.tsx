import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { DispatchPacksTab } from "@/components/site/DispatchPacksTab";
import { DeliveryChecklistButton } from "@/components/production/DeliveryChecklistButton";
import { InstallationSequenceDoc } from "@/components/site/InstallationSequenceDoc";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";

const ALLOWED_ROLES = [
  "super_admin", "managing_director",
  "production_head", "site_installation_mgr", "head_operations",
  "delivery_rm_lead", "factory_floor_supervisor",
];

function DispatchDeliveryContent() {
  const { role } = useUserRole();
  const { selectedProjectId, selectedProject } = useProjectContext();
  const [userRole, setUserRole] = useState<string | null>(role ?? null);

  useEffect(() => { setUserRole(role ?? null); }, [role]);

  if (role && !ALLOWED_ROLES.includes(role)) return <Navigate to="/dashboard" replace />;
  if (!selectedProjectId) {
    return <div className="p-6"><p style={{ color: "#666" }}>Select a project to view dispatch & delivery.</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <MobileProjectSwitcher />
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6" style={{ color: "#006039" }} />
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Dispatch & Delivery</h1>
          <p className="text-sm" style={{ color: "#666" }}>{selectedProject?.name}</p>
        </div>
      </div>

      <Tabs defaultValue="packs" className="w-full">
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="packs">Dispatch Packs</TabsTrigger>
            <TabsTrigger value="delivery">Delivery Checklist</TabsTrigger>
            <TabsTrigger value="installation">Installation Sequence</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="packs">
          <DispatchPacksTab projectId={selectedProjectId} />
        </TabsContent>
        <TabsContent value="delivery">
          <Card>
            <CardHeader><CardTitle className="text-sm">Delivery Checklist</CardTitle></CardHeader>
            <CardContent>
              <DeliveryChecklistButton projectId={selectedProjectId} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="installation">
          <InstallationSequenceDoc
            projectId={selectedProjectId}
            projectName={selectedProject?.name ?? ""}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DispatchDelivery() {
  return <ProjectScopeGuard><DispatchDeliveryContent /></ProjectScopeGuard>;
}
