import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { FileText, Plus, Eye, CheckCircle, Send, IndianRupee } from "lucide-react";
import { LabourInvoiceChecklistGate } from "./LabourInvoiceChecklistGate";
import { LABOUR_INVOICE_STATUS, LABOUR_INVOICE_APPROVE_ROLES, LABOUR_INVOICE_RAISE_ROLES, raiseLabourInvoice } from "@/lib/labour-invoices";

type LabourInvoice = {
  id: string;
  invoice_number: string | null;
  work_order_id: string | null;
  project_id: string | null;
  subcontractor_id: string | null;
  amount_total: number;
  amount_paid: number;
  status: string;
  raised_date: string;
  due_date: string | null;
  notes: string | null;
  approved_at: string | null;
};

type WorkOrderLite = {
  id: string; wo_number: string; project_id: string; subcontractor_id: string;
  total_value: number; status: string;
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}
function fmtINR(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function LabourInvoicesTab() {
  const { role, userId } = useUserRole();
  const [invoices, setInvoices] = useState<LabourInvoice[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrderLite[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [subs, setSubs] = useState<{ id: string; company_name: string | null; contact_person: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [newWo, setNewWo] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [detail, setDetail] = useState<LabourInvoice | null>(null);
  const [detailAllMet, setDetailAllMet] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");

  const canApprove = LABOUR_INVOICE_APPROVE_ROLES.includes(role || "");
  const canRaise = LABOUR_INVOICE_RAISE_ROLES.includes(role || "");
  const canView = canApprove || canRaise;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [invRes, woRes, projRes, subRes] = await Promise.all([
      supabase.from("labour_invoices").select("*").eq("is_archived", false).order("raised_date", { ascending: false }),
      supabase.from("work_orders").select("id, wo_number, project_id, subcontractor_id, total_value, status")
        .in("status", ["measured_signed_off", "closed"]),
      supabase.from("projects").select("id, name").eq("is_archived", false),
      supabase.from("subcontractors").select("id, company_name, contact_person"),
    ]);
    setInvoices((invRes.data ?? []) as any);
    setWorkOrders((woRes.data ?? []) as any);
    setProjects((projRes.data ?? []) as any);
    setSubs((subRes.data ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { if (canView) loadData(); }, [canView, loadData]);

  const projectMap = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects]);
  const subMap = useMemo(() => Object.fromEntries(subs.map((s) => [s.id, s.company_name || s.contact_person || "—"])), [subs]);
  const woMap = useMemo(() => Object.fromEntries(workOrders.map((w) => [w.id, w])), [workOrders]);

  const availableWos = useMemo(() => {
    const invoiced = new Set(invoices.map((i) => i.work_order_id));
    return workOrders.filter((w) => w.status === "measured_signed_off" && !invoiced.has(w.id));
  }, [workOrders, invoices]);

  const filtered = useMemo(() => invoices.filter((inv) => {
    if (filterProject !== "all" && inv.project_id !== filterProject) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    return true;
  }), [invoices, filterProject, filterStatus]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const billedThisMonth = invoices.filter((i) => i.raised_date?.startsWith(thisMonth)).reduce((s, i) => s + Number(i.amount_total), 0);
  const outstanding = invoices.reduce((s, i) => s + (Number(i.amount_total) - Number(i.amount_paid)), 0);
  const pendingChecklist = invoices.filter((i) => i.status === "checklist_pending" || i.status === "draft").length;
  const readyToPay = invoices.filter((i) => i.status === "approved" || i.status === "sent").length;

  async function handleCreate() {
    const wo = woMap[newWo];
    if (!wo) { toast.error("Select a signed-off work order"); return; }
    const res = await raiseLabourInvoice(wo, userId);
    if (res.error) { toast.error(res.error.message); return; }
    if (res.alreadyExists) { toast.error(`Already invoiced as ${res.invoiceNumber}`); return; }
    if (res.id && (newAmount || newDueDate || newNotes)) {
      await supabase.from("labour_invoices").update({
        amount_total: newAmount ? parseFloat(newAmount) : Number(wo.total_value || 0),
        due_date: newDueDate || null,
        notes: newNotes || null,
      }).eq("id", res.id);
    }
    toast.success(`Labour invoice ${res.invoiceNumber} created`);
    setCreateOpen(false); setNewWo(""); setNewAmount(""); setNewDueDate(""); setNewNotes("");
    loadData();
  }

  async function updateStatus(inv: LabourInvoice, status: string) {
    const updates: any = { status };
    if (status === "approved") { updates.approved_by = userId; updates.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from("labour_invoices").update(updates).eq("id", inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status updated to ${LABOUR_INVOICE_STATUS[status]?.label ?? status}`);
    setDetail({ ...inv, ...updates });
    loadData();
  }

  async function recordPayment() {
    if (!detail || !payAmount) return;
    const paid = Number(detail.amount_paid) + parseFloat(payAmount);
    const status = paid >= Number(detail.amount_total) ? "fully_paid" : "partially_paid";
    const { error } = await supabase.from("labour_invoices").update({ amount_paid: paid, status }).eq("id", detail.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment recorded");
    setPayOpen(false); setPayAmount("");
    setDetail({ ...detail, amount_paid: paid, status });
    loadData();
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground py-8 text-center">You do not have access to labour invoices.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Billed This Month</p>
          <p className="text-lg font-bold" style={{ color: "#006039" }}>{fmtINR(billedThisMonth)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding to Subcontractors</p>
          <p className="text-lg font-bold" style={{ color: outstanding > 0 ? "#D4860A" : "#006039" }}>{fmtINR(outstanding)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Checklist Pending</p>
          <p className="text-lg font-bold" style={{ color: pendingChecklist > 0 ? "#D4860A" : "#006039" }}>{pendingChecklist}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Approved / Sent</p>
          <p className="text-lg font-bold" style={{ color: "#006039" }}>{readyToPay}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={filterProject} onValueChange={setFilterProject}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(LABOUR_INVOICE_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {canRaise && (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="ml-auto rounded-full" style={{ background: "#006039" }}>
            <Plus className="h-4 w-4 mr-1" /> New Labour Invoice
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No</TableHead>
              <TableHead>Work Order</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No labour invoices yet</TableCell></TableRow>
            ) : filtered.map((inv) => {
              const st = LABOUR_INVOICE_STATUS[inv.status] ?? LABOUR_INVOICE_STATUS.draft;
              return (
                <TableRow key={inv.id} className="cursor-pointer" onClick={() => { setDetail(inv); setDetailAllMet(false); }}>
                  <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.work_order_id ? woMap[inv.work_order_id]?.wo_number ?? "—" : "—"}</TableCell>
                  <TableCell>{inv.project_id ? projectMap[inv.project_id] ?? "—" : "—"}</TableCell>
                  <TableCell>{inv.subcontractor_id ? subMap[inv.subcontractor_id] ?? "—" : "—"}</TableCell>
                  <TableCell>{fmtDate(inv.raised_date)}</TableCell>
                  <TableCell>{fmtDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtINR(Number(inv.amount_total))}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                      {inv.status === "fully_paid" && <CheckCircle className="h-3 w-3" />}{st.label}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(inv); setDetailAllMet(false); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6"><DialogTitle>New Labour Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3 px-6 overflow-y-auto flex-1">
            <div>
              <Label>Work Order (measured &amp; signed off)</Label>
              <Select value={newWo} onValueChange={(v) => { setNewWo(v); setNewAmount(String(woMap[v]?.total_value ?? "")); }}>
                <SelectTrigger><SelectValue placeholder="Select work order" /></SelectTrigger>
                <SelectContent>
                  {availableWos.length === 0
                    ? <div className="px-3 py-2 text-xs text-muted-foreground">No signed-off work orders awaiting invoicing</div>
                    : availableWos.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.wo_number} — {subMap[w.subcontractor_id] ?? ""} ({fmtINR(Number(w.total_value))})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background border-t px-6 py-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} style={{ background: "#006039" }}>Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          {detail && (() => {
            const st = LABOUR_INVOICE_STATUS[detail.status] ?? LABOUR_INVOICE_STATUS.draft;
            const wo = detail.work_order_id ? woMap[detail.work_order_id] : null;
            const gated = detail.status === "draft" || detail.status === "checklist_pending";
            return (
              <>
                <DialogHeader className="px-6 pt-6">
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-5 w-5" /> {detail.invoice_number}
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="px-6 space-y-3 overflow-y-auto flex-1 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-muted-foreground">Work Order:</span> {wo?.wo_number ?? "—"}</div>
                    <div><span className="text-muted-foreground">Project:</span> {detail.project_id ? projectMap[detail.project_id] ?? "—" : "—"}</div>
                    <div><span className="text-muted-foreground">Subcontractor:</span> {detail.subcontractor_id ? subMap[detail.subcontractor_id] ?? "—" : "—"}</div>
                    <div><span className="text-muted-foreground">WO Value:</span> {fmtINR(Number(wo?.total_value ?? 0))}</div>
                    <div><span className="text-muted-foreground">Raised:</span> {fmtDate(detail.raised_date)}</div>
                    <div><span className="text-muted-foreground">Due:</span> {fmtDate(detail.due_date)}</div>
                    <div><span className="text-muted-foreground">Total:</span> <strong>{fmtINR(Number(detail.amount_total))}</strong></div>
                    <div><span className="text-muted-foreground">Paid:</span> {fmtINR(Number(detail.amount_paid))}</div>
                  </div>
                  {detail.notes && <p className="text-sm text-muted-foreground border-t pt-2">{detail.notes}</p>}

                  <LabourInvoiceChecklistGate
                    invoiceId={detail.id}
                    projectId={detail.project_id}
                    workOrder={wo ? { id: wo.id, status: wo.status, project_id: wo.project_id } : null}
                    canTick={canRaise || canApprove}
                    userId={userId}
                    locked={!gated}
                    onAllMetChange={setDetailAllMet}
                  />
                </div>
                <DialogFooter className="sticky bottom-0 bg-background border-t px-6 py-3 flex-wrap gap-2">
                  {canApprove && gated && (
                    <Button size="sm" disabled={!detailAllMet} onClick={() => updateStatus(detail, "approved")} style={{ background: "#006039" }}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                  )}
                  {canApprove && detail.status === "approved" && (
                    <Button size="sm" onClick={() => updateStatus(detail, "sent")} style={{ background: "#1A1A8C" }}>
                      <Send className="h-4 w-4 mr-1" /> Mark Sent
                    </Button>
                  )}
                  {canApprove && ["sent", "partially_paid"].includes(detail.status) && (
                    <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
                      <IndianRupee className="h-4 w-4 mr-1" /> Record Payment
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div>
            <Label>Amount Paid (₹)</Label>
            <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment} style={{ background: "#006039" }}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
