import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Loader2, CheckCircle2, XCircle, Clock, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PRODUCTION_STAGES } from "@/components/projects/ProductionStageTracker";
import { PhotoGuidanceCard, PhotoFeedback, PhotoQualitySummary, usePhotoWithAI } from "@/components/photos/PhotoGuidance";

interface Props {
  moduleId: string;
  moduleName: string;
  moduleCode: string | null;
  currentStage: string | null;
  userRole: string | null;
}

export function SupervisorDailyLog({ moduleId, moduleName, moduleCode, currentStage, userRole }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [stageWorked, setStageWorked] = useState(currentStage || "");
  const [workCompleted, setWorkCompleted] = useState("");
  const [stageProgress, setStageProgress] = useState([50]);
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [issuesBlockers, setIssuesBlockers] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    photos: aiPhotos,
    guidanceCollapsed,
    addPhotos: addAIPhotos,
    removePhoto: removeAIPhoto,
    overridePhoto,
    retakePhoto,
    resetPhotos,
    anyChecking,
    qualityMeta,
  } = usePhotoWithAI("daily_log");

  const isSupervisor = ["factory_floor_supervisor", "production_head", "super_admin", "managing_director", "head_operations"].includes(userRole ?? "");
  const isReviewer = ["production_head", "super_admin", "managing_director", "head_operations"].includes(userRole ?? "");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("daily_production_logs")
      .select("*")
      .eq("module_id", moduleId)
      .order("log_date", { ascending: false })
      .limit(20);
    setLogs(data ?? []);
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - aiPhotos.length);
    if (files.length > 0) addAIPhotos(files);
  };

  const handleSubmit = async () => {
    if (!workCompleted.trim()) { toast.error("Work completed is required"); return; }
    if (aiPhotos.length < 1) { toast.error("At least 1 photo is required"); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const urls: string[] = [];
      for (const p of aiPhotos) {
        const path = `production/${moduleId}/${Date.now()}-${p.file.name}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, p.file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("daily_production_logs").insert({
        module_id: moduleId,
        stage_worked: stageWorked || currentStage || "Sub-Frame",
        work_completed: workCompleted.trim(),
        stage_progress: stageProgress[0],
        materials_used: materialsUsed.trim() || null,
        issues_blockers: issuesBlockers.trim() || null,
        photo_urls: urls,
        submitted_by: user.id,
      });
      if (error) throw error;

      toast.success("Daily log submitted for review");
      setWorkCompleted(""); setStageProgress([50]); setMaterialsUsed("");
      setIssuesBlockers(""); setPhotos([]); setPhotoPreviews([]);
      setShowForm(false);
      await loadLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (logId: string, action: "approved" | "returned") => {
    const comment = action === "returned" ? prompt("Enter review comment:") : null;
    if (action === "returned" && !comment) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("daily_production_logs")
        .update({
          status: action,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_comment: comment || null,
        })
        .eq("id", logId);
      if (error) throw error;

      toast.success(action === "approved" ? "Log approved" : "Log returned for revision");
      await loadLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to review");
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-primary text-primary-foreground text-[10px]">Approved</Badge>;
      case "returned": return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Returned</Badge>;
      default: return <Badge className="bg-warning text-warning-foreground text-[10px]">Pending Review</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Daily Production Logs</p>
        {isSupervisor && !showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> New Log
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-xs text-card-foreground">
              Daily Log — {format(new Date(), "dd/MM/yyyy")} · {moduleCode || moduleName}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Stage Worked On</label>
              <Select value={stageWorked} onValueChange={setStageWorked}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCTION_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Work Completed Today *</label>
              <Textarea value={workCompleted} onChange={(e) => setWorkCompleted(e.target.value)} placeholder="Describe work done..." rows={2} className="text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">% Stage Complete: {stageProgress[0]}%</label>
              <Slider value={stageProgress} onValueChange={setStageProgress} max={100} step={5} className="mt-2" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Materials Used (optional)</label>
              <Input value={materialsUsed} onChange={(e) => setMaterialsUsed(e.target.value)} placeholder="Materials consumed..." className="text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Issues / Blockers (optional)</label>
              <Textarea value={issuesBlockers} onChange={(e) => setIssuesBlockers(e.target.value)} rows={2} className="text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Photos (1–5) · {photos.length} added</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {photoPreviews.map((url, idx) => (
                  <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="h-14 w-14 rounded object-cover border border-border" />
                ))}
                {photos.length < 5 && (
                  <label className="h-14 w-14 rounded border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting || photos.length < 1} className="flex-1">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Submit Log
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No daily logs yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="border border-border rounded-md p-3 bg-background space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{format(new Date(log.log_date), "dd/MM/yyyy")}</span>
                  <span className="text-xs text-muted-foreground">{log.stage_worked}</span>
                </div>
                {statusBadge(log.status)}
              </div>
              <p className="text-xs text-foreground/80">{log.work_completed}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Progress: {log.stage_progress}%</span>
                {log.photo_urls?.length > 0 && <span>{log.photo_urls.length} photo(s)</span>}
              </div>
              {log.review_comment && (
                <p className="text-xs text-destructive bg-destructive/5 rounded p-1.5">💬 {log.review_comment}</p>
              )}
              {isReviewer && log.status === "pending_review" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => handleReview(log.id, "approved")} className="flex-1 text-xs gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleReview(log.id, "returned")} className="flex-1 text-xs gap-1 text-destructive border-destructive/30">
                    <XCircle className="h-3.5 w-3.5" /> Return
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
