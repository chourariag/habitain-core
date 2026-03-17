import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AddPanelDialog } from "./AddPanelDialog";
import { ProductionStageTracker } from "./ProductionStageTracker";
import { SiteReadinessChecklist } from "@/components/site/SiteReadinessChecklist";
import { DispatchLogForm } from "@/components/site/DispatchLogForm";
import { InstallationChecklist } from "@/components/site/InstallationChecklist";

interface Panel {
  id: string;
  panel_code: string;
  panel_type: string;
  length_mm: number | null;
  height_mm: number | null;
  production_status: string | null;
  current_stage: string | null;
}

interface Module {
  id: string;
  name: string;
  module_code: string | null;
  module_type: string;
  production_status: string | null;
  current_stage: string | null;
}

interface Props {
  module: Module;
  panels: Panel[];
  projectId: string;
  canEdit: boolean;
  canAdvanceStage: boolean;
  userRole: string | null;
  onPanelCreated: () => void;
  onStageAdvanced: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  standard: "Standard Module",
  bathroom_pod: "Bathroom Pod",
  other_pod: "Other Pod",
};

const STATUS_BADGE: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  completed: "bg-success/20 text-success-foreground",
  hold: "bg-destructive/20 text-destructive",
  dispatched: "bg-accent/20 text-accent-foreground",
};

export function ModulePanelCard({ module, panels, projectId, canEdit, canAdvanceStage, userRole, onPanelCreated, onStageAdvanced }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [siteReady, setSiteReady] = useState(false);
  const isDispatched = module.production_status === "dispatched" || module.current_stage === "Dispatch";
  const isAtDispatchStage = module.current_stage === "Dispatch";

  // Check site readiness status
  useEffect(() => {
    if (!expanded) return;
    (async () => {
      const { data } = await (supabase.from("site_readiness" as any) as any)
        .select("is_complete")
        .eq("module_id", module.id)
        .eq("is_complete", true)
        .limit(1);
      setSiteReady((data as any[])?.length > 0);
    })();
  }, [expanded, module.id]);

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      {/* Module header */}
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{module.module_code ?? "—"}</span>
            <span className="font-semibold text-foreground">{module.name}</span>
            {module.module_type === "bathroom_pod" && (
              <Badge variant="outline" className="bg-accent/40 text-accent-foreground text-xs">Pod</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {TYPE_LABELS[module.module_type] ?? module.module_type} · {panels.length} panel{panels.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant="outline" className={STATUS_BADGE[module.production_status ?? "not_started"] ?? STATUS_BADGE.not_started}>
          {(module.production_status ?? "not_started").replace(/_/g, " ")}
        </Badge>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Production Stage Tracker */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Production Progress</p>
            <ProductionStageTracker
              moduleId={module.id}
              projectId={projectId}
              currentStage={module.current_stage}
              productionStatus={module.production_status}
              canAdvance={canAdvanceStage}
              onAdvanced={onStageAdvanced}
            />
          </div>

          {/* Site Readiness — show at Dispatch stage */}
          {isAtDispatchStage && !isDispatched && (
            <SiteReadinessChecklist
              moduleId={module.id}
              userRole={userRole}
              onReadinessConfirmed={() => setSiteReady(true)}
            />
          )}

          {/* Dispatch Log — show at Dispatch stage after site readiness */}
          {isAtDispatchStage && !isDispatched && (
            <DispatchLogForm
              moduleId={module.id}
              moduleCode={module.module_code}
              userRole={userRole}
              siteReady={siteReady}
              onDispatched={onStageAdvanced}
            />
          )}

          {/* Installation Checklist — show after dispatch */}
          {isDispatched && (
            <InstallationChecklist
              moduleId={module.id}
              userRole={userRole}
              onComplete={onStageAdvanced}
            />
          )}

          {/* Panels section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Panels</p>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setAddPanelOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Panel
                </Button>
              )}
            </div>

            {panels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No panels yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {panels.map((p) => (
                  <div key={p.id} className="border border-border rounded-md p-3 bg-background space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-foreground">{p.panel_code}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[p.production_status ?? "not_started"] ?? STATUS_BADGE.not_started}`}>
                        {(p.production_status ?? "not_started").replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{p.panel_type}</p>
                    {(p.length_mm || p.height_mm) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {p.length_mm ?? "—"} × {p.height_mm ?? "—"} mm
                      </p>
                    )}
                    {p.current_stage && (
                      <p className="text-[10px] text-muted-foreground truncate">{p.current_stage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <AddPanelDialog
              open={addPanelOpen}
              onOpenChange={setAddPanelOpen}
              moduleId={module.id}
              onCreated={onPanelCreated}
            />
          )}
        </div>
      )}
    </div>
  );
}
