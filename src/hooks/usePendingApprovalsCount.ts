import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";

const APPROVER_ROLES = ["managing_director", "super_admin", "sales_director", "principal_architect"];

export function usePendingApprovalsCount() {
  const { session } = useAuth();
  const { actualRole } = useUserRole();
  const [count, setCount] = useState(0);

  const refetch = useCallback(async () => {
    if (!session?.user || !actualRole || !APPROVER_ROLES.includes(actualRole)) {
      setCount(0); return;
    }
    const { count: c } = await (supabase.from("approval_requests" as never) as any)
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setCount(c ?? 0);
  }, [session?.user, actualRole]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!session?.user) return;
    const ch = supabase
      .channel("approvals-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user, refetch]);

  return count;
}
