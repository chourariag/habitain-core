import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { AlertTriangle, AlertOctagon, CheckCircle2, Loader2, Package, Phone, Calendar, MessageSquare } from "lucide-react";
import { format, differenceInDays, addDays, isBefore } from "date-fns";
import { cn } from "@/lib/utils";
import { insertNotifications } from "@/lib/notifications";

interface MaterialAlert {
  id: string;
  project_id: string;
  material_plan_item_id: string | null;
  alert_type: string;
  priority: string;
  message: string;
  material_name: string | null;
  related_task_id: string | null;
  vendor_name: string | null;
  days_overdue: number | null;
  days_remaining: number | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  userRole: string | null;
}

export function MaterialAlertsTab({ userRole }: Props) {
  const [alerts, setAlerts] = useState<MaterialAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [deliverSheet, setDeliverSheet] = useState<MaterialAlert | null>(null);
  const [deliverDate, setDeliverDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deliverQty, setDeliverQty] = useState("");
  const [noteSheet, setNoteSheet] = useState<MaterialAlert | null>(null);
  const [noteText, setNoteText] = useState("");
  const [committedSheet, setCommittedSheet] = useState<MaterialAlert | null>(null);
  const [newCommittedDate, setNewCommittedDate] = useState("");

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const [alertsRes, projRes] = await Promise.all([
      supabase.from("material_alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name").eq("is_archived", false),
    ]);
    setAlerts((alertsRes.data ?? []) as MaterialAlert[]);
    const pm: Record<string, string> = {};
    (projRes.data ?? []).forEach((p: any) => { pm[p.id] = p.name; });
    setProjects(pm);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const generateAlerts = useCallback(async () => {
    setGenerating(true);
    try {
      // Fetch all material plan items across active projects
      const { data: planItems } = await supabase
        .from("project_material_plan_items")
        .select("*, project_material_plans!inner(project_id)")
        .is("actual_delivery_date", null);

      // Fetch tasks for schedule impact check
      const { data: allTasks } = await supabase.from("project_tasks").select("*");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = new Date();
      const newAlerts: any[] = [];

      for (const item of planItems ?? []) {
        const projectId = (item as any).project_material_plans?.project_id;
        if (!projectId) continue;

        const committed = item.supplier_committed_date ? new Date(item.supplier_committed_date) : null;
        const planned = item.planned_delivery_date ? new Date(item.planned_delivery_date) : null;
        const refDate = committed ?? planned;

        // ALERT TYPE 1 — Overdue Delivery
        if (refDate && isBefore(refDate, today)) {
          const daysOver = differenceInDays(today, refDate);
          newAlerts.push({
            project_id: projectId,
            material_plan_item_id: item.id,
            alert_type: "overdue_delivery",
            priority: "critical",
            material_name: item.material_description,
            vendor_name: null,
            days_overdue: daysOver,
            days_remaining: null,
            message: `${item.material_description} for ${projects[projectId] ?? "project"} was due ${daysOver} day(s) ago. Supplier committed: ${refDate ? format(refDate, "dd MMM yyyy") : "N/A"}. No delivery recorded yet.`,
          });
        }

        // ALERT TYPE 2 — At Risk (1-3 days out)
        if (refDate && !isBefore(refDate, today) && isBefore(refDate, addDays(today, 4))) {
          const daysLeft = differenceInDays(refDate, today);
          if (daysLeft >= 0 && daysLeft <= 3) {
            newAlerts.push({
              project_id: projectId,
              material_plan_item_id: item.id,
              alert_type: "at_risk",
              priority: "high",
              material_name: item.material_description,
              vendor_name: null,
              days_overdue: null,
              days_remaining: daysLeft,
              message: `${item.material_description} for ${projects[projectId] ?? "project"} is due in ${daysLeft} day(s). Confirm delivery is on track.`,
            });
          }
        }

        // ALERT TYPE 3 — Schedule Impact Risk
        const projectTasks = (allTasks ?? []).filter((t: any) => t.project_id === projectId);
        for (const task of projectTasks) {
          if (task.completion_percentage >= 100) continue;
          if (!task.planned_start_date) continue;
          const taskStart = new Date(task.planned_start_date);
          const daysToStart = differenceInDays(taskStart, today);
          if (daysToStart >= 0 && daysToStart <= 5) {
            // Match by section name containing task phase or material description
            const sectionMatch = item.section?.toLowerCase().includes(task.phase?.toLowerCase() ?? "") ||
              task.task_name?.toLowerCase().includes(item.material_description?.toLowerCase()?.split(" ")[0] ?? "");
            if (sectionMatch) {
              newAlerts.push({
                project_id: projectId,
                material_plan_item_id: item.id,
                alert_type: "schedule_impact",
                priority: "critical",
                material_name: item.material_description,
                related_task_id: task.id,
                vendor_name: null,
                days_overdue: null,
                days_remaining: daysToStart,
                message: `Task "${task.task_name}" starts in ${daysToStart} day(s) but ${item.material_description} has not arrived. Risk of production stoppage.`,
              });
            }
          }
        }
      }

      if (newAlerts.length > 0) {
        // Clear old active alerts first
        const { client } = await getAuthedClient();
        await (client.from("material_alerts") as any).update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("status", "active");
        await (client.from("material_alerts") as any).insert(newAlerts);
      }

      toast.success(`Generated ${newAlerts.length} alert(s)`);
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  }, [projects, fetchAlerts]);

  const handleMarkDelivered = async () => {
    if (!deliverSheet) return;
    try {
      const { client } = await getAuthedClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Update the material plan item
      if (deliverSheet.material_plan_item_id) {
        await (client.from("project_material_plan_items") as any).update({
          actual_delivery_date: deliverDate,
          material_qty_received: Number(deliverQty) || 0,
          status: "Delivered",
        }).eq("id", deliverSheet.material_plan_item_id);
      }

      // Resolve the alert
      await (client.from("material_alerts") as any).update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      }).eq("id", deliverSheet.id);

      // Notify Karthik
      const { data: karthik } = await supabase.from("profiles").select("id").eq("role", "planning_engineer").eq("is_active", true).limit(1).single();
      if (karthik) {
        await insertNotifications({
          recipient_id: karthik.id,
          title: "Material Delivered",
          body: `${deliverSheet.material_name} for ${projects[deliverSheet.project_id] ?? "project"} has been received (${deliverQty} units). Dependent tasks are unblocked.`,
          category: "material_delivery",
          related_table: "project_material_plan_items",
          related_id: deliverSheet.material_plan_item_id ?? undefined,
        });
      }

      toast.success("Marked as delivered");
      setDeliverSheet(null);
      setDeliverQty("");
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateCommitted = async () => {
    if (!committedSheet || !newCommittedDate) return;
    try {
      const { client } = await getAuthedClient();
      if (committedSheet.material_plan_item_id) {
        await (client.from("project_material_plan_items") as any).update({
          supplier_committed_date: newCommittedDate,
        }).eq("id", committedSheet.material_plan_item_id);
      }
      await (client.from("material_alerts") as any).update({
        notes: `Committed date updated to ${newCommittedDate}`,
      }).eq("id", committedSheet.id);
      toast.success("Committed date updated");
      setCommittedSheet(null);
      setNewCommittedDate("");
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddNote = async () => {
    if (!noteSheet || !noteText.trim()) return;
    try {
      const { client } = await getAuthedClient();
      await (client.from("material_alerts") as any).update({ notes: noteText.trim() }).eq("id", noteSheet.id);
      toast.success("Note added");
      setNoteSheet(null);
      setNoteText("");
      fetchAlerts();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const activeAlerts = useMemo(() => alerts.filter(a => a.status === "active"), [alerts]);
  const resolvedAlerts = useMemo(() => alerts.filter(a => a.status === "resolved"), [alerts]);
  const criticalAlerts = activeAlerts.filter(a => a.priority === "critical");
  const highAlerts = activeAlerts.filter(a => a.priority === "high");

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Material Alerts</h3>
        <Button size="sm" onClick={generateAlerts} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
          Run Risk Check
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-red-200" style={{ backgroundColor: "#FFF0F0" }}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "#F40009" }}>{criticalAlerts.length}</p>
            <p className="text-xs" style={{ color: "#666666" }}>Critical</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200" style={{ backgroundColor: "#FFF8E8" }}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "#D4860A" }}>{highAlerts.length}</p>
            <p className="text-xs" style={{ color: "#666666" }}>High</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: "#E8F2ED" }}>
          <CardContent className="py-3 px-4 text-center">
            <p className="text-2xl font-bold" style={{ color: "#006039" }}>{resolvedAlerts.length}</p>
            <p className="text-xs" style={{ color: "#666666" }}>Resolved</p>
          </CardContent>
        </Card>
      </div>

      {activeAlerts.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No active material alerts. Click "Run Risk Check" to scan.
        </CardContent></Card>
      )}

      {/* Critical alerts */}
      {criticalAlerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} projectName={projects[alert.project_id]} onDeliver={() => setDeliverSheet(alert)} onUpdateCommitted={() => setCommittedSheet(alert)} onAddNote={() => { setNoteSheet(alert); setNoteText(alert.notes ?? ""); }} />
      ))}

      {/* High alerts */}
      {highAlerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} projectName={projects[alert.project_id]} onDeliver={() => setDeliverSheet(alert)} onUpdateCommitted={() => setCommittedSheet(alert)} onAddNote={() => { setNoteSheet(alert); setNoteText(alert.notes ?? ""); }} />
      ))}

      {/* Resolved (collapsed) */}
      {resolvedAlerts.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground flex items-center gap-1.5 py-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: "#006039" }} /> Resolved ({resolvedAlerts.length})
          </summary>
          <div className="space-y-2 mt-2">
            {resolvedAlerts.slice(0, 20).map(alert => (
              <Card key={alert.id} className="opacity-60">
                <CardContent className="py-3 px-4">
                  <p className="text-sm">{alert.message}</p>
                  {alert.notes && <p className="text-xs text-muted-foreground mt-1">Note: {alert.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}

      {/* Mark Delivered Sheet */}
      <Sheet open={!!deliverSheet} onOpenChange={(o) => { if (!o) setDeliverSheet(null); }}>
        <SheetContent>
          <SheetHeader><SheetTitle>Mark Delivered</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{deliverSheet?.material_name}</p>
            <div>
              <label className="text-sm font-medium">Delivery Date</label>
              <Input type="date" value={deliverDate} onChange={e => setDeliverDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Qty Received</label>
              <Input type="number" value={deliverQty} onChange={e => setDeliverQty(e.target.value)} placeholder="Enter quantity" />
            </div>
            <Button className="w-full" onClick={handleMarkDelivered} style={{ backgroundColor: "#006039" }}>Confirm Delivery</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Update Committed Date Sheet */}
      <Sheet open={!!committedSheet} onOpenChange={(o) => { if (!o) setCommittedSheet(null); }}>
        <SheetContent>
          <SheetHeader><SheetTitle>Update Committed Date</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{committedSheet?.material_name}</p>
            <div>
              <label className="text-sm font-medium">New Committed Date</label>
              <Input type="date" value={newCommittedDate} onChange={e => setNewCommittedDate(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleUpdateCommitted} style={{ backgroundColor: "#006039" }}>Update Date</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add Note Sheet */}
      <Sheet open={!!noteSheet} onOpenChange={(o) => { if (!o) setNoteSheet(null); }}>
        <SheetContent>
          <SheetHeader><SheetTitle>Add Note</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">{noteSheet?.material_name}</p>
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..." rows={4} />
            <Button className="w-full" onClick={handleAddNote} style={{ backgroundColor: "#006039" }}>Save Note</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---- Alert Card sub-component ---- */
function AlertCard({ alert, projectName, onDeliver, onUpdateCommitted, onAddNote }: {
  alert: MaterialAlert; projectName?: string;
  onDeliver: () => void; onUpdateCommitted: () => void; onAddNote: () => void;
}) {
  const isCritical = alert.priority === "critical";
  const typeLabel = alert.alert_type === "overdue_delivery" ? "Overdue"
    : alert.alert_type === "at_risk" ? "At Risk"
    : "Schedule Impact";

  return (
    <Card className={cn("border-l-4", isCritical ? "border-l-red-500" : "border-l-amber-500")}>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {isCritical
              ? <AlertOctagon className="h-4 w-4 shrink-0" style={{ color: "#F40009" }} />
              : <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#D4860A" }} />}
            <Badge variant="outline" className={isCritical ? "bg-red-100 text-red-800 border-red-200 text-xs" : "bg-amber-100 text-amber-800 border-amber-200 text-xs"}>
              {typeLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">{projectName ?? "Project"}</span>
          </div>
          {alert.days_overdue != null && alert.days_overdue > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">{alert.days_overdue}d overdue</Badge>
          )}
          {alert.days_remaining != null && alert.days_remaining >= 0 && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 text-xs">{alert.days_remaining}d left</Badge>
          )}
        </div>
        <p className="text-sm" style={{ color: "#1A1A1A" }}>{alert.message}</p>
        {alert.notes && <p className="text-xs text-muted-foreground">Note: {alert.notes}</p>}
        {alert.vendor_name && (
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {alert.vendor_name}</p>
        )}
        <div className="flex gap-2 flex-wrap pt-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDeliver}>
            <Package className="h-3 w-3 mr-1" /> Mark Delivered
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onUpdateCommitted}>
            <Calendar className="h-3 w-3 mr-1" /> Update Date
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAddNote}>
            <MessageSquare className="h-3 w-3 mr-1" /> Add Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
