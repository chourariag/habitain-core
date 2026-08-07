import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Unlock, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { UNLOCK_TIER_LABEL } from "@/lib/unlock-authority";

/**
 * Shared unlock control for locked documents that live outside the Scope of Work
 * flow (Sale Agreement → contracts_register, GFC sign-offs → gfc_records).
 *
 * Eligibility is enforced server-side by can_unlock_locked_document(auth.uid()),
 * and every unlock is logged against the individual with timestamp + reason.
 */
export function DocumentUnlockButton({
  recordTable,
  recordId,
  documentLabel,
  onUnlocked,
  size = "sm",
  className,
}: {
  recordTable: "contracts_register" | "gfc_records";
  recordId: string;
  documentLabel: string;
  onUnlocked?: () => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Reason required (min 5 characters)");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("unlock_locked_document", {
      p_record_table: recordTable,
      p_record_id: recordId,
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message || "Unlock failed");
      return;
    }
    toast.success("Unlocked for 24 hours — the change is logged against your name");
    setOpen(false);
    setReason("");
    onUnlocked?.();
  };

  return (
    <>
      <Button size={size} variant="outline" className={className} onClick={() => setOpen(true)}>
        <Unlock className="h-4 w-4 mr-1" /> Unlock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock {documentLabel}</DialogTitle>
          </DialogHeader>
          <div className="rounded-md border p-3 text-xs space-y-1" style={{ borderColor: "#F4D58A", backgroundColor: "#FFF8E8" }}>
            <p className="flex items-center gap-2 font-semibold" style={{ color: "#D4860A" }}>
              <AlertTriangle className="h-4 w-4" /> This action is permanently logged
            </p>
            <p style={{ color: "#7a5b12" }}>
              Your name, role and the reason below are recorded. The document stays editable for 24 hours and then re-locks automatically.
              Unlock authority: {UNLOCK_TIER_LABEL}.
            </p>
          </div>
          <Textarea
            rows={3}
            placeholder="Reason for unlocking (min 5 characters)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving} style={{ backgroundColor: "#F40009", color: "white" }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Unlock &amp; Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
