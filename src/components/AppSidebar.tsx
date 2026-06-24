import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, ClipboardCheck,
  Truck, Package, ShoppingCart, ClipboardList, Compass,
  BarChart3, DollarSign, Wrench, Users, Settings,
  ChevronLeft, ChevronRight, LogOut, Globe, Clock, Target, Bell,
  GitMerge, BookOpen, Globe2, FlaskConical, Search, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole, setTestingMode, clearTestingMode, getTestingModeData } from "@/hooks/useUserRole";
import { canSeeSection, canSeeProjectSelector } from "@/lib/role-nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/roles";
import { ROLE_LABELS, ROLE_TIERS } from "@/lib/roles";

const DESIGN_ROLES = ["principal_architect", "project_architect", "structural_architect", "managing_director", "super_admin", "finance_director", "sales_director", "architecture_director"];

const projectTabs = [
  { to: "/projects/:id", label: "Overview", icon: FolderKanban, suffix: "" },
  { to: "/production", label: "Production", icon: Factory, suffix: "?ctx=project" },
  { to: "/site-hub", label: "Site Hub", icon: Truck, suffix: "?ctx=project" },
  { to: "/drawings", label: "Drawings", icon: ClipboardList, suffix: "?ctx=project" },
];

const sectionConfig = [
  {
    key: "dashboard",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    key: "approvals",
    label: "Approvals",
    items: [{ to: "/alerts", label: "Approvals & Alerts", icon: Bell }],
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
      { to: "/qc", label: "QC & NCR", icon: ClipboardCheck },
    ],
  },
  {
    key: "site",
    label: "On Site Works",
    items: [
      { to: "/site-hub", label: "Site Hub", icon: Truck },
      { to: "/rm", label: "R&M", icon: Wrench },
      { to: "/amc", label: "AMC", icon: ShoppingCart },
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
    key: "finance",
    label: "Finance",
    items: [
      { to: "/finance", label: "Finance", icon: DollarSign },
      { to: "/variations", label: "Variations", icon: GitMerge },
      { to: "/client-portal", label: "Client Portal", icon: Globe2 },
    ],
  },
  {
    key: "design",
    label: "Design",
    items: [{ to: "/design", label: "Design Portal", icon: Compass }],
  },
  {
    key: "sales",
    label: "Sales",
    items: [
      { to: "/sales", label: "Sales Pipeline", icon: BarChart3 },
    ],
  },
  {
    key: "performance",
    label: "Performance",
    items: [{ to: "/kpi", label: "KPI Scorecard", icon: Target }],
  },
  {
    key: "admin",
    label: "ALTREE",
    items: [
      { to: "/attendance", label: "HR & Attendance", icon: Clock },
      { to: "/sop-library", label: "SOP Library", icon: BookOpen },
      { to: "/admin", label: "User Management", icon: Users },
      { to: "/admin/super-admin", label: "Super Admin", icon: FlaskConical },
      { to: "/settings", label: "Settings", icon: Settings },
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

function TestingModeSection({ collapsed }: { collapsed: boolean }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const tm = getTestingModeData();

  useEffect(() => {
    supabase.from("profiles").select("id, display_name, role, auth_user_id")
      .order("display_name", { ascending: true })
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  const filtered = profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      ROLE_LABELS[p.role as AppRole]?.toLowerCase().includes(q)
    );
  });

  // Group by tier
  const grouped: Array<{ tier: string; items: any[] }> = [];
  for (const [tier, roles] of Object.entries(ROLE_TIERS)) {
    const items = filtered.filter((p) => roles.includes(p.role as AppRole));
    if (items.length > 0) grouped.push({ tier, items });
  }

  const handleSelect = async (profile: any) => {
    const realRoleRes = await supabase.rpc("get_user_role", {
      _user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    });
    const realRole = realRoleRes.data as string ?? "managing_director";
    const realRoleName = ROLE_LABELS[realRole as AppRole] ?? realRole;
    setTestingMode({
      overrideRole: profile.role,
      overrideName: profile.display_name,
      realRole,
      realRoleName,
    });
  };

  if (collapsed) return null;

  return (
    <div className="mx-2 mb-1 rounded-lg overflow-hidden" style={{ border: "1px solid #D4860A22", backgroundColor: "#FFF8E811" }}>
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5" style={{ color: "#D4860A" }} />
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#D4860A" }}>Testing Mode</span>
        </div>
        {tm && (
          <button onClick={clearTestingMode} className="rounded p-0.5 hover:bg-black/10">
            <X className="h-3 w-3" style={{ color: "#D4860A" }} />
          </button>
        )}
      </div>

      {tm ? (
        <div className="px-3 pb-2 text-xs" style={{ color: "#D4860A" }}>
          Viewing as: <span className="font-semibold">{tm.overrideName}</span>
          <button onClick={clearTestingMode} className="ml-2 underline text-[10px]">Exit</button>
        </div>
      ) : (
        <div className="px-2 pb-2 space-y-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3" style={{ color: "#999" }} />
            <input
              className="w-full text-xs pl-6 pr-2 py-1.5 rounded border outline-none"
              style={{ borderColor: "#E0E0E0", color: "#1A1A1A", backgroundColor: "#fff" }}
              placeholder="Search user…"
              value={search}
              onFocus={() => setOpen(true)}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            />
          </div>
          {open && filtered.length > 0 && (
            <div className="rounded border overflow-y-auto max-h-48" style={{ borderColor: "#E0E0E0", backgroundColor: "#fff" }}>
              {grouped.map(({ tier, items }) => (
                <div key={tier}>
                  <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ backgroundColor: "#F7F7F7", color: "#999" }}>{tier}</div>
                  {items.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setOpen(false); handleSelect(p); }}
                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-[#E8F2ED] transition-colors"
                      style={{ color: "#1A1A1A" }}
                    >
                      <span className="font-medium">{p.display_name}</span>
                      <span className="ml-1" style={{ color: "#999" }}>— {ROLE_LABELS[p.role as AppRole] ?? p.role}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { i18n } = useTranslation();

  const showProjectSelector = canSeeProjectSelector(userRole);
  const canTestingMode = ["managing_director", "super_admin"].includes(userRole ?? "");
  const tm = getTestingModeData();

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

  // In testing mode, use the real role to gate admin sections
  const effectiveRoleForNav = tm ? (tm.realRole as AppRole) : userRole;

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
          <select
            className="w-full text-sm h-9 mt-1 rounded border px-2"
            style={{ borderColor: "#E0E0E0", color: "#1A1A1A" }}
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">— Select Project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Project Tabs */}
      {!collapsed && showProjectSelector && (
        <nav className="px-2 pb-1 pt-1 space-y-0.5">
          {projectTabs.map((item) => {
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

      {showProjectSelector && <div className="mx-3 my-1" style={{ borderTop: "1px solid #E0E0E0" }} />}

      {/* Role-gated sections */}
      <nav className="flex-1 py-1 space-y-0.5 px-2 overflow-y-auto">
        {sectionConfig.map((section) => {
          if (!canSeeSection(userRole, section.key)) return null;
          // For admin section, only show Super Admin link to real MD/SA
          return (
            <div key={section.key}>
              {section.label && !collapsed && (
                <div className="px-2 pt-2 pb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999999" }}>
                    {section.label}
                  </span>
                </div>
              )}
              {section.items
                .filter((item) => {
                  // Super Admin only visible to real MD/SA (not in testing mode)
                  if (item.to === "/admin/super-admin") {
                    return ["managing_director", "super_admin"].includes(effectiveRoleForNav ?? "");
                  }
                  // User Management only visible to MD, SA, Head of Operations
                  if (item.to === "/admin") {
                    return ["managing_director", "super_admin", "head_operations"].includes(effectiveRoleForNav ?? "");
                  }
                  return true;
                })
                .map((item) => (
                  <NavLink key={item.to} to={item.to} className={navLinkClass} style={navLinkStyle} end={item.to === "/admin"}>
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
            </div>
          );
        })}
      </nav>

      {/* Testing Mode section — always show for MD/SA (based on real role) */}
      {["managing_director", "super_admin"].includes(effectiveRoleForNav ?? "") && (
        <TestingModeSection collapsed={collapsed} />
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #E0E0E0" }}>
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
