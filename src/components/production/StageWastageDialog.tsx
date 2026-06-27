import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { flagLevelForWastage } from "@/lib/stage-gates";

export interface WastagePayload {
  material_category: string;
  qty_issued: number;
  qty_consumed: number;
  wastage_qty: number;
  wastage_percent: number;
  notes: string;
  flag_level: "green" | "amber" | "red";
}

interface Props {
  open: boolean;
  stageName: string;
  onClose: () => void;
  onSubmit: (payload: WastagePayload) => Promise<void> | void;
}

export function StageWastageDialog({ open, stageName, onClose, onSubmit }: Props) {
  const [category, setCategory] = useState("");
  const [issued, setIssued] = useState<string>("");
  const [consumed, setConsumed] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const iss = Number(issued) || 0;
  const con = Number(consumed) || 0;
  const wastageQty = Math.max(iss - con, 0);
  const wastagePct = iss > 0 ? Number((((iss - con) / iss) * 100).toFixed(2)) : 0;
  const flag = useMemo(() => flagLevelForWastage(wastagePct), [wastagePct]);
  const notesRequired = wastagePct > 5;
  const canSubmit = category.trim() && iss > 0 && con >= 0 && (!notesRequired || notes.trim());

  const reset = () => {
    setCategory(""); setIssued(""); setConsumed(""); setNotes("");
  };

  const handle = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit({
        material_category: category.trim(),
        qty_issued: iss,
        qty_consumed: con,
        wastage_qty: wastageQty,
        wastage_percent: wastagePct,
        notes: notes.trim(),
        flag_level: flag,
      });
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const flagColor = flag === "red" ? "#F40009" : flag === "amber" ? "#D4860A" : "#006039";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Wastage — {stageName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Material Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Steel, Plywood, Paint" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity Issued</Label>
              <Input type="number" value={issued} onChange={(e) => setIssued(e.target.value)} />
            </div>
            <div>
              <Label>Quantity Consumed</Label>
              <Input type="number" value={consumed} onChange={(e) => setConsumed(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Wastage Qty</Label>
              <Input value={wastageQty} readOnly />
            </div>
            <div>
              <Label>Wastage %</Label>
              <Input value={`${wastagePct}%`} readOnly style={{ color: flagColor, fontWeight: 600 }} />
            </div>
          </div>
          <div>
            <Label>Notes {notesRequired && <span style={{ color: "#F40009" }}>* required (wastage &gt; 5%)</span>}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          {wastagePct > 10 && (
            <div className="rounded-md p-2 text-sm" style={{ background: "#FFF0F0", color: "#F40009" }}>
              Red flag: Production Head and Planning Head will be notified.
            </div>
          )}
          {wastagePct >= 5 && wastagePct <= 10 && (
            <div className="rounded-md p-2 text-sm" style={{ background: "#FFF8E8", color: "#D4860A" }}>
              Amber flag: Production Head will be notified.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={handle} disabled={!canSubmit || submitting} style={{ backgroundColor: "#006039", color: "#fff" }}>
            {submitting ? "Saving…" : "Submit & Close Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
