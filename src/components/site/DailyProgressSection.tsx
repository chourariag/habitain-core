import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export interface PlannedActivity {
  activity_name: string;
  planned_target: string;
  actual_completion_pct: number;
  status: "completed" | "in_progress" | "not_started" | "blocked";
  reason_for_shortfall: string;
}

interface Props {
  projectId: string;
  activities: PlannedActivity[];
  onChange: (activities: PlannedActivity[]) => void;
  validationErrors: Record<number, string>;
}

const STATUS_OPTIONS: { value: PlannedActivity["status"]; label: string; color: string; bg: string }[] = [
  { value: "completed", label: "Completed", color: "#006039", bg: "#E8F2ED" },
  { value: "in_progress", label: "In Progress", color: "#D4860A", bg: "#FFF8E8" },
  { value: "not_started", label: "Not Started", color: "#666666", bg: "#F5F5F5" },
  { value: "blocked", label: "Blocked", color: "#F40009", bg: "#FDE8E8" },
];

export function DailyProgressSection({ projectId, activities, onChange, validationErrors }: Props) {
  const [loadedSchedule, setLoadedSchedule] = useState(false);

  // Try to pull planned activities from module schedule for today
  useEffect(() => {
    if (loadedSchedule || activities.length > 0) return;
    const loadPlanned = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: modules } = await supabase
        .from("modules")
        .select("id, name, module_code, current_stage")
        .eq("project_id", projectId)
        .eq("is_archived", false);

      if (modules?.length) {
        // Check module_schedule for activities with target dates matching today
        const moduleIds = modules.map((m) => m.id);
        const { data: schedules } = await (supabase.from("module_schedule") as any)
          .select("*")
          .in("module_id", moduleIds)
          .lte("target_start", today)
          .gte("target_end", today);

        if (schedules?.length) {
          const planned: PlannedActivity[] = schedules.map((s: any) => {
            const mod = modules.find((m) => m.id === s.module_id);
            return {
              activity_name: `${mod?.module_code || mod?.name || "Module"} — ${s.stage_name || s.stage}`,
              planned_target: s.target_end || today,
              actual_completion_pct: 0,
              status: "not_started" as const,
              reason_for_shortfall: "",
            };
          });
          onChange(planned);
        }
      }
      setLoadedSchedule(true);
    };
    loadPlanned();
  }, [projectId, loadedSchedule, activities.length, onChange]);

  const updateActivity = (idx: number, updates: Partial<PlannedActivity>) => {
    const updated = [...activities];
    updated[idx] = { ...updated[idx], ...updates };
    // Auto-set status based on completion
    if (updates.actual_completion_pct !== undefined) {
      if (updates.actual_completion_pct === 100) updated[idx].status = "completed";
      else if (updates.actual_completion_pct > 0) updated[idx].status = "in_progress";
    }
    onChange(updated);
  };

  const addActivity = () => {
    onChange([
      ...activities,
      { activity_name: "", planned_target: "", actual_completion_pct: 0, status: "not_started", reason_for_shortfall: "" },
    ]);
  };

  const removeActivity = (idx: number) => {
    onChange(activities.filter((_, i) => i !== idx));
  };

  const completedCount = activities.filter((a) => a.actual_completion_pct >= 75).length;
  const totalCount = activities.length;

  const summaryColor = totalCount === 0 ? "#666666" : completedCount === totalCount ? "#006039" : completedCount > 0 ? "#D4860A" : "#F40009";
  const summaryBg = totalCount === 0 ? "#F5F5F5" : completedCount === totalCount ? "#E8F2ED" : completedCount > 0 ? "#FFF8E8" : "#FDE8E8";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>
          Daily Progress — Planned vs Actual
        </label>
        <Button type="button" size="sm" variant="ghost" onClick={addActivity} className="text-xs h-6">
          <Plus className="h-3 w-3 mr-1" /> Add Activity
        </Button>
      </div>

      {activities.length === 0 && loadedSchedule && (
        <div className="rounded-md p-3 text-xs" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
          No planned activities found for today. Add manually.
        </div>
      )}

      {activities.map((activity, idx) => {
        const needsReason = activity.actual_completion_pct < 75 && activity.actual_completion_pct >= 0;
        const statusOpt = STATUS_OPTIONS.find((s) => s.value === activity.status);

        return (
          <div key={idx} className="border rounded-lg p-3 space-y-2" style={{ borderColor: "#E5E5E5", backgroundColor: "#FAFAFA" }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Activity name"
                  value={activity.activity_name}
                  onChange={(e) => updateActivity(idx, { activity_name: e.target.value })}
                  className="text-sm"
                  readOnly={loadedSchedule && activity.planned_target !== ""}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Completion:</span>
                  <Slider
                    value={[activity.actual_completion_pct]}
                    onValueChange={([v]) => updateActivity(idx, { actual_completion_pct: v })}
                    max={100}
                    step={25}
                    className="flex-1"
                  />
                  <span className="text-xs font-semibold w-10 text-right" style={{ color: activity.actual_completion_pct >= 75 ? "#006039" : "#D4860A" }}>
                    {activity.actual_completion_pct}%
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateActivity(idx, { status: opt.value })}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium border transition-all"
                      style={{
                        backgroundColor: activity.status === opt.value ? opt.bg : "transparent",
                        color: activity.status === opt.value ? opt.color : "#999",
                        borderColor: activity.status === opt.value ? opt.color : "#E5E5E5",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {needsReason && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium" style={{ color: "#F40009" }}>
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Reason for shortfall (required)
                    </label>
                    <Textarea
                      value={activity.reason_for_shortfall}
                      onChange={(e) => updateActivity(idx, { reason_for_shortfall: e.target.value })}
                      placeholder="e.g. Subcontractor did not arrive, Material not available, Weather delay, Design query pending"
                      rows={2}
                      className="text-sm"
                    />
                    {validationErrors[idx] && (
                      <p className="text-xs" style={{ color: "#F40009" }}>{validationErrors[idx]}</p>
                    )}
                  </div>
                )}
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => removeActivity(idx)} className="h-7 w-7 shrink-0">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}

      {totalCount > 0 && (
        <div className="rounded-md px-3 py-2 text-xs font-semibold" style={{ backgroundColor: summaryBg, color: summaryColor }}>
          Today: {completedCount} of {totalCount} planned activities completed.
        </div>
      )}
    </div>
  );
}

export function validatePlannedActivities(activities: PlannedActivity[]): { valid: boolean; errors: Record<number, string> } {
  const errors: Record<number, string> = {};
  activities.forEach((a, idx) => {
    if (a.actual_completion_pct < 75 && (!a.reason_for_shortfall || a.reason_for_shortfall.trim().length < 20)) {
      errors[idx] = `Please explain why "${a.activity_name || "this activity"}" was not completed (minimum 20 characters).`;
    }
  });
  return { valid: Object.keys(errors).length === 0, errors };
}
