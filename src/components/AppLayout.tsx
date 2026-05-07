import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { OfflineBanner } from "./OfflineBanner";
import { UserAvatar } from "./UserAvatar";
import { ProjectBreadcrumb } from "./ProjectBreadcrumb";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { NotificationBell } from "./notifications/NotificationBell";
import { getTestingModeData, clearTestingMode } from "@/hooks/useUserRole";
import { ROLE_LABELS } from "@/lib/roles";
import type { AppRole } from "@/lib/roles";
import { FlaskConical, X } from "lucide-react";

function TestingModeBanner() {
  const tm = getTestingModeData();
  if (!tm) return null;

  const roleLabel = ROLE_LABELS[tm.overrideRole as AppRole] ?? tm.overrideRole;
  const realLabel = ROLE_LABELS[tm.realRole as AppRole] ?? tm.realRole;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0"
      style={{ backgroundColor: "#FFF8E8", borderBottom: "1px solid #D4860A", color: "#D4860A" }}
    >
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 shrink-0" />
        <span className="font-semibold">Testing Mode</span>
        <span>—</span>
        <span>Viewing as: <strong>{tm.overrideName}</strong> ({roleLabel}). Your actual role is {realLabel}.</span>
      </div>
      <button
        onClick={clearTestingMode}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded hover:bg-black/10 transition-colors"
        style={{ color: "#D4860A" }}
      >
        <X className="h-3.5 w-3.5" />
        Exit Testing Mode
      </button>
    </div>
  );
}

export function AppLayout() {
  return (
    <ProjectProvider>
      <div className="flex flex-col h-screen bg-background overflow-x-hidden max-w-[100vw]">
        <OfflineBanner />
        <TestingModeBanner />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-end h-12 px-4 border-b border-border bg-background shrink-0 gap-2">
              <NotificationBell />
              <ConnectionIndicator />
              <UserAvatar />
            </header>
            <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0 bg-background max-w-full">
              <div className="px-4 md:px-6 pt-4">
                <ProjectBreadcrumb />
              </div>
              <Outlet />
            </main>
          </div>
        </div>
        <MobileNav />
      </div>
    </ProjectProvider>
  );
}
