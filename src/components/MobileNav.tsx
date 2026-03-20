import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, ClipboardCheck,
  Truck, Package, Compass, Wrench, Users, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection } from "@/lib/role-nav";
import type { AppRole } from "@/lib/roles";
import logoImg from "@/assets/logo.png";

const mobileItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, section: "dashboard" },
  { to: "/projects", label: "Projects", icon: FolderKanban, section: "projects" },
  { to: "/production", label: "Factory", icon: Factory, section: "production" },
  { to: "/site-hub", label: "Site", icon: Truck, section: "production" },
  { to: "/qc", label: "QC", icon: ClipboardCheck, section: "production" },
  { to: "/inventory", label: "Inv", icon: Package, section: "procurement" },
  { to: "/design", label: "Design", icon: Compass, section: "design" },
  { to: "/rm", label: "R&M", icon: Wrench, section: "business" },
  { to: "/admin", label: "Admin", icon: Users, section: "admin" },
];

export function MobileNav() {
  const { role } = useUserRole();
  const userRole = role as AppRole | null;

  const tabs = mobileItems.filter((t) => canSeeSection(userRole, t.section));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 overflow-x-auto"
      style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}>
      <div className="flex items-center h-16 min-w-max px-1">
        <div className="min-w-[3rem] flex items-center justify-center px-1">
          <img src={logoImg} alt="H" width={28} height={28} className="rounded-full" />
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "min-w-[4rem] flex flex-col items-center justify-center gap-1 px-1.5 py-1 text-[10px] font-medium transition-all",
                isActive ? "font-bold" : ""
              )
            }
            style={({ isActive }) => ({ color: isActive ? "#006039" : "#666666" })}
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
