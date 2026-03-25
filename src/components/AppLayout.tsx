import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { OfflineBanner } from "./OfflineBanner";
import { UserAvatar } from "./UserAvatar";
import { ProjectBreadcrumb } from "./ProjectBreadcrumb";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ConnectionIndicator } from "./ConnectionIndicator";
import { NotificationBell } from "./notifications/NotificationBell";

export function AppLayout() {
  return (
    <ProjectProvider>
      <div className="flex flex-col h-screen bg-background overflow-x-hidden max-w-[100vw]">
        <OfflineBanner />
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
