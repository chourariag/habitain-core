import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  project_id: string;
  kickoff_deadline: string;
  project_setup_deadline: string | null;
  status: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_notes: string | null;
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
  const [drafts, setDrafts] = useState<Record<string, { date: string; time: string; notes: string }>>({});

  const canAct = userRole === "operations_architect" || userRole === "managing_director"
    || userRole === "principal_architect" || userRole === "super_admin";

  async function load() {
    const { data } = await supabase
      .from("kickoff_meetings" as any)
      .select("id, project_id, kickoff_deadline, project_setup_deadline, status, meeting_date, meeting_time, meeting_notes, projects:project_id(name)")
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
        _kickoff_id: row.id, _meeting_date: d.date, _meeting_time: d.time, _notes: d.notes || null,
      });
      if (error) throw error;
      // TODO: Send via Zoho Calendar API once ZOHO_CLIENT_ID is configured
      // eslint-disable-next-line no-console
      console.log("KICKOFF INVITE TO SEND:", {
        attendees: (data as any)?.attendees ?? [],
        meeting_date: d.date,
        meeting_time: d.time,
        project: (data as any)?.project_name,
        project_setup_deadline: (data as any)?.project_setup_deadline,
        body: `Project Setup Template due within 72 hours of GFC Budget approval (${(data as any)?.project_setup_deadline}). Please review GFC Budget and come prepared to confirm factory schedule and material plan dates.`,
      });
      toast.success("Meeting confirmed. Calendar invites queued.");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to confirm");
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
        const draft = drafts[r.id] ?? { date: "", time: "", notes: "" };
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
            </div>
            <div className="flex justify-end">
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
