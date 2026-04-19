import { useUserRole } from "@/hooks/useUserRole";
import { getDashboardTier } from "@/lib/role-nav";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { Loader2 } from "lucide-react";
import { Tier1Dashboard } from "@/components/dashboard/Tier1Dashboard";
import { PlaceholderDashboard } from "@/components/dashboard/PlaceholderDashboard";
import { SharedDashboardBottom } from "@/components/dashboard/SharedDashboardBottom";
import { CheckInButton } from "@/components/attendance/CheckInButton";
import { LogExpenseButton } from "@/components/expenses/LogExpenseButton";
import { WeeklyDigestCard } from "@/components/kpi/WeeklyDigestCard";
import { DailyReadinessBrief } from "@/components/home/DailyReadinessBrief";
import { useAuth } from "@/components/AuthProvider";

export default function Dashboard() {
  const { role, loading } = useUserRole();
  const { user } = useAuth();
  const userRole = role as AppRole | null;

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const tier = getDashboardTier(userRole);
  const roleName = userRole ? ROLE_LABELS[userRole] ?? userRole : "User";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const userName = (user as any)?.user_metadata?.full_name ?? (user as any)?.email?.split("@")[0] ?? "there";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Morning readiness brief — only visible before 10am */}
      <DailyReadinessBrief userRole={userRole} userName={userName} />

      {/* Check-in card at the very top */}
      <CheckInButton userRole={userRole} />

      {/* Submit Expense button */}
      <LogExpenseButton userRole={userRole} />

      {/* Weekly KPI Digest */}
      <WeeklyDigestCard />

      {tier === 1 ? (
        <Tier1Dashboard today={today} />
      ) : tier === 2 ? (
        <PlaceholderDashboard title={`My Dashboard — ${roleName}`} today={today} tier={2} role={userRole} />
      ) : tier === 4 ? (
        <PlaceholderDashboard title="Design Workspace" today={today} tier={4} role={userRole} />
      ) : (
        <PlaceholderDashboard title={`My Workspace — ${roleName}`} today={today} tier={3} role={userRole} />
      )}
      <SharedDashboardBottom userRole={userRole} />
    </div>
  );
}