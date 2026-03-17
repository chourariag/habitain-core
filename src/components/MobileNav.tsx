import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Factory,
  ClipboardCheck,
  PackagePlus,
  Users,
  Truck,
  Wrench,
  FileSignature,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/production", label: "Prod", icon: Factory },
  { to: "/site-hub", label: "Site", icon: Truck },
  { to: "/qc", label: "Quality", icon: ClipboardCheck },
  { to: "/materials", label: "Materials", icon: PackagePlus },
  { to: "/rm", label: "R&M", icon: Wrench },
  { to: "/amc", label: "AMC", icon: FileSignature },
  { to: "/admin", label: "Admin", icon: Users },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 overflow-x-auto">
      <div className="flex items-center h-16 min-w-max px-1">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                "min-w-[4.5rem] flex flex-col items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium transition-snappy",
                isActive ? "text-primary" : "text-muted-foreground"
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
