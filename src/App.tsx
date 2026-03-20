import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/query-core";
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
import SiteHub from "@/pages/SiteHub";
import DesignPortal from "@/pages/DesignPortal";
import { DesignRouteGuard } from "@/components/DesignRouteGuard";
import QualityControl from "@/pages/QualityControl";
import Inventory from "@/pages/Inventory";
import Admin from "@/pages/Admin";
import AppSettings from "@/pages/AppSettings";
import RMPage from "@/pages/RM";
import AMCPage from "@/pages/AMC";
import Drawings from "@/pages/Drawings";
import Procurement from "@/pages/Procurement";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import ComingSoon from "@/pages/ComingSoon";

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
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/production" element={<Production />} />
                <Route path="/site-hub" element={<SiteHub />} />
                <Route path="/design" element={<DesignRouteGuard><DesignPortal /></DesignRouteGuard>} />
                <Route path="/drawings" element={<DesignRouteGuard><Drawings /></DesignRouteGuard>} />
                <Route path="/qc" element={<QualityControl />} />
                <Route path="/procurement" element={<Procurement />} />
                <Route path="/inventory" element={<Navigate to="/procurement" replace />} />
                <Route path="/materials" element={<Navigate to="/procurement" replace />} />
                <Route path="/rm" element={<RMPage />} />
                <Route path="/amc" element={<AMCPage />} />
                <Route path="/sales" element={<ComingSoon />} />
                <Route path="/finance" element={<ComingSoon />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/settings" element={<AppSettings />} />
                <Route path="/profile" element={<Profile />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </OfflineProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
