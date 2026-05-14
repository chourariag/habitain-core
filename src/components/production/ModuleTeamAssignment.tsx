import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";

const ASSIGN_ROLES = ["super_admin", "managing_director", "head_operations", "production_head", "factory_floor_supervisor", "fabrication_foreman"];

interface Props {
  projectId: string;
  moduleId: string;
  currentStage: string | null;
  userRole: string | null;
}

export function ModuleTeamAssignment({ projectId, moduleId, currentStage, userRole }: Props) {
  const canAssign = userRole ? ASSIGN_ROLES.includes(userRole) : false;
  const [teams, setTeams] = useState<{ id: string; team_name: string; specialisation: string | null }[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [teamId, setTeamId] = useState("");
  const [stage, setStage] = useState(currentStage ?? "");
  const [tasks, setTasks] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: h }] = await Promise.all([
      supabase.from("labour_teams").select("id,team_name,specialisation").eq("status", "active").order("team_name"),
      supabase.from("module_team_assignments")
        .select("id,assignment_date,stage,expected_tasks,notes,team:labour_teams(team_name)")
        .eq("module_id", moduleId).eq("is_archived", false)
        .order("assignment_date", { ascending: false }).limit(7),
    ]);
    setTeams((t as any) ?? []);
    setHistory((h as any) ?? []);
    // pre-fill from today's row if exists
    const today = (h as any[] | null)?.find((x) => x.assignment_date === date);
    if (today) {
      setTeamId(today.team_id ?? "");
      setStage(today.stage ?? currentStage ?? "");
      setTasks(today.expected_tasks ?? "");
    }
    setLoading(false);
  }, [moduleId, date, currentStage]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!teamId) return toast.error("Select a team");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("module_team_assignments").upsert({
      project_id: projectId,
      module_id: moduleId,
      team_id: teamId,
      stage: stage || null,
      assignment_date: date,
      expected_tasks: tasks || null,
      assigned_by: u.user?.id,
    }, { onConflict: "module_id,assignment_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Team assigned");
    load();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Daily Team Assignment</span>
      </div>
      {canAssign ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.team_name}{t.specialisation ? ` — ${t.specialisation}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Stage</Label>
              <Input value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Stage" />
            </div>
            <div>
              <Label className="text-xs">Expected Tasks</Label>
              <Input value={tasks} onChange={(e) => setTasks(e.target.value)} placeholder="Today's tasks" />
            </div>
          </div>
          <Button size="sm" onClick={save} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Save
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">View only.</p>
      )}
      {history.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="text-xs text-muted-foreground mb-1">Recent assignments</p>
          <div className="space-y-1">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                <Badge variant="outline">{h.assignment_date}</Badge>
                <span className="font-medium">{h.team?.team_name ?? "—"}</span>
                {h.stage && <span className="text-muted-foreground">· {h.stage}</span>}
                {h.expected_tasks && <span className="text-muted-foreground truncate">· {h.expected_tasks}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
