import { useRef, useEffect, useState } from "react";
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
import type { AppRole } from "@/lib/roles";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Tab = {
  to: string;
  label: string;
  icon: any;
  section: string;
  alwaysVisible?: boolean;
  roles?: string[];
};

const SUPER_ADMIN_ROLES = ["super_admin", "managing_director"];
const ADMIN_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director", "hr_admin"];
const SETTINGS_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];

const allTabs: Tab[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, section: "dashboard", alwaysVisible: true },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck, section: "approvals" },
  { to: "/projects", label: "Projects", icon: FolderKanban, section: "projects" },
  { to: "/production?tab=modules", label: "Factory", icon: Factory, section: "production" },
  { to: "/site-hub?tab=pipeline", label: "Site", icon: Truck, section: "site" },
  { to: "/procurement?tab=dashboard", label: "Procurement", icon: ShoppingCart, section: "procurement" },
  { to: "/finance?tab=mis-invoices", label: "Finance", icon: DollarSign, section: "finance" },
  { to: "/design", label: "Design", icon: Compass, section: "design" },
  { to: "/sales", label: "Sales", icon: BarChart3, section: "sales" },
  { to: "/attendance", label: "HR", icon: UserCog, section: "altree", alwaysVisible: true },
];

type MoreItem = {
  to: string;
  label: string;
  icon: any;
  desc: string;
  critical?: boolean;
  roles: string[];
};

const moreItems: MoreItem[] = [
  { to: "/admin", label: "Admin", icon: Briefcase, desc: "User directory & benchmarks", roles: ADMIN_ROLES },
  { to: "/admin/employees", label: "Employee Management", icon: Users, desc: "Manage employee profiles & roles", roles: SUPER_ADMIN_ROLES },
  { to: "/settings", label: "App Settings", icon: Settings, desc: "Application preferences", roles: SETTINGS_ROLES },
  { to: "/admin/super-admin", label: "Super Admin", icon: ShieldAlert, desc: "System configuration & audit log", critical: true, roles: SUPER_ADMIN_ROLES },
];

export function MobileNav() {
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleTabs = allTabs.filter((t) => {
    if (t.alwaysVisible) return true;
    if (t.roles) return userRole ? t.roles.includes(userRole) : false;
    return canSeeSection(userRole, t.section);
  });

  const visibleMoreItems = moreItems.filter((i) =>
    userRole ? i.roles.includes(userRole) : false
  );

  const showMore = visibleMoreItems.length > 0;

  // Highlight "More" when on any admin/settings route
  const moreActive = visibleMoreItems.some((i) => {
    const path = i.to.split("?")[0];
    return location.pathname === path || location.pathname.startsWith(path + "/");
  });

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, []);

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
      >
        <div className="relative h-[56px] overflow-hidden">
          <div
            ref={scrollRef}
            className="flex items-center h-full overflow-x-auto scrollbar-none px-1"
            style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
          >
            {visibleTabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                onClick={(e) => {
                  const el = (e.currentTarget as HTMLElement);
                  setTimeout(() => el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 0);
                }}
                className={() =>
                  cn(
                    "flex flex-col items-center justify-center gap-[2px] min-w-[68px] flex-shrink-0 px-2 py-1 text-[10px] font-medium transition-colors"
                  )
                }
                style={({ isActive }) => ({
                  color: isActive ? "#006039" : "#999999",
                  scrollSnapAlign: "center",
                })}
              >
                {({ isActive }) => (
                  <span
                    data-active={isActive ? "true" : undefined}
                    className="flex flex-col items-center gap-[2px]"
                  >
                    <tab.icon className="h-[20px] w-[20px]" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </span>
                )}
              </NavLink>
            ))}

            {showMore && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                data-active={moreActive ? "true" : undefined}
                className="flex flex-col items-center justify-center gap-[2px] min-w-[68px] flex-shrink-0 px-2 py-1 text-[10px] font-medium transition-colors"
                style={{
                  color: moreActive ? "#006039" : "#999999",
                  scrollSnapAlign: "center",
                }}
                aria-label="More navigation options"
              >
                <MoreHorizontal className="h-[20px] w-[20px]" />
                <span className="whitespace-nowrap">More</span>
              </button>
            )}
          </div>

          {/* Right scroll hint fade */}
          <div
            className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, #FFFFFF)" }}
          />
          <div
            className="absolute top-0 left-0 bottom-0 w-4 pointer-events-none"
            style={{ background: "linear-gradient(to left, transparent, #FFFFFF)" }}
          />
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl p-0 max-h-[80vh]">
          <SheetHeader className="px-5 pt-5 pb-3 text-left">
            <SheetTitle className="font-display text-lg">More</SheetTitle>
          </SheetHeader>
          <div className="px-3 pb-6 space-y-1">
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
                      {item.label}
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
