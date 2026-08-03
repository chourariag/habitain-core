import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, CheckSquare, ChevronRight, AlertTriangle, Clock, Hourglass, FolderKanban, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchSalesTasks, groupSalesTasks, type SalesTask } from "@/lib/sales-tasks";

const URGENCY_STYLE: Record<SalesTask["urgency"], { color: string; bg: string; Icon: typeof Clock; label: string }> = {
  overdue: { color: "#F40009", bg: "#FFE5E7", Icon: AlertTriangle, label: "Overdue" },
  action: { color: "#D4860A", bg: "#FDF3E3", Icon: Clock, label: "Action needed" },
  waiting: { color: "#666666", bg: "#F0F0F0", Icon: Hourglass, label: "Waiting" },
};

export function SalesTasksCard({ userId }: { userId: string | null }) {
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await fetchSalesTasks(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupSalesTasks(tasks), [tasks]);
  const counts = useMemo(() => ({
    total: tasks.length,
    overdue: tasks.filter(t => t.urgency === "overdue").length,
    action: tasks.filter(t => t.urgency === "action").length,
    waiting: tasks.filter(t => t.urgency === "waiting").length,
  }), [tasks]);

  return (
    <div className="space-y-4">
      {/* Real pending-action tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "My Open Tasks", value: counts.total },
          { label: "Overdue", value: counts.overdue },
          { label: "Action Needed", value: counts.action },
          { label: "Waiting On Others", value: counts.waiting },
        ].map((t) => (
          <div key={t.label} className="rounded-lg border p-4"
            style={{ backgroundColor: "#FFFFFF", borderColor: "#E0E0E0", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeftWidth: 3, borderLeftColor: "#006039" }}>
            <p className="text-[10px] uppercase tracking-wider font-medium mb-2" style={{ color: "#666666" }}>{t.label}</p>
            <p className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>{loading ? "—" : t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h2 className="font-display text-base font-semibold flex items-center gap-2 mb-4" style={{ color: "#1A1A1A" }}>
          <CheckSquare className="h-4 w-4" style={{ color: "#006039" }} /> My Tasks
          {!loading && counts.overdue > 0 && (
            <Badge className="ml-auto text-xs" style={{ backgroundColor: "#FFE5E7", color: "#F40009" }}>
              {counts.overdue} overdue
            </Badge>
          )}
        </h2>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-6 w-6" style={{ color: "#006039" }} />
            <p className="text-sm" style={{ color: "#666666" }}>Nothing pending — you're all caught up.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#006039" }}>
                  <FolderKanban className="h-3.5 w-3.5" /> {g.label}
                  <span className="font-normal" style={{ color: "#999999" }}>({g.items.length})</span>
                </p>
                <div className="space-y-2">
                  {g.items.map((t) => {
                    const s = URGENCY_STYLE[t.urgency];
                    return (
                      <Link key={t.id} to={t.to}
                        className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
                        style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F7F7" }}>
                        <s.Icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: s.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{t.title}</p>
                          {t.detail && <p className="text-xs mt-0.5" style={{ color: "#666666" }}>{t.detail}</p>}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>
                            {!t.actionable && t.ownerLabel && (
                              <span className="text-[10px]" style={{ color: "#999999" }}>with {t.ownerLabel}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#999999" }} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
