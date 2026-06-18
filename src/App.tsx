import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineProvider } from "@/components/OfflineProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import Login from "@/pages/Login";
import Setup from "@/pages/Setup";
import Welcome from "@/pages/Welcome";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Production from "@/pages/Production";
import DeliveryChecklist from "@/pages/DeliveryChecklist";
import SiteHub from "@/pages/SiteHub";
import DispatchPackForm from "@/pages/DispatchPackForm";
import DesignPortal from "@/pages/DesignPortal";
import DesignSchedule from "@/pages/DesignSchedule";
import { DesignRouteGuard } from "@/components/DesignRouteGuard";
import { ManagementRouteGuard } from "@/components/ManagementRouteGuard";
import Management from "@/pages/Management";
import QualityControl from "@/pages/QualityControl";
// Inventory page consolidated into Procurement
import Admin from "@/pages/Admin";
import AppSettings from "@/pages/AppSettings";
import RMPage from "@/pages/RM";
import AMCPage from "@/pages/AMC";
import Drawings from "@/pages/Drawings";
import Procurement from "@/pages/Procurement";
import Sales from "@/pages/Sales";
import Profile from "@/pages/Profile";
import Attendance from "@/pages/Attendance";
import NotFound from "@/pages/NotFound";
import Announcements from "@/pages/Announcements";
import Finance from "@/pages/Finance";
import KPI from "@/pages/KPI";
import KPISettings from "@/pages/KPISettings";
import Alerts from "@/pages/Alerts";
import AdvanceRequest from "@/pages/AdvanceRequest";
import FactoryFloorMap from "@/pages/FactoryFloorMap";
import CapacityPlanning from "@/pages/CapacityPlanning";
import ClientPortal from "@/pages/ClientPortal";
import Onboarding from "@/pages/Onboarding";
import SOPs from "@/pages/SOPs";
import SuperAdmin from "@/pages/SuperAdmin";
import UserManagement from "@/pages/UserManagement";
import Approvals from "@/pages/Approvals";
import AdminHR from "@/pages/AdminHR";
import Safety from "@/pages/Safety";
import ProductionDashboard from "@/pages/ProductionDashboard";
import DispatchDelivery from "@/pages/DispatchDelivery";
import SiteDashboard from "@/pages/SiteDashboard";
import EmployeeManagement from "@/pages/EmployeeManagement";
import AuthCallback from "@/pages/AuthCallback";
import ResetPassword from "@/pages/ResetPassword";
import Trust from "@/pages/Trust";
import { ModuleGuard } from "@/components/ModuleGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <OfflineProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<ModuleGuard module="projects"><Projects /></ModuleGuard>} />
                <Route path="/projects/:id" element={<ModuleGuard module="projects"><ProjectDetail /></ModuleGuard>} />
                <Route path="/management" element={<ModuleGuard module="reports"><ManagementRouteGuard><Management /></ManagementRouteGuard></ModuleGuard>} />
                <Route path="/production" element={<ModuleGuard module="factory"><Production /></ModuleGuard>} />
                <Route path="/production/dashboard" element={<ModuleGuard module="factory"><ProductionDashboard /></ModuleGuard>} />
                <Route path="/production/delivery-checklist/:projectId" element={<ModuleGuard module="factory"><DeliveryChecklist /></ModuleGuard>} />
                <Route path="/dispatch-delivery" element={<ModuleGuard module="dispatch"><DispatchDelivery /></ModuleGuard>} />
                <Route path="/site-dashboard" element={<ModuleGuard module="site"><SiteDashboard /></ModuleGuard>} />
                <Route path="/site-hub" element={<ModuleGuard module="site"><SiteHub /></ModuleGuard>} />
                <Route path="/site-hub/dispatch-pack" element={<ModuleGuard module="site"><DispatchPackForm /></ModuleGuard>} />
                <Route path="/dispatch-pack-form" element={<ModuleGuard module="site"><DispatchPackForm /></ModuleGuard>} />
                <Route path="/site-hub/advance-request" element={<ModuleGuard module="site"><AdvanceRequest /></ModuleGuard>} />
                <Route path="/design" element={<ModuleGuard module="design"><DesignRouteGuard><DesignPortal /></DesignRouteGuard></ModuleGuard>} />
                <Route path="/design/schedule" element={<ModuleGuard module="design"><DesignRouteGuard><DesignSchedule /></DesignRouteGuard></ModuleGuard>} />
                <Route path="/drawings" element={<ModuleGuard module="design"><DesignRouteGuard><Drawings /></DesignRouteGuard></ModuleGuard>} />
                <Route path="/qc" element={<ModuleGuard module="qc"><QualityControl /></ModuleGuard>} />
                <Route path="/procurement" element={<ModuleGuard module="procurement"><Procurement /></ModuleGuard>} />
                <Route path="/inventory" element={<Navigate to="/procurement" replace />} />
                <Route path="/materials" element={<Navigate to="/procurement" replace />} />
                <Route path="/rm" element={<ModuleGuard module="site"><RMPage /></ModuleGuard>} />
                <Route path="/amc" element={<ModuleGuard module="site"><AMCPage /></ModuleGuard>} />
                <Route path="/sales" element={<ModuleGuard module="sales"><Sales /></ModuleGuard>} />
                <Route path="/finance" element={<ModuleGuard module="finance"><Finance /></ModuleGuard>} />
                <Route path="/kpi" element={<KPI />} />
                <Route path="/kpi/settings" element={<KPISettings />} />
                <Route path="/admin" element={<ModuleGuard requireAdminPanel><Admin /></ModuleGuard>} />
                <Route path="/admin/users" element={<ModuleGuard requireAdminPanel><UserManagement /></ModuleGuard>} />
                <Route path="/admin/employees" element={<ModuleGuard requireAdminPanel><EmployeeManagement /></ModuleGuard>} />
                <Route path="/settings" element={<AppSettings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/attendance" element={<ModuleGuard module="hr"><Attendance /></ModuleGuard>} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/factory/floor-map" element={<ModuleGuard module="factory"><FactoryFloorMap /></ModuleGuard>} />
                <Route path="/capacity" element={<ModuleGuard module="factory"><CapacityPlanning /></ModuleGuard>} />
                <Route path="/sops" element={<SOPs />} />
                <Route path="/super-admin" element={<Navigate to="/admin/super-admin" replace />} />
                <Route path="/admin/super-admin" element={<SuperAdmin />} />
                <Route path="/admin/hr" element={<ModuleGuard module="hr"><AdminHR /></ModuleGuard>} />
                <Route path="/safety" element={<ModuleGuard module="factory"><Safety /></ModuleGuard>} />
                <Route path="/approvals" element={<ModuleGuard module="approvals"><Approvals /></ModuleGuard>} />
                <Route path="/announcements" element={<ModuleGuard module="announcements"><Announcements /></ModuleGuard>} />
              </Route>
              <Route path="/client/:projectToken" element={<ClientPortal />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </OfflineProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
