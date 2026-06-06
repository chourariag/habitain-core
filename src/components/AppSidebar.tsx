import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, ClipboardCheck,
  Truck, Package, Compass, BarChart3, DollarSign, Wrench,
  Users, Settings, ChevronLeft, ChevronRight, ChevronDown,
  LogOut, Globe, ShieldAlert, ShieldCheck, Map,
  MessageSquare, Receipt, Building2, UserCog,
  Briefcase, ArrowLeftRight, ClipboardList,
} from "lucide-react";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "./Logo";
import { useProjectContext } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection, canSeeProjectSelector } from "@/lib/role-nav";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { AppRole } from "@/lib/roles";
import { RoleSwitcher } from "./RoleSwitcher";

type NavItem = { to: string; label: string; icon: any; roles?: string[]; section: string; alwaysVisible?: boolean };
type NavSection = { key: string; label?: string; items: NavItem[]; group?: "altree" };

const CAPACITY_ROLES = ["super_admin", "managing_director", "head_operations", "planning_head", "production_head"];
const HR_MGMT_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "hr_admin", "hr_executive", "finance_manager"];
const ADMIN_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "hr_admin"];
const SETTINGS_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];
const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"];

// Strict spec-defined sidebar
const sectionConfig: NavSection[] = [
  { key: "dashboard", items: [{ section: "dashboard", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { key: "approvals", items: [{ section: "approvals", to: "/approvals", label: "Approvals", icon: ShieldCheck }] },
  { key: "announcements", items: [{ section: "dashboard", to: "/announcements", label: "Announcements", icon: MessageSquare }] },
  { key: "projects", items: [{ section: "projects", to: "/projects", label: "Projects", icon: FolderKanban }] },
  {
    key: "production", label: "Production",
    items: [
      { section: "production", to: "/capacity", label: "Capacity Planning", icon: BarChart3, roles: CAPACITY_ROLES },
      { section: "production", to: "/production?tab=modules", label: "Factory Floor", icon: Factory },
      { section: "production", to: "/factory/floor-map", label: "Floor Map", icon: Map },
      { section: "production", to: "/qc", label: "QC & NCR", icon: ClipboardCheck },
      { section: "production", to: "/dispatch-delivery", label: "Despatch & Delivery", icon: Truck },
      { section: "production", to: "/safety", label: "Safety", icon: ShieldAlert },
    ],
  },
  {
    key: "site", label: "On Site Works",
    items: [
      { section: "site", to: "/site-hub?tab=pipeline", label: "Site Hub", icon: Truck },
    ],
  },
  {
    key: "procurement", label: "Procurement",
    items: [
      { section: "procurement", to: "/procurement?tab=dashboard", label: "Dashboard", icon: LayoutDashboard },
      { section: "procurement", to: "/procurement?tab=material-plan", label: "Material Plan", icon: ClipboardList },
      { section: "procurement", to: "/procurement?tab=inventory", label: "Inventory", icon: Package },
      { section: "procurement", to: "/procurement?tab=transfers", label: "Transfers", icon: ArrowLeftRight },
      { section: "procurement", to: "/procurement?tab=asset-register", label: "Equipments", icon: Wrench },
      { section: "procurement", to: "/rm", label: "Repairs & AMC", icon: Wrench },
    ],
  },
  {
    key: "finance", label: "Finance",
    items: [
      { section: "finance", to: "/finance?tab=mis-invoices", label: "Management", icon: BarChart3 },
      { section: "finance", to: "/finance?tab=revenue-margin", label: "Projects", icon: DollarSign },
      { section: "finance", to: "/finance?tab=bank-overdue", label: "General", icon: Receipt },
      { section: "finance", to: "/finance?tab=costing", label: "Costing & Estimation", icon: ClipboardCheck },
    ],
  },
  {
    key: "design", label: "Design",
    items: [
      { section: "design", to: "/design", label: "Projects", icon: Compass },
      { section: "design", to: "/design/schedule", label: "Design Schedule", icon: ClipboardList },
      { section: "design", to: "/design?tab=dq-register", label: "Design Queries", icon: MessageSquare },
    ],
  },
  {
    key: "sales", label: "Sales",
    items: [{ section: "sales", to: "/sales", label: "Sales", icon: BarChart3 }],
  },
  // ALTREE group — always visible (every employee gets My HR)
  {
    key: "altree-hr", label: "HR", group: "altree",
    items: [
      { section: "altree", to: "/attendance", label: "My HR", icon: UserCog, alwaysVisible: true },
      { section: "altree", to: "/admin/hr", label: "HR Management", icon: Users, roles: HR_MGMT_ROLES },
    ],
  },
  { key: "altree-admin", group: "altree", items: [{ section: "altree", to: "/admin", label: "Admin", icon: Briefcase, roles: ADMIN_ROLES }] },
  { key: "altree-employees", group: "altree", items: [{ section: "altree", to: "/admin/employees", label: "Employees", icon: Users, roles: SUPER_ADMIN_ROLES }] },
  { key: "altree-super", group: "altree", items: [{ section: "altree", to: "/admin/super-admin", label: "Super Admin", icon: ShieldAlert, roles: SUPER_ADMIN_ROLES }] },
  { key: "altree-settings", group: "altree", items: [{ section: "altree", to: "/settings", label: "Settings", icon: Settings, roles: SETTINGS_ROLES }] },
];

const ALTREE_OPEN_KEY = "hstack_nav_altree_open";

function scoreItem(pathname: string, search: string, to: string): number {
  const [p, q] = to.split("?");
  const t = q ? new URLSearchParams(q).get("tab") : null;
  const currentTab = new URLSearchParams(search).get("tab");
  if (pathname === p) {
    if (t && currentTab === t) return 100;
    if (!t && !currentTab) return 90;
    if (!t) return 50;
    return 0;
  }
  if (pathname.startsWith(p + "/")) return 10 + p.length;
  return -1;
}

export function AppSidebar() {
  const pendingApprovals = usePendingApprovalsCount();
  const [collapsed, setCollapsed] = useState(false);
  const [altreeOpen, setAltreeOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(ALTREE_OPEN_KEY);
    return v === null ? true : v === "1";
  });
  useEffect(() => {
    try { window.localStorage.setItem(ALTREE_OPEN_KEY, altreeOpen ? "1" : "0"); } catch { /* noop */ }
  }, [altreeOpen]);

  const { signOut } = useAuth();
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const { projects, selectedProjectId, setSelectedProjectId } = useProjectContext();
  const { i18n } = useTranslation();
  const location = useLocation();

  const showProjectSelector = canSeeProjectSelector(userRole);

  const navLinkClass = "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150";
  const linkStyle = (isActive: boolean) => isActive
    ? { backgroundColor: "#E8F2ED", color: "#006039", borderLeft: "3px solid #006039" }
    : { color: "#666666" };

  // Filter visible sections by section-level role + per-item role
  // ALTREE items use alwaysVisible to bypass section gate (every employee gets My HR)
  const visibleSections = sectionConfig
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        const sectionOk = it.alwaysVisible || canSeeSection(userRole, it.section);
        const roleOk = !it.roles || (userRole && it.roles.includes(userRole));
        return sectionOk && roleOk;
      }),
    }))
    .filter((s) => s.items.length > 0);

  // Compute single globally-active item
  const allVisibleItems: NavItem[] = visibleSections.flatMap((s) => s.items);
  let activeKey: string | null = null;
  let bestScore = -1;
  for (const item of allVisibleItems) {
    const sc = scoreItem(location.pathname, location.search, item.to);
    if (sc > bestScore) { bestScore = sc; activeKey = item.to; }
  }

  const langCode = (i18n.language || "en").toUpperCase().slice(0, 2);

  const renderItem = (item: NavItem) => {
    const isActive = item.to === activeKey;
    const isApprovals = item.to === "/approvals";
    const isSuperAdmin = item.to === "/admin/super-admin";
    const baseStyle = isSuperAdmin
      ? (isActive
          ? { backgroundColor: "#FDE7E9", color: "#F40009", borderLeft: "3px solid #F40009" }
          : { color: "#F40009" })
      : linkStyle(isActive);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={cn(navLinkClass, isActive ? "font-bold" : "hover:bg-[#F7F7F7]")}
        style={baseStyle}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1">{item.label}</span>}
        {!collapsed && isApprovals && pendingApprovals > 0 && (
          <span className="rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1.5 h-5 min-w-[20px]"
            style={{ background: "#F40009" }}>
            {pendingApprovals > 99 ? "99+" : pendingApprovals}
          </span>
        )}
      </NavLink>
    );
  };

  const renderSection = (section: NavSection & { items: NavItem[] }) => (
    <div key={section.key}>
      {section.label && !collapsed && (
        <div className="px-2 pt-2 pb-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999999" }}>
            {section.label}
          </span>
        </div>
      )}
      {section.items.map(renderItem)}
    </div>
  );

  const topSections = visibleSections.filter((s) => s.group !== "altree");
  const altreeSections = visibleSections.filter((s) => s.group === "altree");

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col transition-all duration-150 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "#FFFFFF", borderRight: "1px solid #E0E0E0" }}
    >
      <div className="flex items-center px-4 h-16 shrink-0" style={{ borderBottom: "1px solid #E0E0E0" }}>
        <Logo size="sm" showText={!collapsed} />
      </div>

      <RoleSwitcher collapsed={collapsed} />

      {!collapsed && showProjectSelector && (
        <div className="px-3 pt-3 pb-2">
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

      {showProjectSelector && <div className="mx-3 my-1" style={{ borderTop: "1px solid #E0E0E0" }} />}

      <nav className="flex-1 py-1 space-y-0.5 px-2 overflow-y-auto">
        {topSections.map(renderSection)}

        {altreeSections.length > 0 && (
          <>
            <div className="mx-1 mt-3 mb-1" style={{ borderTop: "1px solid #E0E0E0" }} />
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setAltreeOpen((v) => !v)}
                className="w-full flex items-center justify-between px-2 pt-2 pb-1 hover:bg-[#F7F7F7] rounded-md"
              >
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "#006039" }}>
                  ALTREE
                </span>
                {altreeOpen
                  ? <ChevronDown className="h-3.5 w-3.5" style={{ color: "#666666" }} />
                  : <ChevronRight className="h-3.5 w-3.5" style={{ color: "#666666" }} />}
              </button>
            ) : (
              <div className="flex justify-center py-2">
                <Building2 className="h-4 w-4" style={{ color: "#006039" }} />
              </div>
            )}
            {(altreeOpen || collapsed) && altreeSections.map(renderSection)}
          </>
        )}
      </nav>

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
