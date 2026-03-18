import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban, Factory, AlertTriangle, Clock, Activity, Plus, Shield,
  Loader2, Wrench, FileSignature, Package, Truck, HardHat, Construction,
  CheckCircle2, ClipboardCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TileData {
  label: string;
  value: number;
  icon: any;
  href: string;
  tone: "normal" | "red" | "amber" | "green";
}

function DashTile({ tile, loading, onClick }: { tile: TileData; loading: boolean; onClick: () => void }) {
  const bgMap = { normal: "#FFFFFF", red: "#FFF0F0", amber: "#FFF8E8", green: "#F0FFF4" };
  const countMap = { normal: "#1A1A1A", red: "#F40009", amber: "#D4860A", green: "#006039" };
  const Icon = tile.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-border p-4 text-left w-full hover:ring-2 hover:ring-[#006039]/30 transition-all cursor-pointer"
      style={{ backgroundColor: bgMap[tile.tone], boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "#666666" }}>{tile.label}</span>
        <Icon className="h-4.5 w-4.5" style={{ color: "#006039" }} />
      </div>
      <p className="text-2xl font-bold font-display" style={{ color: loading ? "#666666" : countMap[tile.tone] }}>
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : tile.value}
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
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const twoDaysAgo = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Parallel queries for all 11 tiles
      const [
        projectsRes, modulesRes, pendingLogsRes, ncrsRes, criticalNcrsRes,
        scheduleRes, rmRes, amcRes, inventoryRes,
        dispatchedModulesRes, handoverRes, diaryRes, installRes,
        signoffsRes, readinessRes, allInspRes,
      ] = await Promise.all([
        // 1 Active Projects
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_archived", false),
        // 2 In Production
        supabase.from("modules").select("id", { count: "exact", head: true }).eq("is_archived", false).in("production_status", ["in_progress", "not_started"]),
        // 3 Pending Approvals
        supabase.from("daily_production_logs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        // 4 Open NCRs
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).in("status", ["open", "critical_open"]),
        // 4b Critical NCRs
        supabase.from("ncr_register").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "critical_open"),
        // 5 Delayed - fetch schedule rows where target_end < today and no actual_end
        supabase.from("module_schedule").select("module_id,target_end,actual_end").lt("target_end", todayStr).is("actual_end", null),
        // 6 Overdue R&M - urgent tickets open > 48h
        supabase.from("rm_tickets").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("priority", "urgent").eq("status", "open").lt("raised_at", twoDaysAgo),
        // 7 AMC Renewals - expiring within 60 days
        supabase.from("amc_contracts").select("id", { count: "exact", head: true }).eq("is_archived", false).eq("status", "active").lte("end_date", sixtyDaysFromNow),
        // 8 Low Stock
        supabase.from("inventory_items").select("id,current_stock,reorder_level").eq("is_archived", false),
        // 9+10 Dispatched modules
        supabase.from("modules").select("id,project_id,current_stage,production_status").eq("is_archived", false),
        // Handover packs
        supabase.from("handover_pack").select("project_id"),
        // 11 Site diary blockers last 48h
        supabase.from("site_diary").select("id", { count: "exact", head: true }).gte("entry_date", twoDaysAgo.split("T")[0]).not("blockers", "is", null),
        // Installation fails
        supabase.from("installation_checklist").select("id,is_complete").eq("is_complete", false),
        // Dispatch conditions for "Ready to Dispatch"
        supabase.from("dispatch_signoffs").select("module_id"),
        supabase.from("site_readiness").select("module_id,is_complete").eq("is_complete", true),
        supabase.from("qc_inspections").select("module_id,dispatch_decision").eq("dispatch_decision", "PASS STAGE"),
      ]);

      // 5 Delayed modules - count distinct module_ids
      const delayedModuleIds = new Set((scheduleRes.data ?? []).map((s) => s.module_id));
      const delayedCount = delayedModuleIds.size;

      // 8 Low stock count
      const lowStockCount = (inventoryRes.data ?? []).filter((i) => i.current_stock <= i.reorder_level).length;

      // 9 Ready to Dispatch - modules at QC Inspection/Dispatch stage with all 4 conditions met
      const signoffSet = new Set((signoffsRes.data ?? []).map((s) => s.module_id));
      const readinessSet = new Set((readinessRes.data ?? []).map((r: any) => r.module_id));
      const passSet = new Set((allInspRes.data ?? []).map((i) => i.module_id));
      const allModules = dispatchedModulesRes.data ?? [];
      const handoverProjects = new Set((handoverRes.data ?? []).map((h) => h.project_id));

      const readyToDispatch = allModules.filter((m) =>
        m.production_status !== "dispatched" &&
        signoffSet.has(m.id) && readinessSet.has(m.id) && passSet.has(m.id)
      ).length;

      // 10 Active Site Installations - dispatched but not handed over
      const activeInstallations = allModules.filter((m) =>
        (m.production_status === "dispatched" || m.current_stage === "Dispatch") &&
        !handoverProjects.has(m.project_id)
      ).length;

      // 11 Site delays
      const siteDelays = (diaryRes.count ?? 0) + (installRes.data ?? []).length;

      const hasCritical = (criticalNcrsRes.count ?? 0) > 0;

      const builtTiles: TileData[] = [
        { label: "Active Projects", value: projectsRes.count ?? 0, icon: FolderKanban, href: "/projects?filter=active", tone: "normal" },
        { label: "In Production", value: modulesRes.count ?? 0, icon: Factory, href: "/production", tone: "normal" },
        { label: "Pending Approvals", value: pendingLogsRes.count ?? 0, icon: Clock, href: "/production?tab=logs&filter=pending", tone: "normal" },
        { label: "Open NCRs", value: ncrsRes.count ?? 0, icon: AlertTriangle, href: "/qc?tab=ncrs&filter=open", tone: hasCritical ? "red" : "normal" },
        { label: "Delayed Modules", value: delayedCount, icon: Construction, href: "/production?filter=delayed", tone: delayedCount > 0 ? "red" : "normal" },
        { label: "Overdue R&M", value: rmRes.count ?? 0, icon: Wrench, href: "/rm?filter=overdue", tone: (rmRes.count ?? 0) > 0 ? "red" : "normal" },
        { label: "AMC Renewals", value: amcRes.count ?? 0, icon: FileSignature, href: "/amc?filter=expiring", tone: (amcRes.count ?? 0) > 0 ? "amber" : "normal" },
        { label: "Low Stock", value: lowStockCount, icon: Package, href: "/inventory?filter=low", tone: lowStockCount > 0 ? "amber" : "normal" },
        { label: "Ready to Dispatch", value: readyToDispatch, icon: CheckCircle2, href: "/site-hub?filter=ready", tone: readyToDispatch > 0 ? "green" : "normal" },
        { label: "Active Installations", value: activeInstallations, icon: Truck, href: "/site-hub?filter=installing", tone: "normal" },
        { label: "Site Delays", value: siteDelays, icon: HardHat, href: "/site-hub?filter=delays", tone: siteDelays > 0 ? "red" : "normal" },
      ];
      setTiles(builtTiles);

      // Activity feed
      const activities: ActivityItem[] = [];

      const [recentProjects, recentModulesR, recentInspections, recentNCRs, recentLogs, recentDispatches] = await Promise.all([
        supabase.from("projects").select("id,name,created_at").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("modules").select("id,name,module_code,created_at,projects(name)").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("qc_inspections").select("id,stage_name,dispatch_decision,created_at,modules(name,module_code)").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("ncr_register").select("id,ncr_number,status,created_at").eq("is_archived", false).order("created_at", { ascending: false }).limit(3),
        supabase.from("daily_production_logs").select("id,stage_worked,status,created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("dispatch_log").select("id,created_at,module_id").order("created_at", { ascending: false }).limit(3),
      ]);

      (recentProjects.data ?? []).forEach((p) => activities.push({ id: `proj-${p.id}`, type: "project", description: `Project "${p.name}" created`, timestamp: p.created_at!, entityId: p.id }));
      (recentModulesR.data ?? []).forEach((m: any) => activities.push({ id: `mod-${m.id}`, type: "module", description: `Module "${m.module_code || m.name}" added to ${m.projects?.name || "project"}`, timestamp: m.created_at!, entityId: m.id }));
      (recentInspections.data ?? []).forEach((i: any) => activities.push({ id: `insp-${i.id}`, type: "inspection", description: `QC Inspection — ${i.modules?.module_code || i.modules?.name || "module"} ${i.stage_name} → ${i.dispatch_decision || "N/A"}`, timestamp: i.created_at!, entityId: i.id }));
      (recentNCRs.data ?? []).forEach((n) => activities.push({ id: `ncr-${n.id}`, type: "ncr", description: `NCR ${n.ncr_number} raised (${n.status})`, timestamp: n.created_at!, entityId: n.id }));
      (recentLogs.data ?? []).forEach((l) => activities.push({ id: `log-${l.id}`, type: "log", description: `Daily log ${l.status === "approved" ? "approved" : "submitted"} — ${l.stage_worked}`, timestamp: l.created_at!, entityId: l.id }));
      (recentDispatches.data ?? []).forEach((d: any) => activities.push({ id: `disp-${d.id}`, type: "dispatch", description: `Module dispatched`, timestamp: d.created_at! }));

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
      case "project": return <FolderKanban className="h-4 w-4" style={{ color: "#006039" }} />;
      case "module": return <Plus className="h-4 w-4" style={{ color: "#006039" }} />;
      case "inspection": return <Shield className="h-4 w-4" style={{ color: "#006039" }} />;
      case "ncr": return <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />;
      case "log": return <ClipboardCheck className="h-4 w-4" style={{ color: "#006039" }} />;
      case "dispatch": return <Truck className="h-4 w-4" style={{ color: "#006039" }} />;
      default: return <Activity className="h-4 w-4" style={{ color: "#666666" }} />;
    }
  };

  const handleActivityClick = (activity: ActivityItem) => {
    switch (activity.type) {
      case "project": if (activity.entityId) navigate(`/projects/${activity.entityId}`); break;
      case "inspection": navigate("/qc?tab=inspections"); break;
      case "ncr": navigate("/qc?tab=ncrs"); break;
      case "log": navigate("/production?tab=logs"); break;
      case "dispatch": navigate("/site-hub"); break;
      default: break;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#666666" }}>
          Production overview · {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <DashTile key={tile.label} tile={tile} loading={loading} onClick={() => navigate(tile.href)} />
        ))}
      </div>

      <div className="bg-card rounded-lg p-5" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : recentActivity.length === 0 ? (
          <div className="text-sm py-8 text-center" style={{ color: "#666666" }}>No activity yet. Create your first project to get started.</div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => handleActivityClick(activity)}
                className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0 w-full text-left hover:bg-muted/50 rounded px-2 -mx-2 transition-colors cursor-pointer"
              >
                <div className="mt-0.5 shrink-0">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#999999" }}>
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
