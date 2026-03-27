import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Wrench, Camera, X, Image as ImageIcon, Sparkles, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

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

function ImageUploader({ images, setImages }: { images: File[]; setImages: (f: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const allowed = Array.from(files).filter((f) => f.type === "image/jpeg" || f.type === "image/png");
    const combined = [...images, ...allowed].slice(0, 5);
    setImages(combined);
  };

  return (
    <div className="space-y-2">
      <Label>Photos of Issue (optional)</Label>
      <div className="flex items-center gap-2 flex-wrap">
        {images.map((img, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border" style={{ borderColor: "#E0E0E0" }}>
            <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-0 right-0 p-0.5 rounded-bl-md"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setImages(images.filter((_, idx) => idx !== i))}
            >
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        {images.length < 5 && (
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
                  className="w-11 h-11 rounded border overflow-hidden"
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

interface AIReport {
  summary: string;
  severity: string;
  rootCause: string;
  materials: string[];
  repairSteps: string[];
  estimatedDuration: string;
  generatedAt?: string;
  model?: string;
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string }> = {
  High: { bg: "#FFF0F0", color: "#F40009" },
  Medium: { bg: "#FFF8E8", color: "#D4860A" },
  Low: { bg: "#E8F2ED", color: "#006039" },
};

function AIReportCard({ report, onCopy }: { report: AIReport; onCopy: () => void }) {
  const sev = SEVERITY_STYLE[report.severity] ?? SEVERITY_STYLE["Medium"];
  return (
    <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: "#E0E0E0", backgroundColor: "#FAFAFA" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "#006039" }} />
          <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>AI Analysis Report</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: sev.bg, color: sev.color }}
          >
            {report.severity} Severity
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} title="Copy report">
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Section 1: Summary */}
      <div>
        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#444444" }}>Summary</p>
        <p className="text-xs" style={{ color: "#1A1A1A" }}>{report.summary}</p>
      </div>

      {/* Section 2: Root Cause */}
      <div>
        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#444444" }}>Root Cause</p>
        <p className="text-xs" style={{ color: "#1A1A1A" }}>{report.rootCause}</p>
      </div>

      {/* Section 3: Recommended Materials */}
      <div>
        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#444444" }}>Recommended Materials</p>
        <div className="flex flex-wrap gap-1.5">
          {(report.materials ?? []).map((m, i) => (
            <span
              key={i}
              className="text-[11px] px-2 py-0.5 rounded-full border"
              style={{ borderColor: "#006039", color: "#006039", backgroundColor: "#E8F2ED" }}
            >
              {m}
            </span>
          ))}
          {(!report.materials || report.materials.length === 0) && (
            <span className="text-xs" style={{ color: "#999" }}>None specified</span>
          )}
        </div>
      </div>

      {/* Section 4: Repair Steps */}
      <div>
        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#444444" }}>Repair Steps</p>
        <ol className="space-y-1">
          {(report.repairSteps ?? []).map((step, i) => (
            <li key={i} className="text-xs" style={{ color: "#1A1A1A" }}>{step}</li>
          ))}
          {(!report.repairSteps || report.repairSteps.length === 0) && (
            <li className="text-xs" style={{ color: "#999" }}>No steps provided</li>
          )}
        </ol>
      </div>

      {/* Section 5: Estimated Duration */}
      <div>
        <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "#444444" }}>Estimated Duration</p>
        <p className="text-xs" style={{ color: "#1A1A1A" }}>{report.estimatedDuration || "—"}</p>
      </div>

      {/* Section 6: Metadata / Disclaimer */}
      <div className="border-t pt-2" style={{ borderColor: "#E0E0E0" }}>
        <p className="text-[10px] italic" style={{ color: "#999999" }}>
          AI-generated analysis using {report.model ?? "claude-sonnet-4-20250514"}.
          {report.generatedAt && ` Generated ${format(new Date(report.generatedAt), "dd MMM yyyy, HH:mm")}.`}
          {" "}This report is advisory only — always verify on-site before proceeding.
        </p>
      </div>
    </div>
  );
}

export default function RMPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any | null>(null);
  const [form, setForm] = useState({ project_id: "", issue_description: "", priority: "standard" });
  const [formImages, setFormImages] = useState<File[]>([]);
  const [estimateVal, setEstimateVal] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // AI analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
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

  // When a ticket is opened, load existing ai_analysis
  useEffect(() => {
    if (detailTicket) {
      setAiReport(detailTicket.ai_analysis ?? null);
      setAiError(null);
    } else {
      setAiReport(null);
      setAiError(null);
    }
  }, [detailTicket]);

  const handleCreate = async () => {
    if (!form.project_id || !form.issue_description) { toast.error("Fill required fields"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const clientName = projects[form.project_id] || "Unknown";
      const ticketId = crypto.randomUUID();
      let photoUrls: string[] = [];
      if (formImages.length > 0) {
        photoUrls = await uploadImages(formImages, ticketId);
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
      });
      if (error) throw error;
      toast.success("R&M ticket created");
      setNewOpen(false);
      setForm({ project_id: "", issue_description: "", priority: "standard" });
      setFormImages([]);
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

  const handleAnalyseWithAI = async () => {
    if (!detailTicket) return;
    const photoUrls: string[] = detailTicket.photo_urls ?? [];
    if (photoUrls.length === 0) {
      toast.error("Upload at least one photo before running AI analysis");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiReport(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("rm-ai-analysis", {
        body: {
          imageUrls: photoUrls,
          issueDescription: detailTicket.issue_description,
          priority: detailTicket.priority,
        },
      });

      if (error) throw new Error(error.message || "AI analysis failed");
      if (data?.error) throw new Error(data.error);

      const report = data as AIReport;
      setAiReport(report);

      // Save to database
      await (supabase.from("rm_tickets" as any) as any)
        .update({ ai_analysis: report })
        .eq("id", detailTicket.id);

      // Update local state so it persists on revisit
      setDetailTicket((prev: any) => ({ ...prev, ai_analysis: report }));
    } catch (err: any) {
      setAiError(err.message || "AI analysis failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!aiReport) return;
    const text = [
      `AI Analysis Report`,
      `Severity: ${aiReport.severity}`,
      ``,
      `Summary:\n${aiReport.summary}`,
      ``,
      `Root Cause:\n${aiReport.rootCause}`,
      ``,
      `Materials: ${(aiReport.materials ?? []).join(", ")}`,
      ``,
      `Repair Steps:\n${(aiReport.repairSteps ?? []).join("\n")}`,
      ``,
      `Estimated Duration: ${aiReport.estimatedDuration}`,
      ``,
      `Generated: ${aiReport.generatedAt ? format(new Date(aiReport.generatedAt), "dd MMM yyyy, HH:mm") : "—"}`,
      `Model: ${aiReport.model ?? "claude-sonnet-4-20250514"}`,
      ``,
      `AI-generated advisory only. Verify on-site before proceeding.`,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Report copied to clipboard"));
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
                      <p className="font-semibold text-sm truncate" style={{ color: "#1A1A1A" }}>{t.projects?.name || "Project"}</p>
                      {(t.photo_urls?.length ?? 0) > 0 && <ImageIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "#006039" }} />}
                      {t.ai_analysis && <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: "#006039" }} />}
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
            <ImageUploader images={formImages} setImages={setFormImages} />
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#FFFFFF" }}>
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

              {/* Analyse with AI button — only shown when images exist */}
              {(detailTicket.photo_urls?.length ?? 0) > 0 && !aiReport && (
                <div className="border-t pt-3" style={{ borderColor: "#E0E0E0" }}>
                  <Button
                    size="sm"
                    onClick={handleAnalyseWithAI}
                    disabled={aiLoading}
                    className="w-full"
                    style={{ backgroundColor: "#1A1A1A", color: "#FFFFFF" }}
                  >
                    {aiLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analysing…</>
                      : <><Sparkles className="h-4 w-4 mr-2" />Analyse with AI</>
                    }
                  </Button>
                </div>
              )}

              {/* AI Error Card */}
              {aiError && (
                <div className="rounded-lg border p-3 flex items-start gap-2" style={{ borderColor: "#F40009", backgroundColor: "#FFF0F0" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#F40009" }} />
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#F40009" }}>AI Analysis Failed</p>
                    <p className="text-xs mt-0.5" style={{ color: "#666666" }}>{aiError}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 mt-1 text-xs"
                      style={{ color: "#F40009" }}
                      onClick={handleAnalyseWithAI}
                      disabled={aiLoading}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* AI Report */}
              {aiReport && (
                <div className="border-t pt-3" style={{ borderColor: "#E0E0E0" }}>
                  <AIReportCard report={aiReport} onCopy={handleCopyReport} />
                  {/* Re-analyse button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 w-full text-xs"
                    style={{ color: "#666666" }}
                    onClick={handleAnalyseWithAI}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Re-analyse
                  </Button>
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
