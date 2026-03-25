import { useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, Truck,
  BarChart3, DollarSign, ClipboardCheck, ShoppingCart, Compass,
  Wrench, Users, Settings, Clock, Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection } from "@/lib/role-nav";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppRole } from "@/lib/roles";

const allTabs = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, section: "dashboard" },
  { to: "/projects", label: "Projects", icon: FolderKanban, section: "projects" },
  { to: "/production", label: "Factory", icon: Factory, section: "production" },
  { to: "/site-hub", label: "Site", icon: Truck, section: "production" },
  { to: "/qc", label: "QC", icon: ClipboardCheck, section: "production" },
  { to: "/sales", label: "Sales", icon: BarChart3, section: "business" },
  { to: "/finance", label: "Finance", icon: DollarSign, section: "business" },
  { to: "/procurement", label: "Procurement", icon: ShoppingCart, section: "procurement" },
  { to: "/design", label: "Design", icon: Compass, section: "design" },
  { to: "/rm", label: "R&M", icon: Wrench, section: "business" },
  { to: "/attendance", label: "HR", icon: Clock, section: "admin" },
  { to: "/admin", label: "Admin", icon: Users, section: "admin" },
  { to: "/settings", label: "Settings", icon: Settings, section: "admin" },
  { to: "/alerts", label: "Alerts", icon: Bell, section: "alerts" },
];

export function MobileNav() {
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();

  const visibleTabs = allTabs.filter(
    (t) => t.section === "dashboard" || t.section === "alerts" || canSeeSection(userRole, t.section)
  );

  // Scroll active tab into view on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    }
  }, []);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
    >
      <div className="relative h-[60px] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex items-center h-full overflow-x-auto scrollbar-none px-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-[3px] min-w-[64px] flex-shrink-0 px-2 py-1 text-[10px] font-medium transition-colors"
                )
              }
              style={({ isActive }) => ({ color: isActive ? "#006039" : "#999999" })}
            >
              {({ isActive }) => (
                <span
                  data-active={isActive ? "true" : undefined}
                  className="flex flex-col items-center gap-[3px] relative"
                >
                  <span className="relative">
                    <tab.icon className="h-[22px] w-[22px]" />
                    {tab.to === "/alerts" && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                        style={{ backgroundColor: "#F40009", fontSize: 8, minWidth: 14, height: 14, padding: "0 2px" }}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  <span>{tab.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Right scroll hint fade */}
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none"
          style={{ background: "linear-gradient(to right, transparent, #FFFFFF)" }}
        />
      </div>
    </nav>
  );
}
