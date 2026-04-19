import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Lock, Unlock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

interface Milestone {
  id: string;
  project_id: string;
  milestone_name: string;
  milestone_order: number;
  percentage: number;
  amount: number;
  gst_amount: number;
  total_with_gst: number;
  status: "upcoming" | "invoice_raised" | "paid";
  invoice_ref: string | null;
  is_locked: boolean;
}

interface Props {
  projectId: string;
  contractValue: number;
  userRole: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  invoice_raised: "Invoice Raised",
  paid: "Paid",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge style={{ backgroundColor: "#E8F2ED", color: "#006039", border: "1px solid #006039" }}>
        Paid
      </Badge>
    );
  }
  if (status === "invoice_raised") {
    return (
      <Badge style={{ backgroundColor: "#FFF8E8", color: "#D4860A", border: "1px solid #D4860A" }}>
        Invoice Raised
      </Badge>
    );
  }
  return (
    <Badge style={{ backgroundColor: "#F7F7F7", color: "#888", border: "1px solid #ddd" }}>
      Upcoming
    </Badge>
  );
}

export function BillingMilestones({ projectId, contractValue, userRole }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New milestone form state
  const [showAddRow, setShowAddRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPct, setNewPct] = useState("");

  // Invoice ref dialog
  const [invoiceDialog, setInvoiceDialog] = useState<{ milestoneId: string; targetStatus: string } | null>(null);
  const [invoiceRef, setInvoiceRef] = useState("");

  const canUnlock = userRole === "managing_director" || userRole === "super_admin";

  const isLocked = milestones.some(
    (m) => m.status === "invoice_raised" || m.status === "paid",
  );

  const fetchMilestones = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("billing_milestones" as any) as any)
      .select("*")
      .eq("project_id", projectId)
      .order("milestone_order", { ascending: true });
    if (error) {
      toast.error("Failed to load milestones: " + error.message);
    } else {
      setMilestones((data as Milestone[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMilestones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalPct = milestones.reduce((s, m) => s + (m.percentage ?? 0), 0);
  const newPctNum = parseFloat(newPct) || 0;
  const previewTotal = totalPct + (showAddRow ? newPctNum : 0);

  const handleAddMilestone = async () => {
    if (!newName.trim()) { toast.error("Milestone name is required"); return; }
    if (newPctNum <= 0 || newPctNum > 100) { toast.error("Percentage must be between 1 and 100"); return; }
    if (previewTotal > 100) { toast.error("Total percentage cannot exceed 100%"); return; }

    setSaving(true);
    const amount = (newPctNum / 100) * contractValue;
    const gst_amount = amount * 0.18;
    const total_with_gst = amount + gst_amount;
    const milestone_order = milestones.length > 0
      ? Math.max(...milestones.map((m) => m.milestone_order)) + 1
      : 1;

    const { error } = await (supabase.from("billing_milestones" as any) as any).insert({
      project_id: projectId,
      milestone_name: newName.trim(),
      milestone_order,
      percentage: newPctNum,
      amount,
      gst_amount,
      total_with_gst,
      status: "upcoming",
      invoice_ref: null,
      is_locked: false,
    });

    if (error) {
      toast.error("Failed to add milestone: " + error.message);
    } else {
      toast.success("Milestone added");
      setNewName("");
      setNewPct("");
      setShowAddRow(false);
      fetchMilestones();
    }
    setSaving(false);
  };

  const handleDeleteMilestone = async (id: string) => {
    if (isLocked) { toast.error("Milestones are locked. Only MD can unlock."); return; }
    const { error } = await (supabase.from("billing_milestones" as any) as any)
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); } else {
      toast.success("Milestone removed");
      fetchMilestones();
    }
  };

  const handleStatusChange = async (milestoneId: string, newStatus: string) => {
    if (newStatus === "invoice_raised") {
      setInvoiceDialog({ milestoneId, targetStatus: newStatus });
      setInvoiceRef("");
      return;
    }
    await applyStatusChange(milestoneId, newStatus, null);
  };

  const applyStatusChange = async (milestoneId: string, newStatus: string, ref: string | null) => {
    const updates: Record<string, any> = { status: newStatus };
    if (ref) updates.invoice_ref = ref;

    const { error } = await (supabase.from("billing_milestones" as any) as any)
      .update(updates)
      .eq("id", milestoneId);

    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
      fetchMilestones();
    }
  };

  const handleInvoiceDialogConfirm = async () => {
    if (!invoiceDialog) return;
    if (!invoiceRef.trim()) { toast.error("Invoice reference is required"); return; }
    await applyStatusChange(invoiceDialog.milestoneId, invoiceDialog.targetStatus, invoiceRef.trim());
    setInvoiceDialog(null);
    setInvoiceRef("");
  };

  const handleUnlock = async () => {
    if (!canUnlock) return;
    const ids = milestones.map((m) => m.id);
    for (const id of ids) {
      await (supabase.from("billing_milestones" as any) as any)
        .update({ is_locked: false })
        .eq("id", id);
    }
    toast.success("Milestones unlocked");
    fetchMilestones();
  };

  // Grand totals
  const grandAmount = milestones.reduce((s, m) => s + (m.amount ?? 0), 0);
  const grandGst = milestones.reduce((s, m) => s + (m.gst_amount ?? 0), 0);
  const grandTotal = milestones.reduce((s, m) => s + (m.total_with_gst ?? 0), 0);

  const fmtINR = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Contract value + % validation header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>
            Contract Value:{" "}
            <span style={{ color: "#006039" }}>{fmtINR(contractValue)}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* % validation indicator */}
          {milestones.length > 0 && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded"
              style={
                previewTotal === 100
                  ? { color: "#006039", backgroundColor: "#E8F2ED", border: "1px solid #006039" }
                  : { color: "#F40009", backgroundColor: "#FEE2E2", border: "1px solid #F40009" }
              }
            >
              {previewTotal === 100
                ? "✓ 100%"
                : `⚠ Total: ${previewTotal.toFixed(1)}% (must be 100%)`}
            </span>
          )}

          {/* Lock indicator */}
          {isLocked && (
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" style={{ color: "#D4860A" }} />
              <span className="text-xs" style={{ color: "#D4860A" }}>
                Milestones locked after first invoice. Only MD can unlock.
              </span>
              {canUnlock && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlock}
                  className="h-7 text-xs"
                  style={{ borderColor: "#D4860A", color: "#D4860A" }}
                >
                  <Unlock className="h-3 w-3 mr-1" /> Unlock
                </Button>
              )}
            </div>
          )}

          {/* Add milestone button */}
          {!isLocked && (
            <Button
              size="sm"
              onClick={() => setShowAddRow(true)}
              style={{ backgroundColor: "#006039", color: "#fff" }}
              disabled={showAddRow}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
            </Button>
          )}
        </div>
      </div>

      <Card style={{ backgroundColor: "#F7F7F7" }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ backgroundColor: "#F7F7F7" }}>
                  <TableHead className="w-10 text-xs">#</TableHead>
                  <TableHead className="text-xs min-w-[180px]">Milestone Name</TableHead>
                  <TableHead className="text-xs text-right w-16">%</TableHead>
                  <TableHead className="text-xs text-right min-w-[130px]">₹ Amount</TableHead>
                  <TableHead className="text-xs text-right min-w-[120px]">GST (18%)</TableHead>
                  <TableHead className="text-xs text-right min-w-[140px]">Total incl. GST</TableHead>
                  <TableHead className="text-xs min-w-[140px]">Status</TableHead>
                  <TableHead className="text-xs min-w-[150px]">Invoice Ref</TableHead>
                  {!isLocked && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>

              <TableBody>
                {milestones.map((m, idx) => (
                  <TableRow key={m.id} className="hover:bg-white/60">
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{m.milestone_name}</TableCell>
                    <TableCell className="text-right text-sm">{m.percentage}%</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmtINR(m.amount)}</TableCell>
                    <TableCell className="text-right text-sm font-mono">{fmtINR(m.gst_amount)}</TableCell>
                    <TableCell className="text-right text-sm font-mono font-semibold">{fmtINR(m.total_with_gst)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={m.status} />
                        <Select
                          value={m.status}
                          onValueChange={(val) => handleStatusChange(m.id, val)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="invoice_raised">Invoice Raised</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.invoice_ref ?? "—"}
                    </TableCell>
                    {!isLocked && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDeleteMilestone(m.id)}
                          title="Remove milestone"
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: "#F40009" }} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {/* Inline add row */}
                {showAddRow && (
                  <TableRow style={{ backgroundColor: "#FFFBE6" }}>
                    <TableCell className="text-xs text-muted-foreground">
                      {milestones.length + 1}
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Milestone name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="%"
                        value={newPct}
                        onChange={(e) => setNewPct(e.target.value)}
                        className="h-8 text-sm w-20 text-right"
                      />
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-muted-foreground">
                      {newPctNum > 0 ? fmtINR((newPctNum / 100) * contractValue) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-muted-foreground">
                      {newPctNum > 0 ? fmtINR((newPctNum / 100) * contractValue * 0.18) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono text-muted-foreground">
                      {newPctNum > 0 ? fmtINR((newPctNum / 100) * contractValue * 1.18) : "—"}
                    </TableCell>
                    <TableCell colSpan={2}>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleAddMilestone}
                          disabled={saving || previewTotal > 100 || previewTotal !== 100}
                          style={{ backgroundColor: "#006039", color: "#fff" }}
                          className="h-8 text-xs"
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setShowAddRow(false); setNewName(""); setNewPct(""); }}
                          className="h-8 text-xs"
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {/* Empty state */}
                {milestones.length === 0 && !showAddRow && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      No milestones yet.{" "}
                      <button
                        className="underline font-medium"
                        style={{ color: "#006039" }}
                        onClick={() => setShowAddRow(true)}
                      >
                        + Add Milestone
                      </button>
                    </TableCell>
                  </TableRow>
                )}

                {/* Grand total row */}
                {milestones.length > 0 && (
                  <TableRow style={{ backgroundColor: "#E8F2ED", fontWeight: 700 }}>
                    <TableCell colSpan={3} className="text-sm font-bold" style={{ color: "#006039" }}>
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold" style={{ color: "#006039" }}>
                      {fmtINR(grandAmount)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold" style={{ color: "#006039" }}>
                      {fmtINR(grandGst)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono font-bold" style={{ color: "#006039" }}>
                      {fmtINR(grandTotal)}
                    </TableCell>
                    <TableCell colSpan={isLocked ? 2 : 3} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Ref Dialog */}
      <Dialog open={!!invoiceDialog} onOpenChange={(open) => { if (!open) { setInvoiceDialog(null); setInvoiceRef(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter Invoice Reference</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="inv-ref" className="text-sm">Invoice Reference / Number</Label>
            <Input
              id="inv-ref"
              placeholder="e.g. INV-2026-001"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setInvoiceDialog(null); setInvoiceRef(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleInvoiceDialogConfirm}
              style={{ backgroundColor: "#006039", color: "#fff" }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
