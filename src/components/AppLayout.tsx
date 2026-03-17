import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { OfflineBanner } from "./OfflineBanner";
import { UserAvatar } from "./UserAvatar";

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar with avatar */}
          <header className="flex items-center justify-end h-12 px-4 border-b border-border bg-background shrink-0">
            <UserAvatar />
          </header>
          <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
