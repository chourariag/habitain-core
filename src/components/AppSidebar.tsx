import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Users, Settings, Factory,
  ClipboardCheck, Package, PackagePlus, ChevronLeft, ChevronRight,
  LogOut, Truck, Wrench, FileSignature, PenTool, Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";

const DESIGN_ROLES = ["principal_architect", "project_architect", "structural_architect", "managing_director", "super_admin"];

const baseNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/production", label: "Production", icon: Factory },
  { to: "/site-hub", label: "Site Hub", icon: Truck },
  { to: "/design", label: "Design", icon: Compass, roles: DESIGN_ROLES },
  { to: "/qc", label: "Quality", icon: ClipboardCheck },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/rm", label: "R&M", icon: Wrench },
  { to: "/amc", label: "AMC", icon: FileSignature },
  { to: "/admin", label: "Admin", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_user_role", { _user_id: user.id }).then(({ data }) => setUserRole(data as string | null));
  }, [user]);

  const navItems = baseNavItems.filter((item) => {
    if ("roles" in item && item.roles) {
      return userRole ? item.roles.includes(userRole) : false;
    }
    return true;
  });

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col transition-all duration-150",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#FFFFFF", borderRight: "1px solid #E0E0E0" }}
    >
      <div className="flex items-center px-4 h-16" style={{ borderBottom: "1px solid #E0E0E0" }}>
        <Logo size="sm" showText={!collapsed} />
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                isActive ? "font-bold" : "hover:bg-[#F7F7F7]"
              )
            }
            style={({ isActive }) =>
              isActive
                ? { backgroundColor: "#E8F2ED", color: "#006039", borderLeft: "3px solid #006039" }
                : { color: "#666666" }
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: "1px solid #E0E0E0" }}>
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-5 py-3 w-full text-sm transition-all duration-150"
          style={{ color: "#666666" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#F40009")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#666666")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 w-full transition-all duration-150"
          style={{ borderTop: "1px solid #E0E0E0", color: "#666666" }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
