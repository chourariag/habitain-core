import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { getDashboardTier } from "@/lib/role-nav";
import type { AppRole } from "@/lib/roles";
import { Loader2, HardHat } from "lucide-react";
import { HomeTaskList } from "@/components/dashboard/HomeTaskList";
import { CheckInButton } from "@/components/attendance/CheckInButton";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export default function Dashboard() {
  const { role, loading } = useUserRole();
  const userRole = role as AppRole | null;
  const flags = useFeatureFlags();

  useEffect(() => {
    document.title = "Home | HStack";
  }, []);

  if (loading) {

    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">{userRole ?? ""}</p>
      </div>
      {flags.isEnabled("attendance") && <CheckInButton userRole={userRole} />}
      <HomeTaskList userRole={userRole} />
    </div>
  );
}