import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Loader2, Check, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
}

export function SubcontractorSchedule({ projectId, projectName, userRole }: Props) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [adding, setAdding] = useState(false);

  const canManage = ["site_installation_mgr", "site_engineer", "head_operations", "super_admin", "managing_director"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("subcontractor_schedules") as any)
      .select("*").eq("project_id", projectId).order("start_date", { ascending: true });
    setSchedules(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim() || !newDate) { toast.error("Name and date are required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      await (client.from("subcontractor_schedules") as any).insert({
        project_id: projectId,
        subcontractor_name: newName.trim(),
        start_date: newDate,
        created_by: user.id,
      });
      toast.success("Subcontractor scheduled");
      setNewName(""); setNewDate(""); setShowAdd(false);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const { client } = await getAuthedClient();
      await (client.from("subcontractor_schedules") as any).update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
      }).eq("id", id);
      toast.success("Attendance confirmed");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    }
  };

  const handleEmergencyAdvance = async (schedule: any) => {
    // Notify MD directly
    const { data: mdRecipients } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("role", "managing_director" as any)
      .eq("is_active", true);

    if (mdRecipients?.length) {
      await insertNotifications(mdRecipients.map((r: any) => ({
        recipient_id: r.auth_user_id,
        title: "Emergency Advance Request",
        body: `Short-notice dispatch for ${schedule.subcontractor_name} at ${projectName}. MD approval required within 2 hours.`,
        category: "Finance",
        related_table: "subcontractor_schedules",
        related_id: schedule.id,
        navigate_to: "/site-hub",
      })));
    }
    toast.success("Emergency advance request sent to MD");
  };

  // Check and send reminders (runs on load)
  useEffect(() => {
    const sendReminders = async () => {
      const today = new Date();
      for (const s of schedules) {
        const startDate = new Date(s.start_date);
        const daysUntil = differenceInDays(startDate, today);

        const { data: siteRecipients } = await supabase
          .from("profiles")
          .select("auth_user_id")
          .in("role", ["site_installation_mgr", "head_operations"] as any)
          .eq("is_active", true);

        const recipients = siteRecipients ?? [];
        if (recipients.length === 0) continue;

        const { client } = await getAuthedClient();

        // 14-day reminder
        if (daysUntil <= 14 && daysUntil > 5 && !s.reminder_14d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor Reminder — 14 Days",
            body: `Reminder: ${s.subcontractor_name} is due to start work at ${projectName} in 14 days on ${format(startDate, "dd/MM/yyyy")}. Please confirm attendance.`,
            category: "Production",
            related_table: "subcontractor_schedules",
            related_id: s.id,
          })));
          await (client.from("subcontractor_schedules") as any).update({ reminder_14d_sent: true }).eq("id", s.id);
        }

        // 5-day reminder
        if (daysUntil <= 5 && daysUntil > 1 && !s.reminder_5d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor — Action Required",
            body: `Action required: ${s.subcontractor_name} is due on site in 5 days on ${format(startDate, "dd/MM/yyyy")}. Please confirm attendance and materials they will bring.`,
            category: "Production",
            related_table: "subcontractor_schedules",
            related_id: s.id,
          })));
          await (client.from("subcontractor_schedules") as any).update({ reminder_5d_sent: true }).eq("id", s.id);
        }

        // 1-day reminder
        if (daysUntil <= 1 && daysUntil >= 0 && !s.reminder_1d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor — Final Reminder",
            body: `Final reminder: ${s.subcontractor_name} is due on site tomorrow ${format(startDate, "dd/MM/yyyy")}. Awaiting confirmation.`,
            category: "Production",
            related_table: "subcontractor_schedules",
            related_id: s.id,
          })));
          await (client.from("subcontractor_schedules") as any).update({ reminder_1d_sent: true }).eq("id", s.id);

          // Escalation if not confirmed
          if (!s.confirmed && !s.escalation_sent) {
            const { data: escalationRecipients } = await supabase
              .from("profiles")
              .select("auth_user_id")
              .in("role", ["site_installation_mgr", "head_operations"] as any)
              .eq("is_active", true);

            if (escalationRecipients?.length) {
              await insertNotifications(escalationRecipients.map((r: any) => ({
                recipient_id: r.auth_user_id,
                title: "Subcontractor Not Confirmed — Escalation",
                body: `${s.subcontractor_name} has not confirmed attendance for tomorrow at ${projectName}. Immediate follow-up required.`,
                category: "Production",
                related_table: "subcontractor_schedules",
                related_id: s.id,
              })));
            }
            await (client.from("subcontractor_schedules") as any).update({ escalation_sent: true }).eq("id", s.id);
          }
        }
      }
    };

    if (schedules.length > 0) sendReminders();
  }, [schedules, projectName]);

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-2" style={{ color: "#1A1A1A" }}>
            <Users className="h-4 w-4" style={{ color: "#006039" }} />
            Subcontractor Schedule
          </CardTitle>
          {canManage && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)} className="text-xs h-6">
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {showAdd && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input placeholder="Subcontractor name" value={newName} onChange={(e) => setNewName(e.target.value)} className="text-sm" />
            </div>
            <div>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="text-sm" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </Button>
          </div>
        )}

        {schedules.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No subcontractors scheduled.</p>
        ) : (
          schedules.map((s) => {
            const startDate = new Date(s.start_date);
            const daysUntil = differenceInDays(startDate, new Date());
            const isShortNotice = daysUntil >= 0 && daysUntil < 1;
            const isPast = daysUntil < 0;

            return (
              <div key={s.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0" style={{ borderColor: "#F0F0F0" }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#1A1A1A" }}>{s.subcontractor_name}</p>
                  <p className="text-xs" style={{ color: "#666666" }}>
                    Start: {format(startDate, "dd/MM/yyyy")}
                    {daysUntil > 0 && ` (${daysUntil} days away)`}
                    {daysUntil === 0 && " (today)"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.confirmed ? (
                    <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "none" }}>
                      <Check className="h-3 w-3 mr-0.5" /> Confirmed
                    </Badge>
                  ) : (
                    <>
                      {isShortNotice && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6" style={{ color: "#F40009", borderColor: "#F40009" }}
                          onClick={() => handleEmergencyAdvance(s)}>
                          Emergency Advance
                        </Button>
                      )}
                      {canManage && !isPast && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => handleConfirm(s.id)}>
                          Confirm
                        </Button>
                      )}
                      {!isPast && daysUntil <= 1 && (
                        <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: "#FDE8E8", color: "#F40009", border: "none" }}>
                          <AlertTriangle className="h-3 w-3 mr-0.5" /> Not Confirmed
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
