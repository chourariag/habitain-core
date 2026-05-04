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
import { DesignRouteGuard } from "@/components/DesignRouteGuard";
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
import ComingSoon from "@/pages/ComingSoon";
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
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/production" element={<Production />} />
                <Route path="/production/delivery-checklist/:projectId" element={<DeliveryChecklist />} />
                <Route path="/site-hub" element={<SiteHub />} />
                <Route path="/site-hub/dispatch-pack" element={<DispatchPackForm />} />
                <Route path="/site-hub/advance-request" element={<AdvanceRequest />} />
                <Route path="/design" element={<DesignRouteGuard><DesignPortal /></DesignRouteGuard>} />
                <Route path="/drawings" element={<DesignRouteGuard><Drawings /></DesignRouteGuard>} />
                <Route path="/qc" element={<QualityControl />} />
                <Route path="/procurement" element={<Procurement />} />
                <Route path="/inventory" element={<Navigate to="/procurement" replace />} />
                <Route path="/materials" element={<Navigate to="/procurement" replace />} />
                <Route path="/rm" element={<RMPage />} />
                <Route path="/amc" element={<AMCPage />} />
                <Route path="/sales" element={<Sales />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/kpi" element={<KPI />} />
                <Route path="/kpi/settings" element={<KPISettings />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/settings" element={<AppSettings />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/factory/floor-map" element={<FactoryFloorMap />} />
                <Route path="/capacity" element={<CapacityPlanning />} />
                <Route path="/sops" element={<SOPs />} />
                <Route path="/super-admin" element={<Navigate to="/admin/super-admin" replace />} />
                <Route path="/admin/super-admin" element={<SuperAdmin />} />
                <Route path="/approvals" element={<Approvals />} />
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
