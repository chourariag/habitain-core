import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Factory, Truck, MoreHorizontal,
  BarChart3, DollarSign, ClipboardCheck, ShoppingCart, Compass,
  Wrench, Users, Settings, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { canSeeSection } from "@/lib/role-nav";
import type { AppRole } from "@/lib/roles";
import logoImg from "@/assets/logo.png";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

const primaryTabs = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban, section: "projects" },
  { to: "/production", label: "Factory", icon: Factory, section: "production" },
  { to: "/site-hub", label: "Site", icon: Truck, section: "production" },
];

const moreItems = [
  { to: "/sales", label: "Sales", icon: BarChart3, section: "business" },
  { to: "/finance", label: "Finance", icon: DollarSign, section: "business" },
  { to: "/qc", label: "QC & NCR", icon: ClipboardCheck, section: "production" },
  { to: "/procurement", label: "Procurement", icon: ShoppingCart, section: "procurement" },
  { to: "/design", label: "Design Portal", icon: Compass, section: "design" },
  { to: "/rm", label: "R&M / AMC", icon: Wrench, section: "business" },
  { to: "/admin", label: "Admin", icon: Users, section: "admin" },
  { to: "/settings", label: "Settings", icon: Settings, section: "admin" },
];

export function MobileNav() {
  const { role } = useUserRole();
  const userRole = role as AppRole | null;
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const visiblePrimary = primaryTabs.filter(
    (t) => !t.section || canSeeSection(userRole, t.section)
  );

  const visibleMore = moreItems.filter((t) => canSeeSection(userRole, t.section));

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{ backgroundColor: "#FFFFFF", borderTop: "1px solid #E0E0E0" }}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {visiblePrimary.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium transition-all min-w-0",
                  isActive ? "font-bold" : ""
                )
              }
              style={({ isActive }) => ({ color: isActive ? "#006039" : "#666666" })}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </NavLink>
          ))}
          {visibleMore.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium min-w-0"
              style={{ color: "#666666" }}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-2 max-h-[70vh]">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "#E0E0E0" }} />
          </div>
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left font-display text-base" style={{ color: "#1A1A1A" }}>
              More
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-1">
            {visibleMore.map((item) => (
              <button
                key={item.to}
                onClick={() => {
                  navigate(item.to);
                  setMoreOpen(false);
                }}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium transition-colors hover:bg-accent/30"
                style={{ color: "#1A1A1A" }}
              >
                <item.icon className="h-5 w-5 shrink-0" style={{ color: "#006039" }} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
