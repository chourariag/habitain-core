import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { LeaveRequestDrawer } from "./LeaveRequestDrawer";

const LEAVE_LABELS: Record<string, string> = { casual: "Casual", sick: "Sick", earned: "Earned", lop: "Unpaid", other: "Other" };

export function MyLeaveTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const year = new Date().getFullYear();
    const [{ data: reqs }, { data: bal }] = await Promise.all([
      supabase.from("leave_requests").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }),
      supabase.from("leave_balances").select("*").eq("user_id", user.id).eq("year", year).maybeSingle(),
    ]);
    setRequests(reqs ?? []);
    setBalance(bal ?? { cl_total: 12, sl_total: 6, el_total: 15, cl_used: 0, sl_used: 0, el_used: 0 });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const totalUsed = (balance?.cl_used ?? 0) + (balance?.sl_used ?? 0) + (balance?.el_used ?? 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#E8F2ED" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#006039" }}>Casual Leave</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#006039" }}>{(balance?.cl_total ?? 0) - (balance?.cl_used ?? 0)}<span className="text-sm" style={{ color: "#666" }}> / {balance?.cl_total ?? 0}</span></p>
        </div>
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#FFF8E8" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#D4860A" }}>Sick Leave</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#D4860A" }}>{(balance?.sl_total ?? 0) - (balance?.sl_used ?? 0)}<span className="text-sm" style={{ color: "#666" }}> / {balance?.sl_total ?? 0}</span></p>
        </div>
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Earned Leave</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#1A1A1A" }}>{(balance?.el_total ?? 0) - (balance?.el_used ?? 0)}<span className="text-sm" style={{ color: "#666" }}> / {balance?.el_total ?? 0}</span></p>
        </div>
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#666" }}>Total Used</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#1A1A1A" }}>{totalUsed}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <LeaveRequestDrawer onSuccess={fetchData} />
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Type", "From", "To", "Days", "Reason", "Status", "Reviewer Note"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm" style={{ color: "#999" }}>No leave requests yet.</td></tr>
            ) : requests.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 text-xs">{LEAVE_LABELS[r.leave_type] || r.leave_type}</td>
                <td className="px-3 py-2 font-mono text-xs">{format(new Date(r.from_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 font-mono text-xs">{format(new Date(r.to_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.days_count}</td>
                <td className="px-3 py-2 text-xs max-w-[260px] truncate">{r.reason}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px] capitalize" style={{
                    color: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
                    borderColor: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
                  }}>{r.status}</Badge>
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: "#F40009" }}>{r.rejection_reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
