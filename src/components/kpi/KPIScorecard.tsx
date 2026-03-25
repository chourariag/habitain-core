import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { getScoreColor, getStatusBadge, getWeekRange } from "@/lib/kpi-helpers";

interface Props {
  userId: string;
  userRole: AppRole;
  week: ReturnType<typeof getWeekRange>;
}

export function KPIScorecard({ userId, userRole, week }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [userId, userRole]);

  const fetchData = async () => {
    setLoading(true);
    const weekStr = week.start.toISOString().split("T")[0];
    const [{ data: prof }, { data: defs }, { data: snaps }] = await Promise.all([
      supabase.from("profiles").select("display_name, role").eq("auth_user_id", userId).single(),
      supabase.from("kpi_definitions").select("*").eq("role", userRole).eq("is_active", true),
      supabase.from("kpi_snapshots").select("*").eq("user_id", userId).eq("week_start_date", weekStr),
    ]);
    setProfile(prof);
    setDefinitions(defs ?? []);
    setSnapshots(snaps ?? []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const hasTargets = definitions.some((d: any) => d.target_value !== null);

  // Calculate overall score from snapshots
  const scoredSnaps = snapshots.filter((s: any) => s.score !== null && s.score !== undefined);
  const overallScore = scoredSnaps.length > 0
    ? Math.round(scoredSnaps.reduce((a: number, s: any) => a + s.score, 0) / scoredSnaps.length)
    : null;

  // Generate coaching line
  const belowTarget = definitions
    .filter((d: any) => {
      const snap = snapshots.find((s: any) => s.kpi_key === d.kpi_key);
      return snap && d.target_value && snap.actual_value < d.target_value;
    })
    .slice(0, 1);

  const coachingLine = belowTarget.length > 0
    ? `Focus on ${belowTarget[0].kpi_name.toLowerCase()} to improve further.`
    : overallScore !== null
      ? "You're doing well this week. Keep up the momentum!"
      : "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border p-5 bg-background">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">{profile?.display_name || "—"}</h2>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[userRole] || userRole} · {week.label}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-display" style={{ color: getScoreColor(overallScore) }}>
              {overallScore !== null ? `${overallScore}` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">/100</div>
          </div>
        </div>
        {coachingLine && (
          <p className="text-sm italic mt-3" style={{ color: "#666" }}>{coachingLine}</p>
        )}
      </div>

      {/* Info banner if no targets */}
      {!hasTargets && (
        <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#FFF8E8", borderColor: "#D4860A" }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#D4860A" }}>
            <Info className="h-4 w-4 shrink-0" />
            <span>KPI targets will be configured during Phase 5 setup. Live data is already being tracked.</span>
          </div>
        </div>
      )}

      {/* KPI Items Table */}
      <div className="rounded-lg border border-border overflow-x-auto bg-background">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["KPI", "Target", "Actual", "Score", "Status", "Coaching Note"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {definitions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No KPIs defined for this role yet.</td></tr>
            ) : definitions.map((d: any) => {
              const snap = snapshots.find((s: any) => s.kpi_key === d.kpi_key);
              const target = d.target_value;
              const actual = snap?.actual_value ?? null;
              const score = snap?.score ?? null;
              const status = snap?.status || "no_data";
              const badge = getStatusBadge(status);

              const coaching = target === null
                ? "Targets set in Phase 5"
                : actual !== null && target && actual < target
                  ? d.coaching_template_below || ""
                  : actual !== null && target && actual >= target
                    ? d.coaching_template_above || ""
                    : "";

              return (
                <tr key={d.kpi_key} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-foreground">{d.kpi_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: target !== null ? "#1A1A1A" : "#999" }}>
                    {target !== null ? `${target}${d.unit === "%" ? "%" : ` ${d.unit}`}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: actual !== null ? "#1A1A1A" : "#999" }}>
                    {actual !== null ? `${actual}${d.unit === "%" ? "%" : ` ${d.unit}`}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm" style={{ color: getScoreColor(score) }}>
                    {score !== null ? `${score}` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px] font-semibold whitespace-nowrap" style={{ color: badge.color, borderColor: badge.color, backgroundColor: badge.bg }}>
                      {target === null ? "Targets set in Phase 5" : badge.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs max-w-[200px]" style={{ color: "#666" }}>
                    {coaching}
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
