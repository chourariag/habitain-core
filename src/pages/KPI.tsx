import { useState, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import {
  getKpiViewType, DEPARTMENT_MAP, HOD_DIRECT_REPORTS,
  getScoreColor, getStatusBadge, getWeekRange,
} from "@/lib/kpi-helpers";
import { KPIScorecard } from "@/components/kpi/KPIScorecard";

export default function KPI() {
  const { role, userId, loading: roleLoading } = useUserRole();
  const userRole = role as AppRole | null;
  const viewType = getKpiViewType(userRole);
  const week = getWeekRange();

  if (roleLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {viewType === "director" ? (
        <DirectorView week={week} />
      ) : viewType === "hod" ? (
        <HODView role={userRole!} week={week} />
      ) : (
        <IndividualView userId={userId} userRole={userRole} week={week} />
      )}
    </div>
  );
}

/* ─── Director View ─── */
function DirectorView({ week }: { week: ReturnType<typeof getWeekRange> }) {
  const [department, setDepartment] = useState("All");
  const [profiles, setProfiles] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{ id: string; role: AppRole } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const weekStr = week.start.toISOString().split("T")[0];
    const [{ data: profs }, { data: snaps }] = await Promise.all([
      supabase.from("profiles").select("auth_user_id, display_name, role, is_active").eq("is_active", true),
      supabase.from("kpi_snapshots").select("*").eq("week_start_date", weekStr),
    ]);
    setProfiles(profs ?? []);
    setSnapshots(snaps ?? []);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (selectedUser) {
    return (
      <div>
        <Button variant="ghost" className="mb-4 text-sm" onClick={() => setSelectedUser(null)}>← Back to Team</Button>
        <KPIScorecard userId={selectedUser.id} userRole={selectedUser.role} week={week} />
      </div>
    );
  }

  const departments = department === "All"
    ? Object.entries(DEPARTMENT_MAP)
    : Object.entries(DEPARTMENT_MAP).filter(([k]) => k === department);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Team Performance</h1>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Departments</SelectItem>
            {Object.keys(DEPARTMENT_MAP).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: "#D4860A" }}>
          <Info className="h-4 w-4 shrink-0" />
          <span>KPI targets will be configured during Phase 5 setup. Live data is already being tracked.</span>
        </div>
      </div>

      {departments.map(([deptName, roles]) => {
        const deptProfiles = profiles.filter((p: any) => roles.includes(p.role));
        if (deptProfiles.length === 0) return null;
        const isExpanded = expanded === deptName;

        const deptSnaps = snapshots.filter((s: any) => deptProfiles.some((p: any) => p.auth_user_id === s.user_id));
        const avgScore = deptSnaps.length > 0
          ? Math.round(deptSnaps.reduce((a: number, s: any) => a + (s.score || 0), 0) / deptSnaps.length)
          : null;
        const onTrack = deptProfiles.filter((p: any) => {
          const userSnaps = deptSnaps.filter((s: any) => s.user_id === p.auth_user_id);
          if (userSnaps.length === 0) return false;
          const avg = userSnaps.reduce((a: number, s: any) => a + (s.score || 0), 0) / userSnaps.length;
          return avg >= 70;
        }).length;

        return (
          <div key={deptName} className="rounded-lg border border-border overflow-hidden bg-background">
            <button
              onClick={() => setExpanded(isExpanded ? null : deptName)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <span className="font-display font-semibold text-foreground">{deptName}</span>
                  <span className="text-xs text-muted-foreground ml-2">({deptProfiles.length} members)</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span style={{ color: avgScore !== null ? getScoreColor(avgScore) : "#999" }}>
                  {avgScore !== null ? `${avgScore}/100` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">{onTrack} on track</span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#F7F7F7" }}>
                      {["Name", "Role", "This Week", "Status", ""].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptProfiles.map((p: any) => {
                      const userSnaps = deptSnaps.filter((s: any) => s.user_id === p.auth_user_id);
                      const avg = userSnaps.length > 0
                        ? Math.round(userSnaps.reduce((a: number, s: any) => a + (s.score || 0), 0) / userSnaps.length)
                        : null;
                      const status = avg === null ? "no_data" : avg >= 70 ? "on_track" : avg >= 50 ? "needs_attention" : "at_risk";
                      const badge = getStatusBadge(status);
                      return (
                        <tr key={p.auth_user_id} className="border-t border-border">
                          <td className="px-4 py-2.5 font-medium text-foreground">{p.display_name || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{ROLE_LABELS[p.role as AppRole] || p.role}</td>
                          <td className="px-4 py-2.5 font-mono text-sm" style={{ color: getScoreColor(avg) }}>
                            {avg !== null ? `${avg}/100` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: badge.color, borderColor: badge.color, backgroundColor: badge.bg }}>
                              {badge.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Button variant="ghost" size="sm" className="text-xs h-7" style={{ color: "#006039" }}
                              onClick={() => setSelectedUser({ id: p.auth_user_id, role: p.role })}>
                              View Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── HOD View ─── */
function HODView({ role, week }: { role: AppRole; week: ReturnType<typeof getWeekRange> }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; role: AppRole } | null>(null);
  const [loading, setLoading] = useState(true);

  const directReportRoles = HOD_DIRECT_REPORTS[role] ?? [];

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const weekStr = week.start.toISOString().split("T")[0];
    const [{ data: profs }, { data: snaps }] = await Promise.all([
      supabase.from("profiles").select("auth_user_id, display_name, role, is_active").eq("is_active", true),
      supabase.from("kpi_snapshots").select("*").eq("week_start_date", weekStr),
    ]);
    const filtered = (profs ?? []).filter((p: any) => directReportRoles.includes(p.role));
    setProfiles(filtered);
    setSnapshots((snaps ?? []).filter((s: any) => filtered.some((p: any) => p.auth_user_id === s.user_id)));
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (selectedUser) {
    return (
      <div>
        <Button variant="ghost" className="mb-4 text-sm" onClick={() => setSelectedUser(null)}>← Back to Team</Button>
        <KPIScorecard userId={selectedUser.id} userRole={selectedUser.role} week={week} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">My Team Performance</h1>
      <div className="text-sm text-muted-foreground">{week.label}</div>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No direct reports with KPI tracking.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7" }}>
                {["Name", "Role", "This Week", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p: any) => {
                const userSnaps = snapshots.filter((s: any) => s.user_id === p.auth_user_id);
                const avg = userSnaps.length > 0 ? Math.round(userSnaps.reduce((a: number, s: any) => a + (s.score || 0), 0) / userSnaps.length) : null;
                const status = avg === null ? "no_data" : avg >= 70 ? "on_track" : avg >= 50 ? "needs_attention" : "at_risk";
                const badge = getStatusBadge(status);
                return (
                  <tr key={p.auth_user_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">{p.display_name || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{ROLE_LABELS[p.role as AppRole] || p.role}</td>
                    <td className="px-4 py-2.5 font-mono text-sm" style={{ color: getScoreColor(avg) }}>{avg !== null ? `${avg}/100` : "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: badge.color, borderColor: badge.color, backgroundColor: badge.bg }}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button variant="ghost" size="sm" className="text-xs h-7" style={{ color: "#006039" }}
                        onClick={() => setSelectedUser({ id: p.auth_user_id, role: p.role })}>View Details</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Individual View ─── */
function IndividualView({ userId, userRole, week }: { userId: string | null; userRole: AppRole | null; week: ReturnType<typeof getWeekRange> }) {
  if (!userId || !userRole) return <p className="text-sm text-muted-foreground py-8 text-center">No KPI data available.</p>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">My Performance</h1>
      <KPIScorecard userId={userId} userRole={userRole} week={week} />
    </div>
  );
}
