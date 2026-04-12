import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, MessageSquare, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface SiteToFactoryFeedbackProps {
  projectId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  quality: "#F40009",
  dimension: "#D4860A",
  finish: "#4F46E5",
  missing: "#B45309",
  general: "#666",
};

export function SiteToFactoryFeedback({ projectId }: SiteToFactoryFeedbackProps) {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ category: "general", feedback_text: "", module_ref: "" });
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await (supabase.from("site_factory_feedback" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setFeedbacks(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(data as string | null);
    });
  }, [projectId]);

  const handleCreate = async () => {
    if (!form.feedback_text.trim()) { toast.error("Feedback text required"); return; }
    setSaving(true);
    const { data: fb, error } = await (supabase.from("site_factory_feedback" as any) as any).insert({
      project_id: projectId,
      submitted_by: userId,
      category: form.category,
      feedback_text: form.feedback_text,
      module_ref: form.module_ref || null,
      response_deadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      status: "open",
    }).select("id").single();

    if (error) { toast.error(error.message); setSaving(false); return; }

    // Notify production_head
    const { data: prodHeads } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("role", "production_head" as any)
      .eq("is_active", true);
    for (const ph of prodHeads ?? []) {
      await insertNotifications({
        recipient_id: ph.auth_user_id,
        title: "Site→Factory Feedback Received",
        body: `[${form.category.toUpperCase()}] ${form.feedback_text.slice(0, 80)}… Response required within 12 hours.`,
        category: "production",
        related_table: "site_factory_feedback",
        related_id: (fb as any)?.id,
      });
    }
    toast.success("Feedback submitted — factory has 12h to respond");
    setAddOpen(false);
    setForm({ category: "general", feedback_text: "", module_ref: "" });
    fetchData();
    setSaving(false);
  };

  const handleRespond = async (id: string, responseText: string) => {
    await (supabase.from("site_factory_feedback" as any) as any).update({
      response_text: responseText,
      responded_by: userId,
      responded_at: new Date().toISOString(),
      status: "responded",
    }).eq("id", id);
    toast.success("Response submitted");
    fetchData();
  };

  const canRespond = ["production_head", "factory_floor_supervisor", "super_admin", "managing_director"].includes(userRole ?? "");

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" style={{ color: "#006039" }} />
          <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Site → Factory Feedback</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Send Feedback
        </Button>
      </div>

      {feedbacks.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#999" }}>No feedback sent yet.</p>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((fb: any) => {
            const deadline = new Date(fb.response_deadline);
            const hoursLeft = differenceInHours(deadline, new Date());
            const isOverdue = hoursLeft < 0 && fb.status === "open";
            const isUrgent = hoursLeft >= 0 && hoursLeft < 4 && fb.status === "open";

            return (
              <Card key={fb.id} style={{ borderColor: isOverdue ? "#F40009" : isUrgent ? "#D4860A" : undefined }}>
                <CardContent className="py-3 px-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]" style={{ color: CATEGORY_COLORS[fb.category] ?? "#666", borderColor: CATEGORY_COLORS[fb.category] ?? "#666" }}>
                          {fb.category}
                        </Badge>
                        {fb.module_ref && <span className="text-[10px]" style={{ color: "#999" }}>{fb.module_ref}</span>}
                      </div>
                      <p className="text-sm mt-1" style={{ color: "#1A1A1A" }}>{fb.feedback_text}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#999" }}>{format(new Date(fb.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isOverdue && (
                        <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "#F40009" }}>
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </div>
                      )}
                      {isUrgent && (
                        <div className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "#D4860A" }}>
                          <Clock className="h-3 w-3" /> {hoursLeft}h left
                        </div>
                      )}
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: fb.status === "responded" ? "#006039" : "#D4860A",
                        borderColor: fb.status === "responded" ? "#006039" : "#D4860A",
                      }}>
                        {fb.status === "responded" ? "Responded" : "Awaiting"}
                      </Badge>
                    </div>
                  </div>
                  {fb.response_text && (
                    <div className="rounded-md p-2 text-xs" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                      Factory Response: {fb.response_text}
                    </div>
                  )}
                  {canRespond && fb.status === "open" && (
                    <RespondInline id={fb.id} onRespond={handleRespond} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Send Feedback to Factory</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs rounded-md p-2" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              Factory has 12 hours to respond. Escalation to Suraj after 12h.
            </p>
            <div>
              <Label className="text-xs">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">Quality Issue</SelectItem>
                  <SelectItem value="dimension">Dimension Error</SelectItem>
                  <SelectItem value="finish">Finish Problem</SelectItem>
                  <SelectItem value="missing">Missing Component</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Module Reference</Label>
              <input
                type="text"
                value={form.module_ref}
                onChange={(e) => setForm((f) => ({ ...f, module_ref: e.target.value }))}
                placeholder="e.g. MOD-001"
                className="mt-1 w-full border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Feedback *</Label>
              <Textarea value={form.feedback_text} onChange={(e) => setForm((f) => ({ ...f, feedback_text: e.target.value }))} className="mt-1" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "#006039" }} className="text-white">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RespondInline({ id, onRespond }: { id: string; onRespond: (id: string, text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex gap-2 mt-1">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Factory response..."
        className="flex-1 border rounded px-2 py-1 text-xs"
      />
      <Button size="sm" className="h-6 text-[10px] text-white" style={{ backgroundColor: "#006039" }} disabled={!text.trim()} onClick={() => onRespond(id, text)}>
        Reply
      </Button>
    </div>
  );
}
