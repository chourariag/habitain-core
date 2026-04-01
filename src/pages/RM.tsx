import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Wrench, Camera, X, Image as ImageIcon, Search, RefreshCw, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PhotoGuidanceCard, PhotoFeedback, PhotoQualitySummary, usePhotoWithAI } from "@/components/photos/PhotoGuidance";

/* ─── AI Analysis Types ─── */
interface AIAnalysis {
  summary: string;
  root_cause: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  severity_reason: string;
  immediate_action: string;
  complexity: "Simple" | "Moderate" | "Complex";
  materials_needed: string[];
}

const SEVERITY_STYLE: Record<string, string> = {
  Critical: "bg-[#F40009] text-white",
  High: "bg-[#F40009]/70 text-white",
  Medium: "bg-[#D4860A] text-white",
  Low: "bg-[#006039] text-white",
};

const COMPLEXITY_STYLE: Record<string, string> = {
  Simple: "bg-[#006039] text-white",
  Moderate: "bg-[#D4860A] text-white",
  Complex: "bg-[#F40009] text-white",
};

/* ─── AI Report Card ─── */
function AIReportCard({ analysis, generatedAt, onRegenerate, onCopy, analysing }: {
  analysis: AIAnalysis;
  generatedAt: string;
  onRegenerate: () => void;
  onCopy: () => void;
  analysing: boolean;
}) {
  const actionBullets = analysis.immediate_action
    .split(/\n|•/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="border rounded-lg p-4 space-y-4" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F7F7" }}>
      <div>
        <h4 className="font-bold text-sm" style={{ fontFamily: "Montserrat, sans-serif", color: "#1A1A1A" }}>AI Analysis Report</h4>
        <p className="text-[10px]" style={{ color: "#999999" }}>Generated {format(new Date(generatedAt), "dd MMM yyyy, HH:mm")}</p>
        <p className="text-[10px] italic" style={{ color: "#999999" }}>Advisory only — final assessment by R&M Manager</p>
      </div>

      {/* 1. Summary */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Issue Summary</p>
        <p className="text-[13px]" style={{ color: "#1A1A1A" }}>{analysis.summary}</p>
      </div>

      {/* 2. Root Cause */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Likely Root Cause</p>
        <p className="text-[13px]" style={{ color: "#1A1A1A" }}>{analysis.root_cause}</p>
      </div>

      {/* 3. Severity */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Severity</p>
        <Badge className={SEVERITY_STYLE[analysis.severity] ?? "bg-muted"}>{analysis.severity}</Badge>
        <p className="text-[11px] mt-1" style={{ color: "#999999" }}>{analysis.severity_reason}</p>
      </div>

      {/* 4. Immediate Action */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Recommended Immediate Action</p>
        <ul className="list-disc list-inside text-[13px] space-y-0.5" style={{ color: "#1A1A1A" }}>
          {actionBullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      </div>

      {/* 5. Complexity */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Repair Complexity</p>
        <Badge className={COMPLEXITY_STYLE[analysis.complexity] ?? "bg-muted"}>{analysis.complexity}</Badge>
      </div>

      {/* 6. Materials */}
      <div>
        <p className="text-[11px] font-bold uppercase" style={{ color: "#006039", fontFamily: "Montserrat, sans-serif" }}>Materials Likely Needed</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {analysis.materials_needed.map((m, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-[12px]" style={{ backgroundColor: "#F7F7F7", border: "1px solid #E0E0E0", color: "#1A1A1A" }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={analysing} className="flex-1" style={{ borderColor: "#006039", color: "#006039" }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate
        </Button>
        <Button variant="outline" size="sm" onClick={onCopy} className="flex-1" style={{ borderColor: "#006039", color: "#006039" }}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy Report
        </Button>
      </div>

      <p className="text-[10px] italic text-center" style={{ color: "#999999" }}>
        AI analysis is advisory only. Final assessment and decision must be made by the R&M Manager.
      </p>
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-warning text-warning-foreground",
  pending_estimate: "bg-primary/20 text-primary",
  pending_schedule: "bg-primary/20 text-primary",
  scheduled: "bg-accent text-accent-foreground",
  in_progress: "bg-accent text-accent-foreground",
  closed: "bg-muted text-muted-foreground",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  standard: "bg-warning text-warning-foreground",
  cosmetic: "bg-muted text-muted-foreground",
};

const CAN_RAISE = ["super_admin", "managing_director", "site_installation_mgr", "site_engineer", "delivery_rm_lead", "head_operations", "production_head", "sales_director"];
const CAN_ESTIMATE = ["costing_engineer", "super_admin", "managing_director"];
const CAN_SCHEDULE = ["planning_engineer", "super_admin", "managing_director"];
const CAN_COMPLETE = ["delivery_rm_lead", "super_admin", "managing_director"];

function RMImageUploader({ aiPhotos, addAIPhotos, retakePhoto, overridePhoto, guidanceCollapsed }: {
  aiPhotos: any[];
  addAIPhotos: (files: File[]) => void;
  retakePhoto: (i: number) => void;
  overridePhoto: (i: number) => void;
  guidanceCollapsed: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter((f) => f.type === "image/jpeg" || f.type === "image/png").slice(0, 5 - aiPhotos.length);
    if (allowed.length > 0) addAIPhotos(allowed);
  };

  return (
    <div className="space-y-2">
      <Label>Photos of Issue (optional)</Label>
      <PhotoGuidanceCard context="rm_ticket" collapsed={guidanceCollapsed} />
      <div className="flex items-center gap-3 flex-wrap">
        {aiPhotos.map((p: any, i: number) => (
          <PhotoFeedback
            key={i}
            photo={p}
            onRetake={() => retakePhoto(i)}
            onOverride={() => overridePhoto(i)}
          />
        ))}
        {aiPhotos.length < 5 && (
          <button
            type="button"
            className="w-20 h-20 rounded-md flex flex-col items-center justify-center gap-1 border-2 border-dashed transition-colors"
            style={{ borderColor: "#E0E0E0", color: "#999999" }}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px]">Add</span>
          </button>
        )}
      </div>
      <PhotoQualitySummary photos={aiPhotos} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-[10px]" style={{ color: "#999999" }}>JPEG or PNG, up to 5 images</p>
    </div>
  );
}

function ImagePreview({ urls }: { urls: string[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (!urls.length) return null;

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {urls.map((url, i) => (
          <button key={i} type="button" onClick={() => setSelected(i)} className="shrink-0 w-20 h-20 rounded-md overflow-hidden border" style={{ borderColor: "#E0E0E0" }}>
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
      {selected !== null && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl p-2">
            <img src={urls[selected]} alt="" className="w-full rounded-md" />
            <div className="flex justify-center gap-2 mt-2">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-10 h-10 rounded border overflow-hidden"
                  style={{ borderColor: i === selected ? "#006039" : "#E0E0E0", borderWidth: i === selected ? 2 : 1 }}
                  onClick={() => setSelected(i)}
                >
                  <img src={urls[i]} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

async function uploadImages(files: File[], ticketId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("rm-media").upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from("rm-media").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
  }
  return urls;
}

export default function RMPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any | null>(null);
  const [form, setForm] = useState({ project_id: "", issue_description: "", priority: "standard" });
  const {
    photos: rmAIPhotos,
    guidanceCollapsed: rmGuidanceCollapsed,
    addPhotos: rmAddPhotos,
    overridePhoto: rmOverridePhoto,
    retakePhoto: rmRetakePhoto,
    resetPhotos: rmResetPhotos,
    anyChecking: rmAnyChecking,
    qualityMeta: rmQualityMeta,
  } = usePhotoWithAI("rm_ticket");
  const [estimateVal, setEstimateVal] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [aiReport, setAiReport] = useState<AIAnalysis | null>(null);
  const [aiReportTime, setAiReportTime] = useState<string | null>(null);
  const [aiRawText, setAiRawText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const canRaise = CAN_RAISE.includes(userRole ?? "");
  const canEstimate = CAN_ESTIMATE.includes(userRole ?? "");
  const canSchedule = CAN_SCHEDULE.includes(userRole ?? "");
  const canComplete = CAN_COMPLETE.includes(userRole ?? "");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [ticketRes, projRes, roleRes] = await Promise.all([
      (supabase.from("rm_tickets" as any) as any)
        .select("*, projects(name, client_name)")
        .eq("is_archived", false)
        .order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return { role: null, id: null };
        const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
        return { role: data as string | null, id: user.id };
      }),
    ]);
    setTickets(ticketRes.data ?? []);
    const projMap: Record<string, string> = {};
    (projRes.data ?? []).forEach((p: any) => { projMap[p.id] = p.name; });
    setProjects(projMap);
    setUserRole(roleRes.role);
    setUserId(roleRes.id);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load saved AI report when detail ticket opens
  useEffect(() => {
    if (detailTicket?.ai_analysis) {
      setAiReport(detailTicket.ai_analysis as AIAnalysis);
      setAiReportTime(detailTicket.ai_analysis_generated_at ?? null);
      setAiRawText(null);
      setAiError(null);
    } else {
      setAiReport(null);
      setAiReportTime(null);
      setAiRawText(null);
      setAiError(null);
    }
  }, [detailTicket?.id]);

  const runAnalysis = async (ticketId: string, description: string, photoUrls: string[]) => {
    if (!photoUrls?.length) {
      toast.error("Please upload at least one photo of the issue before analysing.");
      return;
    }
    setAnalysing(true);
    setAiError(null);
    setAiRawText(null);
    try {
      const { data, error } = await supabase.functions.invoke("rm-analysis", {
        body: { issue_description: description, image_urls: photoUrls },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const now = new Date().toISOString();

      if (data.analysis) {
        setAiReport(data.analysis);
        setAiReportTime(now);
        // Save to DB
        await (supabase.from("rm_tickets" as any) as any).update({
          ai_analysis: data.analysis,
          ai_analysis_generated_at: now,
        }).eq("id", ticketId);
      } else if (data.raw_text) {
        setAiRawText(data.raw_text);
        setAiReport(null);
      }
    } catch (err: any) {
      console.error("AI analysis error:", err);
      setAiError(err.message || "Analysis failed");
    } finally {
      setAnalysing(false);
    }
  };

  const copyReport = () => {
    if (!aiReport) return;
    const text = `AI Analysis Report
Summary: ${aiReport.summary}
Root Cause: ${aiReport.root_cause}
Severity: ${aiReport.severity} — ${aiReport.severity_reason}
Immediate Action: ${aiReport.immediate_action}
Complexity: ${aiReport.complexity}
Materials: ${aiReport.materials_needed.join(", ")}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const handleCreate = async () => {
    if (!form.project_id || !form.issue_description) { toast.error("Fill required fields"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const clientName = projects[form.project_id] || "Unknown";
      const ticketId = crypto.randomUUID();
      let photoUrls: string[] = [];
      if (rmAIPhotos.length > 0) {
        photoUrls = await uploadImages(rmAIPhotos.map(p => p.file), ticketId);
      }
      const { error } = await (supabase.from("rm_tickets" as any) as any).insert({
        id: ticketId,
        project_id: form.project_id,
        client_name: clientName,
        issue_description: form.issue_description,
        priority: form.priority,
        status: "open",
        raised_by: user.id,
        photo_urls: photoUrls,
        ...rmQualityMeta,
      });
      if (error) throw error;
      toast.success("R&M ticket created");
      setNewOpen(false);
      setForm({ project_id: "", issue_description: "", priority: "standard" });
      rmResetPhotos();
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEstimate = async (ticketId: string) => {
    if (!estimateVal) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("rm_tickets" as any) as any).update({
        cost_estimate: parseFloat(estimateVal),
        cost_estimated_by: user.id,
        cost_estimated_at: new Date().toISOString(),
        status: "pending_schedule",
      }).eq("id", ticketId);
      if (error) throw error;
      toast.success("Cost estimate added");
      setDetailTicket(null);
      setEstimateVal("");
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleSchedule = async (ticketId: string) => {
    if (!scheduleDate) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("rm_tickets" as any) as any).update({
        visit_scheduled_date: scheduleDate,
        visit_scheduled_by: user.id,
        visit_scheduled_at: new Date().toISOString(),
        status: "scheduled",
      }).eq("id", ticketId);
      if (error) throw error;
      toast.success("Visit scheduled");
      setDetailTicket(null);
      setScheduleDate("");
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleComplete = async (ticketId: string) => {
    if (!signoffName) { toast.error("Client sign-off name required"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase.from("rm_tickets" as any) as any).update({
        completed_by: user.id,
        completed_at: new Date().toISOString(),
        client_signoff_name: signoffName,
        completion_notes: completionNotes,
        status: "closed",
      }).eq("id", ticketId);
      if (error) throw error;
      toast.success("Ticket closed with client sign-off");
      setDetailTicket(null);
      setSignoffName("");
      setCompletionNotes("");
      fetchData();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className="flex justify-center items-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>Repair & Maintenance</h1>
          <p className="text-sm mt-1" style={{ color: "#666666" }}>Service tickets from dispatch to client sign-off</p>
        </div>
        {canRaise && (
          <Button onClick={() => setNewOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white hover:opacity-90">
            <Plus className="h-4 w-4 mr-1" /> New Ticket
          </Button>
        )}
      </div>

      {tickets.length === 0 ? (
        <Card style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <CardContent className="py-10 text-center">
            <Wrench className="h-10 w-10 mx-auto mb-3" style={{ color: "#666666" }} />
            <p className="text-sm" style={{ color: "#666666" }}>No R&M tickets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <Card
              key={t.id}
              className="cursor-pointer transition-all hover:shadow-md"
              style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
              onClick={() => setDetailTicket(t)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{t.projects?.name || "Project"}</p>
                      {(t.photo_urls?.length ?? 0) > 0 && <ImageIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#006039" }} />}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#666666" }}>
                      Client: {t.projects?.client_name || t.client_name} · {format(new Date(t.created_at), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: "#1A1A1A" }}>{t.issue_description}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Badge className={PRIORITY_BADGE[t.priority] ?? "bg-muted text-muted-foreground"}>{t.priority}</Badge>
                    <Badge className={STATUS_BADGE[t.status] ?? "bg-muted text-muted-foreground"}>{t.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent style={{ backgroundColor: "#FFFFFF" }}>
          <DialogHeader><DialogTitle style={{ color: "#1A1A1A" }}>New R&M Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label style={{ color: "#1A1A1A" }}>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{Object.entries(projects).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label style={{ color: "#1A1A1A" }}>Issue Description *</Label>
              <Textarea value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} placeholder="Describe the issue..." />
            </div>
            <div>
              <Label style={{ color: "#1A1A1A" }}>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="cosmetic">Cosmetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <RMImageUploader aiPhotos={rmAIPhotos} addAIPhotos={rmAddPhotos} retakePhoto={rmRetakePhoto} overridePhoto={rmOverridePhoto} guidanceCollapsed={rmGuidanceCollapsed} />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!detailTicket} onOpenChange={(o) => { if (!o) setDetailTicket(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" style={{ backgroundColor: "#FFFFFF" }}>
          <DialogHeader><DialogTitle style={{ color: "#1A1A1A" }}>Ticket Details</DialogTitle></DialogHeader>
          {detailTicket && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs" style={{ color: "#666666" }}>Project</p><p className="font-medium" style={{ color: "#1A1A1A" }}>{detailTicket.projects?.name || "—"}</p></div>
                <div><p className="text-xs" style={{ color: "#666666" }}>Client</p><p className="font-medium" style={{ color: "#1A1A1A" }}>{detailTicket.projects?.client_name || detailTicket.client_name || "—"}</p></div>
                <div><p className="text-xs" style={{ color: "#666666" }}>Priority</p><Badge className={PRIORITY_BADGE[detailTicket.priority] ?? ""}>{detailTicket.priority}</Badge></div>
                <div><p className="text-xs" style={{ color: "#666666" }}>Status</p><Badge className={STATUS_BADGE[detailTicket.status] ?? ""}>{detailTicket.status.replace(/_/g, " ")}</Badge></div>
                <div><p className="text-xs" style={{ color: "#666666" }}>Date Raised</p><p style={{ color: "#1A1A1A" }}>{format(new Date(detailTicket.created_at), "dd MMM yyyy")}</p></div>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#666666" }}>Issue Description</p>
                <p style={{ color: "#1A1A1A" }}>{detailTicket.issue_description}</p>
              </div>

              {/* Photos */}
              {(detailTicket.photo_urls?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: "#666666" }}>Photos</p>
                  <ImagePreview urls={detailTicket.photo_urls} />
                </div>
              )}

              {/* AI Analysis Section */}
              {(detailTicket.photo_urls?.length ?? 0) > 0 && (
                <div className="space-y-3">
                  {aiReportTime && !analysing && (
                    <p className="text-[11px]" style={{ color: "#999999" }}>
                      Last analysed {format(new Date(aiReportTime), "dd MMM yyyy, HH:mm")}
                    </p>
                  )}

                  {!aiReport && !aiRawText && !aiError && (
                    <Button
                      variant="outline"
                      className="w-full"
                      style={{ borderColor: "#006039", color: "#006039" }}
                      onClick={() => runAnalysis(detailTicket.id, detailTicket.issue_description, detailTicket.photo_urls)}
                      disabled={analysing}
                    >
                      {analysing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing issue...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" /> 🔍 Analyse Issue with AI</>
                      )}
                    </Button>
                  )}

                  {analysing && (
                    <div className="flex items-center justify-center py-4 gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#006039" }} />
                      <span className="text-sm" style={{ color: "#666666" }}>Analysing issue...</span>
                    </div>
                  )}

                  {aiError && (
                    <div className="border rounded-lg p-4 space-y-2" style={{ borderColor: "#F40009", backgroundColor: "#FFF5F5" }}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" style={{ color: "#F40009" }} />
                        <p className="text-sm font-medium" style={{ color: "#F40009" }}>Analysis failed</p>
                      </div>
                      <p className="text-xs" style={{ color: "#666666" }}>{aiError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        style={{ borderColor: "#F40009", color: "#F40009" }}
                        onClick={() => { setAiError(null); runAnalysis(detailTicket.id, detailTicket.issue_description, detailTicket.photo_urls); }}
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {aiRawText && !aiReport && (
                    <div className="border rounded-lg p-4" style={{ borderColor: "#E0E0E0", backgroundColor: "#F7F7F7" }}>
                      <p className="text-[11px] font-bold uppercase mb-2" style={{ color: "#D4860A" }}>Raw Analysis</p>
                      <p className="text-[13px] whitespace-pre-wrap" style={{ color: "#1A1A1A" }}>{aiRawText}</p>
                    </div>
                  )}

                  {aiReport && aiReportTime && (
                    <AIReportCard
                      analysis={aiReport}
                      generatedAt={aiReportTime}
                      onRegenerate={() => runAnalysis(detailTicket.id, detailTicket.issue_description, detailTicket.photo_urls)}
                      onCopy={copyReport}
                      analysing={analysing}
                    />
                  )}
                </div>
              )}

              {detailTicket.cost_estimate != null && (
                <div><p className="text-xs" style={{ color: "#666666" }}>Cost Estimate</p><p className="font-semibold" style={{ color: "#1A1A1A" }}>₹{Number(detailTicket.cost_estimate).toLocaleString()}</p></div>
              )}
              {detailTicket.visit_scheduled_date && (
                <div><p className="text-xs" style={{ color: "#666666" }}>Visit Scheduled</p><p style={{ color: "#1A1A1A" }}>{detailTicket.visit_scheduled_date}</p></div>
              )}
              {detailTicket.client_signoff_name && (
                <div><p className="text-xs" style={{ color: "#666666" }}>Client Sign-off</p><p style={{ color: "#1A1A1A" }}>{detailTicket.client_signoff_name}</p></div>
              )}
              {detailTicket.completion_notes && (
                <div><p className="text-xs" style={{ color: "#666666" }}>Completion Notes</p><p style={{ color: "#1A1A1A" }}>{detailTicket.completion_notes}</p></div>
              )}

              {detailTicket.status === "open" && canEstimate && (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                  <Label style={{ color: "#1A1A1A" }}>Cost Estimate (₹)</Label>
                  <Input type="number" value={estimateVal} onChange={(e) => setEstimateVal(e.target.value)} placeholder="Enter estimate" />
                  <Button size="sm" onClick={() => handleEstimate(detailTicket.id)} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">Submit Estimate</Button>
                </div>
              )}
              {detailTicket.status === "pending_schedule" && canSchedule && (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                  <Label style={{ color: "#1A1A1A" }}>Visit Date</Label>
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  <Button size="sm" onClick={() => handleSchedule(detailTicket.id)} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">Schedule Visit</Button>
                </div>
              )}
              {detailTicket.status === "scheduled" && canComplete && (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: "#E0E0E0" }}>
                  <Label style={{ color: "#1A1A1A" }}>Completion Notes</Label>
                  <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Work done..." />
                  <Label style={{ color: "#1A1A1A" }}>Client Sign-off Name *</Label>
                  <Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} placeholder="Client name as digital signature" />
                  <Button size="sm" onClick={() => handleComplete(detailTicket.id)} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">Close Ticket</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
