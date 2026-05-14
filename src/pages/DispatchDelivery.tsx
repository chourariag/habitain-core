import { Navigate as _NavUnused } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { DispatchPackFormV2 } from "@/components/dispatch/DispatchPackFormV2";
import { DeliveryChecklistV2 } from "@/components/dispatch/DeliveryChecklistV2";
import { InstallationSequenceV2 } from "@/components/dispatch/InstallationSequenceV2";
import { Truck } from "lucide-react";

const ALLOWED_ROLES = [
  "super_admin", "managing_director",
  "production_head", "site_installation_mgr", "head_operations",
  "delivery_rm_lead", "factory_floor_supervisor",
];

function DispatchDeliveryContent() {
  const { role } = useUserRole();
  const { selectedProjectId, selectedProject } = useProjectContext();

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
            <TabsTrigger value="packs">Stage 1 — Dispatch Pack</TabsTrigger>
            <TabsTrigger value="delivery">Stage 2 — Delivery Checklist</TabsTrigger>
            <TabsTrigger value="installation">Stage 3 — Installation Sequence</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>

        <TabsContent value="packs">
          <DispatchPackFormV2 projectId={selectedProjectId} projectName={selectedProject?.name ?? ""} />
        </TabsContent>
        <TabsContent value="delivery">
          <DeliveryChecklistV2 projectId={selectedProjectId} projectName={selectedProject?.name ?? ""} />
        </TabsContent>
        <TabsContent value="installation">
          <InstallationSequenceV2 projectId={selectedProjectId} projectName={selectedProject?.name ?? ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function DispatchDelivery() {
  return <ProjectScopeGuard><DispatchDeliveryContent /></ProjectScopeGuard>;
}
