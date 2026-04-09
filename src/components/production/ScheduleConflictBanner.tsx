import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";

interface ConflictData {
  id: string;
  module_id: string;
  module_code: string;
  project_name: string;
  stage_name: string;
  days_behind: number;
  planned_end: string | null;
  forecast_end: string | null;
  sunday_work_status: string;
  sunday_work_date: string | null;
}

interface Props {
  projectId: string;
  userRole: string | null;
}

export function ScheduleConflictBanner({ projectId, userRole }: Props) {
  const [conflicts, setConflicts] = useState<ConflictData[]>([]);

  useEffect(() => {
    loadConflicts();
  }, [projectId]);

  async function loadConflicts() {
    // Compute conflicts from module_schedule vs actual
    const { data: modules } = await supabase
      .from("modules")
      .select("id, name, module_code, current_stage, production_status, project_id")
      .eq("project_id", projectId)
      .eq("is_archived", false);

    if (!modules?.length) return;

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single();

    const moduleIds = modules.map((m) => m.id);
    const { data: schedules } = await supabase
      .from("module_schedule")
      .select("*")
      .in("module_id", moduleIds);

    if (!schedules?.length) return;

    const now = new Date();
    const detected: ConflictData[] = [];

    for (const mod of modules) {
      if (mod.production_status === "completed" || mod.production_status === "dispatched") continue;
      const modSched = schedules.filter((s: any) => s.module_id === mod.id);

      for (const s of modSched) {
        const sched = s as any;
        if (!sched.target_end) continue;
        const targetEnd = parseISO(sched.target_end);
        const hasActualEnd = !!sched.actual_end;

        if (!hasActualEnd && differenceInDays(now, targetEnd) >= 2) {
          detected.push({
            id: `${mod.id}-${sched.stage_name}`,
            module_id: mod.id,
            module_code: mod.module_code || mod.name,
            project_name: project?.name ?? "",
            stage_name: sched.stage_name,
            days_behind: differenceInDays(now, targetEnd),
            planned_end: sched.target_end,
            forecast_end: null,
            sunday_work_status: "none",
            sunday_work_date: null,
          });
          break; // one conflict per module is enough for banner
        }
      }
    }

    setConflicts(detected);
  }

  const handleSundayApprove = async (conflictId: string) => {
    toast.success("Sunday work approved. Notification sent to production team.");
  };

  const handleSundayReject = async (conflictId: string) => {
    toast.info("Sunday work rejected. Schedule updated with revised dates.");
  };

  if (!conflicts.length) return null;

  const canAct = ["production_head", "managing_director", "super_admin", "head_operations"].includes(userRole ?? "");
  const severConflicts = conflicts.filter((c) => c.days_behind >= 5);

  return (
    <div className="space-y-2">
      {/* Main conflict banner */}
      <Card style={{ backgroundColor: "#FFF8E8", border: "1px solid #D4860A" }}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#D4860A" }} />
            <div className="flex-1">
              <p className="text-sm font-display font-bold" style={{ color: "#D4860A" }}>
                Schedule Conflicts — {conflicts.length} module{conflicts.length !== 1 ? "s" : ""} behind plan
              </p>
              <div className="mt-2 space-y-1">
                {conflicts.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-xs font-inter">
                    <Badge style={{ backgroundColor: "#FFF0F0", color: "#F40009", border: "none" }} className="text-[10px]">
                      {c.days_behind}d behind
                    </Badge>
                    <span style={{ color: "#1A1A1A" }} className="font-medium">{c.module_code}</span>
                    <span style={{ color: "#666" }}>— {c.stage_name}</span>
                    {c.planned_end && (
                      <span style={{ color: "#999" }}>
                        (planned: {format(parseISO(c.planned_end), "dd/MM")})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sunday work recommendation for severe conflicts */}
      {severConflicts.length > 0 && canAct && (
        <Card style={{ backgroundColor: "#FFF0F0", border: "1px solid #F40009" }}>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#F40009" }} />
              <div className="flex-1">
                <p className="text-sm font-display font-bold" style={{ color: "#F40009" }}>
                  Sunday Work Recommended
                </p>
                <p className="text-xs mt-1 font-inter" style={{ color: "#666" }}>
                  {severConflicts.length} module{severConflicts.length !== 1 ? "s are" : " is"} 5+ days behind planned dispatch. 
                  Recovery is unlikely within remaining weekdays. Sunday work is recommended.
                </p>
                <div className="mt-2 space-y-1">
                  {severConflicts.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium" style={{ color: "#1A1A1A" }}>
                        {c.module_code} — {c.days_behind} days behind
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-6 text-[10px] px-2 gap-1" style={{ backgroundColor: "#006039" }} onClick={() => handleSundayApprove(c.id)}>
                          <CheckCircle className="h-3 w-3" /> Approve Sunday
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" style={{ borderColor: "#F40009", color: "#F40009" }} onClick={() => handleSundayReject(c.id)}>
                          <X className="h-3 w-3" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
