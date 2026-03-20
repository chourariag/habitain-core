import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Users, Settings, Factory,
  ClipboardCheck, Package, ChevronLeft, ChevronRight,
  LogOut, Truck, Wrench, FileSignature, Compass,
  Eye, FileText, DollarSign, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContext } from "@/contexts/ProjectContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DESIGN_ROLES = ["principal_architect", "project_architect", "structural_architect", "managing_director", "super_admin"];

const projectTabs = [
  { to: "/projects/:id", label: "Overview", icon: Eye, suffix: "" },
  { to: "/production", label: "Production", icon: Factory, suffix: "?ctx=project" },
  { to: "/site-hub", label: "Site Hub", icon: Truck, suffix: "?ctx=project" },
  { to: "/design", label: "Design", icon: Compass, suffix: "?ctx=project", roles: DESIGN_ROLES },
  { to: "/drawings", label: "Documents", icon: FileText, suffix: "?ctx=project" },
];

const companyItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/qc", label: "Quality", icon: ClipboardCheck },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/rm", label: "R&M", icon: Wrench },
  { to: "/amc", label: "AMC", icon: FileSignature },
  { to: "/sales", label: "Sales", icon: BarChart3 },
  { to: "/finance", label: "Finance", icon: DollarSign },
  { to: "/admin", label: "Admin", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading: projectsLoading } = useProjectContext();

  useEffect(() => {
    if (!user) return;
    supabase.rpc("get_user_role", { _user_id: user.id }).then(({ data }) => setUserRole(data as string | null));
  }, [user]);

  const filteredProjectTabs = projectTabs.filter((item) => {
    if ("roles" in item && item.roles) {
      return userRole ? item.roles.includes(userRole) : false;
    }
    return true;
  });

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
      isActive ? "font-bold" : "hover:bg-[#F7F7F7]"
    );

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? { backgroundColor: "#E8F2ED", color: "#006039", borderLeft: "3px solid #006039" }
      : { color: "#666666" };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col transition-all duration-150 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#FFFFFF", borderRight: "1px solid #E0E0E0" }}
    >
      {/* Logo */}
      <div className="flex items-center px-4 h-16 shrink-0" style={{ borderBottom: "1px solid #E0E0E0" }}>
        <Logo size="sm" showText={!collapsed} />
      </div>

      {/* Project Selector */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2">
          <Select value={selectedProjectId ?? ""} onValueChange={(v) => setSelectedProjectId(v || null)}>
            <SelectTrigger className="w-full text-sm h-9" style={{ borderColor: "#E0E0E0", color: "#1A1A1A" }}>
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Project Tabs */}
      {!collapsed && (
        <nav className="px-2 pb-2 space-y-0.5">
          {filteredProjectTabs.map((item) => {
            const isDisabled = !selectedProjectId;
            const to = item.to === "/projects/:id"
              ? selectedProjectId ? `/projects/${selectedProjectId}` : "#"
              : item.to;

            if (isDisabled) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium opacity-40 cursor-not-allowed" style={{ color: "#999999" }}>
                      <item.icon className="h-4.5 w-4.5 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>Select a project first</p></TooltipContent>
                </Tooltip>
              );
            }

            return (
              <NavLink key={item.label} to={to} className={navLinkClass} style={navLinkStyle}>
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Divider */}
      <div className="mx-3 my-1" style={{ borderTop: "1px solid #E0E0E0" }} />

      {/* Company Label */}
      {!collapsed && (
        <div className="px-4 pt-1 pb-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999999" }}>Company</span>
        </div>
      )}

      {/* Company nav */}
      <nav className="flex-1 py-1 space-y-0.5 px-2 overflow-y-auto">
        {companyItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass} style={navLinkStyle}>
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
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
          className="flex items-center justify-center h-10 w-full transition-all duration-150"
          style={{ borderTop: "1px solid #E0E0E0", color: "#666666" }}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
