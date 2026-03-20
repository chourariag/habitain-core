import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ModuleWithProject = Tables<"modules"> & { projects: { name: string } | null };

const STAGES = [
  "Sub-Frame", "MEP Rough-In", "Insulation", "Drywall", "Paint",
  "MEP Final", "Windows & Doors", "Finishing", "QC Inspection", "Dispatch",
];

interface Props {
  modules: ModuleWithProject[];
  onRefresh: () => void;
}

export function ProductionKanban({ modules, onRefresh }: Props) {
  const [ncrModules, setNcrModules] = useState<Set<string>>(new Set());
  const [stageEntryDates, setStageEntryDates] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    // Fetch open NCRs per module
    supabase
      .from("ncr_register")
      .select("inspection_id,qc_inspections(module_id)")
      .eq("is_archived", false)
      .in("status", ["open", "critical_open"])
      .then(({ data }) => {
        const set = new Set<string>();
        (data ?? []).forEach((n: any) => {
          if (n.qc_inspections?.module_id) set.add(n.qc_inspections.module_id);
        });
        setNcrModules(set);
      });

    // Fetch stage entry dates from production_stages
    supabase
      .from("production_stages")
      .select("module_id,stage_name,created_at,status")
      .in("status", ["pending", "in_progress"])
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((s) => {
          if (s.created_at) map[s.module_id] = s.created_at;
        });
        setStageEntryDates(map);
      });
  }, [modules]);

  const getDaysInStage = (moduleId: string) => {
    const entry = stageEntryDates[moduleId];
    if (!entry) return 0;
    return Math.floor((Date.now() - new Date(entry).getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDaysBadgeColor = (days: number) => {
    if (days >= 3) return { bg: "#FFF0F0", color: "#F40009" };
    if (days >= 2) return { bg: "#FFF8E8", color: "#D4860A" };
    return { bg: "#F0FFF4", color: "#006039" };
  };

  const handleDragStart = (moduleId: string) => setDragging(moduleId);

  const handleDrop = async (targetStage: string) => {
    if (!dragging) return;
    const mod = modules.find((m) => m.id === dragging);
    if (!mod) return;

    const currentIdx = STAGES.indexOf(mod.current_stage ?? "Sub-Frame");
    const targetIdx = STAGES.indexOf(targetStage);

    if (targetIdx !== currentIdx + 1) {
      toast.error("Can only advance to the next stage");
      setDragging(null);
      return;
    }

    const { error } = await supabase
      .from("modules")
      .update({ current_stage: targetStage, updated_at: new Date().toISOString() })
      .eq("id", dragging);

    if (error) {
      toast.error("Failed to update stage");
    } else {
      // Insert production_stages entry
      await supabase.from("production_stages").insert({
        module_id: dragging,
        stage_name: targetStage,
        stage_order: targetIdx + 1,
        status: "in_progress",
      });
      toast.success(`Moved to ${targetStage}`);
      onRefresh();
    }
    setDragging(null);
  };

  const grouped = STAGES.map((stage) => ({
    stage,
    items: modules.filter((m) => (m.current_stage ?? "Sub-Frame") === stage),
  }));

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {grouped.map(({ stage, items }) => (
          <div
            key={stage}
            className="w-56 shrink-0 rounded-lg border border-border bg-card flex flex-col"
            style={{ minHeight: 200, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            {/* Column Header */}
            <div
              className="px-3 py-2.5 rounded-t-lg flex items-center justify-between"
              style={{ backgroundColor: "#006039" }}
            >
              <span className="text-xs font-semibold text-white truncate">{stage}</span>
              <span className="text-[10px] font-bold text-white/80 bg-white/20 rounded-full px-1.5 py-0.5">{items.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto" style={{ maxHeight: 420 }}>
              {items.map((m) => {
                const days = getDaysInStage(m.id);
                const badge = getDaysBadgeColor(days);
                const hasNCR = ncrModules.has(m.id);

                return (
                  <div
                    key={m.id}
                    draggable
                    onDragStart={() => handleDragStart(m.id)}
                    className="relative rounded-md border p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md bg-background"
                    style={{ borderColor: "#E5E7EB" }}
                  >
                    {hasNCR && (
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full"
                        style={{ backgroundColor: "#F40009" }}
                        title="Open NCR"
                      />
                    )}
                    <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
                      {m.module_code || m.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#666666" }}>
                      {m.projects?.name ?? "—"}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {days}d in stage
                      </span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-[11px] text-center py-4" style={{ color: "#999999" }}>No items</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
