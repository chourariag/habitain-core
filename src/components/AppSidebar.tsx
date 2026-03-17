import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  Factory,
  ClipboardCheck,
  Package,
  PackagePlus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Truck,
  Wrench,
  FileSignature,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/production", label: "Production", icon: Factory },
  { to: "/site-hub", label: "Site Hub", icon: Truck },
  { to: "/qc", label: "Quality", icon: ClipboardCheck },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/materials", label: "Materials", icon: PackagePlus },
  { to: "/rm", label: "R&M", icon: Wrench },
  { to: "/amc", label: "AMC", icon: FileSignature },
  { to: "/admin", label: "Admin", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col bg-background border-r border-border transition-all duration-150",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center px-4 h-16 border-b border-border">
        <Logo size="sm" showText={!collapsed} />
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-snappy",
                isActive
                  ? "bg-accent text-accent-foreground border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-5 py-3 w-full text-sm text-muted-foreground hover:text-destructive transition-snappy"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-12 w-full border-t border-border text-muted-foreground hover:text-foreground transition-snappy"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
