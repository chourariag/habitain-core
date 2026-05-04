import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/useUserRole";
import { ShieldAlert, ListTree, KeySquare, AlertOctagon, BadgeIndianRupee, Database, Users, History } from "lucide-react";
import { TaskMasterTab } from "@/components/super-admin/TaskMasterTab";
import { RolesAccessTab } from "@/components/super-admin/RolesAccessTab";
import { EscalationMatrixTab } from "@/components/super-admin/EscalationMatrixTab";
import { ApprovalsTab } from "@/components/super-admin/ApprovalsTab";
import { DataBankTab } from "@/components/super-admin/DataBankTab";
import { UsersTab } from "@/components/super-admin/UsersTab";
import { AuditTrailTab } from "@/components/super-admin/AuditTrailTab";

const MD_ROLES = ["managing_director", "super_admin"];

export default function SuperAdmin() {
  const { role, loading } = useUserRole();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!role || !MD_ROLES.includes(role)) return <Navigate to="/admin" replace />;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Data Management Centre — changes here affect the entire system.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide" style={{ background: "#F40009", color: "#fff" }}>
          <ShieldAlert className="h-3.5 w-3.5" /> Super Admin
        </span>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-1.5"><ListTree className="h-3.5 w-3.5" /> Task Master</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5"><KeySquare className="h-3.5 w-3.5" /> Roles &amp; Access</TabsTrigger>
          <TabsTrigger value="escalation" className="gap-1.5"><AlertOctagon className="h-3.5 w-3.5" /> Escalation</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5"><BadgeIndianRupee className="h-3.5 w-3.5" /> Approvals</TabsTrigger>
          <TabsTrigger value="databank" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Data Bank</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Users</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5"><History className="h-3.5 w-3.5" /> Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4"><TaskMasterTab /></TabsContent>
        <TabsContent value="roles" className="mt-4"><RolesAccessTab /></TabsContent>
        <TabsContent value="escalation" className="mt-4"><EscalationMatrixTab /></TabsContent>
        <TabsContent value="approvals" className="mt-4"><ApprovalsTab /></TabsContent>
        <TabsContent value="databank" className="mt-4"><DataBankTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditTrailTab /></TabsContent>
      </Tabs>
    </div>
  );
}
