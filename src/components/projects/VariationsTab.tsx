import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Download, Loader2, CheckCircle2, XCircle, Clock, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { insertNotifications } from "@/lib/notifications";
import * as XLSX from "xlsx";

const SCOPE_TYPES = [
  "Addition", "Quantity Increase", "Quantity Decrease",
  "Specification Upgrade", "Specification Downgrade",
  "Credit Note", "Provisional Item Confirmed",
];

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  Draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: FileText },
  "Pending Scope Review": { label: "Pending Scope", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  "Pending Finance Approval": { label: "Pending Finance", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  "Pending MD Approval": { label: "Pending MD", className: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  Approved: { label: "Approved", className: "bg-[#006039]/10 text-[#006039] border-[#006039]/20", icon: CheckCircle2 },
  Rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
};

const CREATE_ROLES = ["planning_engineer", "costing_engineer", "super_admin", "managing_director"];
const SCOPE_APPROVE_ROLES = ["sales_director", "super_admin", "managing_director"];
const FINANCE_APPROVE_ROLES = ["finance_director", "finance_manager", "super_admin", "managing_director"];
const MD_APPROVE_ROLES = ["managing_director", "super_admin"];
const VIEW_ROLES = [...CREATE_ROLES, ...SCOPE_APPROVE_ROLES, ...FINANCE_APPROVE_ROLES, "sales_executive"];

interface Variation {
  id: string;
  project_id: string;
  variation_number: string;
  description: string;
  scope_change_type: string;
  linked_boq_item_id: string | null;
  tender_qty: number;
  gfc_qty: number;
  variance_qty: number;
  unit: string;
  material_rate: number;
  labour_rate: number;
  basic_rate: number;
  margin_pct: number;
  margin_rate: number;
  final_rate: number;
  final_cost: number;
  margin_amount: number;
  initiated_by: string | null;
  date_raised: string;
  status: string;
  scope_approved_by: string | null;
  scope_approved_at: string | null;
  finance_approved_by: string | null;
  finance_approved_at: string | null;
  md_approved_by: string | null;
  md_approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  supporting_doc_urls: string[];
}

interface Props {
  projectId: string;
  userRole: string | null;
  contractValue?: number;
}

const fmt = (n: number) => "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function VariationsTab({ projectId, userRole, contractValue = 0 }: Props) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ variation: Variation; action: string } | null>(null);
  const [actionReason, setActionReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({
    description: "", scope_change_type: "Addition", tender_qty: "",
    gfc_qty: "", unit: "nos", material_rate: "", labour_rate: "",
    margin_pct: "30", notes: "",
  });

  const canCreate = CREATE_ROLES.includes(userRole ?? "");
  const canScopeApprove = SCOPE_APPROVE_ROLES.includes(userRole ?? "");
  const canFinanceApprove = FINANCE_APPROVE_ROLES.includes(userRole ?? "");
  const canMDApprove = MD_APPROVE_ROLES.includes(userRole ?? "");

  const fetchVariations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_variations")
      .select("*")
      .eq("project_id", projectId)
      .order("variation_number", { ascending: true });
    setVariations((data ?? []) as Variation[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchVariations(); }, [fetchVariations]);

  // Computed values
  const tenderQty = Number(form.tender_qty) || 0;
  const gfcQty = Number(form.gfc_qty) || 0;
  const materialRate = Number(form.material_rate) || 0;
  const labourRate = Number(form.labour_rate) || 0;
  const marginPct = Number(form.margin_pct) || 0;
  const varianceQty = gfcQty - tenderQty;
  const basicRate = materialRate + labourRate;
  const marginRate = marginPct < 100 ? basicRate * marginPct / (100 - marginPct) : 0;
  const finalRate = basicRate + marginRate;
  const finalCost = gfcQty * basicRate;
  const marginAmount = gfcQty * marginRate;

  // Summary
  const approvedTotal = useMemo(() => variations.filter(v => v.status === "Approved").reduce((s, v) => s + Number(v.final_cost), 0), [variations]);
  const pendingTotal = useMemo(() => variations.filter(v => !["Approved", "Rejected"].includes(v.status)).reduce((s, v) => s + Number(v.final_cost), 0), [variations]);
  const approvedCount = variations.filter(v => v.status === "Approved").length;
  const pendingCount = variations.filter(v => !["Approved", "Rejected", "Draft"].includes(v.status)).length;
  const rejectedCount = variations.filter(v => v.status === "Rejected").length;
  const revisedContract = contractValue + approvedTotal;

  const resetForm = () => setForm({
    description: "", scope_change_type: "Addition", tender_qty: "",
    gfc_qty: "", unit: "nos", material_rate: "", labour_rate: "",
    margin_pct: "30", notes: "",
  });

  const handleSubmit = async () => {
    if (!form.description.trim()) { toast.error("Description is required"); return; }
    if (!form.gfc_qty) { toast.error("GFC Quantity is required"); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();

      const nextNum = `V${String(variations.length + 1).padStart(3, "0")}`;

      const row = {
        project_id: projectId,
        variation_number: nextNum,
        description: form.description.trim(),
        scope_change_type: form.scope_change_type,
        tender_qty: tenderQty,
        gfc_qty: gfcQty,
        variance_qty: varianceQty,
        unit: form.unit.trim() || "nos",
        material_rate: materialRate,
        labour_rate: labourRate,
        basic_rate: basicRate,
        margin_pct: marginPct,
        margin_rate: marginRate,
        final_rate: finalRate,
        final_cost: finalCost,
        margin_amount: marginAmount,
        initiated_by: user.id,
        status: "Pending Scope Review",
        notes: form.notes.trim() || null,
      };

      const { error } = await (client.from("project_variations") as any).insert(row);
      if (error) throw error;

      // Notify scope approvers
      const { data: approvers } = await supabase.from("profiles").select("id").in("role", ["sales_director"]).eq("is_active", true);
      if (approvers?.length) {
        await insertNotifications(approvers.map((a: any) => ({
          recipient_id: a.id,
          title: "Variation Scope Review",
          body: `New variation ${nextNum} raised for review: ${form.description.trim().slice(0, 80)}`,
          category: "variation_approval",
          related_table: "project_variations",
          navigate_to: `/projects/${projectId}`,
        })));
      }

      toast.success(`Variation ${nextNum} created`);
      setFormOpen(false);
      resetForm();
      fetchVariations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    const { variation, action } = actionDialog;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // SoD checks
      if (action === "scope_approve" && variation.initiated_by === user.id) {
        toast.error("You cannot approve a variation you raised"); return;
      }
      if (action === "finance_approve" && variation.scope_approved_by === user.id) {
        toast.error("You cannot perform consecutive approval steps"); return;
      }

      const { client } = await getAuthedClient();
      let update: Record<string, any> = {};
      let notifyBody = "";

      if (action === "scope_approve") {
        const needsFinance = Number(variation.final_cost) >= 25000;
        update = {
          scope_approved_by: user.id,
          scope_approved_at: new Date().toISOString(),
          status: needsFinance ? "Pending Finance Approval" : "Approved",
        };
        notifyBody = needsFinance
          ? `Variation ${variation.variation_number} scope approved. Pending finance review.`
          : `Variation ${variation.variation_number} approved (below ₹25K threshold).`;
      } else if (action === "finance_approve") {
        const needsMD = Number(variation.final_cost) > 200000;
        update = {
          finance_approved_by: user.id,
          finance_approved_at: new Date().toISOString(),
          status: needsMD ? "Pending MD Approval" : "Approved",
        };
        notifyBody = needsMD
          ? `Variation ${variation.variation_number} finance approved. Pending MD approval (>₹2L).`
          : `Variation ${variation.variation_number} fully approved.`;
      } else if (action === "md_approve") {
        update = {
          md_approved_by: user.id,
          md_approved_at: new Date().toISOString(),
          status: "Approved",
        };
        notifyBody = `Variation ${variation.variation_number} approved by MD.`;
      } else if (action === "reject") {
        update = {
          status: "Draft",
          rejection_reason: actionReason.trim() || "Rejected by reviewer",
        };
        notifyBody = `Variation ${variation.variation_number} was sent back: ${actionReason.trim() || "Rejected"}`;
      }

      const { error } = await (client.from("project_variations") as any).update(update).eq("id", variation.id);
      if (error) throw error;

      // Notify initiator
      if (variation.initiated_by) {
        await insertNotifications({
          recipient_id: variation.initiated_by,
          title: action === "reject" ? "Variation Sent Back" : "Variation Updated",
          body: notifyBody,
          category: "variation_approval",
          related_table: "project_variations",
          related_id: variation.id,
          navigate_to: `/projects/${projectId}`,
        });
      }

      toast.success(action === "reject" ? "Variation sent back" : "Variation approved");
      setActionDialog(null);
      setActionReason("");
      fetchVariations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Excel upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { client } = await getAuthedClient();

      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const toInsert = rows.map((r, i) => {
        const matRate = Number(r["Material Rate ₹"] || r["Material Rate"] || 0);
        const labRate = Number(r["Labour Rate ₹"] || r["Labour Rate"] || 0);
        const br = matRate + labRate;
        const mp = Number(r["Margin %"] || 30);
        const mr = mp < 100 ? br * mp / (100 - mp) : 0;
        const gq = Number(r["GFC Qty"] || 0);
        return {
          project_id: projectId,
          variation_number: String(r["V.No"] || `V${String(i + 1).padStart(3, "0")}`),
          description: String(r["Description"] || "Imported variation"),
          scope_change_type: String(r["Scope Change Type"] || "Addition"),
          tender_qty: Number(r["Tender Qty"] || 0),
          gfc_qty: gq,
          variance_qty: gq - Number(r["Tender Qty"] || 0),
          unit: String(r["Unit"] || "nos"),
          material_rate: matRate,
          labour_rate: labRate,
          basic_rate: br,
          margin_pct: mp,
          margin_rate: mr,
          final_rate: br + mr,
          final_cost: gq * br,
          margin_amount: gq * mr,
          initiated_by: user.id,
          status: "Approved",
          notes: "Imported from historical record",
        };
      });

      if (toInsert.length === 0) { toast.error("No rows found"); return; }
      const { error } = await (client.from("project_variations") as any).insert(toInsert);
      if (error) throw error;
      toast.success(`${toInsert.length} variations imported`);
      fetchVariations();
    } catch (err: any) {
      toast.error(err.message);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadTemplate = () => {
    const t = TEMPLATES.variationRegister;
    downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Variations</h2>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
              <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Template</Button>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" /> Upload</Button>
              <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Variation</Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="py-3 px-4 text-center">
          <p className="text-xs text-muted-foreground">Original Contract</p>
          <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>{fmt(contractValue)}</p>
        </CardContent></Card>
        <Card style={{ backgroundColor: "#E8F2ED" }}><CardContent className="py-3 px-4 text-center">
          <p className="text-xs" style={{ color: "#006039" }}>Approved Variations</p>
          <p className="text-sm font-bold" style={{ color: "#006039" }}>{fmt(approvedTotal)}</p>
        </CardContent></Card>
        <Card style={{ backgroundColor: "#FFF8E8" }}><CardContent className="py-3 px-4 text-center">
          <p className="text-xs" style={{ color: "#D4860A" }}>Pending Variations</p>
          <p className="text-sm font-bold" style={{ color: "#D4860A" }}>{fmt(pendingTotal)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4 text-center">
          <p className="text-xs text-muted-foreground">Revised Contract</p>
          <p className="text-sm font-bold" style={{ color: "#1A1A1A" }}>{fmt(revisedContract)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4 text-center">
          <p className="text-xs text-muted-foreground">Counts</p>
          <div className="flex justify-center gap-2 text-xs">
            <span style={{ color: "#006039" }}>{approvedCount} ✓</span>
            <span style={{ color: "#D4860A" }}>{pendingCount} ⏳</span>
            <span style={{ color: "#F40009" }}>{rejectedCount} ✗</span>
          </div>
        </CardContent></Card>
      </div>

      {/* Register Table */}
      {variations.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No variations yet. {canCreate ? 'Click "+ New Variation" to add one.' : ""}
        </CardContent></Card>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">V.No</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-16 text-right">Tender</TableHead>
                <TableHead className="w-16 text-right">GFC</TableHead>
                <TableHead className="w-16 text-right">Var</TableHead>
                <TableHead className="w-24 text-right">Final Cost</TableHead>
                <TableHead className="w-20 text-right">Margin</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variations.map((v) => {
                const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.Draft;
                const Icon = cfg.icon;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.variation_number}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{v.description}</TableCell>
                    <TableCell className="text-xs">{v.scope_change_type}</TableCell>
                    <TableCell className="text-xs text-right">{v.tender_qty}</TableCell>
                    <TableCell className="text-xs text-right">{v.gfc_qty}</TableCell>
                    <TableCell className={cn("text-xs text-right font-medium", Number(v.variance_qty) > 0 ? "text-red-600" : Number(v.variance_qty) < 0 ? "text-[#006039]" : "")}>
                      {Number(v.variance_qty) > 0 ? "+" : ""}{v.variance_qty}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">{fmt(Number(v.final_cost))}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(Number(v.margin_amount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", cfg.className)}>
                        <Icon className="h-3 w-3 mr-1" /> {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {v.status === "Pending Scope Review" && canScopeApprove && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setActionDialog({ variation: v, action: "scope_approve" })}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600" onClick={() => setActionDialog({ variation: v, action: "reject" })}>Reject</Button>
                          </>
                        )}
                        {v.status === "Pending Finance Approval" && canFinanceApprove && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setActionDialog({ variation: v, action: "finance_approve" })}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600" onClick={() => setActionDialog({ variation: v, action: "reject" })}>Reject</Button>
                          </>
                        )}
                        {v.status === "Pending MD Approval" && canMDApprove && (
                          <>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => setActionDialog({ variation: v, action: "md_approve" })}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600" onClick={() => setActionDialog({ variation: v, action: "reject" })}>Reject</Button>
                          </>
                        )}
                        {v.rejection_reason && v.status === "Draft" && (
                          <span className="text-xs text-red-500 truncate max-w-[120px]" title={v.rejection_reason}>{v.rejection_reason}</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Variation Sheet */}
      <Sheet open={formOpen} onOpenChange={(o) => { if (!o) { setFormOpen(false); resetForm(); } }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader><SheetTitle>New Variation</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the scope change" rows={3} />
            </div>
            <div>
              <Label>Scope Change Type *</Label>
              <Select value={form.scope_change_type} onValueChange={v => setForm(f => ({ ...f, scope_change_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tender Qty</Label>
                <Input type="number" value={form.tender_qty} onChange={e => setForm(f => ({ ...f, tender_qty: e.target.value }))} />
              </div>
              <div>
                <Label>GFC Qty *</Label>
                <Input type="number" value={form.gfc_qty} onChange={e => setForm(f => ({ ...f, gfc_qty: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Material Rate ₹ *</Label>
                <Input type="number" value={form.material_rate} onChange={e => setForm(f => ({ ...f, material_rate: e.target.value }))} />
              </div>
              <div>
                <Label>Labour Rate ₹ *</Label>
                <Input type="number" value={form.labour_rate} onChange={e => setForm(f => ({ ...f, labour_rate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Margin % (default 30%)</Label>
              <Input type="number" value={form.margin_pct} onChange={e => setForm(f => ({ ...f, margin_pct: e.target.value }))} />
            </div>

            {/* Auto-calculated preview */}
            <Card className="bg-muted/30"><CardContent className="py-3 px-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Variance Qty</span><span className="font-medium">{varianceQty > 0 ? `+${varianceQty}` : varianceQty}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Basic Rate</span><span className="font-medium">{fmt(basicRate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margin Rate</span><span className="font-medium">{fmt(marginRate)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Final Rate</span><span className="font-bold">{fmt(finalRate)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Final Cost</span><span className="font-bold">{fmt(finalCost)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margin Amount</span><span className="font-bold" style={{ color: "#006039" }}>{fmt(marginAmount)}</span></div>
            </CardContent></Card>

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" rows={2} />
            </div>

            <Button className="w-full" onClick={handleSubmit} style={{ backgroundColor: "#006039" }}>
              Submit for Scope Review
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Approval / Rejection Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={o => { if (!o) { setActionDialog(null); setActionReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "reject" ? "Reject Variation" : "Approve Variation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {actionDialog?.variation.variation_number} — {actionDialog?.variation.description}
            </p>
            <p className="text-sm font-medium">Final Cost: {fmt(Number(actionDialog?.variation.final_cost ?? 0))}</p>
            {actionDialog?.action === "reject" && (
              <div>
                <Label>Reason for rejection</Label>
                <Textarea value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Explain why this is being sent back" rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={handleAction}
              className={actionDialog?.action === "reject" ? "bg-red-600 hover:bg-red-700" : ""}
              style={actionDialog?.action !== "reject" ? { backgroundColor: "#006039" } : {}}
            >
              {actionDialog?.action === "reject" ? "Send Back" : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
