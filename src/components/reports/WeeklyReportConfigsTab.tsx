import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { DAY_NAMES } from "@/lib/weekly-reports";
import { toast } from "sonner";

type Cfg = {
  id?: string;
  report_name: string;
  assigned_role: AppRole | null;
  assigned_user_id: string | null;
  deadline_day: number;
  deadline_time: string;
  frequency: "weekly" | "fortnightly";
  reviewer_user_id: string | null;
  reviewer_role: AppRole | null;
  active: boolean;
};

const blank: Cfg = {
  report_name: "",
  assigned_role: null,
  assigned_user_id: null,
  deadline_day: 5,
  deadline_time: "16:00",
  frequency: "weekly",
  reviewer_user_id: null,
  reviewer_role: null,
  active: true,
};

export function WeeklyReportConfigsTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Cfg | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: cfgs }, { data: profs }] = await Promise.all([
      supabase.from("weekly_report_configs").select("*").order("report_name"),
      supabase.from("profiles").select("id,display_name,role").eq("is_active", true).order("display_name"),
    ]);
    setRows(cfgs || []);
    setProfiles(profs || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!editing) return;
    if (!editing.report_name.trim()) { toast.error("Report name required"); return; }
    if (!editing.assigned_role && !editing.assigned_user_id) { toast.error("Assign to role or user"); return; }
    if (!editing.reviewer_role && !editing.reviewer_user_id) { toast.error("Reviewer required"); return; }
    setSaving(true);
    const { id, ...payload } = editing;
    const { error } = id
      ? await supabase.from("weekly_report_configs").update(payload).eq("id", id)
      : await supabase.from("weekly_report_configs").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); setEditing(null); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-display text-lg font-bold">Weekly Reports Configuration</h3>
          <p className="text-sm text-muted-foreground">Define who must submit which weekly status report.</p>
        </div>
        <Button onClick={() => setEditing({ ...blank })} style={{ backgroundColor: "#006039" }}>
          <Plus className="h-4 w-4 mr-1" /> Add Report
        </Button>
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Report</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.report_name}</TableCell>
                  <TableCell>
                    {r.assigned_user_id
                      ? profiles.find((p) => p.id === r.assigned_user_id)?.display_name || "—"
                      : ROLE_LABELS[r.assigned_role as AppRole] || "—"}
                  </TableCell>
                  <TableCell>{DAY_NAMES[r.deadline_day]} {r.deadline_time?.slice(0,5)}</TableCell>
                  <TableCell className="capitalize">{r.frequency}</TableCell>
                  <TableCell>
                    {r.reviewer_user_id
                      ? profiles.find((p) => p.id === r.reviewer_user_id)?.display_name || "—"
                      : ROLE_LABELS[r.reviewer_role as AppRole] || "—"}
                  </TableCell>
                  <TableCell>{r.active ? "Yes" : "No"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reports configured.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} Weekly Report</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Report Name</label>
                <Input value={editing.report_name} onChange={(e) => setEditing({ ...editing, report_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Assigned Role</label>
                  <Select value={editing.assigned_role ?? "_none"} onValueChange={(v) => setEditing({ ...editing, assigned_role: v === "_none" ? null : v as AppRole, assigned_user_id: null })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="_none">— none —</SelectItem>
                      {Object.entries(ROLE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Or Specific User</label>
                  <Select value={editing.assigned_user_id ?? "_none"} onValueChange={(v) => setEditing({ ...editing, assigned_user_id: v === "_none" ? null : v, assigned_role: null })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="_none">— none —</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Deadline Day</label>
                  <Select value={String(editing.deadline_day)} onValueChange={(v) => setEditing({ ...editing, deadline_day: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1,2,3,4,5,6].map((d) => <SelectItem key={d} value={String(d)}>{DAY_NAMES[d]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Deadline Time</label>
                  <Input type="time" value={editing.deadline_time.slice(0,5)} onChange={(e) => setEditing({ ...editing, deadline_time: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Frequency</label>
                  <Select value={editing.frequency} onValueChange={(v: any) => setEditing({ ...editing, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Reviewer Role</label>
                  <Select value={editing.reviewer_role ?? "_none"} onValueChange={(v) => setEditing({ ...editing, reviewer_role: v === "_none" ? null : v as AppRole, reviewer_user_id: null })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="_none">— none —</SelectItem>
                      {Object.entries(ROLE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Or Specific Reviewer</label>
                  <Select value={editing.reviewer_user_id ?? "_none"} onValueChange={(v) => setEditing({ ...editing, reviewer_user_id: v === "_none" ? null : v, reviewer_role: null })}>
                    <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="_none">— none —</SelectItem>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editing.active} onCheckedChange={(c) => setEditing({ ...editing, active: c })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving} style={{ backgroundColor: "#006039" }}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
