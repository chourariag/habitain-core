import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, Users, Pencil, X } from "lucide-react";
import { toast } from "sonner";

interface Worker {
  id: string;
  name: string;
  skill_type: string;
  monthly_salary: number;
  status: string;
}

interface Team {
  id: string;
  team_name: string;
  team_head_id: string;
  specialisation: string | null;
  status: string;
  team_head?: Worker | null;
  members?: { id: string; worker_id: string; left_date: string | null; worker?: Worker | null }[];
}

const FOREMEN_NAMES = ["Abu Hassan", "Ajay Nishad", "Shambu Yadav"];

const MANAGE_ROLES = ["super_admin", "managing_director", "production_head", "head_operations"];

export function LabourTeamsManager({ userRole }: { userRole: string | null }) {
  const canManage = userRole ? MANAGE_ROLES.includes(userRole) : false;

  const [teams, setTeams] = useState<Team[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);

  const [teamName, setTeamName] = useState("");
  const [headId, setHeadId] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [specialisation, setSpecialisation] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [reassignReason, setReassignReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: teamData }, { data: workerData }, { data: memberData }] = await Promise.all([
      supabase.from("labour_teams").select("*").order("created_at", { ascending: false }),
      supabase.from("labour_workers").select("id,name,skill_type,monthly_salary,status").eq("status", "active").order("name"),
      supabase.from("labour_team_members").select("id,team_id,worker_id,left_date"),
    ]);
    const workersList = (workerData ?? []) as Worker[];
    const membersByTeam = new Map<string, any[]>();
    (memberData ?? []).forEach((m: any) => {
      const list = membersByTeam.get(m.team_id) ?? [];
      list.push({ ...m, worker: workersList.find((w) => w.id === m.worker_id) ?? null });
      membersByTeam.set(m.team_id, list);
    });
    const enriched = (teamData ?? []).map((t: any) => ({
      ...t,
      team_head: workersList.find((w) => w.id === t.team_head_id) ?? null,
      members: membersByTeam.get(t.id) ?? [],
    }));
    setTeams(enriched as Team[]);
    setWorkers(workersList.filter((w) => !FOREMEN_NAMES.some((n) => w.name.toLowerCase().includes(n.toLowerCase()))));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditing(null);
    setTeamName(""); setHeadId(""); setMemberIds([]);
    setSpecialisation(""); setStatus("active"); setReassignReason("");
    setDialogOpen(true);
  };

  const openEdit = (t: Team) => {
    setEditing(t);
    setTeamName(t.team_name);
    setHeadId(t.team_head_id);
    setMemberIds((t.members ?? []).filter((m) => !m.left_date).map((m) => m.worker_id));
    setSpecialisation(t.specialisation ?? "");
    setStatus(t.status as "active" | "inactive");
    setReassignReason("");
    setDialogOpen(true);
  };

  // Workers already in another active team
  const lockedWorkerIds = new Set<string>();
  teams.forEach((t) => {
    if (editing && t.id === editing.id) return;
    (t.members ?? []).filter((m) => !m.left_date).forEach((m) => lockedWorkerIds.add(m.worker_id));
  });

  const allMemberIds = headId ? Array.from(new Set([headId, ...memberIds])) : memberIds;

  const save = async () => {
    if (!teamName.trim()) return toast.error("Team name required");
    if (!headId) return toast.error("Team head required");
    if (allMemberIds.length < 2) return toast.error("Minimum 2 members (including head)");
    if (allMemberIds.length > 4) return toast.error("Maximum 4 members per team");
    if (editing && reassignReason.trim().length === 0) {
      const oldIds = new Set((editing.members ?? []).filter((m) => !m.left_date).map((m) => m.worker_id));
      const newIds = new Set(allMemberIds);
      const changed = oldIds.size !== newIds.size || [...oldIds].some((id) => !newIds.has(id));
      if (changed) return toast.error("Provide a reason for reassigning workers");
    }

    setSaving(true);
    try {
      let teamId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("labour_teams").update({
          team_name: teamName.trim(),
          team_head_id: headId,
          specialisation: specialisation.trim() || null,
          status,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("labour_teams").insert({
          team_name: teamName.trim(),
          team_head_id: headId,
          specialisation: specialisation.trim() || null,
          status,
        }).select("id").single();
        if (error) throw error;
        teamId = data!.id;
      }

      // Reconcile members
      const existing = (editing?.members ?? []).filter((m) => !m.left_date);
      const existingIds = new Set(existing.map((m) => m.worker_id));
      const newIds = new Set(allMemberIds);

      const toRemove = existing.filter((m) => !newIds.has(m.worker_id));
      const toAdd = allMemberIds.filter((id) => !existingIds.has(id));

      if (toRemove.length) {
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from("labour_team_members").update({
          left_date: today,
          reassign_reason: reassignReason.trim() || null,
        }).in("id", toRemove.map((m) => m.id));
      }
      if (toAdd.length) {
        await supabase.from("labour_team_members").insert(
          toAdd.map((wid) => ({ team_id: teamId!, worker_id: wid, reassign_reason: reassignReason.trim() || null }))
        );
      }

      toast.success(editing ? "Team updated" : "Team created");
      setDialogOpen(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg">Labour Teams</h3>
          <p className="text-xs text-muted-foreground">Group workers (2-4) into teams for assignment & cost tracking.</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} size="sm" className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-1" /> New Team
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
          No teams yet.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map((t) => {
            const active = (t.members ?? []).filter((m) => !m.left_date);
            return (
              <div key={t.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{t.team_name}</span>
                      <Badge variant={t.status === "active" ? "default" : "secondary"} className="text-xs">{t.status}</Badge>
                    </div>
                    {t.specialisation && <p className="text-xs text-muted-foreground mt-0.5">{t.specialisation}</p>}
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div><span className="text-muted-foreground">Head:</span> <span className="font-medium">{t.team_head?.name ?? "—"}</span></div>
                  <div className="text-muted-foreground text-xs">Members ({active.length}):</div>
                  <div className="flex flex-wrap gap-1">
                    {active.map((m) => (
                      <Badge key={m.id} variant="outline" className="text-xs">{m.worker?.name ?? m.worker_id.slice(0, 6)}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Team" : "Create Team"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Team Name</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Team Alpha" />
            </div>
            <div>
              <Label>Team Head</Label>
              <Select value={headId} onValueChange={setHeadId}>
                <SelectTrigger><SelectValue placeholder="Select head" /></SelectTrigger>
                <SelectContent>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id} disabled={lockedWorkerIds.has(w.id) && w.id !== headId}>
                      {w.name} <span className="text-xs text-muted-foreground">({w.skill_type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Members (incl. head: {allMemberIds.length}/4)</Label>
              <ScrollArea className="h-48 border border-border rounded-md p-2">
                <div className="space-y-1.5">
                  {workers.filter((w) => w.id !== headId).map((w) => {
                    const checked = memberIds.includes(w.id);
                    const locked = lockedWorkerIds.has(w.id) && !checked;
                    return (
                      <label key={w.id} className={`flex items-center gap-2 text-sm ${locked ? "opacity-50" : ""}`}>
                        <Checkbox
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={(v) => {
                            if (v) {
                              if (allMemberIds.length >= 4) return toast.error("Max 4 members");
                              setMemberIds([...memberIds, w.id]);
                            } else {
                              setMemberIds(memberIds.filter((id) => id !== w.id));
                            }
                          }}
                        />
                        <span>{w.name}</span>
                        <span className="text-xs text-muted-foreground">({w.skill_type})</span>
                        {locked && <span className="text-xs text-warning ml-auto">In another team</span>}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Specialisation</Label>
                <Input value={specialisation} onChange={(e) => setSpecialisation(e.target.value)} placeholder="Steel, Boarding..." />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: "active" | "inactive") => setStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing && (
              <div>
                <Label>Reassign Reason (required if changing members)</Label>
                <Input value={reassignReason} onChange={(e) => setReassignReason(e.target.value)} placeholder="Why are workers being moved?" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}><X className="h-4 w-4 mr-1" />Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
