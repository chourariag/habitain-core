import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Compass } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/roles";
import {
  useProjectArchitect, fetchArchitectCandidates, ARCHITECT_ASSIGN_ROLES,
  type ArchitectProfile,
} from "@/hooks/useProjectArchitect";

/**
 * Assign / reassign the Project Architect. S-1 and E-5 gate ownership
 * resolves from this value live — reassigning updates both gates immediately.
 */
export function ProjectArchitectCard({ projectId, userRole }: { projectId: string; userRole: string | null }) {
  const { architect, loading, refresh } = useProjectArchitect(projectId);
  const canAssign = ARCHITECT_ASSIGN_ROLES.includes(userRole ?? "");
  const [candidates, setCandidates] = useState<ArchitectProfile[]>([]);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing && candidates.length === 0) fetchArchitectCandidates().then(setCandidates);
  }, [editing, candidates.length]);

  useEffect(() => { setValue(architect?.id ?? ""); }, [architect?.id]);

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("projects")
      .update({ project_architect_id: value || null, updated_by: user?.id ?? null } as any)
      .eq("id", projectId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Project Architect updated");
    setEditing(false);
    refresh();
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Compass className="h-4 w-4 shrink-0" style={{ color: "#006039" }} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">Project Architect</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : architect ? (
            <p className="text-sm text-muted-foreground">
              {architect.display_name || "—"}
              {architect.role && <span className="ml-1.5 text-xs">· {ROLE_LABELS[architect.role] ?? architect.role.replace(/_/g, " ")}</span>}
            </p>
          ) : (
            <p className="text-xs font-medium" style={{ color: "#F40009" }}>
              Unassigned — S-1 and E-5 gates have no owner until an architect is assigned.
            </p>
          )}
        </div>

        {canAssign && !editing && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditing(true)}>
            {architect ? "Reassign" : "Assign"}
          </Button>
        )}

        {canAssign && editing && (
          <div className="flex items-center gap-2">
            <Select value={value || "__none__"} onValueChange={v => setValue(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue placeholder="Select architect" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {candidates.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name || "—"}{c.role ? ` · ${ROLE_LABELS[c.role] ?? c.role.replace(/_/g, " ")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(false); setValue(architect?.id ?? ""); }}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
