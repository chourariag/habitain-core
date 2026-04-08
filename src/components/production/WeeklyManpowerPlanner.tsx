import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Users, GripVertical, CalendarDays, Check, X, AlertCircle } from "lucide-react";
import { format, startOfWeek, addDays, isWithinInterval, parseISO } from "date-fns";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch",
];

const SITE_STAGES = [
  "Site Preparation", "Foundation Check", "Module Lifting", "Module Placement",
  "MEP Stitching", "Weatherproofing", "Module Connections", "Snagging", "Final Inspection",
];

const UNAVAILABILITY_REASONS = ["On Leave", "Sick", "Personal", "No Show"];

interface Worker {
  id: string;
  display_name: string | null;
  email: string;
  role: string;
}

interface ModuleBasic {
  id: string;
  name: string;
  module_code: string | null;
  current_stage: string | null;
  production_status: string | null;
}

interface PlanEntry {
  id?: string;
  worker_id: string;
  module_id: string;
  day_of_week: string;
  stage_task: string;
  planned_hours: number;
}

interface AssignDialogState {
  open: boolean;
  workerId: string;
  workerName: string;
  moduleId: string;
  moduleName: string;
  dayOfWeek: string;
}

interface Props {
  projectId: string;
  userRole: string | null;
}

export function WeeklyManpowerPlanner({ projectId, userRole }: Props) {
  const canAccess = ["production_head", "site_installation_mgr", "super_admin", "managing_director"].includes(userRole ?? "");
  const [planTab, setPlanTab] = useState<"factory" | "site">(
    userRole === "site_installation_mgr" ? "site" : "factory"
  );
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  });
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [modules, setModules] = useState<ModuleBasic[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignDialog, setAssignDialog] = useState<AssignDialogState>({
    open: false, workerId: "", workerName: "", moduleId: "", moduleName: "", dayOfWeek: "",
  });
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedHours, setSelectedHours] = useState("8");
  const [unavailableMarks, setUnavailableMarks] = useState<Record<string, string>>({});
  const [dragWorkerId, setDragWorkerId] = useState<string | null>(null);
  const [dragWorkerName, setDragWorkerName] = useState<string>("");

  const weekLabel = `${format(weekStart, "dd/MM/yyyy")} – ${format(addDays(weekStart, 5), "dd/MM/yyyy")}`;

  const factoryRoles: Array<Worker["role"]> = [
    "factory_floor_supervisor", "fabrication_foreman", "electrical_installer",
    "elec_plumbing_installer", "stores_executive",
  ];
  const siteRoles: Array<Worker["role"]> = [
    "site_installation_mgr", "site_engineer", "delivery_rm_lead",
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);

    const targetRoles = planTab === "factory" ? factoryRoles : siteRoles;
    const { data: workerData } = await supabase
      .from("profiles")
      .select("id, display_name, email, role")
      .in("role", targetRoles as any)
      .eq("is_active", true);
    setWorkers((workerData as Worker[]) ?? []);

    const { data: moduleData } = await supabase
      .from("modules")
      .select("id, name, module_code, current_stage, production_status")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });
    setModules((moduleData as ModuleBasic[]) ?? []);

    const wStart = format(weekStart, "yyyy-MM-dd");
    const { data: planData } = await supabase
      .from("weekly_manpower_plans")
      .select("id, worker_id, module_id, day_of_week, stage_task, planned_hours")
      .eq("project_id", projectId)
      .eq("week_start_date", wStart)
      .eq("plan_type", planTab);
    setPlans((planData as PlanEntry[]) ?? []);

    setLoading(false);
  }, [projectId, planTab, weekStart]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!canAccess) {
    return (
      <div className="bg-card rounded-lg p-8 text-center border border-border">
        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Access restricted to Production Head and Site Installation Manager.</p>
      </div>
    );
  }

  const assignedWorkerDayKeys = new Set(
    plans.map((p) => `${p.worker_id}-${p.day_of_week}`)
  );

  const getWorkerAssignmentsForDay = (day: string) =>
    plans.filter((p) => p.day_of_week === day);

  const getModuleAssignmentsForDay = (moduleId: string, day: string) =>
    plans.filter((p) => p.module_id === moduleId && p.day_of_week === day);

  const isWorkerUnavailable = (workerId: string, day: string) =>
    unavailableMarks[`${workerId}-${day}`] != null;

  const handleDragStart = (workerId: string, workerName: string) => {
    setDragWorkerId(workerId);
    setDragWorkerName(workerName);
  };

  const handleDrop = (moduleId: string, moduleName: string, dayOfWeek: string) => {
    if (!dragWorkerId) return;
    if (assignedWorkerDayKeys.has(`${dragWorkerId}-${dayOfWeek}`)) {
      toast.error("Worker already assigned for this day");
      return;
    }
    setAssignDialog({
      open: true,
      workerId: dragWorkerId,
      workerName: dragWorkerName,
      moduleId,
      moduleName,
      dayOfWeek,
    });
    setDragWorkerId(null);
    setDragWorkerName("");
  };

  const confirmAssignment = async () => {
    if (!selectedStage) {
      toast.error("Please select a stage/task");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newEntry: PlanEntry = {
      worker_id: assignDialog.workerId,
      module_id: assignDialog.moduleId,
      day_of_week: assignDialog.dayOfWeek,
      stage_task: selectedStage,
      planned_hours: parseFloat(selectedHours) || 8,
    };

    const { error } = await supabase.from("weekly_manpower_plans").insert({
      week_start_date: format(weekStart, "yyyy-MM-dd"),
      plan_type: planTab,
      project_id: projectId,
      module_id: assignDialog.moduleId,
      worker_id: assignDialog.workerId,
      day_of_week: assignDialog.dayOfWeek,
      stage_task: selectedStage,
      planned_hours: parseFloat(selectedHours) || 8,
      created_by: user.id,
    });

    if (error) {
      toast.error("Failed to save assignment");
      return;
    }

    setPlans((prev) => [...prev, newEntry]);
    setAssignDialog({ open: false, workerId: "", workerName: "", moduleId: "", moduleName: "", dayOfWeek: "" });
    setSelectedStage("");
    setSelectedHours("8");
    toast.success("Worker assigned");
  };

  const removeAssignment = async (plan: PlanEntry) => {
    if (plan.id) {
      await supabase.from("weekly_manpower_plans").delete().eq("id", plan.id);
    }
    setPlans((prev) => prev.filter((p) => p !== plan));
    toast.success("Assignment removed");
  };

  const markUnavailable = (workerId: string, day: string, reason: string) => {
    setUnavailableMarks((prev) => ({ ...prev, [`${workerId}-${day}`]: reason }));
  };

  const confirmPlan = async () => {
    setSaving(true);
    const wStart = format(weekStart, "yyyy-MM-dd");
    const { error } = await supabase
      .from("weekly_manpower_plans")
      .update({ status: "confirmed" })
      .eq("project_id", projectId)
      .eq("week_start_date", wStart)
      .eq("plan_type", planTab);

    if (error) {
      toast.error("Failed to confirm plan");
    } else {
      toast.success(`${planTab === "factory" ? "Factory" : "Site"} plan confirmed for ${weekLabel}`);
    }
    setSaving(false);
  };

  const stages = planTab === "factory" ? PRODUCTION_STAGES : SITE_STAGES;

  const navigateWeek = (dir: number) => {
    setWeekStart((prev) => addDays(prev, dir * 7));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Weekly Manpower Planner</h2>
          <p className="text-xs text-muted-foreground">Plan worker assignments for the week</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateWeek(-1)}>← Prev</Button>
          <span className="text-sm font-medium px-2">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={() => navigateWeek(1)}>Next →</Button>
        </div>
      </div>

      <Tabs value={planTab} onValueChange={(v) => setPlanTab(v as "factory" | "site")}>
        <TabsList>
          <TabsTrigger value="factory" className="gap-1.5">
            <Users className="h-4 w-4" /> Factory Plan
          </TabsTrigger>
          <TabsTrigger value="site" className="gap-1.5">
            <Users className="h-4 w-4" /> Site Plan
          </TabsTrigger>
        </TabsList>

        <TabsContent value={planTab} className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* LEFT: Worker Pool */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border border-border p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Available Workers</h3>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {workers.length === 0 && (
                        <p className="text-xs text-muted-foreground">No workers found for this team.</p>
                      )}
                      {workers.map((w) => (
                        <div
                          key={w.id}
                          draggable
                          onDragStart={() => handleDragStart(w.id, w.full_name || w.email)}
                          className="flex items-center gap-2 p-2 rounded-md border border-border bg-background cursor-grab hover:border-primary/50 transition-colors"
                        >
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {w.full_name || w.email}
                            </p>
                            <p className="text-xs text-muted-foreground">{w.role.replace(/_/g, " ")}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            Available
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* RIGHT: Module Grid */}
              <div className="lg:col-span-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-semibold text-foreground min-w-[140px]">Module</th>
                        {DAYS.map((d, i) => (
                          <th key={d} className="text-center p-2 font-semibold text-foreground min-w-[120px]">
                            {DAY_LABELS[i]}
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {format(addDays(weekStart, i), "dd/MM")}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {modules.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-muted-foreground">
                            No modules in this project.
                          </td>
                        </tr>
                      )}
                      {modules.map((m) => (
                        <tr key={m.id} className="border-b border-border/50">
                          <td className="p-2">
                            <div>
                              <p className="font-medium text-foreground">{m.module_code || m.name}</p>
                              <p className="text-[10px] text-muted-foreground">{m.current_stage ?? "—"}</p>
                            </div>
                          </td>
                          {DAYS.map((day) => {
                            const dayAssignments = getModuleAssignmentsForDay(m.id, day);
                            return (
                              <td
                                key={day}
                                className="p-1 align-top"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDrop(m.id, m.module_code || m.name, day)}
                              >
                                <div className="min-h-[60px] rounded-md border border-dashed border-border/50 p-1 bg-muted/20 hover:bg-accent/20 transition-colors">
                                  {dayAssignments.map((a, idx) => {
                                    const worker = workers.find((w) => w.id === a.worker_id);
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1 bg-primary/10 text-primary rounded px-1.5 py-0.5 mb-1 text-[11px]"
                                      >
                                        <span className="truncate flex-1">
                                          {worker?.full_name || "Worker"}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeAssignment(a)}
                                          className="text-destructive hover:text-destructive/80 shrink-0"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-4 gap-2">
                  <Button variant="outline" size="sm" onClick={fetchData}>
                    Refresh
                  </Button>
                  <Button size="sm" onClick={confirmPlan} disabled={saving || plans.length === 0}>
                    {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <Check className="h-4 w-4 mr-1" />
                    Confirm {planTab === "factory" ? "Factory" : "Site"} Plan
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={(o) => !o && setAssignDialog((p) => ({ ...p, open: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              What stage/task will <span className="font-semibold text-foreground">{assignDialog.workerName}</span> do on{" "}
              <span className="font-semibold text-foreground">{assignDialog.moduleName}</span> ({assignDialog.dayOfWeek})?
            </p>
            <div className="space-y-2">
              <Label>Stage / Task</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Planned Hours</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={selectedHours}
                onChange={(e) => setSelectedHours(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog((p) => ({ ...p, open: false }))}>
              Cancel
            </Button>
            <Button onClick={confirmAssignment}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
