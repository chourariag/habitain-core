import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  EDIT_ROLES, STAGE_STATUSES, STATUS_STYLES, type DesignStageStatus,
} from "@/lib/design-schedule";

type StageDef = {
  id: string; stage_code: string; stage_name: string; stage_order: number;
  pipeline_type: "habitainer" | "ads"; stage_group: string | null;
  is_mandatory: boolean; is_production_gate: boolean; is_read_only: boolean;
};
type ProjectStage = {
  id: string; project_id: string; stage_definition_id: string;
  status: DesignStageStatus; planned_date: string | null; actual_date: string | null;
  owner_id: string | null; notes: string | null;
};
type Profile = { id: string; display_name: string | null; email: string | null };

export function ProjectDesignScheduleTab({ projectId, projectType, userRole }: {
  projectId: string; projectType: string | null; userRole: string | null;
}) {
  const canEdit = EDIT_ROLES.includes(userRole ?? "");
  const pipeline: "habitainer" | "ads" = (projectType ?? "").toLowerCase().startsWith("ads") ? "ads" : "habitainer";

  const [loading, setLoading] = useState(true);
  const [defs, setDefs] = useState<StageDef[]>([]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<{ def: StageDef; stage: ProjectStage | null } | null>(null);

  const load = async () => {
    setLoading(true);
    const [defsRes, stagesRes, profRes] = await Promise.all([
      supabase.from("design_stage_definitions").select("*").eq("pipeline_type", pipeline).order("stage_order"),
      supabase.from("project_design_stages").select("*").eq("project_id", projectId),
      supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
    ]);
    const defsData = (defsRes.data ?? []) as StageDef[];
    const stagesData = (stagesRes.data ?? []) as ProjectStage[];
    setDefs(defsData);
    setStages(stagesData);
    setProfiles((profRes.data ?? []) as Profile[]);
    setLoading(false);

    // Lazy-seed missing rows
    if (canEdit && defsData.length) {
      const have = new Set(stagesData.map(s => s.stage_definition_id));
      const missing = defsData.filter(d => !have.has(d.id))
        .map(d => ({ project_id: projectId, stage_definition_id: d.id, status: "Not Started" as DesignStageStatus }));
      if (missing.length > 0) {
        await supabase.from("project_design_stages").insert(missing);
        const refresh = await supabase.from("project_design_stages").select("*").eq("project_id", projectId);
        setStages((refresh.data ?? []) as ProjectStage[]);
      }
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, pipeline]);

  const stageByDef = useMemo(() => {
    const m = new Map<string, ProjectStage>();
    for (const s of stages) m.set(s.stage_definition_id, s);
    return m;
  }, [stages]);

  const ownerMap = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const editable = defs.filter(d => !d.is_read_only);
  const completed = editable.filter(d => stageByDef.get(d.id)?.status === "Completed").length;
  const pct = editable.length > 0 ? Math.round((completed / editable.length) * 100) : 0;

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // Group by stage_group
  const groups: { group: string; defs: StageDef[] }[] = [];
  for (const d of defs) {
    const last = groups[groups.length - 1];
    if (last && last.group === (d.stage_group ?? "")) last.defs.push(d);
    else groups.push({ group: d.stage_group ?? "Other", defs: [d] });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Pre-production progress · {pipeline === "ads" ? "ADS" : "Habitainer"} pipeline</p>
            <p className="text-sm text-muted-foreground">{completed} of {editable.length} stages completed</p>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {groups.map(g => (
        <Card key={g.group}>
          <CardContent className="p-0">
            <div className="px-4 py-2 bg-muted/50 font-display text-sm font-semibold">{g.group}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2 w-[110px]">Stage</th>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="text-left px-3 py-2 w-[140px]">Owner</th>
                    <th className="text-left px-3 py-2 w-[120px]">Planned</th>
                    <th className="text-left px-3 py-2 w-[120px]">Actual</th>
                    <th className="text-left px-3 py-2 w-[130px]">Status</th>
                    <th className="text-left px-3 py-2">Notes</th>
                    {canEdit && <th className="w-[40px]"></th>}
                  </tr>
                </thead>
                <tbody>
                  {g.defs.map(d => {
                    const s = stageByDef.get(d.id);
                    const status = (s?.status ?? "Not Started") as DesignStageStatus;
                    const style = STATUS_STYLES[status];
                    const owner = s?.owner_id ? ownerMap.get(s.owner_id) : null;
                    const skipped = status === "Skipped";
                    return (
                      <tr key={d.id} className="border-t border-border">
                        <td className={`px-3 py-2 font-mono text-xs ${skipped ? "line-through text-muted-foreground" : ""}`}>
                          {d.stage_code}{d.is_production_gate && <Badge className="ml-1" style={{ backgroundColor: "#006039", color: "#fff", border: "none" }}>Gate</Badge>}
                        </td>
                        <td className={`px-3 py-2 ${skipped ? "line-through text-muted-foreground" : ""}`}>{d.stage_name}{!d.is_mandatory && <span className="text-xs text-muted-foreground ml-1">(optional)</span>}</td>
                        <td className="px-3 py-2">{owner?.display_name ?? "—"}</td>
                        <td className="px-3 py-2">{s?.planned_date ? format(parseISO(s.planned_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="px-3 py-2">{s?.actual_date ? format(parseISO(s.actual_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="px-3 py-2">
                          <Badge style={{ backgroundColor: style.bg, color: style.fg, border: "none" }}>{status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs max-w-[260px] truncate" title={s?.notes ?? ""}>
                          {status === "Blocked" && s?.notes ? <span style={{ color: "#F40009" }}>{s.notes}</span> : (s?.notes ?? "—")}
                        </td>
                        {canEdit && !d.is_read_only && (
                          <td className="px-3 py-2">
                            <Button size="icon" variant="ghost" onClick={() => setEditing({ def: d, stage: s ?? null })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        )}
                        {canEdit && d.is_read_only && <td></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {editing && (
        <EditDialog
          def={editing.def}
          stage={editing.stage}
          projectId={projectId}
          profiles={profiles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function EditDialog({ def, stage, projectId, profiles, onClose, onSaved }: {
  def: StageDef; stage: ProjectStage | null; projectId: string;
  profiles: Profile[]; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState<DesignStageStatus>(stage?.status ?? "Not Started");
  const [plannedDate, setPlannedDate] = useState(stage?.planned_date ?? "");
  const [actualDate, setActualDate] = useState(stage?.actual_date ?? "");
  const [ownerId, setOwnerId] = useState(stage?.owner_id ?? "");
  const [notes, setNotes] = useState(stage?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      project_id: projectId,
      stage_definition_id: def.id,
      status,
      planned_date: plannedDate || null,
      actual_date: actualDate || null,
      owner_id: ownerId || null,
      notes: notes || null,
      updated_by: user?.id ?? null,
    };
    const res = stage?.id
      ? await supabase.from("project_design_stages").update(payload).eq("id", stage.id)
      : await supabase.from("project_design_stages").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Stage updated");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{def.stage_code} · {def.stage_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: DesignStageStatus) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Planned Date</Label><Input type="date" value={plannedDate} onChange={e => setPlannedDate(e.target.value)} /></div>
            <div><Label>Actual Date</Label><Input type="date" value={actualDate} onChange={e => setActualDate(e.target.value)} /></div>
          </div>
          <div>
            <Label>Owner</Label>
            <Select value={ownerId || "__none__"} onValueChange={v => setOwnerId(v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.display_name || p.email || "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
