import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, ClipboardCheck,
  Truck, Package, ShoppingCart, ClipboardList, Compass,
  BarChart3, DollarSign, Wrench, Users, Settings,
  ChevronLeft, ChevronRight, LogOut, Globe, Clock, Target, Bell, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection, canSeeProjectSelector } from "@/lib/role-nav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import type { AppRole } from "@/lib/roles";

const DESIGN_ROLES = ["principal_architect", "project_architect", "structural_architect", "managing_director", "super_admin", "finance_director", "sales_director", "architecture_director"];

const projectTabs = [
  { to: "/projects/:id", label: "Overview", icon: FolderKanban, suffix: "" },
  { to: "/production", label: "Production", icon: Factory, suffix: "?ctx=project" },
  { to: "/site-hub", label: "Site Hub", icon: Truck, suffix: "?ctx=project" },
  { to: "/drawings", label: "Drawings", icon: ClipboardList, suffix: "?ctx=project" },
];

// Sections with role gating
const sectionConfig = [
  {
    key: "dashboard",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    key: "projects",
    label: "Projects",
    items: [{ to: "/projects", label: "Projects", icon: FolderKanban }],
  },
  {
    key: "production",
    label: "Production",
    items: [
      { to: "/production", label: "Factory Floor", icon: Factory },
      { to: "/factory/floor-map", label: "Floor Map", icon: LayoutDashboard },
      { to: "/capacity", label: "Capacity Planning", icon: BarChart3 },
      { to: "/qc", label: "QC & NCR", icon: ClipboardCheck },
      { to: "/site-hub", label: "Site Hub", icon: Truck },
    ],
  },
  {
    key: "procurement",
    label: "Procurement",
    items: [
      { to: "/procurement", label: "Procurement", icon: ShoppingCart },
    ],
  },
  {
    key: "design",
    label: "Design",
    items: [{ to: "/design", label: "Design Portal", icon: Compass }],
  },
  {
    key: "business",
    label: "Business",
    items: [
      { to: "/sales", label: "Sales", icon: BarChart3 },
      { to: "/finance", label: "Finance", icon: DollarSign },
      { to: "/rm", label: "R&M", icon: Wrench },
      { to: "/amc", label: "AMC", icon: ShoppingCart },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    items: [{ to: "/kpi", label: "KPI Scorecard", icon: Target }],
  },
  {
    key: "admin",
    label: "Admin",
    items: [
      { to: "/attendance", label: "HR & Attendance", icon: Clock },
      { to: "/admin", label: "Admin", icon: Users },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    items: [
      { to: "/sops", label: "SOPs", icon: BookOpen },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { to: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { i18n } = useTranslation();
  const location = useLocation();

  const showProjectSelector = canSeeProjectSelector(userRole);

  const filteredProjectTabs = projectTabs;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
      isActive ? "font-bold" : "hover:bg-[#F7F7F7]"
    );

  const navLinkStyle = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? { backgroundColor: "#E8F2ED", color: "#006039", borderLeft: "3px solid #006039" }
      : { color: "#666666" };

  const langCode = (i18n.language || "en").toUpperCase().slice(0, 2);

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
      {!collapsed && showProjectSelector && (
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999999" }}>
            Active Project
          </span>
          <Select value={selectedProjectId ?? ""} onValueChange={(v) => setSelectedProjectId(v || null)}>
            <SelectTrigger className="w-full text-sm h-9 mt-1" style={{ borderColor: "#E0E0E0", color: "#1A1A1A" }}>
              <SelectValue placeholder="— Select Project —" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Project Tabs (only when project selected + has project selector) */}
      {!collapsed && showProjectSelector && (
        <nav className="px-2 pb-1 pt-1 space-y-0.5">
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
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right"><p>Select a project first</p></TooltipContent>
                </Tooltip>
              );
            }

            return (
              <NavLink key={item.label} to={to} className={navLinkClass} style={navLinkStyle} end={item.to === "/projects/:id"}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* Divider */}
      {showProjectSelector && <div className="mx-3 my-1" style={{ borderTop: "1px solid #E0E0E0" }} />}

      {/* Role-gated sections */}
      <nav className="flex-1 py-1 space-y-0.5 px-2 overflow-y-auto">
        {sectionConfig.map((section) => {
          if (!canSeeSection(userRole, section.key)) return null;
          return (
            <div key={section.key}>
              {section.label && !collapsed && (
                <div className="px-2 pt-2 pb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999999" }}>
                    {section.label}
                  </span>
                </div>
              )}
              {section.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={navLinkClass} style={navLinkStyle}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E0E0E0" }}>
        {/* Language toggle */}
        {!collapsed && (
          <button
            onClick={() => {
              const langs = ["en", "hi", "kn", "ta", "te"];
              const idx = langs.indexOf(i18n.language);
              i18n.changeLanguage(langs[(idx + 1) % langs.length]);
            }}
            className="flex items-center gap-3 px-5 py-2 w-full text-xs transition-all"
            style={{ color: "#666666" }}
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span>{langCode}</span>
          </button>
        )}
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
