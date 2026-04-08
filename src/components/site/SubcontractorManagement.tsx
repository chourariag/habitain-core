import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Check, AlertTriangle, Users, Phone, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

interface Props {
  projectId: string;
  projectName: string;
  userRole: string | null;
}

const WORK_TYPES = ["Electrical", "Plumbing", "Civil", "Painting", "Carpentry", "Welding", "MEP", "Finishing", "Other"];
const SCOPES = ["factory", "site", "both"];

export function SubcontractorManagement({ projectId, projectName, userRole }: Props) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [workType, setWorkType] = useState("");
  const [scope, setScope] = useState("site");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");

  const canManage = ["site_installation_mgr", "site_engineer", "head_operations", "super_admin", "managing_director", "production_head"].includes(userRole ?? "");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.from("subcontractor_assignments") as any)
      .select("*").eq("project_id", projectId).order("scheduled_start", { ascending: true });
    setRecords(data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!companyName.trim() || !startDate) { toast.error("Company name and start date required"); return; }
    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();
      await (client.from("subcontractor_assignments") as any).insert({
        project_id: projectId,
        company_name: companyName.trim(),
        work_type: workType || null,
        scope,
        contact_person: contactPerson.trim() || null,
        phone: phone.trim() || null,
        scheduled_start: startDate,
        scheduled_completion: completionDate || null,
        created_by: user.id,
      });
      toast.success("Subcontractor added");
      setCompanyName(""); setWorkType(""); setScope("site"); setContactPerson(""); setPhone(""); setStartDate(""); setCompletionDate("");
      setShowAdd(false);
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
      await (client.from("subcontractor_assignments") as any).update({
        confirmed: true,
        confirmed_at: new Date().toISOString(),
        status: "confirmed",
      }).eq("id", id);

      // Notify production head and site manager
      const { data: recipients } = await supabase.from("profiles").select("auth_user_id")
        .in("role", ["production_head", "site_installation_mgr"] as any).eq("is_active", true);
      if (recipients?.length) {
        const rec = records.find(r => r.id === id);
        await insertNotifications(recipients.map((r: any) => ({
          recipient_id: r.auth_user_id,
          title: "Subcontractor Confirmed",
          body: `Materials confirmed for ${rec?.company_name} — ${projectName}. Production can proceed as planned.`,
          category: "Production",
          related_table: "subcontractor_assignments",
          related_id: id,
          navigate_to: "/site-hub",
        })));
      }
      toast.success("Attendance confirmed");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    }
  };

  // Send reminders on load
  useEffect(() => {
    const sendReminders = async () => {
      const today = new Date();
      for (const s of records) {
        if (!s.scheduled_start) continue;
        const startDt = new Date(s.scheduled_start);
        const daysUntil = differenceInDays(startDt, today);

        const { data: siteRecipients } = await supabase.from("profiles").select("auth_user_id")
          .in("role", ["site_installation_mgr", "head_operations"] as any).eq("is_active", true);
        const recipients = siteRecipients ?? [];
        if (recipients.length === 0) continue;

        const { client } = await getAuthedClient();

        // 14-day reminder
        if (daysUntil <= 14 && daysUntil > 5 && !s.reminder_14d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor Reminder — 14 Days",
            body: `${s.company_name} is due to start at ${projectName} in 14 days on ${format(startDt, "dd/MM/yyyy")}. Please confirm attendance, materials, and manpower.`,
            category: "Production",
            related_table: "subcontractor_assignments",
            related_id: s.id,
          })));
          await (client.from("subcontractor_assignments") as any).update({ reminder_14d_sent: true }).eq("id", s.id);
        }

        // 5-day reminder
        if (daysUntil <= 5 && daysUntil > 1 && !s.reminder_5d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor — Action Required",
            body: `Action required: ${s.company_name} due on site in 5 days on ${format(startDt, "dd/MM/yyyy")}. Please confirm attendance and what materials they will bring.`,
            category: "Production",
            related_table: "subcontractor_assignments",
            related_id: s.id,
          })));
          await (client.from("subcontractor_assignments") as any).update({ reminder_5d_sent: true }).eq("id", s.id);
        }

        // 1-day reminder
        if (daysUntil <= 1 && daysUntil >= 0 && !s.reminder_1d_sent) {
          await insertNotifications(recipients.map((r: any) => ({
            recipient_id: r.auth_user_id,
            title: "Subcontractor — Final Reminder",
            body: `Final reminder: ${s.company_name} due tomorrow ${format(startDt, "dd/MM/yyyy")}. Awaiting confirmation.`,
            category: "Production",
            related_table: "subcontractor_assignments",
            related_id: s.id,
          })));
          await (client.from("subcontractor_assignments") as any).update({ reminder_1d_sent: true }).eq("id", s.id);

          // Escalation if not confirmed
          if (!s.confirmed && !s.escalation_sent) {
            const { data: escalationRecipients } = await supabase.from("profiles").select("auth_user_id")
              .in("role", ["site_installation_mgr", "head_operations"] as any).eq("is_active", true);
            if (escalationRecipients?.length) {
              await insertNotifications(escalationRecipients.map((r: any) => ({
                recipient_id: r.auth_user_id,
                title: "Subcontractor Not Confirmed — Escalation",
                body: `${s.company_name} has not confirmed attendance for tomorrow at ${projectName}. Immediate follow-up required.`,
                category: "Production",
                related_table: "subcontractor_assignments",
                related_id: s.id,
              })));
            }
            await (client.from("subcontractor_assignments") as any).update({ escalation_sent: true }).eq("id", s.id);
          }
        }
      }
    };
    if (records.length > 0) sendReminders();
  }, [records, projectName]);

  const statusBadge = (s: any) => {
    if (s.status === "completed") return { bg: "#E8F2ED", color: "#006039", label: "Completed" };
    if (s.confirmed) return { bg: "#E8F2ED", color: "#006039", label: "Confirmed" };
    const daysUntil = s.scheduled_start ? differenceInDays(new Date(s.scheduled_start), new Date()) : 999;
    if (daysUntil < 0) return { bg: "#F7F7F7", color: "#666666", label: "Past Due" };
    if (daysUntil <= 1) return { bg: "#FDE8E8", color: "#F40009", label: "Not Confirmed" };
    if (daysUntil <= 5) return { bg: "#FFF8E8", color: "#D4860A", label: "Pending" };
    return { bg: "#F7F7F7", color: "#666666", label: "Scheduled" };
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#1A1A1A" }}>
          <Users className="h-4 w-4" style={{ color: "#006039" }} />
          Subcontractor Assignments ({records.length})
        </h3>
        {canManage && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="text-xs h-7 gap-1">
            <Plus className="h-3 w-3" /> Add Subcontractor
          </Button>
        )}
      </div>

      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="Company name *" value={companyName} onChange={e => setCompanyName(e.target.value)} className="text-sm" />
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Work type" /></SelectTrigger>
                <SelectContent>{WORK_TYPES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Scope" /></SelectTrigger>
                <SelectContent>
                  {SCOPES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Contact person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} className="text-sm" />
              <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="text-sm" />
              <div />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Start date *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Completion date</label>
                <Input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={adding}>
                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 ? (
        <Card><CardContent className="py-8 text-center"><p className="text-sm text-muted-foreground">No subcontractors assigned to this project.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {records.map(s => {
            const badge = statusBadge(s);
            const daysUntil = s.scheduled_start ? differenceInDays(new Date(s.scheduled_start), new Date()) : null;
            return (
              <Card key={s.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>{s.company_name}</p>
                        {s.work_type && <Badge variant="outline" className="text-[10px]">{s.work_type}</Badge>}
                        <Badge variant="outline" className="text-[10px]" style={{ backgroundColor: badge.bg, color: badge.color, border: "none" }}>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "#666666" }}>
                        {s.scope && <span>Scope: {s.scope}</span>}
                        {s.scheduled_start && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(s.scheduled_start), "dd/MM/yyyy")}
                            {s.scheduled_completion && ` — ${format(new Date(s.scheduled_completion), "dd/MM/yyyy")}`}
                          </span>
                        )}
                        {daysUntil !== null && daysUntil > 0 && <span>({daysUntil} days away)</span>}
                        {daysUntil === 0 && <span style={{ color: "#D4860A" }}>(today)</span>}
                      </div>
                      {(s.contact_person || s.phone) && (
                        <div className="flex items-center gap-3 text-xs" style={{ color: "#666666" }}>
                          {s.contact_person && <span>{s.contact_person}</span>}
                          {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!s.confirmed && canManage && daysUntil !== null && daysUntil >= 0 && (
                        <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => handleConfirm(s.id)}>
                          <Check className="h-3 w-3 mr-0.5" /> Confirm
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
