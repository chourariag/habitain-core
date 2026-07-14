import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload, Star, CheckCircle2, XCircle, Download, FileText, ChevronDown, ChevronRight, AlertTriangle, Loader2, ShieldAlert, RotateCcw } from "lucide-react";

type Project = { id: string; project_name: string; project_code?: string | null };
type QRStatus =
  | "indent_pending"
  | "indent_approved"
  | "indent_rejected"
  | "open"
  | "under_review"
  | "approved"
  | "rejected"
  | "escalated";
type QR = {
  id: string; project_id: string; material_category: string | null;
  line_item_description: string; unit: string | null;
  boq_quantity: number; boq_unit_rate: number;
  minimum_quotes_required: number; quotes_received_count: number;
  remarks: string | null; status: QRStatus;
  rejection_reason: string | null; created_by: string | null; created_at: string;
  indent_approved_by: string | null; indent_approved_at: string | null;
  indent_rejection_reason: string | null;
  requote_round: number;
  escalated_to_planning_head: boolean;
  escalated_at: string | null;
};
type VQ = {
  id: string; quotation_request_id: string; vendor_name: string;
  unit_rate: number; quantity: number; total_value: number;
  delivery_date: string | null; payment_terms: string | null;
  quote_file_url: string | null; quote_filename: string | null;
  is_preferred: boolean; is_approved: boolean; sayeed_notes: string | null;
};

const MANAGE_ROLES = ["procurement", "purchase_assistant", "managing_director", "super_admin"];
const APPROVE_ROLES = ["costing_engineer", "managing_director", "super_admin"];
const PLANNING_ROLE = "planning_head";
const VIEW_ROLES = [
  "procurement", "purchase_assistant", "costing_engineer", "planning_head", "planning_engineer",
  "managing_director", "super_admin", "finance_director", "head_operations",
];

const MAX_REQUOTE_ROUNDS = 2;

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n || 0);

function minRequired(total: number) {
  // Below ₹50,000 → 1 quote; ≥ ₹50,000 → 3 quotes.
  return total < 50000 ? 1 : 3;
}

function downloadHabitainerTemplate() {
  const headers = [
    "Vendor Name", "Material Description", "Quantity", "Unit", "Unit Rate (INR)",
    "Total Value", "Delivery Date (YYYY-MM-DD)", "Payment Terms", "GST %", "Validity (days)", "Remarks",
  ];
  const sample = [
    "ABC Steel Pvt Ltd", "Sample item", "100", "Nos", "250.00", "25000.00",
    "2026-07-15", "30 days from delivery", "18", "30", "—",
  ];
  const csv = [headers.join(","), sample.map((v) => `"${v}"`).join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "Habitainer_Vendor_Quote_Template.csv";
  a.click(); URL.revokeObjectURL(url);
}

export function QuotationsTab({ userRole, projects }: { userRole: string | null; projects: Project[] }) {
  const canView = VIEW_ROLES.includes(userRole ?? "");
  const canManage = MANAGE_ROLES.includes(userRole ?? "");
  const canApprove = APPROVE_ROLES.includes(userRole ?? "");
  const isPlanningHead = userRole === PLANNING_ROLE;

  const [requests, setRequests] = useState<QR[]>([]);
  const [quotesByReq, setQuotesByReq] = useState<Record<string, VQ[]>>({});
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newOpen, setNewOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: qrs } = await supabase
      .from("quotation_requests").select("*").order("created_at", { ascending: false });
    const list = ((qrs as unknown) as QR[]) ?? [];
    setRequests(list);
    if (list.length) {
      const { data: vqs } = await supabase
        .from("vendor_quotes").select("*")
        .in("quotation_request_id", list.map((r) => r.id));
      const grouped: Record<string, VQ[]> = {};
      (vqs as VQ[] ?? []).forEach((q) => {
        (grouped[q.quotation_request_id] ||= []).push(q);
      });
      setQuotesByReq(grouped);
    } else {
      setQuotesByReq({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (canView) fetchAll(); }, [canView, fetchAll]);

  const filtered = useMemo(() => requests.filter((r) =>
    (filterProject === "all" || r.project_id === filterProject) &&
    (filterStatus === "all" || r.status === filterStatus)
  ), [requests, filterProject, filterStatus]);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.project_name ?? "—";

  if (!canView) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">You do not have access to Quotations.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-display font-bold" style={{ color: "#1A1A1A" }}>Vendor Quotations</h2>
        <div className="ml-auto flex items-center gap-2">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="indent_pending">Indent Pending</SelectItem>
              <SelectItem value="indent_approved">Indent Approved</SelectItem>
              <SelectItem value="indent_rejected">Indent Rejected</SelectItem>
              <SelectItem value="open">Collecting Quotes</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={downloadHabitainerTemplate}>
            <Download className="h-4 w-4 mr-1" /> Habitainer Template
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setNewOpen(true)} style={{ backgroundColor: "#006039", color: "white" }}>
              <Plus className="h-4 w-4 mr-1" /> Raise Indent
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No indents raised yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RequestCard
              key={r.id}
              req={r}
              quotes={quotesByReq[r.id] || []}
              projectName={projectName(r.project_id)}
              expanded={!!expanded[r.id]}
              onToggle={() => setExpanded((s) => ({ ...s, [r.id]: !s[r.id] }))}
              canManage={canManage}
              canApprove={canApprove}
              isPlanningHead={isPlanningHead}
              onChanged={fetchAll}
            />
          ))}
        </div>
      )}

      <NewQuotationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projects={projects}
        onCreated={fetchAll}
      />
    </div>
  );
}

function statusBadge(s: QRStatus) {
  const map: Record<QRStatus, { bg: string; fg: string; label: string }> = {
    indent_pending:  { bg: "#EEF2FF", fg: "#4338CA", label: "Indent Pending" },
    indent_approved: { bg: "#E8F6EF", fg: "#006039", label: "Indent Approved" },
    indent_rejected: { bg: "#FFF0F0", fg: "#F40009", label: "Indent Rejected" },
    open:            { bg: "#EEF6FF", fg: "#1D4ED8", label: "Collecting Quotes" },
    under_review:    { bg: "#FFF8E8", fg: "#D4860A", label: "Under Review" },
    approved:        { bg: "#E8F6EF", fg: "#006039", label: "Approved" },
    rejected:        { bg: "#FFF0F0", fg: "#F40009", label: "Rejected" },
    escalated:       { bg: "#FEE2E2", fg: "#B91C1C", label: "Escalated → Planning Head" },
  };
  const v = map[s];
  return <Badge style={{ backgroundColor: v.bg, color: v.fg }} className="border-0">{v.label}</Badge>;
}

function RequestCard({
  req, quotes, projectName, expanded, onToggle,
  canManage, canApprove, isPlanningHead, onChanged,
}: {
  req: QR; quotes: VQ[]; projectName: string;
  expanded: boolean; onToggle: () => void;
  canManage: boolean; canApprove: boolean; isPlanningHead: boolean;
  onChanged: () => void;
}) {
  const belowMin = req.quotes_received_count < req.minimum_quotes_required;
  const preferred = quotes.find((q) => q.is_preferred);
  const canCollectQuotes = req.status === "indent_approved" || req.status === "open";

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <div className="flex-1">
            <CardTitle className="text-base">{req.line_item_description}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {projectName} · {req.material_category || "—"} · BOQ: {fmtINR(req.boq_quantity)} {req.unit || ""} @ ₹{fmtINR(req.boq_unit_rate)} = ₹{fmtINR(req.boq_quantity * req.boq_unit_rate)}
              {req.requote_round > 0 && (
                <> · <span className="font-medium text-amber-700">Re-quote round {req.requote_round}/{MAX_REQUOTE_ROUNDS}</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canCollectQuotes && belowMin && (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                <AlertTriangle className="h-3 w-3 mr-1" /> {req.quotes_received_count}/{req.minimum_quotes_required} quotes
              </Badge>
            )}
            {canCollectQuotes && !belowMin && (
              <Badge variant="outline">{req.quotes_received_count} quotes</Badge>
            )}
            {statusBadge(req.status)}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {req.status === "indent_pending" && (
            <Card style={{ backgroundColor: "#EEF2FF" }}>
              <CardContent className="p-3 text-sm">
                <p className="font-medium" style={{ color: "#4338CA" }}>Awaiting Costing Engineer approval</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Vendor quotes cannot be collected until the indent is approved against the BOQ rate.
                </p>
              </CardContent>
            </Card>
          )}

          {req.status === "indent_pending" && canApprove && (
            <IndentApprovalActions req={req} onActioned={onChanged} />
          )}

          {req.status === "indent_rejected" && (
            <Card style={{ backgroundColor: "#FFF0F0" }}>
              <CardContent className="p-3 text-sm" style={{ color: "#F40009" }}>
                Indent rejected — {req.indent_rejection_reason || "no reason provided"}. Procurement must revise the indent.
              </CardContent>
            </Card>
          )}

          {(canCollectQuotes || req.status === "under_review" || req.status === "approved" || req.status === "rejected" || req.status === "escalated") && (
            <QuotesTable
              req={req} quotes={quotes}
              canManage={canManage} canApprove={canApprove}
              isPlanningHead={isPlanningHead}
              onChanged={onChanged}
            />
          )}

          {canManage && canCollectQuotes && (
            <AddVendorQuote req={req} onAdded={onChanged} />
          )}

          {canCollectQuotes && canManage && (
            <SubmitForReview req={req} preferred={preferred} onSubmitted={onChanged} />
          )}

          {req.status === "under_review" && canApprove && (
            <ReviewActions req={req} onActioned={onChanged} />
          )}

          {req.status === "escalated" && (
            <Card style={{ backgroundColor: "#FEF2F2" }} className="border-red-200">
              <CardContent className="p-3 text-sm space-y-1">
                <p className="font-medium flex items-center gap-1" style={{ color: "#B91C1C" }}>
                  <ShieldAlert className="h-4 w-4" /> Escalated to Planning Head
                </p>
                <p className="text-muted-foreground text-xs">
                  Completed {MAX_REQUOTE_ROUNDS} re-quote rounds with no acceptable vendor. Awaiting Planning Head's final decision.
                </p>
              </CardContent>
            </Card>
          )}

          {req.status === "escalated" && isPlanningHead && (
            <PlanningHeadActions req={req} onActioned={onChanged} />
          )}

          {req.status === "approved" && (
            <Card style={{ backgroundColor: "#E8F6EF" }}>
              <CardContent className="p-3 text-sm" style={{ color: "#006039" }}>
                ✓ Approved. Create PO in Tally for the approved vendor below.
              </CardContent>
            </Card>
          )}

          {req.status === "rejected" && (
            <Card style={{ backgroundColor: "#FFF0F0" }}>
              <CardContent className="p-3 text-sm" style={{ color: "#F40009" }}>
                Rejected — {req.rejection_reason || "no reason provided"}.
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function IndentApprovalActions({ req, onActioned }: { req: QR; onActioned: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("quotation_requests").update({
      status: "open",
      indent_approved_by: u.user?.id ?? null,
      indent_approved_at: new Date().toISOString(),
      indent_rejection_reason: null,
    } as any).eq("id", req.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Indent approved — Procurement can now collect vendor quotes");
    onActioned();
  };

  const reject = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setBusy(true);
    const { error } = await supabase.from("quotation_requests").update({
      status: "indent_rejected",
      indent_rejection_reason: reason,
    } as any).eq("id", req.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Indent rejected — sent back to Procurement");
    setRejectOpen(false); setReason(""); onActioned();
  };

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Indent
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject indent</DialogTitle></DialogHeader>
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={reject} disabled={busy} style={{ backgroundColor: "#F40009", color: "white" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Button size="sm" onClick={approve} disabled={busy} style={{ backgroundColor: "#006039", color: "white" }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
        Approve Indent
      </Button>
    </div>
  );
}

function QuotesTable({
  req, quotes, canManage, canApprove, isPlanningHead, onChanged,
}: {
  req: QR; quotes: VQ[];
  canManage: boolean; canApprove: boolean; isPlanningHead: boolean;
  onChanged: () => void;
}) {
  const boqRate = Number(req.boq_unit_rate) || 0;
  const canCollectQuotes = req.status === "indent_approved" || req.status === "open";

  const variance = (rate: number) => boqRate > 0 ? ((rate - boqRate) / boqRate) * 100 : 0;
  const varianceFlag = (v: number) => {
    const a = Math.abs(v);
    if (a >= 20) return "red";
    if (a >= 10) return "amber";
    return "none";
  };

  const togglePreferred = async (q: VQ) => {
    if (!canManage || !canCollectQuotes) return;
    await supabase.from("vendor_quotes").update({ is_preferred: false }).eq("quotation_request_id", req.id);
    await supabase.from("vendor_quotes").update({ is_preferred: !q.is_preferred }).eq("id", q.id);
    onChanged();
  };

  const deleteQuote = async (q: VQ) => {
    if (!canManage || !canCollectQuotes) return;
    if (!confirm(`Remove quote from ${q.vendor_name}?`)) return;
    await supabase.from("vendor_quotes").delete().eq("id", q.id);
    onChanged();
  };

  const downloadQuote = async (q: VQ) => {
    if (!q.quote_file_url) return;
    const { data, error } = await supabase.storage.from("vendor-quotes").createSignedUrl(q.quote_file_url, 300);
    if (error || !data) { toast.error("Could not load file"); return; }
    window.open(data.signedUrl, "_blank");
  };

  if (!quotes.length) {
    return <p className="text-sm text-muted-foreground">No vendor quotes uploaded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor</TableHead>
            <TableHead className="text-right">Unit Rate</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Variance vs BOQ</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>File</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => {
            const v = variance(Number(q.unit_rate));
            const flag = varianceFlag(v);
            return (
              <TableRow key={q.id} className={q.is_approved ? "bg-emerald-50/40" : ""}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {q.is_preferred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
                    <span className="font-medium">{q.vendor_name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">₹{fmtINR(Number(q.unit_rate))}</TableCell>
                <TableCell className="text-right">₹{fmtINR(Number(q.total_value))}</TableCell>
                <TableCell>
                  <span style={{
                    color: flag === "red" ? "#F40009" : flag === "amber" ? "#D4860A" : "#1A1A1A",
                    fontWeight: flag === "none" ? 400 : 600,
                  }}>
                    {v > 0 ? "+" : ""}{v.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-xs">{q.delivery_date || "—"}</TableCell>
                <TableCell className="text-xs">{q.payment_terms || "—"}</TableCell>
                <TableCell>
                  {q.quote_file_url ? (
                    <Button size="sm" variant="ghost" onClick={() => downloadQuote(q)}>
                      <FileText className="h-3.5 w-3.5 mr-1" /> {q.quote_filename || "View"}
                    </Button>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {q.is_approved
                    ? <Badge style={{ backgroundColor: "#E8F6EF", color: "#006039" }} className="border-0">Approved</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && canCollectQuotes && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => togglePreferred(q)}>
                        {q.is_preferred ? "Unprefer" : "Prefer"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteQuote(q)}>
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {canApprove && req.status === "under_review" && !q.is_approved && (
                    <ApproveVendorButton req={req} quote={q} variancePct={v} onDone={onChanged} />
                  )}
                  {isPlanningHead && req.status === "escalated" && !q.is_approved && (
                    <ApproveVendorButton req={req} quote={q} variancePct={v} onDone={onChanged} label="Planning Head Approve" />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ApproveVendorButton({ req, quote, variancePct, onDone, label }: { req: QR; quote: VQ; variancePct: number; onDone: () => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const requireComment = Math.abs(variancePct) >= 20;

  const submit = async () => {
    if (requireComment && !notes.trim()) {
      toast.error("Comment required for ≥20% variance");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("vendor_quotes").update({ is_approved: false }).eq("quotation_request_id", req.id);
    const { error: e1 } = await supabase.from("vendor_quotes")
      .update({ is_approved: true, sayeed_notes: notes || null })
      .eq("id", quote.id);
    if (e1) { toast.error(e1.message); setBusy(false); return; }
    await supabase.from("quotation_approvals").insert({
      quotation_request_id: req.id,
      approved_vendor_quote_id: quote.id,
      approved_by: u.user?.id ?? null,
      variance_vs_boq_percent: Number(variancePct.toFixed(2)),
      notes: notes || null,
    });
    const { error: e2 } = await supabase.from("quotation_requests")
      .update({ status: "approved" }).eq("id", req.id);
    if (e2) { toast.error(e2.message); setBusy(false); return; }
    toast.success("Vendor approved");
    setBusy(false); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" style={{ backgroundColor: "#006039", color: "white" }}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {label ?? "Approve"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Approve {quote.vendor_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Unit rate ₹{fmtINR(Number(quote.unit_rate))} — {variancePct > 0 ? "+" : ""}{variancePct.toFixed(1)}% vs BOQ.
          </p>
          {requireComment && (
            <p className="text-xs" style={{ color: "#F40009" }}>
              Variance ≥ 20% — comment is mandatory.
            </p>
          )}
          <Label>Notes {requireComment && <span style={{ color: "#F40009" }}>*</span>}</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} style={{ backgroundColor: "#006039", color: "white" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddVendorQuote({ req, onAdded }: { req: QR; onAdded: () => void }) {
  const [vendorName, setVendorName] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [qty, setQty] = useState(String(req.boq_quantity || ""));
  const [deliveryDate, setDeliveryDate] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const total = (Number(unitRate) || 0) * (Number(qty) || 0);

  const save = async () => {
    if (!vendorName.trim() || !unitRate) { toast.error("Vendor name and rate required"); return; }
    setBusy(true);
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file) {
      const key = `${req.project_id}/${req.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("vendor-quotes").upload(key, file, { upsert: false });
      if (error) { toast.error(error.message); setBusy(false); return; }
      filePath = key; fileName = file.name;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendor_quotes").insert({
      quotation_request_id: req.id,
      vendor_name: vendorName.trim(),
      unit_rate: Number(unitRate),
      quantity: Number(qty) || 0,
      total_value: total,
      delivery_date: deliveryDate || null,
      payment_terms: paymentTerms || null,
      quote_file_url: filePath,
      quote_filename: fileName,
      created_by: u.user?.id ?? null,
    });
    // Flip from indent_approved → open on first quote so downstream filters treat it as "collecting"
    if (!error && req.status === "indent_approved") {
      await supabase.from("quotation_requests").update({ status: "open" }).eq("id", req.id);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quote added");
    setVendorName(""); setUnitRate(""); setDeliveryDate(""); setPaymentTerms(""); setFile(null);
    onAdded();
  };

  return (
    <Card style={{ backgroundColor: "#F7F7F7" }}>
      <CardContent className="p-3 space-y-3">
        <p className="text-sm font-medium">Add Vendor Quote</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div><Label className="text-xs">Vendor Name *</Label><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></div>
          <div><Label className="text-xs">Unit Rate (₹) *</Label><Input type="number" step="0.01" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} /></div>
          <div><Label className="text-xs">Quantity</Label><Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><Label className="text-xs">Total (auto)</Label><Input value={`₹${fmtINR(total)}`} readOnly /></div>
          <div><Label className="text-xs">Delivery Date</Label><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></div>
          <div><Label className="text-xs">Payment Terms</Label><Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30 days" /></div>
          <div className="md:col-span-3">
            <Label className="text-xs">Quote File (PDF / Excel / Image)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={downloadHabitainerTemplate}>
            <Download className="h-3.5 w-3.5 mr-1" /> Use Habitainer Template
          </Button>
          <Button size="sm" onClick={save} disabled={busy} style={{ backgroundColor: "#006039", color: "white" }}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />} Add Quote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmitForReview({ req, preferred, onSubmitted }: { req: QR; preferred: VQ | undefined; onSubmitted: () => void }) {
  const [remarks, setRemarks] = useState(req.remarks || "");
  const [busy, setBusy] = useState(false);
  const belowMin = req.quotes_received_count < req.minimum_quotes_required;

  const submit = async () => {
    if (!preferred) { toast.error("Mark one vendor as Preferred before submitting"); return; }
    if (belowMin && !remarks.trim()) { toast.error("Remarks required when below minimum quotes"); return; }
    setBusy(true);
    const { error } = await supabase.from("quotation_requests")
      .update({ status: "under_review", remarks: remarks || null })
      .eq("id", req.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sent to Costing Engineer for review");
    onSubmitted();
  };

  return (
    <Card style={{ backgroundColor: "#FFFBEB" }}>
      <CardContent className="p-3 space-y-2">
        <p className="text-sm font-medium">Submit for Costing Engineer Review</p>
        {belowMin && (
          <div className="text-xs" style={{ color: "#D4860A" }}>
            Only {req.quotes_received_count} of minimum {req.minimum_quotes_required} quotes — remarks mandatory.
          </div>
        )}
        {belowMin && (
          <Textarea
            placeholder="Why are fewer quotes acceptable? (mandatory)"
            value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
          />
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} disabled={busy} style={{ backgroundColor: "#006039", color: "white" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for Review"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewActions({ req, onActioned }: { req: QR; onActioned: () => void }) {
  const [requoteOpen, setRequoteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const willEscalate = req.requote_round >= MAX_REQUOTE_ROUNDS;

  const requote = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setBusy(true);
    // Clear preferred / approved flags on quotes so Procurement starts fresh
    await supabase.from("vendor_quotes")
      .update({ is_preferred: false, is_approved: false })
      .eq("quotation_request_id", req.id);

    if (willEscalate) {
      const { error } = await supabase.from("quotation_requests").update({
        status: "escalated",
        escalated_to_planning_head: true,
        escalated_at: new Date().toISOString(),
        rejection_reason: reason,
      } as any).eq("id", req.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Escalated to Planning Head — 2 re-quote rounds completed");
    } else {
      const { error } = await supabase.from("quotation_requests").update({
        status: "open",
        requote_round: (req.requote_round || 0) + 1,
        remarks: reason,
      } as any).eq("id", req.id);
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Sent back to Procurement — re-quote round ${(req.requote_round || 0) + 1}/${MAX_REQUOTE_ROUNDS}`);
    }
    setRequoteOpen(false); setReason(""); onActioned();
  };

  return (
    <div className="flex flex-wrap justify-end items-center gap-2">
      <p className="text-xs text-muted-foreground mr-auto">
        Use per-row <strong>Approve</strong> to select a vendor, or request a re-quote if none is acceptable.
      </p>
      <Dialog open={requoteOpen} onOpenChange={setRequoteOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            {willEscalate
              ? <><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Escalate to Planning Head</>
              : <><RotateCcw className="h-3.5 w-3.5 mr-1" /> Request Re-quote ({(req.requote_round || 0) + 1}/{MAX_REQUOTE_ROUNDS})</>}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {willEscalate ? "Escalate to Planning Head" : `Request re-quote (round ${(req.requote_round || 0) + 1}/${MAX_REQUOTE_ROUNDS})`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {willEscalate
              ? `${MAX_REQUOTE_ROUNDS} re-quote rounds have already been completed. This will escalate the quotation to Planning Head for a final decision.`
              : "Procurement will be asked to collect fresh vendor quotes. All preferred / approved flags on current quotes will be cleared."}
          </p>
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequoteOpen(false)}>Cancel</Button>
            <Button
              onClick={requote}
              disabled={busy}
              style={{ backgroundColor: willEscalate ? "#B91C1C" : "#D4860A", color: "white" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (willEscalate ? "Escalate" : "Send Re-quote")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanningHeadActions({ req, onActioned }: { req: QR; onActioned: () => void }) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const reject = async () => {
    if (!reason.trim()) { toast.error("Reason required"); return; }
    setBusy(true);
    const { error } = await supabase.from("quotation_requests")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", req.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quotation rejected");
    setRejectOpen(false); setReason(""); onActioned();
  };

  return (
    <div className="flex justify-end gap-2">
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Quotation
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Planning Head — reject quotation</DialogTitle></DialogHeader>
          <Label>Reason *</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button onClick={reject} disabled={busy} style={{ backgroundColor: "#F40009", color: "white" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground self-center">Use the per-row <strong>Planning Head Approve</strong> to select a final vendor.</p>
    </div>
  );
}

function NewQuotationDialog({
  open, onOpenChange, projects, onCreated,
}: {
  open: boolean; onOpenChange: (b: boolean) => void;
  projects: Project[]; onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  const total = (Number(qty) || 0) * (Number(rate) || 0);
  const minReq = minRequired(total);

  const reset = () => { setProjectId(""); setCategory(""); setDesc(""); setUnit(""); setQty(""); setRate(""); };

  const save = async () => {
    if (!projectId || !desc.trim()) { toast.error("Project and line item required"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("quotation_requests").insert({
      project_id: projectId,
      material_category: category || null,
      line_item_description: desc.trim(),
      unit: unit || null,
      boq_quantity: Number(qty) || 0,
      boq_unit_rate: Number(rate) || 0,
      status: "indent_pending",
      created_by: u.user?.id ?? null,
    } as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Indent raised — awaiting Costing Engineer approval");
    reset(); onOpenChange(false); onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Raise Indent</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Costing Engineer will approve this indent against the BOQ rate before you collect vendor quotes.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Project *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Material Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Steel, MEP" /></div>
            <div><Label>Unit</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Nos / Kg / m" /></div>
          </div>
          <div>
            <Label>Line Item Description *</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>BOQ Quantity</Label><Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div><Label>BOQ Unit Rate (₹)</Label><Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          </div>
          <Card style={{ backgroundColor: "#F7F7F7" }}>
            <CardContent className="p-3 text-sm flex justify-between">
              <span>BOQ Total: <strong>₹{fmtINR(total)}</strong></span>
              <span>Minimum quotes required: <strong>{minReq}</strong> {total < 50000 ? "(below ₹50,000)" : "(≥ ₹50,000)"}</span>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy} style={{ backgroundColor: "#006039", color: "white" }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Raise Indent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
