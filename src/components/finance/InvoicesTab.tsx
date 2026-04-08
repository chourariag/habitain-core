import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { FileText, Plus, Eye, CheckCircle, Send, IndianRupee, AlertTriangle } from "lucide-react";
import { RetentionSection } from "./RetentionSection";

type Invoice = {
  id: string;
  invoice_number: string;
  project_id: string;
  invoice_type: string;
  raised_date: string;
  due_date: string | null;
  amount_total: number;
  amount_paid: number;
  amount_outstanding: number;
  status: string;
  sent_date: string | null;
  sent_to_email: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  notes: string | null;
  dispatch_event_id: string | null;
};

type Variation = {
  id: string;
  invoice_id: string;
  description: string;
  client_approval_ref: string | null;
  value: number;
  contribution_margin_pct: number | null;
  approved_date: string | null;
};

type Payment = {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount_received: number;
  payment_reference: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "#F7F7F7", text: "#666666", label: "Draft" },
  approved: { bg: "#E8F2ED", text: "#006039", label: "Approved" },
  sent: { bg: "#EAF0FB", text: "#1A1A8C", label: "Sent to Client" },
  partially_paid: { bg: "#FFF3CD", text: "#D4860A", label: "Partially Paid" },
  fully_paid: { bg: "#E8F2ED", text: "#006039", label: "Fully Paid" },
  overdue: { bg: "#FDE8E8", text: "#F40009", label: "Overdue" },
};

const FULL_ACCESS_ROLES = [
  "super_admin", "managing_director", "finance_director", "finance_manager",
];
const SUMMARY_ONLY_ROLES = ["sales_director", "architecture_director"];
const READ_ONLY_ROLES = ["planning_engineer"];

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}
function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
}

export function InvoicesTab() {
  const { role, userId } = useUserRole();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; division: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailVariations, setDetailVariations] = useState<Variation[]>([]);
  const [detailPayments, setDetailPayments] = useState<Payment[]>([]);

  // Create form
  const [newType, setNewType] = useState<"part" | "final">("part");
  const [newProject, setNewProject] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Payment recording
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Variation form
  const [variationOpen, setVariationOpen] = useState(false);
  const [varDesc, setVarDesc] = useState("");
  const [varValue, setVarValue] = useState("");
  const [varMargin, setVarMargin] = useState("");
  const [varApprovalRef, setVarApprovalRef] = useState("");

  const hasFullAccess = FULL_ACCESS_ROLES.includes(role || "");
  const hasSummaryOnly = SUMMARY_ONLY_ROLES.includes(role || "");
  const hasReadOnly = READ_ONLY_ROLES.includes(role || "");
  const canView = hasFullAccess || hasSummaryOnly || hasReadOnly;

  useEffect(() => {
    if (!canView) return;
    loadData();
  }, [canView]);

  async function loadData() {
    setLoading(true);
    const [invRes, projRes] = await Promise.all([
      supabase.from("project_invoices").select("*").order("raised_date", { ascending: false }),
      supabase.from("projects").select("id, name, division").eq("is_archived", false),
    ]);
    if (invRes.data) setInvoices(invRes.data as any);
    if (projRes.data) setProjects(projRes.data as any);
    setLoading(false);
  }

  const projectMap = useMemo(() => {
    const m: Record<string, { name: string; division: string | null }> = {};
    projects.forEach((p) => (m[p.id] = { name: p.name, division: p.division }));
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterProject !== "all" && inv.project_id !== filterProject) return false;
      if (filterType !== "all" && inv.invoice_type !== filterType) return false;
      if (filterStatus !== "all" && inv.status !== filterStatus) return false;
      return true;
    });
  }, [invoices, filterProject, filterType, filterStatus]);

  // Summary tiles
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const invoicedThisMonth = invoices
    .filter((i) => i.raised_date?.startsWith(thisMonth))
    .reduce((s, i) => s + Number(i.amount_total), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.amount_outstanding), 0);
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  const pendingApproval = invoices.filter((i) => i.status === "draft").length;

  async function handleCreate() {
    if (!newProject || !newAmount) { toast.error("Project and amount required"); return; }
    const year = new Date().getFullYear();
    const seq = invoices.length + 1;
    const invoiceNumber = `INV-${year}-${String(seq).padStart(4, "0")}`;
    const { error } = await supabase.from("project_invoices").insert({
      invoice_number: invoiceNumber,
      project_id: newProject,
      invoice_type: newType,
      amount_total: parseFloat(newAmount),
      due_date: newDueDate || null,
      notes: newNotes || null,
      created_by: userId,
      raised_date: format(new Date(), "yyyy-MM-dd"),
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Invoice ${invoiceNumber} created`);
    setCreateOpen(false);
    setNewAmount(""); setNewDueDate(""); setNewNotes(""); setNewProject("");
    loadData();
  }

  async function openDetail(inv: Invoice) {
    setDetailInvoice(inv);
    const [varRes, payRes] = await Promise.all([
      supabase.from("invoice_variations").select("*").eq("invoice_id", inv.id),
      supabase.from("invoice_payments").select("*").eq("invoice_id", inv.id).order("payment_date"),
    ]);
    setDetailVariations((varRes.data as any) || []);
    setDetailPayments((payRes.data as any) || []);
  }

  async function updateStatus(inv: Invoice, newStatus: string) {
    const updates: any = { status: newStatus };
    if (newStatus === "approved") {
      updates.approved_by = userId;
      updates.approved_at = new Date().toISOString();
    }
    if (newStatus === "sent") {
      updates.sent_date = format(new Date(), "yyyy-MM-dd");
    }
    const { error } = await supabase.from("project_invoices").update(updates).eq("id", inv.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status updated to ${STATUS_STYLES[newStatus]?.label || newStatus}`);
    loadData();
    if (detailInvoice?.id === inv.id) openDetail({ ...inv, ...updates });
  }

  async function recordPayment() {
    if (!detailInvoice || !paymentAmount) return;
    const amt = parseFloat(paymentAmount);
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: detailInvoice.id,
      payment_date: paymentDate,
      amount_received: amt,
      payment_reference: paymentRef || null,
      recorded_by: userId,
    } as any);
    if (error) { toast.error(error.message); return; }

    const newPaid = Number(detailInvoice.amount_paid) + amt;
    const newSt = newPaid >= Number(detailInvoice.amount_total) ? "fully_paid" : "partially_paid";
    await supabase.from("project_invoices").update({ amount_paid: newPaid, status: newSt } as any).eq("id", detailInvoice.id);
    toast.success("Payment recorded");
    setPaymentOpen(false); setPaymentAmount(""); setPaymentRef("");
    loadData();
    openDetail({ ...detailInvoice, amount_paid: newPaid, status: newSt });
  }

  async function addVariation() {
    if (!detailInvoice || !varDesc || !varValue) return;
    const margin = varMargin ? parseFloat(varMargin) : null;
    const { error } = await supabase.from("invoice_variations").insert({
      invoice_id: detailInvoice.id,
      description: varDesc,
      value: parseFloat(varValue),
      contribution_margin_pct: margin,
      client_approval_ref: varApprovalRef || null,
      approved_date: format(new Date(), "yyyy-MM-dd"),
      created_by: userId,
    } as any);
    if (error) { toast.error(error.message); return; }

    // Update invoice total
    const newTotal = Number(detailInvoice.amount_total) + parseFloat(varValue);
    await supabase.from("project_invoices").update({ amount_total: newTotal } as any).eq("id", detailInvoice.id);
    toast.success("Variation added");
    setVariationOpen(false); setVarDesc(""); setVarValue(""); setVarMargin(""); setVarApprovalRef("");
    loadData();
    openDetail({ ...detailInvoice, amount_total: newTotal });
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground py-8 text-center">You do not have access to invoice tracking.</p>;
  }

  return (
    <Tabs defaultValue="invoices" className="w-full space-y-4">
      <TabsList>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="retention">Retention</TabsTrigger>
      </TabsList>

      <TabsContent value="invoices">
      <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Invoiced This Month</p>
          <p className="text-lg font-bold" style={{ color: "#006039" }}>{formatCurrency(invoicedThisMonth)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Outstanding Receivable</p>
          <p className="text-lg font-bold" style={{ color: totalOutstanding > 0 ? "#D4860A" : "#006039" }}>{formatCurrency(totalOutstanding)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Overdue Invoices</p>
          <p className="text-lg font-bold" style={{ color: overdueCount > 0 ? "#F40009" : "#006039" }}>{overdueCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Pending Approval</p>
          <p className="text-lg font-bold" style={{ color: pendingApproval > 0 ? "#D4860A" : "#006039" }}>{pendingApproval}</p>
        </CardContent></Card>
      </div>

      {/* Summary-only directors stop here */}
      {hasSummaryOnly && !hasFullAccess && (
        <p className="text-sm text-muted-foreground text-center py-4">Summary view only. Contact Finance for detailed invoice information.</p>
      )}

      {(hasFullAccess || hasReadOnly) && (
        <>
          {/* Filters + Create */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterProject} onValueChange={setFilterProject}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="part">Part Invoice</SelectItem>
                <SelectItem value="final">Final Invoice</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_STYLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFullAccess && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="ml-auto">
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            )}
          </div>

          {/* Invoice Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No invoices found</TableCell></TableRow>
                ) : (
                  filtered.map((inv) => {
                    const st = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
                    return (
                      <TableRow key={inv.id} className="cursor-pointer" onClick={() => openDetail(inv)}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell>{projectMap[inv.project_id]?.name || "—"}</TableCell>
                        <TableCell className="capitalize">{inv.invoice_type}</TableCell>
                        <TableCell>{formatDate(inv.raised_date)}</TableCell>
                        <TableCell>{formatDate(inv.due_date)}</TableCell>
                        <TableCell className="text-right font-medium">{Number(inv.amount_total).toLocaleString("en-IN")}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                            {inv.status === "fully_paid" && <CheckCircle className="h-3 w-3" />}
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(inv); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Invoice Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="part">Part Invoice</SelectItem>
                  <SelectItem value="final">Final Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project</Label>
              <Select value={newProject} onValueChange={setNewProject}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Draft</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={(o) => { if (!o) setDetailInvoice(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailInvoice && (() => {
            const st = STATUS_STYLES[detailInvoice.status] || STATUS_STYLES.draft;
            const projName = projectMap[detailInvoice.project_id]?.name || "—";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {detailInvoice.invoice_number}
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ml-2" style={{ backgroundColor: st.bg, color: st.text }}>
                      {st.label}
                    </span>
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Project:</span> {projName}</div>
                  <div><span className="text-muted-foreground">Type:</span> <span className="capitalize">{detailInvoice.invoice_type}</span></div>
                  <div><span className="text-muted-foreground">Raised:</span> {formatDate(detailInvoice.raised_date)}</div>
                  <div><span className="text-muted-foreground">Due:</span> {formatDate(detailInvoice.due_date)}</div>
                  <div><span className="text-muted-foreground">Total:</span> <strong>{formatCurrency(Number(detailInvoice.amount_total))}</strong></div>
                  <div><span className="text-muted-foreground">Paid:</span> {formatCurrency(Number(detailInvoice.amount_paid))}</div>
                  <div><span className="text-muted-foreground">Outstanding:</span> <strong style={{ color: Number(detailInvoice.amount_outstanding) > 0 ? "#D4860A" : "#006039" }}>{formatCurrency(Number(detailInvoice.amount_outstanding))}</strong></div>
                  {detailInvoice.sent_date && <div><span className="text-muted-foreground">Sent:</span> {formatDate(detailInvoice.sent_date)}</div>}
                </div>

                {detailInvoice.notes && <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{detailInvoice.notes}</p>}

                {/* Variations (Final invoices only) */}
                {detailInvoice.invoice_type === "final" && (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">Variation Orders</h4>
                      {hasFullAccess && (
                        <Button size="sm" variant="outline" onClick={() => setVariationOpen(true)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Variation
                        </Button>
                      )}
                    </div>
                    {detailVariations.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No variations recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {detailVariations.map((v) => (
                          <div key={v.id} className="flex items-center justify-between border rounded p-2 text-xs">
                            <div>
                              <p className="font-medium">{v.description}</p>
                              {v.client_approval_ref && <p className="text-muted-foreground">Ref: {v.client_approval_ref}</p>}
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(Number(v.value))}</p>
                              {v.contribution_margin_pct != null && (
                                <p className={Number(v.contribution_margin_pct) < 35 ? "text-[#F40009]" : "text-[#006039]"}>
                                  {Number(v.contribution_margin_pct) < 35 && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                  {Number(v.contribution_margin_pct).toFixed(1)}% margin
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Payments */}
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">Payments Received</h4>
                    {hasFullAccess && detailInvoice.status !== "fully_paid" && (
                      <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
                        <IndianRupee className="h-3 w-3 mr-1" /> Record Payment
                      </Button>
                    )}
                  </div>
                  {detailPayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No payments recorded.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Reference</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {detailPayments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{formatDate(p.payment_date)}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{formatCurrency(Number(p.amount_received))}</TableCell>
                            <TableCell className="text-xs">{p.payment_reference || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Action buttons */}
                {hasFullAccess && (
                  <div className="flex flex-wrap gap-2 border-t pt-3 mt-3">
                    {detailInvoice.status === "draft" && (
                      <Button size="sm" onClick={() => updateStatus(detailInvoice, "approved")} style={{ backgroundColor: "#006039" }}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    )}
                    {detailInvoice.status === "approved" && (
                      <Button size="sm" onClick={() => updateStatus(detailInvoice, "sent")} style={{ backgroundColor: "#1A1A8C" }}>
                        <Send className="h-4 w-4 mr-1" /> Mark Sent
                      </Button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <Label>Amount Received (₹)</Label>
              <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Payment Reference</Label>
              <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. NEFT ref / cheque no" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={recordPayment}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Variation Dialog */}
      <Dialog open={variationOpen} onOpenChange={setVariationOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Variation Order</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Description</Label>
              <Textarea value={varDesc} onChange={(e) => setVarDesc(e.target.value)} />
            </div>
            <div>
              <Label>Value (₹)</Label>
              <Input type="number" value={varValue} onChange={(e) => setVarValue(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Contribution Margin %</Label>
              <Input type="number" value={varMargin} onChange={(e) => setVarMargin(e.target.value)} placeholder="35" />
              {varMargin && parseFloat(varMargin) < 35 && (
                <p className="text-xs mt-1" style={{ color: "#F40009" }}>
                  <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                  Warning: Margin below 35% target
                </p>
              )}
            </div>
            <div>
              <Label>Client Approval Reference</Label>
              <Input value={varApprovalRef} onChange={(e) => setVarApprovalRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariationOpen(false)}>Cancel</Button>
            <Button onClick={addVariation}>Add Variation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TabsContent>

    <TabsContent value="retention">
      <RetentionSection />
    </TabsContent>
    </Tabs>
  );
}
