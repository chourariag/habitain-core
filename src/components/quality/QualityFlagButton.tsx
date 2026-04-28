import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { insertNotifications } from "@/lib/notifications";

const QC_ROLES = ["qc_inspector", "production_head", "managing_director", "super_admin"]; // Tagore = qc_inspector

interface Props {
  bayNumber: number;
  bayLabel: string;
  moduleId?: string | null;
  projectId?: string | null;
  size?: "sm" | "xs";
}

export function QualityFlagButton({ bayNumber, bayLabel, moduleId, projectId, size = "xs" }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [observation, setObservation] = useState("");
  const [severity, setSeverity] = useState<"minor" | "review" | "stop_work">("review");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Not signed in"); return; }
    if (!observation.trim()) { toast.error("Describe what you observed"); return; }
    setBusy(true);
    const { error } = await (supabase as any).from("quality_flags").insert({
      bay_number: bayNumber,
      bay_label: bayLabel,
      module_id: moduleId || null,
      project_id: projectId || null,
      flagged_by: user.id,
      observation: observation.trim().slice(0, 150),
      severity,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }

    // Notify QC (Tagore)
    const { data: qc } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .in("role", QC_ROLES as any)
      .eq("is_active", true);
    if (qc?.length) {
      await insertNotifications(qc.map((p: any) => ({
        recipient_id: p.auth_user_id,
        title: severity === "stop_work" ? "🛑 STOP-WORK quality flag" : "Quality flag raised",
        body: `${bayLabel} · ${observation.trim().slice(0, 120)}`,
        category: "quality_flag",
        related_table: "quality_flags",
        navigate_to: "/quality-control",
      })));
    }

    toast.success("Flag raised — Tagore notified");
    setObservation(""); setSeverity("review"); setOpen(false); setBusy(false);
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={size === "xs" ? "h-6 text-[10px] px-2 gap-1" : "h-7 text-xs px-2 gap-1"}
        style={{ borderColor: "#D4860A", color: "#D4860A" }}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        <Flag className="h-3 w-3" /> Flag Quality
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle>Flag a quality concern</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">What did you observe? *</label>
              <Textarea
                rows={3}
                maxLength={150}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="e.g. Drywall edge not flush at south wall…"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{observation.length}/150</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Location</label>
              <p className="text-sm" style={{ color: "#1A1A1A" }}>{bayLabel}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Severity *</label>
              <Select value={severity} onValueChange={(v: any) => setSeverity(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor concern</SelectItem>
                  <SelectItem value="review">Needs Tagore review</SelectItem>
                  <SelectItem value="stop_work">Stop work</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || !observation.trim()} style={{ backgroundColor: "#D4860A" }} className="text-white">
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Raise Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
