import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { useProjectContext } from "@/contexts/ProjectContext";
import { ProjectScopeGuard } from "@/components/ProjectScopeGuard";
import { MobileProjectSwitcher } from "@/components/MobileProjectSwitcher";
import { DispatchPacksTab } from "@/components/site/DispatchPacksTab";
import { InstallationSequenceDoc } from "@/components/site/InstallationSequenceDoc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, ClipboardCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ALLOWED_ROLES = [
  "super_admin", "managing_director",
  "production_head", "site_installation_mgr", "head_operations",
  "delivery_rm_lead", "factory_floor_supervisor",
];

function DispatchDeliveryContent() {
  const { role } = useUserRole();
  const { selectedProjectId, selectedProject } = useProjectContext();
  const [userRole, setUserRole] = useState<string | null>(role ?? null);
  const navigate = useNavigate();

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
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} /> Delivery Checklist — 3-Part Sign-Off
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs" style={{ color: "#666" }}>
                Three sign-offs required before dispatch:
                <br/>1. <strong>Rakesh</strong> — Pre-Dispatch (Factory Supervisor)
                <br/>2. <strong>Sandeep</strong> — Stores Confirmation
                <br/>3. <strong>Awaiz</strong> — Site Installation Manager
              </p>
              <Button
                onClick={() => navigate(`/production/delivery-checklist/${selectedProjectId}`)}
                className="gap-1.5"
                style={{ backgroundColor: "#006039", color: "#FFFFFF" }}
              >
                <ClipboardCheck className="h-4 w-4" /> Open Delivery Checklist
              </Button>
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
