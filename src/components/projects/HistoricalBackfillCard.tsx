import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { History, Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

type StageOption = { id: string; label: string; order: number };

export type BackfillRecord = {
  id: string;
  phase: string;
  starting_stage_code: string | null;
  starting_stage_label: string | null;
  note: string;
  original_doc_unavailable: boolean;
  stages_affected: number;
  created_by_name: string | null;
  created_at: string;
};

export function HistoricalBackfillCard({
  projectId,
  pipeline,
  onDone,
}: {
  projectId: string;
  pipeline: "habitainer" | "ads";
  onDone?: () => void;
}) {
  const { actualRole } = useUserRole();
  const allowed = actualRole === "managing_director" || actualRole === "super_admin";

  const [record, setRecord] = useState<BackfillRecord | null>(null);
  const [options, setOptions] = useState<StageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [stageId, setStageId] = useState("");
  const [note, setNote] = useState("");
  const [docUnavailable, setDocUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [bf, stages] = await Promise.all([
      (supabase as any)
        .from("project_backfills")
        .select("*")
        .eq("project_id", projectId)
        .eq("phase", "design")
        .maybeSingle(),
      (supabase as any)
        .from("project_design_stages")
        .select("id, design_stage_definitions!inner(stage_code, stage_name, stage_order, pipeline_type)")
        .eq("project_id", projectId),
    ]);
    setRecord((bf.data ?? null) as BackfillRecord | null);
    const opts: StageOption[] = ((stages.data ?? []) as any[])
      .filter((r) => r.design_stage_definitions?.pipeline_type === pipeline)
      .map((r) => ({
        id: r.id,
        label: `${r.design_stage_definitions.stage_code} — ${r.design_stage_definitions.stage_name}`,
        order: r.design_stage_definitions.stage_order,
      }))
      .sort((a, b) => a.order - b.order);
    setOptions(opts);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId, pipeline]);

  if (!allowed || loading) return null;

  const submit = async () => {
    if (!stageId) return toast.error("Select the stage this project is currently at");
    if (note.trim().length < 10) return toast.error("Add a note explaining the backfill (min 10 characters)");
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("backfill_project_starting_stage", {
      _project_id: projectId,
      _phase: "design",
      _starting_stage_id: stageId,
      _note: note.trim(),
      _doc_unavailable: docUnavailable,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Backfilled ${data?.stages_affected ?? 0} stage(s) as Pre-HStack`);
    setOpen(false);
    setNote(""); setStageId(""); setDocUnavailable(false);
    await load();
    onDone?.();
  };

  return (
    <Card style={{ borderColor: "#F40009", borderWidth: 2 }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2" style={{ color: "#F40009" }}>
          <History className="h-4 w-4" /> Historical Backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {record ? (
          <div className="space-y-1">
            <p className="flex items-center gap-2 font-medium" style={{ color: "#006039" }}>
              <Lock className="h-4 w-4" /> Locked — backfill already applied
            </p>
            <p className="text-muted-foreground">
              Starting stage: <strong>{record.starting_stage_code} — {record.starting_stage_label}</strong> ·{" "}
              {record.stages_affected} prior stage(s) marked Completed — Pre-HStack.
            </p>
            <p className="text-muted-foreground">
              Set by {record.created_by_name ?? "Unknown"} on {format(parseISO(record.created_at), "dd/MM/yyyy")}
            </p>
            <p className="text-xs">Note: {record.note}</p>
            {record.original_doc_unavailable && (
              <p className="text-xs" style={{ color: "#D4860A" }}>Original documents marked unavailable.</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-muted-foreground">
              For projects that started before HStack. Marks every stage before the selected starting stage as
              <strong> Completed — Pre-HStack</strong>, without firing approvals, notifications or deadline timers.
              This can only be done once per project and is permanently locked afterwards.
            </p>
            <Button onClick={() => setOpen(true)} className="text-white" style={{ backgroundColor: "#F40009" }}>
              Set Starting Stage (Historical Backfill)
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Starting Stage (Historical Backfill)</DialogTitle>
            <DialogDescription>
              All stages before the selected stage will be marked Completed — Pre-HStack. Live gate enforcement
              resumes from the selected stage onwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Current stage of this project</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger><SelectValue placeholder="Select starting stage" /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Reason / context (required)</Label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Project started in Jan 2026 before HStack rollout; design stages completed offline and signed by client."
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="docna" checked={docUnavailable} onCheckedChange={(v) => setDocUnavailable(!!v)} />
              <Label htmlFor="docna" className="text-sm font-normal">Original documents not available</Label>
            </div>

            <div className="flex items-start gap-2 text-xs rounded-md p-2" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              This is permanent. Backfilled stages are labelled Pre-HStack forever and cannot be re-run.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="text-white" style={{ backgroundColor: "#F40009" }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirm Backfill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
