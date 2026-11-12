import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, Truck,
  DollarSign, ShieldCheck, ShoppingCart, Compass,
  BarChart3, UserCog, MoreHorizontal, ShieldAlert,
  Users, Settings, Briefcase, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection } from "@/lib/role-nav";
import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleKey } from "@/lib/rbac-matrix";
import type { AppRole } from "@/lib/roles";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { featureFlagForModule } from "@/lib/feature-flags";
import { LABOUR_DIRECTORY_VIEW_ROLES } from "@/lib/labour-rules";

type Tab = {
  to: string;
  labelKey: string;
  icon: any;
  section: string;
  alwaysVisible?: boolean;
  roles?: string[];
  module?: ModuleKey;
  featureFlag?: string;
};

const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"];
const SETTINGS_ROLES = ["super_admin", "managing_director"];

const allTabs: Tab[] = [
  { to: "/dashboard", labelKey: "nav.home", icon: LayoutDashboard, section: "dashboard", module: "dashboard" },
  { to: "/approvals", labelKey: "nav.approvals", icon: ShieldCheck, section: "approvals", module: "approvals" },
  { to: "/projects", labelKey: "nav.projects", icon: FolderKanban, section: "projects", module: "projects" },
  { to: "/production?tab=modules", labelKey: "nav.factory", icon: Factory, section: "production", module: "factory" },
  { to: "/labour", labelKey: "nav.labour", icon: Users, section: "dashboard", featureFlag: "labour", roles: [...LABOUR_DIRECTORY_VIEW_ROLES] },
  { to: "/site-hub?tab=pipeline", labelKey: "nav.site", icon: Truck, section: "site", module: "site" },
  { to: "/procurement?tab=dashboard", labelKey: "nav.procurement", icon: ShoppingCart, section: "procurement", module: "procurement" },
  { to: "/finance?tab=mis-invoices", labelKey: "nav.finance", icon: DollarSign, section: "finance", module: "finance" },
  { to: "/design", labelKey: "nav.design", icon: Compass, section: "design", module: "design", featureFlag: "design_schedule" },
  { to: "/design/schedule", labelKey: "nav.designSchedule", icon: Compass, section: "design", module: "design", featureFlag: "design_schedule" },
  { to: "/sales", labelKey: "nav.sales", icon: BarChart3, section: "sales", module: "sales" },
  { to: "/attendance", labelKey: "nav.hr", icon: UserCog, section: "altree", module: "hr" },
  { to: "/safety", labelKey: "nav.safety", icon: ShieldAlert, section: "production", module: "factory", featureFlag: "compliance" },
];

type MoreItem = {
  to: string;
  labelKey: string;
  icon: any;
  desc: string;
  critical?: boolean;
  roles?: string[];
  requireAdminPanel?: boolean;
  requireEmployeeManagement?: boolean;
};

const moreItems: MoreItem[] = [
  { to: "/admin", labelKey: "nav.admin", icon: Briefcase, desc: "User directory & benchmarks", requireAdminPanel: true },
  { to: "/admin/employees", labelKey: "nav.employees", icon: Users, desc: "Manage employee profiles & roles", requireEmployeeManagement: true },
  { to: "/settings", labelKey: "nav.settings", icon: Settings, desc: "Application preferences", roles: SETTINGS_ROLES },
  { to: "/admin/super-admin", labelKey: "nav.superAdmin", icon: ShieldAlert, desc: "System configuration & audit log", critical: true, roles: SUPER_ADMIN_ROLES },
];

export function MobileNav() {
  const { role } = useUserRole();
  const { t } = useTranslation();
  const userRole = role as AppRole | null;
  const { canView, canAccessAdminPanel, canAccessEmployeeManagement } = usePermissions();
  const featureFlags = useFeatureFlags();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryPaths = ["/dashboard", "/attendance", "/projects", "/procurement"];

  const visibleTabs = allTabs.filter((t) => {
    if (t.featureFlag && !featureFlags.isEnabled(t.featureFlag)) return false;
    if (t.module) {
      const moduleFlag = featureFlagForModule(t.module);
      return (!moduleFlag || featureFlags.isEnabled(moduleFlag)) && canView(t.module);
    }
    if (t.alwaysVisible) return true;
    if (t.roles) return userRole ? t.roles.includes(userRole) : false;
    return canSeeSection(userRole, t.section);
  });
  const primaryTabs = primaryPaths
    .map((path) => visibleTabs.find((tab) => tab.to.split("?")[0] === path))
    .filter((tab): tab is Tab => Boolean(tab));
  const overflowTabs = visibleTabs.filter((tab) => !primaryTabs.includes(tab));

  const visibleMoreItems = moreItems.filter((i) => {
    if (i.requireAdminPanel) return featureFlags.isEnabled("user_admin") && canAccessAdminPanel();
    if (i.requireEmployeeManagement) return featureFlags.isEnabled("user_admin") && canAccessEmployeeManagement();
    return featureFlags.isEnabled("user_admin") && (i.roles ? (userRole ? i.roles.includes(userRole) : false) : false);
  });

  const showMore = visibleMoreItems.length > 0 || overflowTabs.length > 0;

  // Highlight "More" when on any admin/settings route
  const moreActive = visibleMoreItems.some((i) => {
    const path = i.to.split("?")[0];
    return location.pathname === path || location.pathname.startsWith(path + "/");
  });
  const overflowActive = overflowTabs.some((tab) => {
    const path = tab.to.split("?")[0];
    return location.pathname === path || location.pathname.startsWith(path + "/");
  });

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
      >
        <div className="grid h-[56px] grid-cols-5 items-stretch px-1">
            {primaryTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={() =>
                  cn(
                    "flex min-w-0 flex-col items-center justify-center gap-[2px] px-1 py-1 text-[10px] font-medium transition-colors"
                  )
                }
                style={({ isActive }) => ({
                  color: isActive ? "#006039" : "#999999",
                })}
              >
                {({ isActive }) => (
                  <span
                    data-active={isActive ? "true" : undefined}
                    className="flex flex-col items-center gap-[2px]"
                  >
                    <tab.icon className="h-[20px] w-[20px]" />
                    <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                  </span>
                )}
              </NavLink>
            ))}

            {showMore && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                data-active={moreActive ? "true" : undefined}
                className="flex min-w-0 flex-col items-center justify-center gap-[2px] px-1 py-1 text-[10px] font-medium transition-colors"
                style={{
                  color: moreActive || overflowActive ? "#006039" : "#999999",
                }}
                aria-label={t("nav.moreOptions")}
              >
                <MoreHorizontal className="h-[20px] w-[20px]" />
                <span className="max-w-full truncate">{t("nav.more")}</span>
              </button>
            )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl p-0 max-h-[80vh]">
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle className="font-display text-lg">{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <div className="px-3 pb-6 space-y-1">
            {overflowTabs.map((tab) => {
              const path = tab.to.split("?")[0];
              const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <button key={tab.to} type="button" onClick={() => { setMoreOpen(false); navigate(tab.to); }} className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors", isActive ? "bg-muted" : "hover:bg-muted/60")}>
                  <tab.icon className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">{t(tab.labelKey)}</div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
            {visibleMoreItems.map((item) => {
              const path = item.to.split("?")[0];
              const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.to);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                    isActive ? "bg-muted" : "hover:bg-muted/60"
                  )}
                >
                  <item.icon
                    className="h-5 w-5 shrink-0"
                    style={{ color: item.critical ? "#F40009" : "#006039" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: item.critical ? "#F40009" : undefined }}
                    >
                      {t(item.labelKey)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{item.desc}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
