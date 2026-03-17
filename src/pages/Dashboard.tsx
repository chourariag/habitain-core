import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban,
  Factory,
  AlertTriangle,
  Clock,
  Activity,
  Plus,
  Shield,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
  accent = "primary",
  onClick,
}: {
  label: string;
  value: string | number;
  icon: any;
  loading?: boolean;
  accent?: "primary" | "secondary" | "success" | "warning";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-background rounded-lg border border-border p-5 shadow-card text-left w-full hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={`h-9 w-9 rounded-md bg-${accent}/10 flex items-center justify-center`}>
          <Icon className={`h-5 w-5 text-${accent}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground font-display">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
      </p>
    </button>
  );
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  entityId?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeProjects, setActiveProjects] = useState(0);
  const [modulesInProduction, setModulesInProduction] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [openNCRs, setOpenNCRs] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [projectsRes, modulesRes, claimsRes, ncrsRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "hold"]),
        supabase.from("labour_claims").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]),
      ]);

      setActiveProjects(projectsRes.count ?? 0);
      setModulesInProduction(modulesRes.count ?? 0);
      setPendingClaims(claimsRes.count ?? 0);
      setOpenNCRs(ncrsRes.count ?? 0);

      const activities: ActivityItem[] = [];

      const { data: recentProjects } = await supabase
        .from("projects").select("id, name, created_at").eq("is_archived", false)
        .order("created_at", { ascending: false }).limit(3);

      (recentProjects ?? []).forEach((p) => {
        activities.push({ id: `proj-${p.id}`, type: "project", description: `Project "${p.name}" created`, timestamp: p.created_at!, entityId: p.id });
      });

      const { data: recentModules } = await supabase
        .from("modules").select("id, name, module_code, created_at, projects(name)").eq("is_archived", false)
        .order("created_at", { ascending: false }).limit(3);

      (recentModules ?? []).forEach((m: any) => {
        activities.push({ id: `mod-${m.id}`, type: "module", description: `Module "${m.module_code || m.name}" added to ${m.projects?.name || "project"}`, timestamp: m.created_at!, entityId: m.id });
      });

      const { data: recentInspections } = await supabase
        .from("qc_inspections").select("id, stage_name, dispatch_decision, created_at, modules(name, module_code)").eq("is_archived", false)
        .order("created_at", { ascending: false }).limit(3);

      (recentInspections ?? []).forEach((i: any) => {
        activities.push({ id: `insp-${i.id}`, type: "inspection", description: `QC Inspection submitted for ${i.modules?.module_code || i.modules?.name || "module"} — ${i.stage_name} → ${i.dispatch_decision || "N/A"}`, timestamp: i.created_at!, entityId: i.id });
      });

      const { data: recentNCRs } = await supabase
        .from("ncr_register").select("id, ncr_number, status, created_at").eq("is_archived", false)
        .order("created_at", { ascending: false }).limit(3);

      (recentNCRs ?? []).forEach((n) => {
        activities.push({ id: `ncr-${n.id}`, type: "ncr", description: `NCR ${n.ncr_number} raised (${n.status})`, timestamp: n.created_at!, entityId: n.id });
      });

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivity(activities.slice(0, 10));
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "project": return <FolderKanban className="h-4 w-4 text-primary" />;
      case "module": return <Plus className="h-4 w-4 text-secondary" />;
      case "inspection": return <Shield className="h-4 w-4 text-success" />;
      case "ncr": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleActivityClick = (activity: ActivityItem) => {
    switch (activity.type) {
      case "project":
        if (activity.entityId) navigate(`/projects/${activity.entityId}`);
        break;
      case "inspection":
        navigate("/qc?tab=inspections");
        break;
      case "ncr":
        navigate("/qc?tab=ncrs");
        break;
      default:
        break;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Production overview · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={activeProjects} icon={FolderKanban} accent="primary" loading={loading} onClick={() => navigate("/projects?filter=active")} />
        <StatCard label="Modules in Production" value={modulesInProduction} icon={Factory} accent="secondary" loading={loading} onClick={() => navigate("/production?filter=in_production")} />
        <StatCard label="Pending Claims" value={pendingClaims} icon={Clock} accent="warning" loading={loading} onClick={() => navigate("/production?tab=claims&filter=pending")} />
        <StatCard label="Open NCRs" value={openNCRs} icon={AlertTriangle} accent="primary" loading={loading} onClick={() => navigate("/qc?tab=ncrs&filter=open")} />
      </div>

      <div className="bg-card rounded-lg p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-card-foreground mb-4">Recent Activity</h2>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="text-sm text-card-foreground/60 py-8 text-center">
            No activity yet. Create your first project to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => handleActivityClick(activity)}
                className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0 w-full text-left hover:bg-card-foreground/5 rounded px-1 -mx-1 transition-colors cursor-pointer"
              >
                <div className="mt-0.5 shrink-0">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-card-foreground">{activity.description}</p>
                  <p className="text-xs text-card-foreground/50 mt-0.5">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
