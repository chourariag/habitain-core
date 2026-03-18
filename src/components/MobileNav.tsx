import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Factory,
  ClipboardCheck,
  Users,
  Truck,
  Wrench,
  FileSignature,
  Compass,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoImg from "@/assets/logo.png";

const DESIGN_ROLES = ["principal_architect", "project_architect", "structural_architect", "managing_director", "super_admin"];

const allTabs = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/production", label: "Prod", icon: Factory },
  { to: "/site-hub", label: "Site", icon: Truck },
  { to: "/design", label: "Design", icon: Compass, roles: DESIGN_ROLES },
  { to: "/qc", label: "Quality", icon: ClipboardCheck },
  { to: "/rm", label: "R&M", icon: Wrench },
  { to: "/amc", label: "AMC", icon: FileSignature },
  { to: "/admin", label: "Admin", icon: Users },
];

export function MobileNav() {
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, []);

  const tabs = allTabs.filter((t) => {
    if ("roles" in t && t.roles) return userRole ? t.roles.includes(userRole) : false;
    return true;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-40 overflow-x-auto">
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
