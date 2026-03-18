import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PRODUCTION_STAGES } from "@/components/projects/ProductionStageTracker";

interface Props {
  moduleId: string;
  currentStage: string | null;
  userRole: string | null;
}

interface ScheduleRow {
  id?: string;
  stage_name: string;
  target_start: string | null;
  target_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
}

export function ModuleSchedule({ moduleId, currentStage, userRole }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const canEdit = ["planning_engineer", "super_admin", "managing_director"].includes(userRole ?? "");

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("module_schedule")
      .select("*")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      setRows(data.map((d) => ({
        id: d.id,
        stage_name: d.stage_name,
        target_start: d.target_start,
        target_end: d.target_end,
        actual_start: d.actual_start,
        actual_end: d.actual_end,
      })));
    } else {
      setRows(PRODUCTION_STAGES.map((s) => ({
        stage_name: s,
        target_start: null,
        target_end: null,
        actual_start: null,
        actual_end: null,
      })));
    }
    setLoading(false);
  }, [moduleId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const getStatus = (row: ScheduleRow): { label: string; color: string } => {
    const currentIdx = currentStage ? PRODUCTION_STAGES.indexOf(currentStage as any) : -1;
    const stageIdx = PRODUCTION_STAGES.indexOf(row.stage_name as any);

    if (row.actual_end) return { label: "Completed", color: "bg-primary text-primary-foreground" };
    if (row.target_end && new Date() > new Date(row.target_end) && !row.actual_end && stageIdx <= currentIdx) {
      return { label: "Delayed", color: "bg-destructive text-destructive-foreground" };
    }
    if (stageIdx <= currentIdx && row.actual_start) return { label: "On Track", color: "bg-primary/20 text-primary" };
    return { label: "Pending", color: "bg-muted text-muted-foreground" };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { client, session } = await getAuthedClient();

      for (const row of rows) {
        if (row.id) {
          await client.from("module_schedule").update({
            target_start: row.target_start,
            target_end: row.target_end,
          }).eq("id", row.id);
        } else {
          await client.from("module_schedule").insert({
            module_id: moduleId,
            stage_name: row.stage_name,
            target_start: row.target_start,
            target_end: row.target_end,
            created_by: session.user.id,
          });
        }
      }

      toast.success("Schedule saved");
      setEditing(false);
      await loadSchedule();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (idx: number, field: keyof ScheduleRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value || null } : r));
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Production Schedule</p>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs">Edit Schedule</Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); loadSchedule(); }} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />} Save
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium text-muted-foreground">Stage</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Target Start</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Target End</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Actual Start</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Actual End</th>
              <th className="text-left p-2 font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const status = getStatus(row);
              return (
                <tr key={row.stage_name} className="border-b last:border-0">
                  <td className="p-2 font-medium text-foreground whitespace-nowrap">{row.stage_name}</td>
                  <td className="p-2">
                    {editing ? (
                      <Input type="date" value={row.target_start || ""} onChange={(e) => updateRow(idx, "target_start", e.target.value)} className="h-7 text-xs w-32" />
                    ) : (
                      <span className="text-muted-foreground">{row.target_start || "—"}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <Input type="date" value={row.target_end || ""} onChange={(e) => updateRow(idx, "target_end", e.target.value)} className="h-7 text-xs w-32" />
                    ) : (
                      <span className="text-muted-foreground">{row.target_end || "—"}</span>
                    )}
                  </td>
                  <td className="p-2 text-muted-foreground">{row.actual_start || "—"}</td>
                  <td className="p-2 text-muted-foreground">{row.actual_end || "—"}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={`${status.color} text-[10px]`}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
