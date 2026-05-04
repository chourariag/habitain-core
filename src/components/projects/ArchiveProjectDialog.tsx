import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { raiseApprovalRequest } from "@/lib/approval-requests";
import { logAudit } from "@/lib/super-admin";

const REASONS = ["Completed","Cancelled by client","On hold indefinitely","Duplicate entry","Other"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ArchiveProjectDialog({ open, onOpenChange, projectId, projectName }: Props) {
  const [reason, setReason] = useState("");
  const [reasonOther, setReasonOther] = useState("");
  const [invoicesSettled, setInvoicesSettled] = useState(false);
  const [materialsAccounted, setMaterialsAccounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) { toast.error("Reason is required"); return; }
    setSubmitting(true);
    try {
      const finalReason = reason === "Other" ? reasonOther : reason;
      const reqRow: any = await raiseApprovalRequest("archive_project", {
        project_id: projectId,
        project_name: projectName,
        reason: finalReason,
        invoices_settled: invoicesSettled,
        materials_accounted: materialsAccounted,
      });
      await logAudit({ section: "Projects", action: "raise_archive_project", entity: projectName, summary: finalReason });
      // Notify all MDs/super_admins
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { insertNotifications } = await import("@/lib/notifications");
        const { data: mds } = await supabase.from("profiles")
          .select("auth_user_id").in("role", ["managing_director", "super_admin"] as any).eq("is_active", true);
        const recipients = (mds || []).map((m: any) => m.auth_user_id);
        if (recipients.length) {
          await insertNotifications(recipients.map((rid) => ({
            recipient_id: rid,
            title: `Archive request — ${projectName}`,
            body: `Reason: ${finalReason}. Tap to review.`,
            category: "approval_request",
            related_table: "approval_requests",
            related_id: reqRow?.id,
            navigate_to: `/approvals?id=${reqRow?.id}`,
          })));
        }
      } catch { /* ignore notify failure */ }
      toast.success("Archive request sent to MD for approval");
      onOpenChange(false);
      setReason(""); setReasonOther(""); setInvoicesSettled(false); setMaterialsAccounted(false);
    } catch (err) { toast.error((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Request to Archive — {projectName}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-muted-foreground">Projects are never deleted. Archived projects are hidden from active lists but preserved in historical reports.</p>
          <div>
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            {reason === "Other" && (
              <Textarea className="mt-2" placeholder="Specify reason" value={reasonOther} onChange={e=>setReasonOther(e.target.value)} />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={invoicesSettled} onChange={e=>setInvoicesSettled(e.target.checked)} />
            All invoices are settled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={materialsAccounted} onChange={e=>setMaterialsAccounted(e.target.checked)} />
            All materials are accounted for
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send for MD Approval"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
