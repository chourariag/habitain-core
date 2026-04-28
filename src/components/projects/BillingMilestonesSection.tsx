import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Lock, Unlock, Save, AlertTriangle, IndianRupee } from "lucide-react";

const TRIGGER_EVENTS = [
  "Booking",
  "H1 GFC Sign-off",
  "Shell & Core Delivery",
  "Builder Finish",
  "Finishing Works",
  "Handover",
  "Custom",
];

const DEFAULT_MILESTONES = [
  { milestone_number: 1, description: "Booking", percentage: 10, trigger_event: "Booking", gst_applicable: false },
  { milestone_number: 2, description: "Shell & Core Phase 1", percentage: 30, trigger_event: "Shell & Core Delivery", gst_applicable: true },
  { milestone_number: 3, description: "Shell & Core Phase 2", percentage: 25, trigger_event: "Shell & Core Delivery", gst_applicable: true },
  { milestone_number: 4, description: "Phase 3", percentage: 15, trigger_event: "Builder Finish", gst_applicable: true },
  { milestone_number: 5, description: "Finishing Works", percentage: 15, trigger_event: "Finishing Works", gst_applicable: true },
  { milestone_number: 6, description: "Handover", percentage: 5, trigger_event: "Handover", gst_applicable: true },
];

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  billed: { label: "Billed", className: "bg-primary/10 text-primary" },
  received: { label: "Received", className: "bg-emerald-100 text-emerald-700" },
};

interface Milestone {
  id?: string;
  milestone_number: number;
  description: string;
  percentage: number;
  amount_excl_gst: number;
  gst_amount: number;
  amount_incl_gst: number;
  trigger_event: string;
  gst_applicable: boolean;
  status: string;
  invoice_id?: string | null;
  billed_date?: string | null;
  received_date?: string | null;
}

interface Props {
  projectId: string;
  contractValue: number;
  userRole: string | null;
  locked: boolean;
  onLockChange?: (locked: boolean) => void;
}

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function BillingMilestonesSection({ projectId, contractValue, userRole, locked, onLockChange }: Props) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPctError, setShowPctError] = useState(false);

  const canEdit = ["super_admin", "managing_director", "finance_director", "finance_manager"].includes(userRole || "");
  const canUnlock = ["super_admin", "managing_director"].includes(userRole || "");
  const isEditable = canEdit && !locked;

  const loadMilestones = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_billing_milestones")
      .select("*")
      .eq("project_id", projectId)
      .order("milestone_number");

    if (data && data.length > 0) {
      setMilestones(data.map((d: any) => ({
        id: d.id,
        milestone_number: d.milestone_number,
        description: d.description,
        percentage: Number(d.percentage),
        amount_excl_gst: Number(d.amount_excl_gst),
        gst_amount: Number(d.gst_amount),
        amount_incl_gst: Number(d.amount_incl_gst),
        trigger_event: d.trigger_event,
        gst_applicable: d.gst_applicable,
        status: d.status,
        invoice_id: d.invoice_id,
        billed_date: d.billed_date,
        received_date: d.received_date,
      })));
    } else {
      // Pre-populate defaults
      setMilestones(DEFAULT_MILESTONES.map(d => recalc({ ...d, amount_excl_gst: 0, gst_amount: 0, amount_incl_gst: 0, status: "pending" })));
      setDirty(true);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadMilestones(); }, [loadMilestones]);

  function recalc(m: Milestone): Milestone {
    const excl = (m.percentage / 100) * contractValue;
    const gst = m.gst_applicable ? excl * 0.18 : 0;
    return { ...m, amount_excl_gst: Math.round(excl), gst_amount: Math.round(gst), amount_incl_gst: Math.round(excl + gst) };
  }

  // Recalculate amounts when contract value changes
  useEffect(() => {
    if (!loading && milestones.length > 0) {
      setMilestones(prev => prev.map(m => recalc(m)));
    }
  }, [contractValue]);

  const totalPct = useMemo(() => milestones.reduce((s, m) => s + m.percentage, 0), [milestones]);
  const totalExcl = useMemo(() => milestones.reduce((s, m) => s + m.amount_excl_gst, 0), [milestones]);
  const totalGst = useMemo(() => milestones.reduce((s, m) => s + m.gst_amount, 0), [milestones]);
  const totalIncl = useMemo(() => milestones.reduce((s, m) => s + m.amount_incl_gst, 0), [milestones]);

  function updateMilestone(idx: number, field: string, value: any) {
    setMilestones(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      if (field === "percentage" || field === "gst_applicable") {
        updated[idx] = recalc(updated[idx]);
      }
      return updated;
    });
    setDirty(true);
    if (field === "percentage") setShowPctError(false);
  }

  function addMilestone() {
    const nextNum = milestones.length > 0 ? Math.max(...milestones.map(m => m.milestone_number)) + 1 : 1;
    const newM = recalc({
      milestone_number: nextNum,
      description: "",
      percentage: 0,
      amount_excl_gst: 0,
      gst_amount: 0,
      amount_incl_gst: 0,
      trigger_event: "Custom",
      gst_applicable: true,
      status: "pending",
    });
    setMilestones(prev => [...prev, newM]);
    setDirty(true);
  }

  function removeMilestone(idx: number) {
    if (milestones[idx].status !== "pending") {
      toast.error("Cannot remove a billed or received milestone");
      return;
    }
    setMilestones(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  async function saveMilestones() {
    if (totalPct !== 100) {
      setShowPctError(true);
      toast.error(`Percentages must total 100%. Currently ${totalPct}%`);
      return;
    }
    setSaving(true);

    // Delete existing and re-insert
    await supabase.from("project_billing_milestones").delete().eq("project_id", projectId);

    const rows = milestones.map((m, i) => ({
      project_id: projectId,
      milestone_number: i + 1,
      description: m.description || `Milestone ${i + 1}`,
      percentage: m.percentage,
      amount_excl_gst: m.amount_excl_gst,
      gst_amount: m.gst_amount,
      amount_incl_gst: m.amount_incl_gst,
      trigger_event: m.trigger_event,
      gst_applicable: m.gst_applicable,
      status: m.status,
      invoice_id: m.invoice_id || null,
      billed_date: m.billed_date || null,
      received_date: m.received_date || null,
    }));

    const { error } = await supabase.from("project_billing_milestones").insert(rows as any);
    if (error) { toast.error(error.message); setSaving(false); return; }

    toast.success("Billing milestones saved");
    setDirty(false);
    setSaving(false);
    loadMilestones();
  }

  async function toggleLock() {
    const newLocked = !locked;
    await supabase.from("projects").update({ milestones_locked: newLocked } as any).eq("id", projectId);
    onLockChange?.(newLocked);
    toast.success(newLocked ? "Milestones locked" : "Milestones unlocked");
  }

  async function billMilestone(idx: number) {
    const m = milestones[idx];
    if (m.status !== "pending") return;

    // Create invoice
    const year = new Date().getFullYear();
    const { count } = await supabase.from("project_invoices").select("*", { count: "exact", head: true });
    const seq = (count || 0) + 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;

    const { data: user } = await supabase.auth.getUser();

    const { data: inv, error: invErr } = await supabase.from("project_invoices").insert({
      invoice_number: invoiceNumber,
      project_id: projectId,
      invoice_type: "part",
      amount_total: m.amount_incl_gst,
      raised_date: new Date().toISOString().split("T")[0],
      notes: `Milestone ${m.milestone_number}: ${m.description} — ₹${m.amount_excl_gst.toLocaleString("en-IN")} + GST ₹${m.gst_amount.toLocaleString("en-IN")}`,
      created_by: user?.user?.id || "",
    } as any).select().single();

    if (invErr) { toast.error(invErr.message); return; }

    // Update milestone
    if (m.id) {
      await supabase.from("project_billing_milestones").update({
        status: "billed",
        invoice_id: inv.id,
        billed_date: new Date().toISOString().split("T")[0],
      } as any).eq("id", m.id);
    }

    // Lock milestones after first invoice
    if (!locked) {
      await supabase.from("projects").update({ milestones_locked: true } as any).eq("id", projectId);
      onLockChange?.(true);
    }

    toast.success(`Invoice ${invoiceNumber} created for ${m.description}`);
    loadMilestones();
  }

  if (loading) return <div className="py-4 text-sm text-muted-foreground text-center">Loading milestones…</div>;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
            <IndianRupee className="h-4 w-4" /> Billing Milestones
          </CardTitle>
          <div className="flex items-center gap-2">
            {locked && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
            {canUnlock && (
              <Button size="sm" variant="ghost" onClick={toggleLock} className="h-7 text-xs">
                {locked ? <><Unlock className="h-3 w-3 mr-1" /> Unlock</> : <><Lock className="h-3 w-3 mr-1" /> Lock</>}
              </Button>
            )}
          </div>
        </div>
        {contractValue > 0 && (
          <p className="text-xs text-muted-foreground">
            Contract Value: {fmt(contractValue)} (excl. GST)
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {contractValue <= 0 && (
          <div className="flex items-center gap-2 text-xs p-2 rounded bg-warning/10 text-warning-foreground border border-warning/30">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Enter Contract Value in Project Overview to see amounts
          </div>
        )}
        {showPctError && totalPct !== 100 && (
          <div className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/10 text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Percentages total {totalPct}% — must equal 100%
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20">%</TableHead>
                <TableHead className="text-right">₹ Excl. GST</TableHead>
                <TableHead className="w-16 text-center">GST</TableHead>
                <TableHead className="text-right">GST Amt</TableHead>
                <TableHead className="text-right">₹ Incl. GST</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                {isEditable && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((m, idx) => {
                const st = STATUS_STYLES[m.status] || STATUS_STYLES.pending;
                const rowLocked = locked || m.status !== "pending";
                return (
                  <TableRow key={idx}>
                    <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      {isEditable && !rowLocked ? (
                        <Input
                          value={m.description}
                          onChange={(e) => updateMilestone(idx, "description", e.target.value)}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <span className="text-sm">{m.description}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditable && !rowLocked ? (
                        <Input
                          type="number"
                          value={m.percentage}
                          onChange={(e) => updateMilestone(idx, "percentage", Number(e.target.value))}
                          onBlur={() => setShowPctError(true)}
                          className="h-8 text-xs w-16"
                          min={0}
                          max={100}
                        />
                      ) : (
                        <span className="text-sm">{m.percentage}%</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(m.amount_excl_gst)}</TableCell>
                    <TableCell className="text-center">
                      {isEditable && !rowLocked ? (
                        <Switch
                          checked={m.gst_applicable}
                          onCheckedChange={(v) => updateMilestone(idx, "gst_applicable", v)}
                        />
                      ) : (
                        <span className="text-xs">{m.gst_applicable ? "Y" : "N"}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(m.gst_amount)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(m.amount_incl_gst)}</TableCell>
                    <TableCell>
                      {isEditable && !rowLocked ? (
                        <Select value={m.trigger_event} onValueChange={(v) => updateMilestone(idx, "trigger_event", v)}>
                          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRIGGER_EVENTS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs">{m.trigger_event}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={`text-[10px] ${st.className}`}>{st.label}</Badge>
                        {rowLocked && m.status !== "pending" && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    {isEditable && (
                      <TableCell>
                        <div className="flex gap-1">
                          {m.status === "pending" && canEdit && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => billMilestone(idx)} title="Bill this milestone">
                              <IndianRupee className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!rowLocked && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeMilestone(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell />
                <TableCell>Total</TableCell>
                <TableCell className={totalPct !== 100 ? "text-destructive" : ""}>{totalPct}%</TableCell>
                <TableCell className="text-right">{fmt(totalExcl)}</TableCell>
                <TableCell />
                <TableCell className="text-right">{fmt(totalGst)}</TableCell>
                <TableCell className="text-right">{fmt(totalIncl)}</TableCell>
                <TableCell colSpan={isEditable ? 3 : 2} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {isEditable && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addMilestone}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Milestone
            </Button>
            {dirty && (
              <Button size="sm" onClick={saveMilestones} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" /> {saving ? "Saving…" : "Save Milestones"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
