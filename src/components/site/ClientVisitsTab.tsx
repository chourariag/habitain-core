import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

type Visit = {
  id: string;
  project_id: string;
  visit_date: string;
  visit_time: string | null;
  client_name: string;
  client_feedback: string | null;
  commitments_made: string;
  follow_up_action: string | null;
  commitments_status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
};

interface Props {
  projectId: string;
  projectName: string;
  clientName: string | null;
  userRole: string | null;
}

export function ClientVisitsTab({ projectId, projectName, clientName, userRole }: Props) {
  const [rows, setRows] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    visit_date: new Date().toISOString().slice(0, 10),
    visit_time: "",
    client_name: clientName ?? "",
    client_feedback: "",
    commitments_made: "",
    follow_up_action: "",
  });

  const canEdit = ["site_installation_mgr", "site_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_visits" as any)
      .select("*")
      .eq("project_id", projectId)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Visit[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`cv-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "client_visits", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, load]);

  useEffect(() => { setForm(f => ({ ...f, client_name: f.client_name || (clientName ?? "") })); }, [clientName]);

  const openCount = rows.filter(r => r.commitments_status === "open").length;

  const submit = async () => {
    if (!form.commitments_made.trim()) { toast.error("Commitments made is mandatory"); return; }
    if (!form.client_name.trim()) { toast.error("Client name required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("client_visits" as any).insert({
      project_id: projectId,
      visit_date: form.visit_date,
      visit_time: form.visit_time || null,
      client_name: form.client_name.trim(),
      client_feedback: form.client_feedback.trim() || null,
      commitments_made: form.commitments_made.trim(),
      follow_up_action: form.follow_up_action.trim() || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Client visit logged");
    setOpen(false);
    setForm({
      visit_date: new Date().toISOString().slice(0, 10),
      visit_time: "",
      client_name: clientName ?? "",
      client_feedback: "",
      commitments_made: "",
      follow_up_action: "",
    });
  };

  const closeVisit = async (v: Visit) => {
    const { error } = await supabase.from("client_visits" as any)
      .update({
        commitments_status: "closed",
        closed_at: new Date().toISOString(),
        closed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq("id", v.id);
    if (error) toast.error(error.message); else toast.success("Commitment closed");
  };

  const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 3600 * 1000));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg font-bold">Client Visits</h2>
          <p className="text-xs text-muted-foreground">
            {projectName} —{" "}
            {openCount > 0
              ? <Badge className="bg-warning/20 text-warning-foreground ml-1">{openCount} open commitment{openCount === 1 ? "" : "s"}</Badge>
              : <span className="text-muted-foreground">No open commitments</span>}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)} style={{ backgroundColor: "#006039" }} className="text-white">
            <Plus className="h-4 w-4 mr-2" /> Log Client Visit
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-lg p-8 text-center shadow-sm border border-border">
          <p className="text-sm text-muted-foreground">No client visits logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((v) => {
            const overdue = v.commitments_status === "open" && ageDays(v.created_at) >= 2;
            return (
              <div key={v.id} className={`bg-card rounded-lg border p-3 ${overdue ? "border-warning/60" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{v.client_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(v.visit_date).toLocaleDateString("en-IN")}{v.visit_time ? ` · ${v.visit_time.slice(0,5)}` : ""}
                      </span>
                      <Badge className={v.commitments_status === "open" ? "bg-warning/20 text-warning-foreground" : "bg-primary text-primary-foreground"}>
                        {v.commitments_status}
                      </Badge>
                      {overdue && (
                        <Badge className="bg-destructive/15 text-destructive gap-1">
                          <AlertTriangle className="h-3 w-3" /> {ageDays(v.created_at)}d open
                        </Badge>
                      )}
                    </div>
                    {v.client_feedback && (
                      <p className="text-xs mt-2"><span className="text-muted-foreground">Feedback:</span> {v.client_feedback}</p>
                    )}
                    <p className="text-xs mt-1"><span className="text-muted-foreground">Commitments:</span> {v.commitments_made}</p>
                    {v.follow_up_action && (
                      <p className="text-xs mt-1"><span className="text-muted-foreground">Follow-up:</span> {v.follow_up_action}</p>
                    )}
                    {v.closed_at && (
                      <p className="text-[11px] text-muted-foreground mt-1">Closed {new Date(v.closed_at).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  {v.commitments_status === "open" && canEdit && (
                    <Button size="sm" onClick={() => closeVisit(v)} style={{ backgroundColor: "#006039" }} className="text-white shrink-0">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Closed
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Client Visit</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visit date *</Label>
                <Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
              </div>
              <div>
                <Label>Visit time</Label>
                <Input type="time" value={form.visit_time} onChange={(e) => setForm({ ...form, visit_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Client name *</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            </div>
            <div>
              <Label>Client feedback</Label>
              <Textarea rows={2} value={form.client_feedback} onChange={(e) => setForm({ ...form, client_feedback: e.target.value })} />
            </div>
            <div>
              <Label>Commitments made *</Label>
              <Textarea rows={3} value={form.commitments_made} onChange={(e) => setForm({ ...form, commitments_made: e.target.value })} placeholder="Mandatory — what was promised to the client" />
            </div>
            <div>
              <Label>Follow-up action</Label>
              <Textarea rows={2} value={form.follow_up_action} onChange={(e) => setForm({ ...form, follow_up_action: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
