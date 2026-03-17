import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Factory,
  ClipboardCheck,
  PackagePlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/production", label: "Prod", icon: Factory },
  { to: "/materials", label: "Materials", icon: PackagePlus },
  { to: "/admin", label: "Admin", icon: Users },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-40">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 px-2 py-1 text-[10px] font-medium transition-snappy",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
