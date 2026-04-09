import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, TrendingDown, CheckCircle, Calendar, X } from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import { toast } from "sonner";

const PRODUCTION_STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation",
  "Drywall", "Paint", "MEP Final", "Windows & Doors",
  "Finishing", "QC Inspection", "Dispatch",
];

interface VelocityItem {
  moduleId: string;
  moduleCode: string;
  projectName: string;
  stageName: string;
  stageNumber: number;
  plannedDays: number;
  actualDays: number;
  velocityRatio: number;
  daysBehind: number;
  plannedEnd: string | null;
  forecastEnd: string | null;
  coachingMessage: string;
  sundayRecommended: boolean;
}

interface Props {
  userRole: string | null;
}

const ALLOWED = ["production_head", "head_operations", "managing_director", "super_admin",
  "planning_engineer", "site_installation_mgr", "finance_director", "sales_director", "architecture_director"];

function generateCoaching(item: VelocityItem): string {
  const stage = item.stageName;
  const behind = item.daysBehind;
  const mod = item.moduleCode;
  const proj = item.projectName;

  let recovery = "";
  if (stage === "Drywall" || stage === "Paint") {
    recovery = `→ Add 1 worker to ${stage.toLowerCase()} team tomorrow\n→ Complete ${stage.toLowerCase()} ${behind} days faster\n→ Next stage can begin overlap — assign workers in parallel`;
  } else if (stage === "MEP Rough-In" || stage === "MEP Final") {
    recovery = `→ Assign additional MEP technician for ${behind} days\n→ Electrical and plumbing can run in parallel\n→ Coordinate with QC for concurrent inspection`;
  } else if (stage === "Sub-Frame") {
    recovery = `→ Add welding crew — target ${behind}-day acceleration\n→ Pre-fabricate remaining joints off-bay\n→ Quality check can be staged, not end-of-stage`;
  } else {
    recovery = `→ Add ${Math.ceil(behind / 2)} worker(s) to accelerate\n→ Review if any sub-tasks can overlap\n→ Prioritise this module in daily assignment`;
  }

  let sundayNote = "";
  if (item.sundayRecommended) {
    sundayNote = `\n\nIf above is done: dispatch can be saved.\nIf not done by Wednesday: Sunday work needed.`;
  }

  return `${mod} (${proj}) is ${behind} days behind plan at Stage ${item.stageNumber + 1} ${stage}. Planned completion was ${item.plannedEnd ? format(parseISO(item.plannedEnd), "dd/MM/yyyy") : "—"}, current forecast is ${item.forecastEnd ? format(parseISO(item.forecastEnd), "dd/MM/yyyy") : "—"}.\n\nTo recover:\n${recovery}${sundayNote}`;
}

export function StageVelocityMonitor({ userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<VelocityItem[]>([]);
  const [avgVelocity, setAvgVelocity] = useState(1.0);
  const [onScheduleCount, setOnScheduleCount] = useState(0);

  useEffect(() => {
    loadVelocityData();
  }, []);

  async function loadVelocityData() {
    setLoading(true);

    // Get all active modules with their projects
    const { data: modules } = await supabase
      .from("modules")
      .select("id, name, module_code, current_stage, production_status, project_id, projects(name)")
      .eq("is_archived", false)
      .not("production_status", "in", "(completed,dispatched)");

    if (!modules?.length) { setLoading(false); return; }

    const moduleIds = modules.map((m) => m.id);
    const { data: schedules } = await supabase
      .from("module_schedule")
      .select("*")
      .in("module_id", moduleIds);

    if (!schedules?.length) { setLoading(false); return; }

    const now = new Date();
    const atRiskItems: VelocityItem[] = [];
    const velocities: number[] = [];
    let onSched = 0;

    for (const mod of modules) {
      const modSched = schedules.filter((s: any) => s.module_id === mod.id);
      const proj = (mod as any).projects as any;
      const projName = proj?.name ?? "";

      for (const s of modSched) {
        const sched = s as any;
        if (!sched.target_start || !sched.target_end) continue;

        const targetStart = parseISO(sched.target_start);
        const targetEnd = parseISO(sched.target_end);
        const plannedDays = Math.max(differenceInDays(targetEnd, targetStart), 1);

        let actualDays: number;
        if (sched.actual_start && sched.actual_end) {
          actualDays = Math.max(differenceInDays(parseISO(sched.actual_end), parseISO(sched.actual_start)), 1);
        } else if (sched.actual_start && !sched.actual_end) {
          actualDays = Math.max(differenceInDays(now, parseISO(sched.actual_start)), 1);
        } else {
          continue;
        }

        const ratio = actualDays / plannedDays;
        velocities.push(ratio);

        if (ratio <= 1.2) {
          onSched++;
          continue;
        }

        const stageIdx = PRODUCTION_STAGES.indexOf(sched.stage_name);
        const daysBehind = Math.max(actualDays - plannedDays, 0);
        const forecastEnd = sched.actual_start
          ? format(addDays(parseISO(sched.actual_start), actualDays + Math.ceil(daysBehind * 0.5)), "yyyy-MM-dd")
          : null;

        const item: VelocityItem = {
          moduleId: mod.id,
          moduleCode: mod.module_code || mod.name,
          projectName: projName,
          stageName: sched.stage_name,
          stageNumber: stageIdx,
          plannedDays,
          actualDays,
          velocityRatio: Math.round(ratio * 100) / 100,
          daysBehind,
          plannedEnd: sched.target_end,
          forecastEnd,
          coachingMessage: "",
          sundayRecommended: daysBehind >= 5,
        };
        item.coachingMessage = generateCoaching(item);
        atRiskItems.push(item);
      }
    }

    atRiskItems.sort((a, b) => b.daysBehind - a.daysBehind);
    setAlerts(atRiskItems);
    setOnScheduleCount(onSched);
    setAvgVelocity(velocities.length ? Math.round((velocities.reduce((a, b) => a + b, 0) / velocities.length) * 100) / 100 : 1.0);
    setLoading(false);
  }

  if (!ALLOWED.includes(userRole ?? "")) return null;

  if (loading) return (
    <Card><CardContent className="p-4 flex justify-center">
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#666" }} />
    </CardContent></Card>
  );

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <Card style={{ border: "1px solid #E0E0E0" }}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5" style={{ color: "#006039" }} />
            <h3 className="font-display text-sm font-bold" style={{ color: "#1A1A1A" }}>Stage Velocity Monitor</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md p-2 text-center" style={{ backgroundColor: "#E8F2ED" }}>
              <p className="text-lg font-bold font-display" style={{ color: "#006039" }}>{onScheduleCount}</p>
              <p className="text-[10px]" style={{ color: "#006039" }}>On Schedule</p>
            </div>
            <div className="rounded-md p-2 text-center" style={{ backgroundColor: alerts.length > 0 ? "#FFF0F0" : "#F7F7F7" }}>
              <p className="text-lg font-bold font-display" style={{ color: alerts.length > 0 ? "#F40009" : "#1A1A1A" }}>{alerts.length}</p>
              <p className="text-[10px]" style={{ color: alerts.length > 0 ? "#F40009" : "#666" }}>At Risk</p>
            </div>
            <div className="rounded-md p-2 text-center" style={{ backgroundColor: avgVelocity > 1.2 ? "#FFF8E8" : "#F7F7F7" }}>
              <p className="text-lg font-bold font-display" style={{ color: avgVelocity > 1.2 ? "#D4860A" : "#1A1A1A" }}>{avgVelocity}x</p>
              <p className="text-[10px]" style={{ color: "#666" }}>Avg Velocity</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coaching cards */}
      {alerts.slice(0, 5).map((item) => (
        <Card key={`${item.moduleId}-${item.stageNumber}`} style={{ border: `1px solid ${item.sundayRecommended ? "#F40009" : "#D4860A"}` }}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <TrendingDown className="h-4 w-4 shrink-0" style={{ color: "#F40009" }} />
              <span className="font-display text-sm font-bold" style={{ color: "#1A1A1A" }}>{item.moduleCode}</span>
              <Badge style={{ backgroundColor: "#FFF0F0", color: "#F40009", border: "none" }} className="text-[10px]">
                {item.daysBehind}d behind • {item.velocityRatio}x
              </Badge>
              {item.sundayRecommended && (
                <Badge style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }} className="text-[10px]">
                  Sunday recommended
                </Badge>
              )}
              <span className="text-[10px] ml-auto" style={{ color: "#999" }}>{item.projectName}</span>
            </div>

            {/* Coaching message */}
            <pre className="text-xs whitespace-pre-wrap font-inter leading-relaxed rounded-md p-3" style={{ backgroundColor: "#F7F7F7", color: "#333" }}>
              {item.coachingMessage}
            </pre>

            {/* Actions */}
            {item.sundayRecommended && (
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs gap-1" style={{ backgroundColor: "#006039" }}
                  onClick={() => toast.success("Sunday work approved. Notification sent.")}>
                  <CheckCircle className="h-3 w-3" /> Approve Sunday Work
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                  style={{ borderColor: "#F40009", color: "#F40009" }}
                  onClick={() => toast.info("Sunday rejected. Schedule revised.")}>
                  <X className="h-3 w-3" /> Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {alerts.length === 0 && (
        <Card style={{ backgroundColor: "#E8F2ED" }}>
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" style={{ color: "#006039" }} />
            <p className="text-sm font-display" style={{ color: "#006039" }}>All modules are on schedule. No recovery actions needed.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
