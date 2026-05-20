import { useRef, useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, Truck,
  DollarSign, ShieldCheck, ShoppingCart, Compass,
  BarChart3, UserCog, Briefcase, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection } from "@/lib/role-nav";
import type { AppRole } from "@/lib/roles";

type Tab = {
  to: string;
  label: string;
  icon: any;
  section: string;
  alwaysVisible?: boolean;
  roles?: string[];
};

const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"];

const allTabs: Tab[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, section: "dashboard", alwaysVisible: true },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, section: "approvals" },
  { to: "/projects", label: "Projects", icon: FolderKanban, section: "projects" },
  { to: "/production?tab=modules", label: "Factory", icon: Factory, section: "production" },
  { to: "/site-hub?tab=pipeline", label: "Site", icon: Truck, section: "site" },
  { to: "/procurement?tab=dashboard", label: "Procurement", icon: ShoppingCart, section: "procurement" },
  { to: "/finance?tab=mis-invoices", label: "Finance", icon: DollarSign, section: "finance" },
  { to: "/design", label: "Design", icon: Compass, section: "design" },
  { to: "/sales", label: "Sales", icon: BarChart3, section: "sales" },
  { to: "/attendance", label: "HR", icon: UserCog, section: "altree", alwaysVisible: true },
  { to: "/admin", label: "Admin", icon: Briefcase, section: "admin" },
  { to: "/admin/super-admin", label: "Super Admin", icon: ShieldAlert, section: "altree", roles: SUPER_ADMIN_ROLES },
];

export function MobileNav() {
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleTabs = allTabs.filter((t) => {
    if (t.alwaysVisible) return true;
    if (t.roles) return userRole ? t.roles.includes(userRole) : false;
    return canSeeSection(userRole, t.section);
  });

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, []);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40"
      style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
    >
      <div className="relative h-[56px] overflow-hidden">
        <div
          ref={scrollRef}
          className="flex items-center h-full overflow-x-auto scrollbar-none px-1"
          style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
        >
          {visibleTabs.map((tab) => {
            const isSuperAdmin = tab.to === "/admin/super-admin";
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                onClick={(e) => {
                  const el = (e.currentTarget as HTMLElement);
                  setTimeout(() => el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 0);
                }}
                className={() =>
                  cn(
                    "flex flex-col items-center justify-center gap-[2px] min-w-[68px] flex-shrink-0 px-2 py-1 text-[10px] font-medium transition-colors"
                  )
                }
                style={({ isActive }) => ({
                  color: isActive
                    ? (isSuperAdmin ? "#F40009" : "#006039")
                    : (isSuperAdmin ? "#F40009" : "#999999"),
                  scrollSnapAlign: "center",
                })}
              >
                {({ isActive }) => (
                  <span
                    data-active={isActive ? "true" : undefined}
                    className="flex flex-col items-center gap-[2px]"
                  >
                    <tab.icon className="h-[20px] w-[20px]" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Right scroll hint fade */}
        <div
          className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none"
          style={{ background: "linear-gradient(to right, transparent, #FFFFFF)" }}
        />
        <div
          className="absolute top-0 left-0 bottom-0 w-4 pointer-events-none"
          style={{ background: "linear-gradient(to left, transparent, #FFFFFF)" }}
        />
      </div>
    </nav>
  );
}
