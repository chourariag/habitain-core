import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-warning/20 text-warning-foreground",
  pending_estimate: "bg-primary/20 text-primary",
  pending_schedule: "bg-primary/20 text-primary",
  scheduled: "bg-secondary/20 text-secondary",
  in_progress: "bg-secondary/20 text-secondary",
  closed: "bg-success/20 text-success-foreground",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-destructive/20 text-destructive",
  standard: "bg-muted text-muted-foreground",
  cosmetic: "bg-muted text-muted-foreground",
};

const CAN_RAISE = ["super_admin", "managing_director", "site_installation_mgr", "site_engineer", "delivery_rm_lead", "head_operations", "production_head", "sales_director"];
const CAN_ESTIMATE = ["costing_engineer", "super_admin", "managing_director"];
const CAN_SCHEDULE = ["planning_engineer", "super_admin", "managing_director"];
const CAN_COMPLETE = ["delivery_rm_lead", "super_admin", "managing_director"];

export default function RMPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any | null>(null);
  const [form, setForm] = useState({ project_id: "", issue_description: "", priority: "standard" });
  const [estimateVal, setEstimateVal] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!form.project_id || !form.issue_description) { toast.error("Fill required fields"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const clientName = projects[form.project_id] || "Unknown";
      const { error } = await (supabase.from("rm_tickets" as any) as any).insert({
        project_id: form.project_id,
        client_name: clientName,
        issue_description: form.issue_description,
        priority: form.priority,
        status: "open",
        raised_by: user.id,
      });
      if (error) throw error;
      toast.success("R&M ticket created");
      setNewOpen(false);
      setForm({ project_id: "", issue_description: "", priority: "standard" });
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Repair & Maintenance</h1>
          <p className="text-muted-foreground text-sm mt-1">Service tickets from dispatch to client sign-off</p>
        </div>
        {canRaise && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>}
      </div>

      {tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">No R&M tickets yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <Card key={t.id} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => setDetailTicket(t)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{t.projects?.name || "Project"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Client: {t.projects?.client_name || t.client_name} · {format(new Date(t.created_at), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs text-card-foreground/80 mt-1 line-clamp-1">{t.issue_description}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className={PRIORITY_BADGE[t.priority] ?? ""}>{t.priority}</Badge>
                    <Badge variant="outline" className={STATUS_BADGE[t.status] ?? ""}>{t.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Ticket Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New R&M Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Project *</Label>
              <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>{Object.entries(projects).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issue Description *</Label>
              <Textarea value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} placeholder="Describe the issue..." />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="cosmetic">Cosmetic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!detailTicket} onOpenChange={(o) => { if (!o) setDetailTicket(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ticket Details</DialogTitle></DialogHeader>
          {detailTicket && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Project</p><p className="text-card-foreground font-medium">{detailTicket.projects?.name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Client</p><p className="text-card-foreground font-medium">{detailTicket.projects?.client_name || detailTicket.client_name || "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Priority</p><Badge variant="outline" className={PRIORITY_BADGE[detailTicket.priority] ?? ""}>{detailTicket.priority}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge variant="outline" className={STATUS_BADGE[detailTicket.status] ?? ""}>{detailTicket.status.replace(/_/g, " ")}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Date Raised</p><p className="text-card-foreground">{format(new Date(detailTicket.created_at), "dd MMM yyyy")}</p></div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Issue Description</p>
                <p className="text-card-foreground">{detailTicket.issue_description}</p>
              </div>

              {detailTicket.cost_estimate != null && (
                <div><p className="text-muted-foreground text-xs">Cost Estimate</p><p className="text-card-foreground font-semibold">₹{Number(detailTicket.cost_estimate).toLocaleString()}</p></div>
              )}
              {detailTicket.visit_scheduled_date && (
                <div><p className="text-muted-foreground text-xs">Visit Scheduled</p><p className="text-card-foreground">{detailTicket.visit_scheduled_date}</p></div>
              )}
              {detailTicket.client_signoff_name && (
                <div><p className="text-muted-foreground text-xs">Client Sign-off</p><p className="text-card-foreground">{detailTicket.client_signoff_name}</p></div>
              )}
              {detailTicket.completion_notes && (
                <div><p className="text-muted-foreground text-xs">Completion Notes</p><p className="text-card-foreground">{detailTicket.completion_notes}</p></div>
              )}

              {detailTicket.status === "open" && canEstimate && (
                <div className="border-t pt-3 space-y-2">
                  <Label>Cost Estimate (₹)</Label>
                  <Input type="number" value={estimateVal} onChange={(e) => setEstimateVal(e.target.value)} placeholder="Enter estimate" />
                  <Button size="sm" onClick={() => handleEstimate(detailTicket.id)} disabled={submitting}>Submit Estimate</Button>
                </div>
              )}
              {detailTicket.status === "pending_schedule" && canSchedule && (
                <div className="border-t pt-3 space-y-2">
                  <Label>Visit Date</Label>
                  <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
                  <Button size="sm" onClick={() => handleSchedule(detailTicket.id)} disabled={submitting}>Schedule Visit</Button>
                </div>
              )}
              {detailTicket.status === "scheduled" && canComplete && (
                <div className="border-t pt-3 space-y-2">
                  <Label>Completion Notes</Label>
                  <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Work done..." />
                  <Label>Client Sign-off Name *</Label>
                  <Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} placeholder="Client name as digital signature" />
                  <Button size="sm" onClick={() => handleComplete(detailTicket.id)} disabled={submitting}>Close Ticket</Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
