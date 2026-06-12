import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, X, Minus, Loader2, Camera, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
  preselectedProjectId?: string;
  preselectedModuleId?: string;
  userId: string | null;
}

interface Definition {
  id: string;
  construction_type: string;
  stage_id: string;
  stage_label: string;
  item_order: number;
  check_category: string | null;
  check_text: string;
  standard_specification: string | null;
  checked_by_role: string | null;
  evidence_required: string | null;
  pass_criteria: string | null;
  severity: string | null;
}

type Result = "pass" | "fail" | "na" | null;
interface ItemState {
  result: Result;
  notes: string;
  photoFile: File | null;
  photoPreview: string | null;
}

export function SOPInspectionWizard({
  open, onOpenChange, onCompleted, preselectedProjectId, preselectedModuleId, userId,
}: Props) {
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [defs, setDefs] = useState<Definition[]>([]);
  const [projectId, setProjectId] = useState(preselectedProjectId || "");
  const [moduleId, setModuleId] = useState(preselectedModuleId || "");
  const [stageId, setStageId] = useState("");
  const [state, setState] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedProject = projects.find((p) => p.id === projectId);
  const constructionType = selectedProject?.construction_type || "modular";

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setProjectId(preselectedProjectId || "");
      setModuleId(preselectedModuleId || "");
      setStageId("");
      setState({});
    }
  }, [open, preselectedProjectId, preselectedModuleId]);

  // Load projects
  useEffect(() => {
    if (!open) return;
    supabase
      .from("projects")
      .select("id, name, construction_type, project_code")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .then(({ data }) => setProjects(data ?? []));
  }, [open]);

  // Load modules for project
  useEffect(() => {
    if (!projectId) { setModules([]); return; }
    supabase
      .from("modules")
      .select("id, name, module_code, current_stage")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("module_code", { ascending: true })
      .then(({ data }) => setModules(data ?? []));
  }, [projectId]);

  // Load SOP definitions for construction type + 'both'
  useEffect(() => {
    if (!open || !constructionType) return;
    setLoading(true);
    (supabase.from("qc_checklist_definitions") as any)
      .select("*")
      .in("construction_type", [constructionType, "both"])
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("stage_id", { ascending: true })
      .order("item_order", { ascending: true })
      .then(({ data }: any) => { setDefs(data ?? []); setLoading(false); });
  }, [open, constructionType]);

  // Stage list — distinct stage_id + label
  const stages = useMemo(() => {
    const seen = new Map<string, string>();
    defs.forEach((d) => { if (!seen.has(d.stage_id)) seen.set(d.stage_id, d.stage_label); });
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [defs]);

  // Items for selected stage + common checks
  const stageItems = useMemo(() => {
    if (!stageId) return [];
    return defs.filter((d) => d.stage_id === stageId);
  }, [defs, stageId]);
  const commonItems = useMemo(() => defs.filter((d) => d.construction_type === "both"), [defs]);

  // Items to inspect = stage items (excluding common which we add at the end if not already a common stage)
  const inspectItems = useMemo(() => {
    if (!stageId) return [];
    const isCommon = stageId.startsWith("COMMON_");
    if (isCommon) return stageItems;
    // dedupe by id
    const map = new Map<string, Definition>();
    stageItems.forEach((d) => map.set(d.id, d));
    commonItems.forEach((d) => map.set(d.id, d));
    return Array.from(map.values());
  }, [stageItems, commonItems, stageId]);

  const setItem = useCallback((id: string, patch: Partial<ItemState>) => {
    setState((prev) => {
      const cur = prev[id] || { result: null, notes: "", photoFile: null, photoPreview: null };
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  }, []);

  const handlePhoto = useCallback((id: string, file: File | null) => {
    if (!file) { setItem(id, { photoFile: null, photoPreview: null }); return; }
    const reader = new FileReader();
    reader.onloadend = () => setItem(id, { photoFile: file, photoPreview: reader.result as string });
    reader.readAsDataURL(file);
  }, [setItem]);

  // Progress
  const total = inspectItems.length;
  const completed = inspectItems.filter((d) => state[d.id]?.result).length;
  const failCount = inspectItems.filter((d) => state[d.id]?.result === "fail").length;
  const naCount = inspectItems.filter((d) => state[d.id]?.result === "na").length;
  const passCount = inspectItems.filter((d) => state[d.id]?.result === "pass").length;
  const progress = total ? Math.round((completed / total) * 100) : 0;

  // Validation: all items must have a result; fails need notes + photo
  const canSubmit = useMemo(() => {
    if (!total || completed < total) return false;
    return inspectItems.every((d) => {
      const s = state[d.id];
      if (!s?.result) return false;
      if (s.result === "fail" && (!s.notes.trim() || !s.photoFile)) return false;
      return true;
    });
  }, [inspectItems, state, total, completed]);

  async function uploadPhoto(file: File, inspectionId: string, defId: string): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `sop/${inspectionId}/${defId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("qc-photos").upload(path, file, { upsert: false });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from("qc-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit() {
    if (!canSubmit || !userId || !moduleId || !stageId) return;
    setSubmitting(true);
    try {
      const { client } = await getAuthedClient();
      const stageLabel = stages.find((s) => s.id === stageId)?.label || stageId;
      const { data: insp, error: e1 } = await (client.from("qc_inspections") as any)
        .insert({
          module_id: moduleId,
          inspector_id: userId,
          project_id: projectId,
          construction_type: constructionType,
          stage_id: stageId,
          stage_label: stageLabel,
          stage_name: stageLabel,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          sop_pass_count: passCount,
          sop_fail_count: failCount,
          sop_na_count: naCount,
        })
        .select()
        .single();
      if (e1 || !insp) throw e1 || new Error("Failed to create inspection");

      const rows: any[] = [];
      for (const def of inspectItems) {
        const s = state[def.id];
        let photoUrl: string | null = null;
        if (s.photoFile) photoUrl = await uploadPhoto(s.photoFile, insp.id, def.id);
        rows.push({
          inspection_id: insp.id,
          definition_id: def.id,
          checklist_item_id: null,
          result: s.result,
          notes: s.notes || null,
          photo_url: photoUrl,
          check_text_snapshot: def.check_text,
          severity_snapshot: def.severity,
        });
      }
      const { error: e2 } = await (client.from("qc_inspection_items") as any).insert(rows);
      if (e2) throw e2;

      toast.success(`Inspection submitted — ${passCount} pass, ${failCount} fail, ${naCount} N/A`);
      onCompleted();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit inspection");
    } finally {
      setSubmitting(false);
    }
  }

  const sevColor = (sev: string | null) =>
    sev === "Critical" ? "hsl(0 80% 45%)" :
    sev === "Major" ? "hsl(35 90% 40%)" :
    "hsl(155 30% 40%)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SOP Quality Inspection</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {step === 1 ? "Select project & module" : step === 2 ? "Select stage" : "Inspect items"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_code ? `${p.project_code} — ` : ""}{p.name}
                      <Badge variant="outline" className="ml-2 text-[10px]">{p.construction_type || "modular"}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Module / Unit</Label>
              <Select value={moduleId} onValueChange={setModuleId} disabled={!projectId}>
                <SelectTrigger><SelectValue placeholder={projectId ? "Select module" : "Pick project first"} /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.module_code || m.name} {m.current_stage ? ` · ${m.current_stage}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!projectId || !moduleId} onClick={() => setStep(2)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Construction type: <Badge variant="outline">{constructionType}</Badge> · {defs.length} SOP items loaded ({stages.length} stages)
            </p>
            <div>
              <Label>Inspection Stage</Label>
              {loading ? (
                <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-mono text-[10px] mr-2">{s.id}</span>{s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {stageId && !stageId.startsWith("COMMON_") && (
              <p className="text-xs text-muted-foreground">
                Plus {commonItems.length} common checks (documentation, safety, handover) will be appended.
              </p>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              <Button disabled={!stageId} onClick={() => setStep(3)}>
                Start inspection ({inspectItems.length} items) <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="sticky top-0 bg-background pb-3 z-10 border-b">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {completed}/{total} checked · <span className="text-green-700">{passCount} pass</span> · <span className="text-red-600">{failCount} fail</span> · <span className="text-muted-foreground">{naCount} N/A</span>
                </p>
                <Badge variant="outline">{stages.find((s) => s.id === stageId)?.label}</Badge>
              </div>
              <Progress value={progress} />
            </div>

            <div className="space-y-3">
              {inspectItems.map((d, idx) => {
                const s = state[d.id] || { result: null, notes: "", photoFile: null, photoPreview: null };
                const isCommon = d.construction_type === "both";
                return (
                  <Card key={d.id} className={s.result === "fail" ? "border-red-300" : s.result === "pass" ? "border-green-300" : ""}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono mt-0.5 text-muted-foreground">{idx + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{d.check_text}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {d.severity && (
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: sevColor(d.severity), color: sevColor(d.severity) }}>
                                {d.severity}
                              </Badge>
                            )}
                            {d.check_category && <Badge variant="secondary" className="text-[10px]">{d.check_category}</Badge>}
                            {isCommon && <Badge variant="outline" className="text-[10px]">Common</Badge>}
                            {d.checked_by_role && <span className="text-[10px] text-muted-foreground">By: {d.checked_by_role}</span>}
                          </div>
                          {(d.standard_specification || d.pass_criteria || d.evidence_required) && (
                            <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                              {d.standard_specification && <p><span className="font-semibold">Spec:</span> {d.standard_specification}</p>}
                              {d.pass_criteria && <p><span className="font-semibold">Pass:</span> {d.pass_criteria}</p>}
                              {d.evidence_required && <p><span className="font-semibold">Evidence:</span> {d.evidence_required}</p>}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant={s.result === "pass" ? "default" : "outline"}
                          className={s.result === "pass" ? "bg-green-600 hover:bg-green-700" : ""}
                          onClick={() => setItem(d.id, { result: "pass" })}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Pass
                        </Button>
                        <Button size="sm" variant={s.result === "fail" ? "default" : "outline"}
                          className={s.result === "fail" ? "bg-red-600 hover:bg-red-700" : ""}
                          onClick={() => setItem(d.id, { result: "fail" })}>
                          <X className="h-3.5 w-3.5 mr-1" /> Fail
                        </Button>
                        <Button size="sm" variant={s.result === "na" ? "default" : "outline"}
                          onClick={() => setItem(d.id, { result: "na" })}>
                          <Minus className="h-3.5 w-3.5 mr-1" /> N/A
                        </Button>
                      </div>

                      {(s.result === "fail" || s.result === "na") && (
                        <div className="space-y-2 pt-1">
                          <Textarea
                            placeholder={s.result === "fail" ? "Describe the issue (required)" : "Reason for N/A (optional)"}
                            value={s.notes}
                            onChange={(e) => setItem(d.id, { notes: e.target.value })}
                            className="text-sm"
                            rows={2}
                          />
                          {s.result === "fail" && (
                            <div>
                              <label className="cursor-pointer inline-flex items-center gap-2 text-sm border rounded-md px-3 py-1.5 hover:bg-muted">
                                <Camera className="h-3.5 w-3.5" />
                                {s.photoFile ? "Change photo" : "Upload photo (required)"}
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                  onChange={(e) => handlePhoto(d.id, e.target.files?.[0] || null)} />
                              </label>
                              {s.photoPreview && (
                                <img src={s.photoPreview} alt="Evidence" className="mt-2 max-h-32 rounded border" />
                              )}
                              {!s.photoFile && (
                                <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Photo required for failed checks
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-between sticky bottom-0 bg-background pt-3 border-t">
              <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                Submit inspection
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
