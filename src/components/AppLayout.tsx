import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { OfflineBanner } from "./OfflineBanner";

export function AppLayout() {
  return (
    <div className="flex flex-col h-screen">
      <OfflineBanner />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
