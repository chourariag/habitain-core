import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError } from "@supabase/supabase-js";

type Row = {
  id: string;
  project_id: string;
  kickoff_deadline: string;
  project_setup_deadline: string | null;
  status: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_notes: string | null;
  meeting_link: string | null;
  projects?: { name: string | null } | null;
};

interface Props {
  userRole: string | null;
}

function hoursLeft(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 36e5);
}

export default function KickoffMeetingCard({ userRole }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState<Record<string, boolean>>({});
  const [cancelDrafts, setCancelDrafts] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { date: string; time: string; notes: string; link: string }>>({});

  const canAct = userRole === "operations_architect" || userRole === "managing_director"
    || userRole === "principal_architect" || userRole === "head_operations" || userRole === "super_admin";

  async function load() {
    const { data } = await supabase
      .from("kickoff_meetings" as any)
      .select("id, project_id, kickoff_deadline, project_setup_deadline, status, meeting_date, meeting_time, meeting_notes, meeting_link, projects:project_id(name)")
      .in("status", ["pending_initiation"])
      .order("kickoff_deadline", { ascending: true });
    setRows((data as any) || []);
  }

  useEffect(() => { load(); }, []);

  async function confirm(row: Row) {
    const d = drafts[row.id];
    if (!d?.date || !d?.time) { toast.error("Pick a meeting date and time"); return; }
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.rpc("confirm_kickoff_meeting" as any, {
        _kickoff_id: row.id, _meeting_date: d.date, _meeting_time: d.time,
        _notes: d.notes || null, _meeting_link: d.link?.trim() || null,
      });
      if (error) throw error;

      const attendees = ((data as any)?.attendees ?? []) as Array<{ email: string | null }>;
      const emails = attendees.map((a) => a?.email).filter(Boolean) as string[];
      const projectName = (data as any)?.project_name ?? "Project";
      const setupDeadline = (data as any)?.project_setup_deadline;

      const { data: sendData, error: sendError } = await supabase.functions.invoke("send-calendar-invite", {
        body: {
          attendee_emails: emails,
          title: `GFC Kickoff Meeting — ${projectName}`,
          date: d.date,
          time: d.time,
          duration_minutes: 60,
          meeting_link: d.link?.trim() || null,
          notes: [
            d.notes,
            `Project Setup Template due within 72 hours of GFC Budget approval${setupDeadline ? ` (${new Date(setupDeadline).toLocaleString("en-IN")})` : ""}.`,
            "Please review the GFC Budget and come prepared to confirm factory schedule and material plan dates.",
          ].filter(Boolean).join("\n\n"),
        },
      });

      if (sendError || (sendData as any)?.success === false) {
        const detail = sendError instanceof FunctionsHttpError
          ? await sendError.context.text()
          : (sendData as any)?.error ?? sendError?.message ?? "unknown error";
        toast.error(`Meeting date saved, but the invite could not be sent: ${detail}`);
        load();
        return;
      }

      toast.success(`Meeting confirmed. Invite sent to ${((sendData as any)?.sent_to ?? emails).length} attendee(s).`);
      load();
    } catch (e: any) {
      const raw = String(e?.message ?? "");
      const friendly = /operations architect/i.test(raw)
        ? "You don't have permission to confirm this kickoff meeting."
        : /not found/i.test(raw)
        ? "This kickoff meeting no longer exists. Refresh and try again."
        : /violates|constraint|relation|column/i.test(raw)
        ? "Couldn't confirm the meeting — some project details are incomplete. Please contact an admin."
        : raw || "Failed to confirm";
      toast.error(friendly);
    } finally {
      setBusyId(null);
    }
  }
  async function cancelMeeting(row: Row) {
    const remarks = (cancelDrafts[row.id] ?? "").trim();
    if (!remarks) { toast.error("Cancellation remarks are required"); return; }
    setBusyId(row.id);
    try {
      const { error } = await supabase.rpc("cancel_kickoff_meeting" as any, {
        _kickoff_id: row.id, _remarks: remarks,
      });
      if (error) throw error;
      toast.success("Kickoff meeting cancelled. The team has been notified.");
      setCancelOpen((p) => ({ ...p, [row.id]: false }));
      setCancelDrafts((p) => ({ ...p, [row.id]: "" }));
      load();
    } catch (e: any) {
      const raw = String(e?.message ?? "");
      toast.error(/remarks are required/i.test(raw)
        ? "Cancellation remarks are required"
        : /can cancel/i.test(raw)
        ? "You don't have permission to cancel this kickoff meeting."
        : raw || "Failed to cancel");
    } finally {
      setBusyId(null);
    }
  }


  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 space-y-3" style={{ background: "#F7F7F7", borderColor: "#E5E5E5" }}>
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5" style={{ color: "#006039" }} />
        <div className="font-display font-bold">GFC Kickoff Meetings — initiation pending</div>
      </div>
      {rows.map((r) => {
        const hrs = hoursLeft(r.kickoff_deadline);
        const red = hrs < 12;
        const draft = drafts[r.id] ?? { date: "", time: "", notes: "", link: "" };
        return (
          <div key={r.id} className="rounded-md border p-3 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">
                Initiate GFC Kickoff Meeting — {r.projects?.name ?? "Project"}
              </div>
              <div className="text-xs font-bold" style={{ color: red ? "#F40009" : "#006039" }}>
                {hrs > 0 ? `${hrs}h remaining` : `${Math.abs(hrs)}h overdue`}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              GFC drawings are complete. Coordinate with Karthik, Stanley, Suraj and Azad to agree a meeting date.
              Calendar invite will be auto-sent to all attendees (incl. MD & Principal Architect).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Meeting Date</Label>
                <Input type="date" value={draft.date}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...draft, date: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Meeting Time</Label>
                <Input type="time" value={draft.time}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...draft, time: e.target.value } }))} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea rows={1} value={draft.notes}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...draft, notes: e.target.value } }))} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Meeting Link (Zoom / Google Meet — optional)</Label>
                <Input type="url" placeholder="https://meet.google.com/..." value={draft.link}
                  onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...draft, link: e.target.value } }))} />
              </div>
            </div>
            {cancelOpen[r.id] && (
              <div>
                <Label className="text-xs">Cancellation Remarks (required)</Label>
                <Textarea rows={2} value={cancelDrafts[r.id] ?? ""} placeholder="Why is this kickoff meeting being cancelled?"
                  onChange={(e) => setCancelDrafts((p) => ({ ...p, [r.id]: e.target.value }))} />
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {cancelOpen[r.id] ? (
                <>
                  <Button size="sm" variant="ghost" disabled={busyId === r.id}
                    onClick={() => setCancelOpen((p) => ({ ...p, [r.id]: false }))}>
                    Keep Meeting
                  </Button>
                  <Button size="sm" variant="outline" disabled={!canAct || busyId === r.id || !(cancelDrafts[r.id] ?? "").trim()}
                    className="text-destructive border-destructive/40" onClick={() => cancelMeeting(r)}>
                    {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Confirm Cancellation
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" disabled={!canAct || busyId === r.id}
                  onClick={() => setCancelOpen((p) => ({ ...p, [r.id]: true }))}>
                  <XCircle className="h-4 w-4 mr-1" /> Cancel Meeting
                </Button>
              )}
              <Button size="sm" disabled={!canAct || busyId === r.id} onClick={() => confirm(r)}
                style={{ background: "#006039", color: "#fff" }}>
                {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Confirm Meeting Date & Send Invite
              </Button>
            </div>

          </div>
        );
      })}
    </div>
  );
}
