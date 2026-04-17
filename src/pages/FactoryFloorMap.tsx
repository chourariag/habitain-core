import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import {
  Loader2, ChevronRight, ChevronDown, AlertTriangle,
  Check, Truck, Users, Package, ShieldAlert, Clock,
  ArrowRight, GripVertical,
} from "lucide-react";
import { format, startOfWeek, addDays, isToday } from "date-fns";

/* ──── CONSTANTS ──── */
// Module bay numbering: 1-5 indoor, 11-17 outdoor (legacy used 1-10 indoor; bays 6-10 still rendered as legacy if occupied).
const INDOOR_MODULE_BAYS = 5;
const OUTDOOR_MODULE_BAYS = 7;
const OUTDOOR_BAY_START = 11;
const PANEL_BAYS = 3;
const PANEL_BAY_START = 101; // 101, 102, 103
const PANEL_STAGES = ["Cutting", "Framing", "Insulation", "Boarding", "Finishing", "QC", "Ready"] as const;
const PANEL_TYPE_LABELS: Record<string, string> = {
  wall_panel: "Wall Panel",
  floor_panel: "Floor Panel",
  roof_panel: "Roof Panel",
  external_cladding_panel: "External Cladding Panel",
};

const STAGE_NAMES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch Ready",
];
const STAGE_COLOURS = [
  "#8B8B8B", "#5B8DD9", "#9B59B6", "#E67E22", "#F1C40F",
  "#1ABC9C", "#3498DB", "#E91E63", "#006039", "#F40009",
];

const CAN_ASSIGN_ROLES = ["production_head", "factory_floor_supervisor", "super_admin", "managing_director"];

function stageIndex(stage: string | null): number {
  if (!stage) return 0;
  const s = stage.toLowerCase().replace(/[^a-z ]/g, "").trim();
  const idx = STAGE_NAMES.findIndex((n) => n.toLowerCase().replace(/[^a-z ]/g, "").trim() === s);
  return idx >= 0 ? idx : 0;
}

type BayAssignment = {
  id: string;
  module_id: string;
  bay_number: number;
  bay_type: string;
  project_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
  moved_from: number | null;
  move_reason: string | null;
};

type ModuleRow = {
  id: string;
  name: string;
  module_code: string | null;
  current_stage: string | null;
  production_status: string | null;
  project_id: string | null;
  projects: { name: string } | null;
};

type WorkerRow = {
  id: string;
  display_name: string | null;
  role: string | null;
};

type ManpowerPlan = {
  worker_id: string;
  module_id: string | null;
  stage_task: string | null;
};

type PanelBatch = {
  id: string;
  bay_number: number;
  project_id: string | null;
  panel_type: string;
  total_panels: number;
  completed_panels: number;
  current_stage: string;
  status: string;
  expected_completion: string | null;
  projects?: { name: string } | null;
};

type PanelHandover = {
  id: string;
  panel_batch_id: string;
  source_panel_bay: number;
  target_module_bay: number;
  project_id: string | null;
  status: string;
  ready_at: string;
  projects?: { name: string } | null;
  panel_batches?: { panel_type: string; total_panels: number } | null;
};

/* ──────────────── COMPONENT ──────────────── */
export default function FactoryFloorMap() {
  const { role, userId, loading: roleLoading } = useUserRole();
  const isMobile = useIsMobile();
  const canAssign = CAN_ASSIGN_ROLES.includes(role ?? "");

  // Week selector
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    return addDays(monday, weekOffset * 7);
  }, [weekOffset]);

  // Data
  const [bays, setBays] = useState<BayAssignment[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [manpower, setManpower] = useState<ManpowerPlan[]>([]);
  const [panelBatches, setPanelBatches] = useState<PanelBatch[]>([]);
  const [handovers, setHandovers] = useState<PanelHandover[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<number | null>(null);

  // Drag / assign state
  const [dragWorkerId, setDragWorkerId] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean; workerId: string; workerName: string; bayNumber: number; moduleId: string; moduleName: string;
  } | null>(null);
  const [assignTask, setAssignTask] = useState("");

  // Move bay dialog
  const [moveDialog, setMoveDialog] = useState<{
    open: boolean; moduleId: string; currentBay: number;
  } | null>(null);
  const [moveToBay, setMoveToBay] = useState("");
  const [moveReason, setMoveReason] = useState("");

  // Worker pool collapsed
  const [poolOpen, setPoolOpen] = useState(!isMobile);

  // Tap-to-assign (mobile)
  const [tapWorkerId, setTapWorkerId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [bayRes, modRes, workerRes, mpRes, panelRes, handoverRes] = await Promise.all([
      supabase.from("bay_assignments").select("*").is("moved_from", null),
      supabase.from("modules").select("id, name, module_code, current_stage, production_status, project_id, projects(name)").eq("is_archived", false),
      supabase.from("profiles").select("id, display_name, role").in("role", [
        "fabrication_foreman", "electrical_installer", "elec_plumbing_installer",
        "factory_floor_supervisor",
      ]).eq("is_active", true),
      supabase.from("weekly_manpower_plans").select("worker_id, module_id, stage_task")
        .eq("plan_type", "factory")
        .gte("week_start_date", format(weekStart, "yyyy-MM-dd"))
        .lte("week_start_date", format(addDays(weekStart, 6), "yyyy-MM-dd")),
      supabase.from("panel_batches")
        .select("id, bay_number, project_id, panel_type, total_panels, completed_panels, current_stage, status, expected_completion, projects(name)")
        .neq("status", "dispatched"),
      supabase.from("panel_handovers")
        .select("id, panel_batch_id, source_panel_bay, target_module_bay, project_id, status, ready_at, projects(name), panel_batches(panel_type, total_panels)")
        .eq("status", "pending")
        .order("ready_at", { ascending: false }),
    ]);
    setBays((bayRes.data as BayAssignment[] | null) ?? []);
    setModules((modRes.data as ModuleRow[] | null) ?? []);
    setWorkers((workerRes.data as WorkerRow[] | null) ?? []);
    setManpower((mpRes.data as ManpowerPlan[] | null) ?? []);
    setPanelBatches((panelRes.data as PanelBatch[] | null) ?? []);
    setHandovers((handoverRes.data as PanelHandover[] | null) ?? []);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derived
  const bayMap = useMemo(() => {
    const m = new Map<number, BayAssignment>();
    bays.forEach((b) => m.set(b.bay_number, b));
    return m;
  }, [bays]);

  const moduleMap = useMemo(() => {
    const m = new Map<string, ModuleRow>();
    modules.forEach((mod) => m.set(mod.id, mod));
    return m;
  }, [modules]);

  const workerMap = useMemo(() => {
    const m = new Map<string, WorkerRow>();
    workers.forEach((w) => m.set(w.id, w));
    return m;
  }, [workers]);

  // Workers assigned to modules in bays this week
  const moduleWorkers = useMemo(() => {
    const m = new Map<string, { workerId: string; task: string | null }[]>();
    manpower.forEach((mp) => {
      if (!mp.module_id) return;
      const arr = m.get(mp.module_id) || [];
      if (!arr.find((a) => a.workerId === mp.worker_id)) {
        arr.push({ workerId: mp.worker_id, task: mp.stage_task });
      }
      m.set(mp.module_id, arr);
    });
    return m;
  }, [manpower]);

  const assignedWorkerIds = useMemo(() => new Set(manpower.map((p) => p.worker_id)), [manpower]);

  // Stats
  const stats = useMemo(() => {
    const occupied = bays.length;
    let behind = 0, qcReady = 0, dispatchReady = 0, materialHold = 0;
    bays.forEach((b) => {
      const mod = moduleMap.get(b.module_id);
      if (!mod) return;
      const status = mod.production_status;
      if (status === "hold") materialHold++;
      const si = stageIndex(mod.current_stage);
      if (si === 8) qcReady++;
      if (si === 9) dispatchReady++;
      if (status === "in_progress") behind++; // simplified heuristic
    });
    return { active: occupied, behind, qcReady, dispatchReady, materialHold };
  }, [bays, moduleMap]);

  /* ── ASSIGN WORKER ── */
  const handleDrop = (bayNumber: number) => {
    if (!dragWorkerId) return;
    const bay = bayMap.get(bayNumber);
    if (!bay) { toast.error("No module in this bay"); return; }
    const mod = moduleMap.get(bay.module_id);
    const worker = workerMap.get(dragWorkerId);
    setAssignDialog({
      open: true,
      workerId: dragWorkerId,
      workerName: worker?.display_name || "Worker",
      bayNumber,
      moduleId: bay.module_id,
      moduleName: mod?.module_code || mod?.name || bay.module_id,
    });
    setDragWorkerId(null);
  };

  const handleTapAssign = (bayNumber: number) => {
    if (!tapWorkerId) return;
    const bay = bayMap.get(bayNumber);
    if (!bay) { toast.error("No module in this bay"); return; }
    const mod = moduleMap.get(bay.module_id);
    const worker = workerMap.get(tapWorkerId);
    setAssignDialog({
      open: true,
      workerId: tapWorkerId,
      workerName: worker?.display_name || "Worker",
      bayNumber,
      moduleId: bay.module_id,
      moduleName: mod?.module_code || mod?.name || bay.module_id,
    });
    setTapWorkerId(null);
  };

  const confirmAssign = async () => {
    if (!assignDialog || !assignTask) return;
    const todayStr = format(weekStart, "yyyy-MM-dd");
    const dayName = format(new Date(), "EEEE").toLowerCase();
    const { error } = await supabase.from("weekly_manpower_plans").insert({
      week_start_date: todayStr,
      plan_type: "factory",
      project_id: bayMap.get(assignDialog.bayNumber)?.project_id ?? null,
      module_id: assignDialog.moduleId,
      worker_id: assignDialog.workerId,
      day_of_week: dayName,
      stage_task: assignTask,
      planned_hours: 8,
      created_by: userId,
    });
    if (error) { toast.error("Failed to assign worker"); return; }
    toast.success(`${assignDialog.workerName} assigned to ${assignDialog.moduleName}`);
    setAssignDialog(null);
    setAssignTask("");
    fetchAll();
  };

  /* ── MOVE BAY ── */
  const confirmMove = async () => {
    if (!moveDialog || !moveToBay) return;
    const newBay = parseInt(moveToBay);
    if (bayMap.has(newBay)) { toast.error("Target bay is occupied"); return; }

    // Mark old assignment as moved
    const oldBay = bays.find((b) => b.module_id === moveDialog.moduleId && !b.moved_from);
    if (oldBay) {
      await supabase.from("bay_assignments").update({
        moved_from: oldBay.bay_number,
        move_reason: moveReason || null,
      }).eq("id", oldBay.id);
    }

    // Insert new assignment
    await supabase.from("bay_assignments").insert({
      module_id: moveDialog.moduleId,
      project_id: oldBay?.project_id ?? null,
      bay_number: newBay,
      assigned_by: userId,
    });

    toast.success(`Module moved to Bay ${newBay}`);
    setMoveDialog(null);
    setMoveToBay("");
    setMoveReason("");
    fetchAll();
  };

  const selectedBayData = selectedBay != null ? bayMap.get(selectedBay) : null;
  const selectedModule = selectedBayData ? moduleMap.get(selectedBayData.module_id) : null;

  if (roleLoading || loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ──────── RENDER ──────── */
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>
            Factory Floor Map
          </h1>
          <p className="text-sm mt-1" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            {format(new Date(), "EEEE, dd/MM/yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>← Prev</Button>
          <span className="text-sm font-medium" style={{ fontFamily: "var(--font-input)", color: "#1A1A1A" }}>
            {format(weekStart, "dd MMM")} – {format(addDays(weekStart, 5), "dd MMM yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)}>Next →</Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
          )}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Active Modules", value: stats.active, icon: Package, color: "#006039" },
          { label: "Behind Schedule", value: stats.behind, icon: Clock, color: stats.behind > 0 ? "#D4860A" : "#006039" },
          { label: "QC Ready", value: stats.qcReady, icon: ShieldAlert, color: "#006039" },
          { label: "Dispatch Ready", value: stats.dispatchReady, icon: Truck, color: "#006039" },
          { label: "Material Hold", value: stats.materialHold, icon: AlertTriangle, color: stats.materialHold > 0 ? "#F40009" : "#006039" },
        ].map((s) => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 shrink-0" style={{ color: s.color }} />
              <div>
                <p className="text-xs" style={{ fontFamily: "var(--font-input)", color: "#666" }}>{s.label}</p>
                <p className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)", color: s.color }}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs font-semibold" style={{ color: "#999" }}>BAY TYPES:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm border-l-4" style={{ borderLeftColor: "#D4860A", backgroundColor: "#FFF" }} />
          <span className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>Panel Production</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm border-l-4" style={{ borderLeftColor: "#006039", backgroundColor: "#FFF" }} />
          <span className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>Module Bay (Indoor)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm border-l-4" style={{ borderLeftColor: "#999", backgroundColor: "#FFF" }} />
          <span className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>Outdoor Bay</span>
        </div>
        <span className="text-xs font-semibold ml-3" style={{ color: "#999" }}>STAGES:</span>
        {STAGE_NAMES.map((name, i) => (
          <div key={name} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: STAGE_COLOURS[i] }} />
            <span className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#666" }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Main layout: Floor + Worker Pool */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Floor zones */}
        <div className="flex-1 space-y-6">
          {/* Two production zones side-by-side on desktop */}
          <div className="grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-6">
            {/* ZONE A — Panel Production */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
                  PANEL PRODUCTION ZONE
                </span>
                <Badge className="text-xs" style={{ backgroundColor: "#D4860A", color: "#fff" }}>3 Bays</Badge>
              </div>
              <div className="grid grid-cols-3 xl:grid-cols-1 gap-3">
                {Array.from({ length: PANEL_BAYS }, (_, i) => i + PANEL_BAY_START).map((n, idx) => (
                  <PanelBayCard
                    key={n}
                    bayNumber={n}
                    bayLabel={`Panel Bay ${idx + 1}`}
                    batch={panelBatches.find((b) => b.bay_number === n)}
                  />
                ))}
              </div>
            </div>

            {/* ZONE B — Module Production (Indoor) */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
                  MODULE PRODUCTION ZONE — Indoor
                </span>
                <Badge className="text-xs" style={{ backgroundColor: "#006039", color: "#fff" }}>{INDOOR_MODULE_BAYS} Bays</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Array.from({ length: INDOOR_MODULE_BAYS }, (_, i) => i + 1).map((n) => (
                  <BayCard
                    key={n}
                    bayNumber={n}
                    bayLabel={`Module Bay ${n} (Indoor)`}
                    assignment={bayMap.get(n)}
                    module={bayMap.get(n) ? moduleMap.get(bayMap.get(n)!.module_id) : undefined}
                    workers={bayMap.get(n) ? moduleWorkers.get(bayMap.get(n)!.module_id) : undefined}
                    workerMap={workerMap}
                    selected={selectedBay === n}
                    canAssign={canAssign}
                    onSelect={() => setSelectedBay(selectedBay === n ? null : n)}
                    onDrop={() => handleDrop(n)}
                    onDragOver={(e) => { e.preventDefault(); }}
                    onTapAssign={() => isMobile && tapWorkerId ? handleTapAssign(n) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Outdoor Zone */}
          <div>
            <div className="rounded-md p-2 mb-3 flex items-start gap-2" style={{ backgroundColor: "#FFF3CD", border: "1px solid #D4860A" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D4860A" }} />
              <p className="text-xs" style={{ fontFamily: "var(--font-input)", color: "#856404" }}>
                Monsoon Note: Modules in outdoor bays should complete external boarding before June.
                Plan shell and core stages indoors first.
              </p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
                Open Yard — Module Bays {OUTDOOR_BAY_START} to {OUTDOOR_BAY_START + OUTDOOR_MODULE_BAYS - 1}
              </span>
              <Badge className="text-xs" style={{ backgroundColor: "#999", color: "#fff" }}>Outdoor</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: OUTDOOR_MODULE_BAYS }, (_, i) => i + OUTDOOR_BAY_START).map((n) => (
                <BayCard
                  key={n}
                  bayNumber={n}
                  bayLabel={`Module Bay ${n - OUTDOOR_BAY_START + 1} (Outdoor)`}
                  assignment={bayMap.get(n)}
                  module={bayMap.get(n) ? moduleMap.get(bayMap.get(n)!.module_id) : undefined}
                  workers={bayMap.get(n) ? moduleWorkers.get(bayMap.get(n)!.module_id) : undefined}
                  workerMap={workerMap}
                  selected={selectedBay === n}
                  canAssign={canAssign}
                  onSelect={() => setSelectedBay(selectedBay === n ? null : n)}
                  onDrop={() => handleDrop(n)}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onTapAssign={() => isMobile && tapWorkerId ? handleTapAssign(n) : undefined}
                  outdoor
                />
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          {selectedBayData && selectedModule && (
            <Card className="border-border mt-4">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-3">
                    <h3 className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
                      {selectedModule.module_code || selectedModule.name}
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm" style={{ fontFamily: "var(--font-input)" }}>
                      <div><span style={{ color: "#666" }}>Project:</span> <span style={{ color: "#1A1A1A" }}>{selectedModule.projects?.name ?? "—"}</span></div>
                      <div><span style={{ color: "#666" }}>Bay:</span> <span style={{ color: "#1A1A1A" }}>{selectedBay}</span></div>
                      <div><span style={{ color: "#666" }}>Current Stage:</span> <span style={{ color: "#1A1A1A" }}>{selectedModule.current_stage ?? "—"}</span></div>
                      <div><span style={{ color: "#666" }}>Status:</span> <span style={{ color: "#1A1A1A" }}>{selectedModule.production_status?.replace(/_/g, " ") ?? "—"}</span></div>
                    </div>
                    {/* Stage progress dots */}
                    <div className="flex gap-1 items-center mt-2">
                      {STAGE_NAMES.map((name, i) => {
                        const si = stageIndex(selectedModule.current_stage);
                        const done = i < si;
                        const current = i === si;
                        return (
                          <div
                            key={name}
                            title={name}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{
                              backgroundColor: done ? STAGE_COLOURS[i] : current ? STAGE_COLOURS[i] : "#E0E0E0",
                              color: done || current ? "#fff" : "#999",
                              border: current ? "2px solid #1A1A1A" : "none",
                            }}
                          >
                            {i + 1}
                          </div>
                        );
                      })}
                    </div>
                    {/* Assigned workers */}
                    <div className="mt-3">
                      <p className="text-xs font-semibold mb-1" style={{ color: "#999" }}>WORKERS THIS WEEK</p>
                      <div className="flex flex-wrap gap-1">
                        {(moduleWorkers.get(selectedBayData.module_id) || []).map((w) => {
                          const wd = workerMap.get(w.workerId);
                          return (
                            <Badge key={w.workerId} variant="outline" className="text-xs">
                              {wd?.display_name ?? "Worker"} {w.task ? `(${w.task})` : ""}
                            </Badge>
                          );
                        })}
                        {!(moduleWorkers.get(selectedBayData.module_id) || []).length && (
                          <span className="text-xs" style={{ color: "#999" }}>No workers assigned this week</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:w-48">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = "/production"}>
                      <ArrowRight className="h-4 w-4 mr-1" /> View in Production
                    </Button>
                    {canAssign && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMoveDialog({
                            open: true,
                            moduleId: selectedBayData.module_id,
                            currentBay: selectedBay!,
                          });
                        }}
                      >
                        Move Bay
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Worker Pool */}
        {canAssign && (
          <div className={`${isMobile ? "w-full" : "w-64"} shrink-0`}>
            <Collapsible open={poolOpen} onOpenChange={setPoolOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Worker Pool
                  </span>
                  {poolOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 max-h-[60vh] overflow-y-auto border border-border rounded-md p-2" style={{ backgroundColor: "#FAFAFA" }}>
                  {workers.map((w) => {
                    const assigned = assignedWorkerIds.has(w.id);
                    const tapped = tapWorkerId === w.id;
                    return (
                      <div
                        key={w.id}
                        draggable={!assigned && !isMobile}
                        onDragStart={() => setDragWorkerId(w.id)}
                        onDragEnd={() => setDragWorkerId(null)}
                        onClick={() => {
                          if (isMobile && !assigned) {
                            setTapWorkerId(tapped ? null : w.id);
                          }
                        }}
                        className={`flex items-center gap-2 p-2 rounded-md text-sm cursor-grab transition-colors ${
                          assigned ? "opacity-40 cursor-not-allowed" : tapped ? "ring-2 ring-primary" : "hover:bg-accent/40"
                        }`}
                        style={{ fontFamily: "var(--font-input)" }}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" style={{ color: "#1A1A1A", fontSize: 13 }}>
                            {w.display_name ?? "Worker"}
                          </p>
                          <p className="text-[11px]" style={{ color: "#999" }}>
                            {w.role?.replace(/_/g, " ") ?? "—"}
                          </p>
                        </div>
                        <Badge variant={assigned ? "muted" : "outline"} className="text-[10px]">
                          {assigned ? "Assigned" : "Available"}
                        </Badge>
                      </div>
                    );
                  })}
                  {workers.length === 0 && (
                    <p className="text-xs text-center py-4" style={{ color: "#999" }}>No factory workers found</p>
                  )}
                </div>
                {isMobile && tapWorkerId && (
                  <p className="text-xs mt-2 text-center" style={{ color: "#D4860A" }}>
                    Now tap a bay to assign {workerMap.get(tapWorkerId)?.display_name}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </div>

      {/* ── Assign Dialog ── */}
      <Dialog open={!!assignDialog?.open} onOpenChange={() => { setAssignDialog(null); setAssignTask(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Worker</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            What will <strong>{assignDialog?.workerName}</strong> do on <strong>{assignDialog?.moduleName}</strong>?
          </p>
          <Select value={assignTask} onValueChange={setAssignTask}>
            <SelectTrigger><SelectValue placeholder="Select stage/task" /></SelectTrigger>
            <SelectContent>
              {STAGE_NAMES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignDialog(null); setAssignTask(""); }}>Cancel</Button>
            <Button disabled={!assignTask} onClick={confirmAssign}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Bay Dialog ── */}
      <Dialog open={!!moveDialog?.open} onOpenChange={() => { setMoveDialog(null); setMoveToBay(""); setMoveReason(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Module to Another Bay</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            Currently in Bay {moveDialog?.currentBay}. Select new bay:
          </p>
          <Select value={moveToBay} onValueChange={setMoveToBay}>
            <SelectTrigger><SelectValue placeholder="Target bay" /></SelectTrigger>
            <SelectContent>
              {[
                ...Array.from({ length: INDOOR_MODULE_BAYS }, (_, i) => i + 1),
                ...Array.from({ length: OUTDOOR_MODULE_BAYS }, (_, i) => i + OUTDOOR_BAY_START),
              ]
                .filter((n) => !bayMap.has(n))
                .map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Module Bay {n < OUTDOOR_BAY_START ? n : n - OUTDOOR_BAY_START + 1}{" "}
                    {n < OUTDOOR_BAY_START ? "(Indoor)" : "(Outdoor)"}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={moveReason} onValueChange={setMoveReason}>
            <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Stage completed indoors">Stage completed indoors</SelectItem>
              <SelectItem value="Space required">Space required</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {moveReason === "Other" && (
            <Textarea placeholder="Explain reason..." value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMoveDialog(null); setMoveToBay(""); setMoveReason(""); }}>Cancel</Button>
            <Button disabled={!moveToBay || !moveReason} onClick={confirmMove}>Confirm Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────── BAY CARD ──────── */
function BayCard({
  bayNumber, bayLabel, assignment, module, workers, workerMap, selected, canAssign,
  onSelect, onDrop, onDragOver, onTapAssign, outdoor,
}: {
  bayNumber: number;
  bayLabel?: string;
  assignment?: BayAssignment;
  module?: ModuleRow;
  workers?: { workerId: string; task: string | null }[];
  workerMap: Map<string, WorkerRow>;
  selected: boolean;
  canAssign: boolean;
  onSelect: () => void;
  onDrop: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onTapAssign?: () => void;
  outdoor?: boolean;
}) {
  const occupied = !!assignment && !!module;
  const si = occupied ? stageIndex(module!.current_stage) : 0;
  const stageColour = STAGE_COLOURS[si];
  const status = module?.production_status;
  const leftBorderColor = outdoor ? "#999" : "#006039";

  const flagColor = status === "hold" ? "#D4860A" : si === 9 ? "#F40009" : si === 8 ? "#006039" : "#006039";
  const flagIcon = status === "hold" ? "⚠" : si === 9 ? "🚚" : si === 8 ? "!" : "✓";

  return (
    <div
      onClick={() => { occupied ? onSelect() : onTapAssign?.(); }}
      onDrop={(e) => { e.preventDefault(); canAssign && onDrop(); }}
      onDragOver={canAssign ? onDragOver : undefined}
      className={`relative rounded-lg cursor-pointer transition-all ${
        occupied
          ? `border shadow-sm ${selected ? "ring-2 ring-primary" : "hover:shadow-md"}`
          : "border-2 border-dashed hover:border-muted-foreground/30"
      }`}
      style={{
        backgroundColor: occupied ? "#FFFFFF" : "#FAFAFA",
        borderColor: occupied ? (selected ? undefined : "#E0E0E0") : "#E0E0E0",
        borderLeftWidth: 4,
        borderLeftColor: leftBorderColor,
        borderTopWidth: occupied ? 4 : undefined,
        borderTopColor: occupied ? stageColour : undefined,
        minHeight: 120,
      }}
    >
      {/* Bay label */}
      <span className="absolute top-1 left-2 text-[10px] font-bold" style={{ color: "#999" }}>
        {bayLabel ?? `Bay ${bayNumber}`}
      </span>

      {occupied ? (
        <div className="p-2 pt-5 space-y-1">
          {/* Flag */}
          <span
            className="absolute top-1 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            style={{ backgroundColor: flagColor, color: "#fff" }}
          >
            {flagIcon}
          </span>

          {/* Module ID */}
          <p className="font-bold text-sm truncate" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
            {module!.module_code || module!.name}
          </p>
          <p className="text-[11px] truncate" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            {module!.projects?.name ?? "—"}
          </p>

          {/* Stage pill */}
          <Badge
            className="text-[10px] mt-1"
            style={{ backgroundColor: `${stageColour}20`, color: stageColour, border: `1px solid ${stageColour}40` }}
          >
            {STAGE_NAMES[si]}
          </Badge>

          {/* Worker chips */}
          {workers && workers.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1">
              {workers.slice(0, 3).map((w) => (
                <span
                  key={w.workerId}
                  className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "#E8F2ED", color: "#006039", fontFamily: "var(--font-input)" }}
                >
                  {workerMap.get(w.workerId)?.display_name?.split(" ")[0] ?? "?"}
                </span>
              ))}
              {workers.length > 3 && (
                <span className="text-[9px] px-1" style={{ color: "#999" }}>+{workers.length - 3}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full min-h-[100px]">
          <span className="text-xs" style={{ color: "#999" }}>Available</span>
        </div>
      )}
    </div>
  );
}

/* ──────── PANEL BAY CARD ──────── */
function PanelBayCard({
  bayNumber, bayLabel, batch,
}: {
  bayNumber: number;
  bayLabel: string;
  batch?: PanelBatch;
}) {
  const occupied = !!batch;
  const stage = batch?.current_stage ?? "";
  const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);
  const isReady = stage === "ready" || batch?.status === "ready_for_dispatch";
  const statusLabel = !occupied
    ? "Empty"
    : isReady
      ? "Ready for Dispatch"
      : "In Progress";
  const statusColor = !occupied ? "#999" : isReady ? "#006039" : "#D4860A";

  return (
    <div
      className="relative rounded-lg border shadow-sm transition-all"
      style={{
        backgroundColor: occupied ? "#FFFFFF" : "#FAFAFA",
        borderColor: "#E0E0E0",
        borderLeftWidth: 4,
        borderLeftColor: "#D4860A",
        minHeight: 120,
      }}
    >
      <span className="absolute top-1 left-2 text-[10px] font-bold" style={{ color: "#999" }}>
        {bayLabel} · #{bayNumber}
      </span>

      {occupied ? (
        <div className="p-2 pt-5 space-y-1">
          <span
            className="absolute top-1 right-2 text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40` }}
          >
            {statusLabel}
          </span>
          <p className="font-bold text-sm truncate" style={{ fontFamily: "var(--font-heading)", color: "#1A1A1A" }}>
            {PANEL_TYPE_LABELS[batch.panel_type] ?? batch.panel_type}
          </p>
          <p className="text-[11px] truncate" style={{ fontFamily: "var(--font-input)", color: "#666" }}>
            {batch.projects?.name ?? "—"}
          </p>
          <p className="text-[11px]" style={{ fontFamily: "var(--font-input)", color: "#1A1A1A" }}>
            {batch.completed_panels} of {batch.total_panels} panels
          </p>
          <Progress
            value={batch.total_panels > 0 ? (batch.completed_panels / batch.total_panels) * 100 : 0}
            className="h-1.5"
          />
          <Badge
            className="text-[10px] mt-1"
            style={{ backgroundColor: "#FFF3CD", color: "#856404", border: "1px solid #D4860A" }}
          >
            {stageLabel || "—"}
          </Badge>
          {batch.expected_completion && (
            <p className="text-[10px]" style={{ color: "#999" }}>
              ETA {format(new Date(batch.expected_completion), "dd MMM")}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full min-h-[100px] gap-1 pt-4">
          <span className="text-xs" style={{ color: "#999" }}>Empty</span>
          <span className="text-[10px]" style={{ color: "#bbb" }}>Panel Production</span>
        </div>
      )}
    </div>
  );
}
