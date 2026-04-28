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
import { MyTasksSection } from "@/components/tasks/MyTasksSection";
import { DailyReadinessBrief } from "@/components/dashboard/DailyReadinessBrief";
import { MyReportsSection } from "@/components/reports/MyReportsSection";
import { ReportsToReviewSection } from "@/components/reports/ReportsToReviewSection";

export default function Dashboard() {
  const { role, userId, loading } = useUserRole();
  const userRole = role as AppRole | null;

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const tier = getDashboardTier(userRole);
  const roleName = userRole ? ROLE_LABELS[userRole] ?? userRole : "User";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Daily Readiness Brief — pinned above check-in, hidden after 10am */}
      <DailyReadinessBrief userRole={userRole} userId={userId} />

      {/* Check-in card */}
      <CheckInButton userRole={userRole} />

      {/* Submit Expense button */}
      <LogExpenseButton userRole={userRole} />

      {/* Weekly KPI Digest */}
      <WeeklyDigestCard />

      {/* Weekly status reports */}
      <MyReportsSection />
      <ReportsToReviewSection />

      {/* My Tasks */}
      <MyTasksSection userRole={userRole} />

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