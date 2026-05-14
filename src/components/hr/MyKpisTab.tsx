import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Info } from "lucide-react";
import { ragColor, ragLabel, type RagStatus } from "@/lib/kpi-metrics";

export function MyKpisTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [defs, setDefs] = useState<any[]>([]);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !role) return;
    (async () => {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: d }, { data: s }] = await Promise.all([
        supabase.from("kpi_definitions").select("*").eq("role", role as any).eq("is_active", true),
        supabase.from("kpi_snapshots").select("*").eq("user_id", user.id).eq("period_type", "daily").eq("period_date", today),
      ]);
      setDefs(d ?? []); setSnaps(s ?? []); setLoading(false);
    })();
  }, [user, role]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (defs.length === 0) {
    return (
      <div className="rounded-lg border border-border p-6 bg-background text-center">
        <Info className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No KPI metrics are tracked for your role yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Your live performance scorecard. Updated daily from system data.</p>
      <div className="rounded-lg border border-border bg-background overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["KPI", "Target", "Actual", "Status"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {defs.map((d: any) => {
              const s = snaps.find((x: any) => x.kpi_key === d.kpi_key);
              const status: RagStatus = (s?.status as RagStatus) ?? "no_data";
              return (
                <tr key={d.kpi_key} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{d.kpi_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.target_value ?? "—"} {d.unit}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{s?.actual_value !== null && s?.actual_value !== undefined ? `${Math.round(s.actual_value * 10) / 10} ${d.unit}` : "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ color: ragColor(status), backgroundColor: ragColor(status) + "1A" }}>
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: ragColor(status) }} />
                      {ragLabel(status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
