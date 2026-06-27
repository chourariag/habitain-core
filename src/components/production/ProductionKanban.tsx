import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { getPhaseForStage } from "@/lib/production-phases";
import { getStagesForSystem, type ProductionSystem } from "@/lib/production-systems";
import { evaluateStageGate, requiredGfcForStage, type GateContext } from "@/lib/stage-gates";
import { StageWastageDialog, type WastagePayload } from "./StageWastageDialog";
import { Lock } from "lucide-react";

type ModuleWithProject = Tables<"modules"> & { projects: { name: string } | null };

interface Props {
  modules: ModuleWithProject[];
  onRefresh: () => void;
  productionSystem?: ProductionSystem | null;
}

interface StageRow {
  id: string;
  module_id: string;
  stage_name: string;
  stage_order: number;
  status: string | null;
  created_at: string | null;
}

export function ProductionKanban({ modules, onRefresh, productionSystem }: Props) {
  const STAGES = getStagesForSystem(productionSystem ?? null) as readonly string[];
  const [ncrModules, setNcrModules] = useState<Set<string>>(new Set());
  const [stagesByModule, setStagesByModule] = useState<Record<string, StageRow[]>>({});
  const [gfcByProject, setGfcByProject] = useState<Record<string, Set<"H1" | "H2" | "H3">>>({});
  const [setupByProject, setSetupByProject] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [wastageDialog, setWastageDialog] = useState<{
    moduleId: string; fromStage: string; toStage: string; toIdx: number;
  } | null>(null);

  const projectIds = useMemo(
    () => Array.from(new Set(modules.map((m) => m.project_id))),
    [modules]
  );
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);

  useEffect(() => {
    // Open NCRs per module
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

    if (moduleIds.length === 0) { setStagesByModule({}); return; }
    supabase
      .from("production_stages")
      .select("id, module_id, stage_name, stage_order, status, created_at")
      .in("module_id", moduleIds)
      .eq("is_archived", false)
      .order("stage_order", { ascending: true })
      .then(({ data }) => {
        const map: Record<string, StageRow[]> = {};
        ((data as StageRow[] | null) ?? []).forEach((s) => {
          (map[s.module_id] ??= []).push(s);
        });
        setStagesByModule(map);
      });
  }, [moduleIds.join(",")]);

  useEffect(() => {
    if (projectIds.length === 0) { setGfcByProject({}); setSetupByProject({}); return; }
    supabase
      .from("gfc_records")
      .select("project_id, gfc_stage")
      .in("project_id", projectIds)
      .then(({ data }) => {
        const map: Record<string, Set<"H1" | "H2" | "H3">> = {};
        (data ?? []).forEach((r: any) => {
          const code = r.gfc_stage === "advance_h1" ? "H1"
            : r.gfc_stage === "final_h2" ? "H2"
            : r.gfc_stage === "interior_h3" ? "H3" : null;
          if (!code) return;
          (map[r.project_id] ??= new Set()).add(code);
        });
        setGfcByProject(map);
      });
    supabase
      .from("projects")
      .select("id, project_setup_approved")
      .in("id", projectIds)
      .then(({ data }) => {
        const m: Record<string, boolean> = {};
        (data ?? []).forEach((p: any) => { m[p.id] = !!p.project_setup_approved; });
        setSetupByProject(m);
      });
  }, [projectIds.join(",")]);

  const stageEntryDates = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(stagesByModule).forEach((rows) => {
      rows.forEach((s) => {
        if ((s.status === "pending" || s.status === "in_progress") && s.created_at) {
          map[s.module_id] = s.created_at;
        }
      });
    });
    return map;
  }, [stagesByModule]);

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

  // Gate context for a given module
  const gateCtx = (mod: ModuleWithProject): GateContext => ({
    approvedGfc: gfcByProject[mod.project_id] ?? new Set(),
    projectSetupApproved: setupByProject[mod.project_id] ?? false,
    moduleStages: stagesByModule[mod.id] ?? [],
  });

  // Determine if a column/stage is locked for any module (banner display).
  // For column-level banner, base it on first module in column.
  const columnLockReason = (stage: string, items: ModuleWithProject[]) => {
    if (items.length === 0) {
      // generic: check just GFC + setup using first project in modules
      const anyMod = modules[0];
      if (!anyMod) return null;
      const res = evaluateStageGate(stage, gateCtx(anyMod));
      return res.allowed ? null : res.reason ?? null;
    }
    const res = evaluateStageGate(stage, gateCtx(items[0]));
    return res.allowed ? null : res.reason ?? null;
  };

  const handleDragStart = (moduleId: string) => setDragging(moduleId);

  const handleDrop = async (targetStage: string) => {
    if (!dragging) return;
    const mod = modules.find((m) => m.id === dragging);
    if (!mod) { setDragging(null); return; }

    const currentStage = mod.current_stage ?? STAGES[0];
    const currentIdx = STAGES.indexOf(currentStage);
    const targetIdx = STAGES.indexOf(targetStage);

    if (targetIdx !== currentIdx + 1) {
      toast.error("Can only advance to the next stage");
      setDragging(null);
      return;
    }

    const gate = evaluateStageGate(targetStage, gateCtx(mod));
    if (!gate.allowed) {
      toast.error(gate.reason ?? "Stage is locked");
      setDragging(null);
      return;
    }

    // Open wastage dialog for the CURRENT (about-to-close) stage
    setWastageDialog({
      moduleId: mod.id,
      fromStage: currentStage,
      toStage: targetStage,
      toIdx: targetIdx,
    });
    setDragging(null);
  };

  const handleWastageSubmit = async (payload: WastagePayload) => {
    if (!wastageDialog) return;
    const { moduleId, fromStage, toStage, toIdx } = wastageDialog;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const user = (await supabase.auth.getUser()).data.user;

    // 1) Record wastage
    const { error: wErr } = await supabase.from("stage_wastage").insert({
      project_id: mod.project_id,
      module_id: moduleId,
      stage_name: fromStage,
      material_category: payload.material_category,
      qty_issued: payload.qty_issued,
      qty_consumed: payload.qty_consumed,
      notes: payload.notes || null,
      flag_level: payload.flag_level,
      recorded_by: user?.id,
    });
    if (wErr) { toast.error("Failed to record wastage"); return; }

    // 2) Close current stage
    const currentRow = (stagesByModule[moduleId] ?? []).find((s) => s.stage_name === fromStage);
    if (currentRow) {
      await supabase
        .from("production_stages")
        .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: user?.id ?? null })
        .eq("id", currentRow.id);
    }

    // 3) Advance module + insert new stage in_progress
    const { error: mErr } = await supabase
      .from("modules")
      .update({ current_stage: toStage, updated_at: new Date().toISOString() })
      .eq("id", moduleId);
    if (mErr) { toast.error("Failed to update module"); return; }

    await supabase.from("production_stages").insert({
      module_id: moduleId,
      stage_name: toStage,
      stage_order: toIdx + 1,
      status: "in_progress",
    });

    // 4) Notify on flag
    if (payload.flag_level !== "green") {
      const roles = payload.flag_level === "red"
        ? ["production_head", "planning_head"]
        : ["production_head"];
      const { data: recipients } = await supabase
        .from("profiles")
        .select("auth_user_id")
        .in("role", roles as any)
        .eq("is_active", true);
      const title = `${payload.flag_level === "red" ? "🚩 Red" : "⚠️ Amber"} Wastage — ${fromStage}`;
      const body = `${payload.wastage_percent}% wastage on ${payload.material_category} (${mod.module_code || mod.name})`;
      const notifs = (recipients ?? [])
        .filter((r: any) => r.auth_user_id)
        .map((r: any) => ({
          recipient_id: r.auth_user_id,
          type: "wastage_flag",
          category: "production",
          title,
          body,
          content: body,
          navigate_to: "/production",
        }));
      if (notifs.length) await supabase.from("notifications").insert(notifs);
    }

    toast.success(`Stage closed — moved to ${toStage}`);
    setWastageDialog(null);
    onRefresh();
  };

  const grouped = STAGES.map((stage) => ({
    stage,
    items: modules.filter((m) => (m.current_stage ?? STAGES[0]) === stage),
  }));

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {grouped.map(({ stage, items }) => {
            const lockReason = columnLockReason(stage, items);
            const need = requiredGfcForStage(stage);
            return (
              <div
                key={stage}
                className="w-56 shrink-0 rounded-lg border border-border bg-card flex flex-col"
                style={{ minHeight: 200, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                <div className="px-3 py-2 rounded-t-lg" style={{ backgroundColor: "#006039" }}>
                  <div className="text-[9px] font-medium uppercase tracking-wide text-white/70 truncate">
                    {getPhaseForStage(stage, productionSystem ?? null)}
                    {need && <span className="ml-1">· Requires {need}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs font-semibold text-white truncate">{stage}</span>
                    <span className="text-[10px] font-bold text-white/80 bg-white/20 rounded-full px-1.5 py-0.5">{items.length}</span>
                  </div>
                </div>

                {lockReason && (
                  <div
                    className="px-2 py-1.5 text-[10px] flex items-start gap-1"
                    style={{ background: "#FFF8E8", color: "#8B5A00", borderBottom: "1px solid #F1E5C2" }}
                  >
                    <Lock className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{lockReason}</span>
                  </div>
                )}

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
            );
          })}
        </div>
      </div>

      <StageWastageDialog
        open={!!wastageDialog}
        stageName={wastageDialog?.fromStage ?? ""}
        onClose={() => setWastageDialog(null)}
        onSubmit={handleWastageSubmit}
      />
    </>
  );
}
