import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, AlertTriangle, Camera, MessageSquareWarning, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
  modules: { id: string; name: string; module_code: string }[];
}

const ISSUE_TYPES = ["Wrong Dimension", "Wrong Fitting", "Missing Component", "Quality Defect", "Other"];
const SEVERITIES = ["critical", "major", "minor"];

function generateFeedbackId(existingIds: string[]): string {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `SFF-${today}-`;
  const existing = existingIds.filter(id => id.startsWith(prefix));
  const maxSeq = existing.reduce((max, id) => {
    const seq = parseInt(id.replace(prefix, ""), 10);
    return isNaN(seq) ? max : Math.max(max, seq);
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export function SiteFactoryFeedback({ projectId, projectName, userRole, modules }: Props) {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form
  const [moduleId, setModuleId] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("major");
  const [photos, setPhotos] = useState<File[]>([]);

  // Response form
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [response, setResponse] = useState<"ncr_required" | "no_ncr" | "">("");
  const [explanation, setExplanation] = useState("");

  const canRaise = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");
  const canRespond = ["production_head", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("site_factory_feedback") as any)
      .select("*").eq("project_id", projectId).order("raised_at", { ascending: false });
    setFeedbacks(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!issueType) { toast.error("Issue type required"); return; }
    if (description.trim().length < 20) { toast.error("Description must be at least 20 characters"); return; }
    if (photos.length === 0) { toast.error("At least 1 photo required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload photos
      const photoUrls: string[] = [];
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `site-feedback/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("site-photos").upload(path, photo, { upsert: true });
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      }

      const { data: profile } = await supabase.from("profiles").select("display_name").eq("auth_user_id", user.id).single();
      const existingIds = feedbacks.map(f => f.feedback_id);
      const feedbackId = generateFeedbackId(existingIds);

      const { client } = await getAuthedClient();
      const { data: inserted } = await (client.from("site_factory_feedback") as any).insert({
        feedback_id: feedbackId,
        project_id: projectId,
        module_id: moduleId || null,
        issue_type: issueType,
        description: description.trim(),
        photos: photoUrls,
        severity,
        raised_by: user.id,
        raised_by_name: profile?.display_name ?? user.email,
      }).select("id").single();

      // Notify Azad (production_head), Suraj (head_operations), and Gaurav (managing_director) simultaneously
      const { data: recipients } = await supabase.from("profiles").select("auth_user_id")
        .in("role", ["production_head", "head_operations", "managing_director"] as any).eq("is_active", true);
      if (recipients?.length) {
        await insertNotifications(recipients.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: `Site Feedback — ${severity.toUpperCase()}`,
          body: `${profile?.display_name ?? "Site team"} reported: ${issueType} at ${projectName}. "${description.trim().slice(0, 80)}..." Response required within 12 hours.`,
          category: "Production",
          related_table: "site_factory_feedback",
          related_id: inserted?.id,
          navigate_to: "/site-hub",
        })));
      }

      toast.success("Feedback submitted — notifications sent");
      setModuleId(""); setIssueType(""); setDescription(""); setSeverity("major"); setPhotos([]);
      setShowAdd(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setAdding(false);
    }
  };

  const handleRespond = async (id: string) => {
    if (!response) { toast.error("Select a response"); return; }
    if (response === "no_ncr" && explanation.trim().length < 50) {
      toast.error("Explanation must be at least 50 characters for No NCR decisions");
      return;
    }
    try {
      const { client } = await getAuthedClient();
      await (client.from("site_factory_feedback") as any).update({
        azad_response: response,
        azad_explanation: response === "no_ncr" ? explanation.trim() : null,
        azad_responded_at: new Date().toISOString(),
      }).eq("id", id);

      const feedback = feedbacks.find(f => f.id === id);

      // Notify raiser
      if (feedback?.raised_by) {
        await insertNotifications({
          recipient_id: feedback.raised_by,
          title: response === "ncr_required" ? "NCR Created from Feedback" : "Feedback — No NCR Required",
          body: response === "ncr_required"
            ? `An NCR has been raised for your feedback on ${projectName}: ${feedback.issue_type}.`
            : `No NCR required for your feedback on ${projectName}: ${explanation.trim().slice(0, 100)}`,
          category: "Production",
          related_table: "site_factory_feedback",
          related_id: id,
        });
      }

      toast.success("Response recorded");
      setRespondingId(null); setResponse(""); setExplanation("");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to respond");
    }
  };

  // Check for 12-hour escalation
  useEffect(() => {
    const checkEscalation = async () => {
      for (const f of feedbacks) {
        if (f.azad_response || f.escalated) continue;
        const hoursSince = differenceInHours(new Date(), new Date(f.raised_at));
        if (hoursSince >= 12) {
          const { data: escalationRecipients } = await supabase.from("profiles").select("auth_user_id")
            .in("role", ["head_operations"] as any).eq("is_active", true);
          if (escalationRecipients?.length) {
            await insertNotifications(escalationRecipients.map((r: any) => ({
              recipient_id: r.auth_user_id,
              title: "Site Feedback — 12hr Escalation",
              body: `Factory has not acknowledged site feedback on ${projectName} raised by ${f.raised_by_name}. 12-hour window exceeded.`,
              category: "Production",
              related_table: "site_factory_feedback",
              related_id: f.id,
            })));
          }
          const { client } = await getAuthedClient();
          await (client.from("site_factory_feedback") as any).update({
            escalated: true,
            escalation_sent_at: new Date().toISOString(),
          }).eq("id", f.id);
        }
      }
    };
    if (feedbacks.length > 0) checkEscalation();
  }, [feedbacks, projectName]);

  const severityStyle = (sev: string) => {
    switch (sev) {
      case "critical": return { bg: "#FDE8E8", color: "#F40009" };
      case "major": return { bg: "#FFF8E8", color: "#D4860A" };
      default: return { bg: "#F7F7F7", color: "#666666" };
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <MessageSquareWarning className="h-4 w-4" style={{ color: "#F40009" }} />
          Site → Factory Feedback ({feedbacks.length})
        </h3>
        {canRaise && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="text-xs h-7 gap-1" style={{ color: "#F40009", borderColor: "#F40009" }}>
            <Plus className="h-3 w-3" /> Report Factory Issue
          </Button>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select value={moduleId} onValueChange={setModuleId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Module (optional)" /></SelectTrigger>
                <SelectContent>
                  {modules.map(m => <SelectItem key={m.id} value={m.module_code || m.name}>{m.module_code || m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Issue type *" /></SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Description * (min 20 characters)" value={description} onChange={e => setDescription(e.target.value)} className="text-sm min-h-[80px]" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <label className="flex items-center gap-1.5 cursor-pointer border rounded-md px-3 py-2 text-sm hover:bg-muted/50">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  {photos.length > 0 ? `${photos.length} photo(s)` : "Photos *"}
                  <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                    onChange={e => setPhotos(Array.from(e.target.files ?? []))} />
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding} style={{ backgroundColor: "#F40009" }}>
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Submit Feedback"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {feedbacks.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No factory issues reported.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {feedbacks.map(f => {
            const sevStyle = severityStyle(f.severity);
            const hoursSince = differenceInHours(new Date(), new Date(f.raised_at));
            const isOverdue = !f.azad_response && hoursSince >= 12;
            return (
              <Card key={f.id}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono" style={{ color: "#666666" }}>{f.feedback_id}</span>
                        <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: sevStyle.bg, color: sevStyle.color, border: "none" }}>
                          {f.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{f.issue_type}</Badge>
                        {f.azad_response === "ncr_required" && (
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>NCR Created</Badge>
                        )}
                        {f.azad_response === "no_ncr" && (
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "none" }}>No NCR</Badge>
                        )}
                        {isOverdue && !f.azad_response && (
                          <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>
                            <Clock className="h-3 w-3 mr-0.5" /> Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm mt-1" style={{ color: "#1A1A1A" }}>{f.description}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs mt-1" style={{ color: "#666666" }}>
                        {f.module_id && <span>Module: {f.module_id}</span>}
                        <span>By: {f.raised_by_name}</span>
                        <span>{format(new Date(f.raised_at), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                    </div>
                    {/* Photo thumbnails */}
                    {f.photos?.length > 0 && (
                      <div className="flex gap-1 shrink-0">
                        {f.photos.slice(0, 2).map((url: string, i: number) => (
                          <img key={i} src={url} alt="" className="h-10 w-10 rounded object-cover" />
                        ))}
                        {f.photos.length > 2 && <span className="text-[10px] self-end" style={{ color: "#666666" }}>+{f.photos.length - 2}</span>}
                      </div>
                    )}
                  </div>

                  {/* Response display */}
                  {f.azad_response === "no_ncr" && f.azad_explanation && (
                    <div className="text-xs p-2 rounded" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
                      <span className="font-medium">No NCR reason:</span> {f.azad_explanation}
                      {f.azad_responded_at && <span className="ml-2" style={{ color: "#999" }}>({format(new Date(f.azad_responded_at), "dd/MM/yyyy HH:mm")})</span>}
                    </div>
                  )}

                  {f.azad_response === "ncr_required" && (
                    <div className="text-xs p-2 rounded" style={{ backgroundColor: "#FDE8E8", color: "#F40009" }}>
                      NCR required — acknowledged {f.azad_responded_at && format(new Date(f.azad_responded_at), "dd/MM/yyyy HH:mm")}
                    </div>
                  )}

                  {/* Response form */}
                  {respondingId === f.id && (
                    <div className="space-y-2 p-2 border rounded">
                      <div className="flex gap-2">
                        <Button size="sm" variant={response === "ncr_required" ? "default" : "outline"} className="text-xs h-7"
                          onClick={() => setResponse("ncr_required")}
                          style={response === "ncr_required" ? { backgroundColor: "#F40009" } : {}}>
                          NCR Required
                        </Button>
                        <Button size="sm" variant={response === "no_ncr" ? "default" : "outline"} className="text-xs h-7"
                          onClick={() => setResponse("no_ncr")}
                          style={response === "no_ncr" ? { backgroundColor: "#D4860A" } : {}}>
                          No NCR
                        </Button>
                      </div>
                      {response === "no_ncr" && (
                        <Textarea placeholder="Explanation required * (min 50 characters)" value={explanation}
                          onChange={e => setExplanation(e.target.value)} className="text-sm min-h-[60px]" />
                      )}
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setRespondingId(null); setResponse(""); setExplanation(""); }}>Cancel</Button>
                        <Button size="sm" onClick={() => handleRespond(f.id)}>Submit Response</Button>
                      </div>
                    </div>
                  )}

                  {/* Respond button */}
                  {!f.azad_response && canRespond && respondingId !== f.id && (
                    <Button size="sm" variant="outline" className="text-xs h-6" onClick={() => { setRespondingId(f.id); setResponse(""); setExplanation(""); }}>
                      Respond
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
