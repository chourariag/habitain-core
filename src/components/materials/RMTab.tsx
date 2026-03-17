import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
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

interface Props {
  userRole: string | null;
  userId: string | null;
  projects: Record<string, string>;
}

export function RMTab({ userRole, userId, projects }: Props) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<any | null>(null);
  const [form, setForm] = useState({ project_id: "", issue_description: "", priority: "standard" });
  const [estimateVal, setEstimateVal] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [signoffName, setSignoffName] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canRaise = CAN_RAISE.includes(userRole ?? "");
  const canEstimate = CAN_ESTIMATE.includes(userRole ?? "");
  const canSchedule = CAN_SCHEDULE.includes(userRole ?? "");
  const canComplete = CAN_COMPLETE.includes(userRole ?? "");

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("rm_tickets" as any) as any)
      .select("*, projects(name, client_name)")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleCreate = async () => {
    if (!form.project_id || !form.issue_description) { toast.error("Fill required fields"); return; }
    setSubmitting(true);
    try {
      const { client, session } = await getAuthedClient();
      const clientName = projects[form.project_id] || "Unknown";
      const { error } = await (client.from("rm_tickets" as any) as any).insert({
        project_id: form.project_id,
        client_name: clientName,
        issue_description: form.issue_description,
        priority: form.priority,
        status: "open",
        raised_by: session.user.id,
      });
      if (error) throw error;
      toast.success("R&M ticket created");
      setNewOpen(false);
      setForm({ project_id: "", issue_description: "", priority: "standard" });
      fetchTickets();
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
      const { client, session } = await getAuthedClient();
      const { error } = await (client.from("rm_tickets" as any) as any).update({
        cost_estimate: parseFloat(estimateVal),
        cost_estimated_by: session.user.id,
        cost_estimated_at: new Date().toISOString(),
        status: "pending_schedule",
      }).eq("id", ticketId);
      if (error) throw error;
      toast.success("Cost estimate added");
      setDetailTicket(null);
      setEstimateVal("");
      fetchTickets();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleSchedule = async (ticketId: string) => {
    if (!scheduleDate) return;
    setSubmitting(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await (client.from("rm_tickets" as any) as any).update({
        visit_scheduled_date: scheduleDate,
        visit_scheduled_by: session.user.id,
        visit_scheduled_at: new Date().toISOString(),
        status: "scheduled",
      }).eq("id", ticketId);
      if (error) throw error;
      toast.success("Visit scheduled");
      setDetailTicket(null);
      setScheduleDate("");
      fetchTickets();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  const handleComplete = async (ticketId: string) => {
    if (!signoffName) { toast.error("Client sign-off name required"); return; }
    setSubmitting(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await (client.from("rm_tickets" as any) as any).update({
        completed_by: session.user.id,
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
      fetchTickets();
    } catch (err: any) { toast.error(err.message); } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-lg font-semibold text-foreground">Repair & Maintenance Tickets</h2>
        {canRaise && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Ticket</Button>}
      </div>

      {tickets.length === 0 ? (
        <Card><CardContent className="py-10 text-center"><Wrench className="h-10 w-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm">No R&M tickets yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => setDetailTicket(t)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">{(t as any).projects?.name || "Project"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(t as any).projects?.client_name || t.client_name} · {format(new Date(t.created_at), "dd MMM yyyy")}
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
      <Dialog open={!!detailTicket} onOpenChange={(o) => !o && setDetailTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ticket Details</DialogTitle></DialogHeader>
          {detailTicket && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Project:</span> <span className="text-card-foreground font-medium">{(detailTicket as any).projects?.name}</span></div>
                <div><span className="text-muted-foreground">Client:</span> <span className="text-card-foreground font-medium">{detailTicket.client_name}</span></div>
                <div><span className="text-muted-foreground">Priority:</span> <Badge variant="outline" className={PRIORITY_BADGE[detailTicket.priority] ?? ""}>{detailTicket.priority}</Badge></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={STATUS_BADGE[detailTicket.status] ?? ""}>{detailTicket.status.replace(/_/g, " ")}</Badge></div>
                <div><span className="text-muted-foreground">Raised:</span> <span className="text-card-foreground">{format(new Date(detailTicket.created_at), "dd MMM yyyy")}</span></div>
              </div>
              <div>
                <span className="text-muted-foreground">Issue:</span>
                <p className="text-card-foreground mt-1">{detailTicket.issue_description}</p>
              </div>

              {detailTicket.cost_estimate != null && (
                <div><span className="text-muted-foreground">Cost Estimate:</span> <span className="text-card-foreground font-semibold">₹{Number(detailTicket.cost_estimate).toLocaleString()}</span></div>
              )}
              {detailTicket.visit_scheduled_date && (
                <div><span className="text-muted-foreground">Visit Scheduled:</span> <span className="text-card-foreground">{detailTicket.visit_scheduled_date}</span></div>
              )}
              {detailTicket.client_signoff_name && (
                <div><span className="text-muted-foreground">Client Sign-off:</span> <span className="text-card-foreground">{detailTicket.client_signoff_name}</span></div>
              )}
              {detailTicket.completion_notes && (
                <div><span className="text-muted-foreground">Completion Notes:</span> <p className="text-card-foreground">{detailTicket.completion_notes}</p></div>
              )}

              {/* Actions based on status */}
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
