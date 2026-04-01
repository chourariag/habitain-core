import { useState, useEffect, useCallback } from "react";
import { PhotoGuidanceCard, type PhotoCheckResult } from "@/components/photos/PhotoGuidance";
import { supabase } from "@/integrations/supabase/client";
import { insertNotifications } from "@/lib/notifications";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Minus,
  Loader2,
  Camera,
  AlertTriangle,
  FileText,
  Brain,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface QCInspectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
  /** Pre-select context */
  preselectedProjectId?: string;
  preselectedModuleId?: string;
}

interface ChecklistItem {
  id: string;
  item_number: number;
  description: string;
  stage_name: string;
  is_critical: boolean;
  sort_order: number;
}

interface ItemResult {
  result: "pass" | "fail" | "na" | null;
  notes: string;
  photoFile: File | null;
  photoPreview: string | null;
  photoChecking?: boolean;
  photoCheckResult?: PhotoCheckResult | null;
  photoOverridden?: boolean;
  photoCheckError?: boolean;
}

interface AIItemAnalysis {
  itemNumber: number;
  severity: string;
  rootCause: string;
  immediateAction: string;
  correctiveAction: string;
}

interface AIAnalysis {
  itemAnalysis: AIItemAnalysis[];
  stageDecision: string;
  summary: string;
}

const STEPS = [
  "Setup",
  "Checklist",
  "AI Analysis",
  "NCR Generation",
  "Report",
  "Complete",
];

export function QCInspectionWizard({
  open,
  onOpenChange,
  onCompleted,
  preselectedProjectId,
  preselectedModuleId,
}: QCInspectionWizardProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [projects, setProjects] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [panels, setPanels] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [inspectorName, setInspectorName] = useState("");
  const [inspectorId, setInspectorId] = useState("");

  // Step 2 state
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [itemResults, setItemResults] = useState<Record<string, ItemResult>>({});
  const [activeStage, setActiveStage] = useState<string>("");

  // Step 3 state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [editableAnalysis, setEditableAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Step 4 state
  const [generatedNCRs, setGeneratedNCRs] = useState<any[]>([]);

  // Step 5 state
  const [inspectionId, setInspectionId] = useState<string>("");

  // Load projects + inspector on open
  useEffect(() => {
    if (!open) return;
    setStep(0);
    resetState();
    loadInitialData();
  }, [open]);

  const resetState = () => {
    setSelectedProjectId(preselectedProjectId || "");
    setSelectedModuleId(preselectedModuleId || "");
    setSelectedPanelId("");
    setChecklistItems([]);
    setItemResults({});
    setAiAnalysis(null);
    setEditableAnalysis(null);
    setGeneratedNCRs([]);
    setInspectionId("");
  };

  const loadInitialData = async () => {
    const [projectsRes, userRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name")
        .eq("is_archived", false)
        .order("name"),
      supabase.auth.getUser(),
    ]);
    setProjects(projectsRes.data ?? []);

    if (userRes.data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("auth_user_id", userRes.data.user.id)
        .single();
      if (profile) {
        setInspectorName(profile.display_name || profile.email || "Inspector");
        setInspectorId(userRes.data.user.id);
      }
    }

    if (preselectedProjectId) {
      loadModules(preselectedProjectId);
    }
  };

  const loadModules = async (projectId: string) => {
    const { data } = await supabase
      .from("modules")
      .select("id, name, module_code, current_stage")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("created_at");
    setModules(data ?? []);
    if (preselectedModuleId && data?.some((m) => m.id === preselectedModuleId)) {
      loadPanels(preselectedModuleId);
    }
  };

  const loadPanels = async (moduleId: string) => {
    const { data } = await (supabase.from("panels" as any) as any)
      .select("id, panel_code, panel_type, length_mm, height_mm, current_stage")
      .eq("module_id", moduleId)
      .eq("is_archived", false)
      .order("created_at");
    setPanels(data ?? []);
  };

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    setSelectedModuleId("");
    setSelectedPanelId("");
    setModules([]);
    setPanels([]);
    loadModules(id);
  };

  const handleModuleChange = (id: string) => {
    setSelectedModuleId(id);
    setSelectedPanelId("");
    setPanels([]);
    loadPanels(id);
  };

  // Step 2: Load checklist for module's current stage
  const loadChecklist = async () => {
    const mod = modules.find((m) => m.id === selectedModuleId);
    const stage = mod?.current_stage || "Sub-Frame";
    setActiveStage(stage);

    const { data } = await supabase
      .from("qc_checklist_items")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    setChecklistItems(data ?? []);
    const results: Record<string, ItemResult> = {};
    (data ?? []).forEach((item) => {
      results[item.id] = { result: null, notes: "", photoFile: null, photoPreview: null };
    });
    setItemResults(results);
  };

  const stageItems = checklistItems.filter((item) => item.stage_name === activeStage);
  const allStages = [...new Set(checklistItems.map((i) => i.stage_name))];

  const stageProgress = stageItems.length > 0
    ? Math.round(
        (stageItems.filter((i) => itemResults[i.id]?.result !== null).length /
          stageItems.length) *
          100
      )
    : 0;

  const allStageItemsMarked = stageItems.every(
    (i) => itemResults[i.id]?.result !== null
  );

  const failedItems = stageItems.filter(
    (i) => itemResults[i.id]?.result === "fail"
  );

  const setResult = (itemId: string, result: "pass" | "fail" | "na") => {
    setItemResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], result },
    }));
  };

  const setNotes = (itemId: string, notes: string) => {
    setItemResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  const handlePhotoCapture = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setItemResults((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], photoFile: file, photoPreview: preview },
    }));
  };

  // Step 3: AI Analysis
  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      const panel = panels.find((p: any) => p.id === selectedPanelId);
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qc-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            failedItems: failedItems.map((item) => ({
              itemNumber: item.item_number,
              description: item.description,
              notes: itemResults[item.id]?.notes || "",
              isCritical: item.is_critical,
            })),
            panelDetails: panel
              ? {
                  panelCode: panel.panel_code,
                  panelType: panel.panel_type,
                  lengthMm: panel.length_mm,
                  heightMm: panel.height_mm,
                }
              : null,
            stageName: activeStage,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "AI analysis failed");
      }

      const analysis = await response.json();
      setAiAnalysis(analysis);
      setEditableAnalysis(JSON.parse(JSON.stringify(analysis)));
    } catch (err: any) {
      toast.error(err.message || "AI analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 4: Generate NCRs
  const generateNCRs = async () => {
    if (!editableAnalysis) return;
    const today = format(new Date(), "yyyyMMdd");
    const ncrs = failedItems.map((item, idx) => {
      const analysis = editableAnalysis.itemAnalysis.find(
        (a) => a.itemNumber === item.item_number
      );
      return {
        ncrNumber: `NCR-${today}-${String(idx + 1).padStart(3, "0")}`,
        checklistItemId: item.id,
        description: item.description,
        severity: analysis?.severity || "Minor",
        rootCause: analysis?.rootCause || "",
        immediateAction: analysis?.immediateAction || "",
        correctiveAction: analysis?.correctiveAction || "",
        notes: itemResults[item.id]?.notes || "",
      };
    });
    setGeneratedNCRs(ncrs);
  };

  // Step 5+6: Submit everything
  const submitInspection = async () => {
    setLoading(true);
    try {
      const { client } = await getAuthedClient();

      // 1. Upload photos
      const photoUrls: Record<string, string> = {};
      for (const item of stageItems) {
        const ir = itemResults[item.id];
        if (ir?.photoFile) {
          const path = `inspections/${Date.now()}-${item.id}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("qc-photos")
            .upload(path, ir.photoFile);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from("qc-photos")
              .getPublicUrl(path);
            photoUrls[item.id] = urlData.publicUrl;
          }
        }
      }

      // 2. Create inspection record
      const { data: inspection, error: inspErr } = await client
        .from("qc_inspections")
        .insert({
          module_id: selectedModuleId,
          inspector_id: inspectorId,
          stage_name: activeStage,
          status: "completed",
          submitted_at: new Date().toISOString(),
          ai_response: editableAnalysis as any,
          dispatch_decision: editableAnalysis?.stageDecision || null,
        })
        .select("id")
        .single();

      if (inspErr) throw inspErr;
      const newInspectionId = inspection.id;
      setInspectionId(newInspectionId);

      // 3. Create inspection items
      const inspectionItems = stageItems.map((item) => ({
        inspection_id: newInspectionId,
        checklist_item_id: item.id,
        result: itemResults[item.id]?.result || null,
        notes: itemResults[item.id]?.notes || null,
        photo_url: photoUrls[item.id] || null,
        ai_severity:
          editableAnalysis?.itemAnalysis.find(
            (a) => a.itemNumber === item.item_number
          )?.severity || null,
      }));

      const { error: itemsErr } = await client
        .from("qc_inspection_items")
        .insert(inspectionItems);
      if (itemsErr) throw itemsErr;

      // 4. Create NCRs
      for (const ncr of generatedNCRs) {
        await client.from("ncr_register").insert({
          inspection_id: newInspectionId,
          checklist_item_id: ncr.checklistItemId,
          ncr_number: ncr.ncrNumber,
          status: ncr.severity === "Critical" ? "critical_open" : "open",
          raised_by: inspectorId,
        });
      }

      // 5. Dispatch gate: if REWORK REQUIRED or any Critical NCR, lock module
      const hasCritical = generatedNCRs.some((n) => n.severity === "Critical");
      const isRework = editableAnalysis?.stageDecision === "REWORK REQUIRED";

      if (hasCritical || isRework) {
        await client
          .from("modules")
          .update({ production_status: "hold" } as any)
          .eq("id", selectedModuleId);
        toast.warning("Module locked — REWORK REQUIRED or Critical NCR found. Production head must close all NCRs before advancing.");
      }

      // 6. Notify production_head
      const { data: prodHeads } = await client
        .from("profiles")
        .select("auth_user_id")
        .eq("role", "production_head" as any)
        .eq("is_active", true);

      for (const ph of prodHeads ?? []) {
        await insertNotifications({
          recipient_id: ph.auth_user_id,
          title: "QC Inspection Complete",
          body: `QC Inspection completed for stage "${activeStage}" with ${generatedNCRs.length} NCR(s). Decision: ${editableAnalysis?.stageDecision || "N/A"}`,
          category: "production",
          related_table: "qc_inspection",
          related_id: newInspectionId,
        });
      }

      toast.success("QC Inspection submitted successfully!");
      setStep(5); // Complete
    } catch (err: any) {
      toast.error(err.message || "Failed to submit inspection");
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep0 = selectedProjectId && selectedModuleId && selectedPanelId;
  const canProceedStep1 = allStageItemsMarked;

  // Validate failed items have notes
  const failedWithoutNotes = failedItems.filter(
    (i) => !itemResults[i.id]?.notes?.trim()
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            QC Inspection — Step {step + 1} of {STEPS.length}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, idx) => (
            <div key={s} className="flex items-center shrink-0">
              {idx > 0 && (
                <div
                  className={`w-6 h-0.5 ${
                    idx <= step ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <div
                className={`px-2 py-1 rounded-full text-[10px] font-medium border ${
                  idx < step
                    ? "bg-success/20 text-success-foreground border-success/30"
                    : idx === step
                    ? "bg-primary/20 text-primary border-primary/30 ring-2 ring-primary/20"
                    : "bg-muted text-muted-foreground border-border opacity-50"
                }`}
              >
                {s}
              </div>
            </div>
          ))}
        </div>

        {/* Step 0: Setup */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">
                  Inspector
                </label>
                <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm text-foreground">
                  {inspectorName}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Date & Time
                </label>
                <div className="mt-1 px-3 py-2 rounded-md bg-muted text-sm text-foreground">
                  {format(new Date(), "dd MMM yyyy, HH:mm")}
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Project *
              </label>
              <Select
                value={selectedProjectId}
                onValueChange={handleProjectChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Module *
              </label>
              <Select
                value={selectedModuleId}
                onValueChange={handleModuleChange}
                disabled={!selectedProjectId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.module_code || m.name} — Stage: {m.current_stage || "N/A"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Panel *
              </label>
              <Select
                value={selectedPanelId}
                onValueChange={setSelectedPanelId}
                disabled={!selectedModuleId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select panel" />
                </SelectTrigger>
                <SelectContent>
                  {panels.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.panel_code} ({p.panel_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  loadChecklist();
                  setStep(1);
                }}
                disabled={!canProceedStep0}
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 1: Checklist */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Stage tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {allStages.map((stage) => {
                const isActive = stage === activeStage;
                return (
                  <button
                    key={stage}
                    disabled={!isActive}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border whitespace-nowrap ${
                      isActive
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {stage}
                  </button>
                );
              })}
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{stageProgress}%</span>
              </div>
              <Progress value={stageProgress} className="h-2" />
            </div>

            {/* Checklist items */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {stageItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No checklist items found for stage "{activeStage}". Add items in the QC Checklist management.
                </p>
              ) : (
                stageItems.map((item) => {
                  const ir = itemResults[item.id];
                  return (
                    <div
                      key={item.id}
                      className="border border-border rounded-lg p-3 space-y-2 bg-background"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{item.item_number}
                            </span>
                            {item.is_critical && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-destructive/20 text-destructive border-destructive/30"
                              >
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground mt-0.5">
                            {item.description}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant={ir?.result === "pass" ? "success" : "outline"}
                            className="h-8 w-8 p-0"
                            onClick={() => setResult(item.id, "pass")}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={ir?.result === "fail" ? "destructive" : "outline"}
                            className="h-8 w-8 p-0"
                            onClick={() => setResult(item.id, "fail")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={ir?.result === "na" ? "secondary" : "outline"}
                            className="h-8 w-8 p-0"
                            onClick={() => setResult(item.id, "na")}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {ir?.result === "fail" && (
                        <div className="space-y-2 pl-2 border-l-2 border-destructive/30">
                          <Textarea
                            placeholder="Describe the failure (required)..."
                            value={ir.notes}
                            onChange={(e) => setNotes(item.id, e.target.value)}
                            className="text-sm min-h-[60px]"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              <Camera className="h-3.5 w-3.5" />
                              {ir.photoFile ? "Change photo" : "Add photo (optional)"}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handlePhotoCapture(item.id, e)}
                              />
                            </label>
                            {ir.photoPreview && (
                              <img
                                src={ir.photoPreview}
                                alt="Capture"
                                className="h-10 w-10 rounded object-cover border border-border"
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {failedItems.length > 0 ? (
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1 || failedWithoutNotes.length > 0}
                >
                  {failedWithoutNotes.length > 0
                    ? `${failedWithoutNotes.length} failed item(s) need notes`
                    : "Next — AI Analysis"}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    // No failures — skip AI, NCR, go directly to submit
                    setEditableAnalysis({
                      itemAnalysis: [],
                      stageDecision: "PASS STAGE",
                      summary: "All checklist items passed.",
                    });
                    setGeneratedNCRs([]);
                    setStep(4); // go to report/submit
                  }}
                  disabled={!canProceedStep1}
                >
                  All Passed — Submit <Check className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 2: AI Analysis */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center py-4 space-y-3">
              <Brain className="h-10 w-10 mx-auto text-primary" />
              <div>
                <h3 className="font-semibold text-foreground">
                  AI Analysis Ready
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {failedItems.length} failed item(s) will be analyzed for severity, root cause, and recommended actions.
                </p>
              </div>
              {!aiAnalysis && (
                <Button onClick={runAIAnalysis} disabled={analyzing} size="lg">
                  {analyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Run AI Analysis
                    </>
                  )}
                </Button>
              )}
            </div>

            {editableAnalysis && (
              <div className="space-y-4">
                {/* Stage Decision */}
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Stage Decision
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <Select
                      value={editableAnalysis.stageDecision}
                      onValueChange={(val) =>
                        setEditableAnalysis((prev) =>
                          prev ? { ...prev, stageDecision: val } : prev
                        )
                      }
                    >
                      <SelectTrigger className="text-card-foreground bg-white/80 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PASS STAGE">PASS STAGE</SelectItem>
                        <SelectItem value="HOLD">HOLD</SelectItem>
                        <SelectItem value="REWORK REQUIRED">
                          REWORK REQUIRED
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      className="mt-2 text-sm text-card-foreground bg-white/80 border-border placeholder:text-muted-foreground"
                      value={editableAnalysis.summary}
                      onChange={(e) =>
                        setEditableAnalysis((prev) =>
                          prev ? { ...prev, summary: e.target.value } : prev
                        )
                      }
                      placeholder="Overall summary..."
                    />
                  </CardContent>
                </Card>

                {/* Item analyses */}
                {editableAnalysis.itemAnalysis.map((a, idx) => {
                  const item = failedItems.find(
                    (fi) => fi.item_number === a.itemNumber
                  );
                  return (
                    <Card key={idx}>
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm">
                          #{a.itemNumber}: {item?.description || "Item"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-4 pb-3 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Severity
                          </label>
                          <Select
                            value={a.severity}
                            onValueChange={(val) => {
                              const updated = [...editableAnalysis.itemAnalysis];
                              updated[idx] = { ...updated[idx], severity: val };
                              setEditableAnalysis({
                                ...editableAnalysis,
                                itemAnalysis: updated,
                              });
                            }}
                          >
                            <SelectTrigger className="mt-1 text-card-foreground bg-white/80 border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Critical">Critical</SelectItem>
                              <SelectItem value="Major">Major</SelectItem>
                              <SelectItem value="Minor">Minor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(["rootCause", "immediateAction", "correctiveAction"] as const).map(
                          (field) => (
                            <div key={field}>
                              <label className="text-xs font-medium text-muted-foreground capitalize">
                                {field.replace(/([A-Z])/g, " $1")}
                              </label>
                              <Textarea
                                className="mt-1 text-sm min-h-[50px] text-card-foreground bg-white/80 border-border placeholder:text-muted-foreground"
                                value={a[field]}
                                onChange={(e) => {
                                  const updated = [
                                    ...editableAnalysis.itemAnalysis,
                                  ];
                                  updated[idx] = {
                                    ...updated[idx],
                                    [field]: e.target.value,
                                  };
                                  setEditableAnalysis({
                                    ...editableAnalysis,
                                    itemAnalysis: updated,
                                  });
                                }}
                              />
                            </div>
                          )
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button
                    onClick={() => {
                      generateNCRs();
                      setStep(3);
                    }}
                  >
                    Generate NCRs <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: NCR Generation */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              Auto-Generated NCRs ({generatedNCRs.length})
            </h3>

            {generatedNCRs.map((ncr, idx) => (
              <Card key={idx}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="font-mono">{ncr.ncrNumber}</span>
                    <Badge
                      variant="outline"
                      className={
                        ncr.severity === "Critical"
                          ? "bg-destructive/20 text-destructive border-destructive/30"
                          : ncr.severity === "Major"
                          ? "bg-warning/20 text-warning-foreground border-warning/30"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {ncr.severity}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Issue:</span>{" "}
                    {ncr.description}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Root Cause:</span>{" "}
                    {ncr.rootCause}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Action:</span>{" "}
                    {ncr.immediateAction}
                  </p>
                </CardContent>
              </Card>
            ))}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(4)}>
                Review & Submit <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Report summary & submit */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Inspection Summary</h3>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Stage:</span>{" "}
                {activeStage}
              </p>
              <p>
                <span className="text-muted-foreground">Items Checked:</span>{" "}
                {stageItems.length}
              </p>
              <p>
                <span className="text-muted-foreground">Passed:</span>{" "}
                {stageItems.filter((i) => itemResults[i.id]?.result === "pass").length}
              </p>
              <p>
                <span className="text-muted-foreground">Failed:</span>{" "}
                {failedItems.length}
              </p>
              <p>
                <span className="text-muted-foreground">N/A:</span>{" "}
                {stageItems.filter((i) => itemResults[i.id]?.result === "na").length}
              </p>
              <p>
                <span className="text-muted-foreground">NCRs Generated:</span>{" "}
                {generatedNCRs.length}
              </p>
              <p className="font-semibold">
                <span className="text-muted-foreground">Decision:</span>{" "}
                <Badge
                  variant="outline"
                  className={
                    editableAnalysis?.stageDecision === "PASS STAGE"
                      ? "bg-success/20 text-success-foreground border-success/30"
                      : editableAnalysis?.stageDecision === "REWORK REQUIRED"
                      ? "bg-destructive/20 text-destructive border-destructive/30"
                      : "bg-warning/20 text-warning-foreground border-warning/30"
                  }
                >
                  {editableAnalysis?.stageDecision || "N/A"}
                </Badge>
              </p>
            </div>

            {(editableAnalysis?.stageDecision === "REWORK REQUIRED" ||
              generatedNCRs.some((n) => n.severity === "Critical")) && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  This module will be locked from advancing until all NCRs are closed by the Production Head.
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() =>
                  setStep(failedItems.length > 0 ? 3 : 1)
                }
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={submitInspection} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Inspection <Check className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 5 && (
          <div className="text-center py-8 space-y-4">
            <div className="h-16 w-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <Check className="h-8 w-8 text-success-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">
                Inspection Complete
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {generatedNCRs.length > 0
                  ? `${generatedNCRs.length} NCR(s) have been sent to the Production Head.`
                  : "All items passed. No NCRs generated."}
              </p>
              {editableAnalysis?.stageDecision && (
                <Badge
                  variant="outline"
                  className={`mt-3 ${
                    editableAnalysis.stageDecision === "PASS STAGE"
                      ? "bg-success/20 text-success-foreground border-success/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }`}
                >
                  {editableAnalysis.stageDecision}
                </Badge>
              )}
            </div>
            <Button
              onClick={() => {
                onOpenChange(false);
                onCompleted();
              }}
            >
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
