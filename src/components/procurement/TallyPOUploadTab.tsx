import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Download, Loader2, Check, X, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import * as XLSX from "xlsx";

const UPLOAD_ROLES = ["procurement", "production_head", "super_admin", "managing_director"];
const DIRECTOR_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];

const TEMPLATE_HEADERS = [
  "PO Number", "PO Date", "Vendor Name", "Vendor Code", "Item Description",
  "Quantity", "Unit", "Unit Rate", "Total Amount", "Project Name",
  "Category", "Delivery Date", "Expected Delivery Date", "Notes",
];

interface TallyPO {
  id: string;
  po_number: string | null;
  po_date: string;
  vendor_name: string;
  vendor_code: string | null;
  item_description: string | null;
  quantity: number | null;
  unit: string | null;
  unit_rate: number | null;
  total_amount: number | null;
  project_name: string | null;
  category: string | null;
  delivery_date: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  source: string | null;
  created_at: string;
}

interface UploadResult {
  total: number;
  imported: number;
  duplicates: number;
  failed: number;
  pendingApproval: number;
}

export function TallyPOUploadTab() {
  const [pos, setPos] = useState<TallyPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectPoId, setRejectPoId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAbove50k, setFilterAbove50k] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: role } = await supabase.rpc("get_user_role", { _user_id: user.id });
      setUserRole(role as string | null);
    }
    const { data } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("source", "tally_upload")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    setPos((data as any as TallyPO[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const canUpload = UPLOAD_ROLES.includes(userRole ?? "");
  const isDirector = DIRECTOR_ROLES.includes(userRole ?? "");

  const projects = useMemo(() => {
    const set = new Set(pos.map((p) => p.project_name).filter(Boolean));
    return Array.from(set).sort();
  }, [pos]);

  const vendors = useMemo(() => {
    const set = new Set(pos.map((p) => p.vendor_name).filter(Boolean));
    return Array.from(set).sort();
  }, [pos]);

  const filtered = useMemo(() => {
    return pos.filter((po) => {
      if (filterProject !== "all" && po.project_name !== filterProject) return false;
      if (filterVendor !== "all" && po.vendor_name !== filterVendor) return false;
      if (filterStatus !== "all" && po.status !== filterStatus) return false;
      if (filterDateFrom && po.po_date < filterDateFrom) return false;
      if (filterDateTo && po.po_date > filterDateTo) return false;
      if (filterAbove50k && (po.total_amount ?? 0) <= 50000) return false;
      return true;
    });
  }, [pos, filterProject, filterVendor, filterStatus, filterDateFrom, filterDateTo, filterAbove50k]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    XLSX.utils.book_append_sheet(wb, ws, "PO Template");
    XLSX.writeFile(wb, "Tally_PO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) { toast.error("Only .xlsx files accepted"); return; }

    setUploading(true);
    setUploadResult(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!rows.length) { toast.error("No data rows found"); setUploading(false); return; }

      const existingNums = new Set(pos.map((p) => p.po_number));
      const result: UploadResult = { total: rows.length, imported: 0, duplicates: 0, failed: 0, pendingApproval: 0 };
      const toInsert: any[] = [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (const row of rows) {
        const poNum = String(row["PO Number"] ?? "").trim();
        const poDate = row["PO Date"];
        const vendorName = String(row["Vendor Name"] ?? "").trim();
        const totalAmt = Number(row["Total Amount"]) || 0;

        if (!poNum || !vendorName || !totalAmt) { result.failed++; continue; }
        if (existingNums.has(poNum)) { result.duplicates++; continue; }

        let parsedDate = "";
        if (poDate) {
          if (typeof poDate === "number") {
            const d = XLSX.SSF.parse_date_code(poDate);
            parsedDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          } else {
            const parts = String(poDate).split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [a, b, c] = parts;
              if (Number(a) > 31) parsedDate = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
              else parsedDate = `${c.length === 2 ? "20" + c : c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
            }
          }
        }
        if (!parsedDate) { result.failed++; continue; }

        const status = totalAmt > 50000 ? "pending_approval" : "approved";
        if (status === "pending_approval") result.pendingApproval++;

        let deliveryDate: string | null = null;
        const dd = row["Delivery Date"];
        if (dd) {
          if (typeof dd === "number") {
            const d = XLSX.SSF.parse_date_code(dd);
            deliveryDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          } else {
            const parts = String(dd).split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [a, b, c] = parts;
              if (Number(a) > 31) deliveryDate = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
              else deliveryDate = `${c.length === 2 ? "20" + c : c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
            }
          }
        }

        // Parse expected delivery date
        let expectedDeliveryDate: string | null = null;
        const edd = row["Expected Delivery Date"];
        if (edd) {
          if (typeof edd === "number") {
            const d = XLSX.SSF.parse_date_code(edd);
            expectedDeliveryDate = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
          } else {
            const parts = String(edd).split(/[\/\-\.]/);
            if (parts.length === 3) {
              const [a, b, c] = parts;
              if (Number(a) > 31) expectedDeliveryDate = `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
              else expectedDeliveryDate = `${c.length === 2 ? "20" + c : c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
            }
          }
        }

        // Compute lead_time_promised
        let leadTimePromised: number | null = null;
        if (parsedDate && expectedDeliveryDate) {
          const diff = differenceInDays(parseISO(expectedDeliveryDate), parseISO(parsedDate));
          if (diff > 0) leadTimePromised = diff;
        }

        toInsert.push({
          po_number: poNum,
          po_date: parsedDate,
          vendor_name: vendorName,
          vendor_code: String(row["Vendor Code"] ?? "").trim() || null,
          item_description: String(row["Item Description"] ?? "").trim() || null,
          quantity: Number(row["Quantity"]) || null,
          unit: String(row["Unit"] ?? "").trim() || null,
          unit_rate: Number(row["Unit Rate"]) || null,
          total_amount: totalAmt,
          amount: totalAmt,
          items_summary: String(row["Item Description"] ?? "Tally PO").trim(),
          project_name: String(row["Project Name"] ?? "").trim() || null,
          category: String(row["Category"] ?? "").trim() || null,
          delivery_date: deliveryDate,
          expected_delivery_date: expectedDeliveryDate,
          lead_time_promised: leadTimePromised,
          notes: String(row["Notes"] ?? "").trim() || null,
          status,
          source: "tally_upload",
          uploaded_by: user.id,
          raised_by: user.id,
        });

        existingNums.add(poNum);
      }

      if (toInsert.length > 0) {
        const { client } = await getAuthedClient();
        const { error } = await (client.from("purchase_orders") as any).insert(toInsert);
        if (error) throw error;
        result.imported = toInsert.length;
      }

      setUploadResult(result);
      toast.success(`${result.imported} POs imported successfully`);
      fetchData();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleApprove = async (poId: string) => {
    setActing(true);
    try {
      const { client, session } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders") as any)
        .update({ status: "approved", approved_by: session.user.id, approved_at: new Date().toISOString() })
        .eq("id", poId);
      if (error) throw error;
      toast.success("PO approved");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!rejectPoId || !rejectReason.trim()) { toast.error("Reason required"); return; }
    setActing(true);
    try {
      const { client } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders") as any)
        .update({ status: "rejected", rejection_reason: rejectReason.trim() })
        .eq("id", rejectPoId);
      if (error) throw error;
      toast.success("PO rejected");
      setRejectOpen(false);
      setRejectPoId(null);
      setRejectReason("");
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setActing(false); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; bg: string; color: string }> = {
      approved: { label: "Approved", bg: "#E8F2ED", color: "#006039" },
      pending_approval: { label: "Pending Approval", bg: "#FFF3CD", color: "#D4860A" },
      rejected: { label: "Rejected", bg: "#FDE8E8", color: "#F40009" },
    };
    const s = map[status] ?? { label: status, bg: "#F7F7F7", color: "#666" };
    return <Badge style={{ backgroundColor: s.bg, color: s.color, border: "none" }}>{s.label}</Badge>;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
  };

  const formatCurrency = (n: number | null) => {
    if (n == null) return "—";
    return "₹" + n.toLocaleString("en-IN");
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: "#666" }} /></div>;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      {canUpload && (
        <Card style={{ backgroundColor: "#F7F7F7", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-lg font-bold" style={{ color: "#1A1A1A" }}>Upload Tally POs</h2>
                <p className="text-xs mt-0.5 font-inter" style={{ color: "#666" }}>Import Purchase Orders from Tally Excel export</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate} className="gap-2 font-display text-sm" style={{ borderColor: "#006039", color: "#006039" }}>
                <Download className="h-4 w-4" /> Download Template
              </Button>
            </div>

            <div className="rounded-md p-3 text-sm font-inter" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              <AlertTriangle className="h-4 w-4 inline mr-1.5" />
              Export Purchase Orders from Tally: Gateway → Display → More Reports → Purchase → Purchase Order Book → Export Excel. Then upload the file here.
            </div>

            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2 font-display" style={{ backgroundColor: "#006039" }}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Processing..." : "Upload .xlsx"}
              </Button>
            </div>

            {uploadResult && (
              <div className="rounded-md p-4 space-y-2" style={{ backgroundColor: "#fff", border: "1px solid #E0E0E0" }}>
                <p className="font-display font-bold text-sm" style={{ color: "#1A1A1A" }}>Upload Summary</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm font-inter">
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#F7F7F7" }}>
                    <p className="font-bold" style={{ color: "#1A1A1A" }}>{uploadResult.total}</p>
                    <p className="text-xs" style={{ color: "#666" }}>Total Rows</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#E8F2ED" }}>
                    <p className="font-bold" style={{ color: "#006039" }}>{uploadResult.imported}</p>
                    <p className="text-xs" style={{ color: "#006039" }}>Imported</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#FFF8E8" }}>
                    <p className="font-bold" style={{ color: "#D4860A" }}>{uploadResult.duplicates}</p>
                    <p className="text-xs" style={{ color: "#D4860A" }}>Duplicates</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#FDE8E8" }}>
                    <p className="font-bold" style={{ color: "#F40009" }}>{uploadResult.failed}</p>
                    <p className="text-xs" style={{ color: "#F40009" }}>Failed</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#FFF3CD" }}>
                    <p className="font-bold" style={{ color: "#D4860A" }}>{uploadResult.pendingApproval}</p>
                    <p className="text-xs" style={{ color: "#D4860A" }}>Pending Approval</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-40">
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>Project</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>Vendor</Label>
          <Select value={filterVendor} onValueChange={setFilterVendor}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((v) => <SelectItem key={v} value={v!}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending_approval">Pending Approval</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>From</Label>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-36 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>To</Label>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-36 text-sm" />
        </div>
        <Button
          variant={filterAbove50k ? "default" : "outline"}
          size="sm"
          className="font-display text-xs"
          style={filterAbove50k ? { backgroundColor: "#D4860A" } : {}}
          onClick={() => setFilterAbove50k(!filterAbove50k)}
        >
          Above ₹50K
        </Button>
      </div>

      {/* PO List */}
      <Card style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-display text-xs">PO Number</TableHead>
                <TableHead className="font-display text-xs">Date</TableHead>
                <TableHead className="font-display text-xs">Vendor</TableHead>
                <TableHead className="font-display text-xs">Project</TableHead>
                <TableHead className="font-display text-xs text-right">Amount</TableHead>
                <TableHead className="font-display text-xs">Category</TableHead>
                <TableHead className="font-display text-xs">Status</TableHead>
                {isDirector && <TableHead className="font-display text-xs">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isDirector ? 8 : 7} className="text-center py-8">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2" style={{ color: "#CCC" }} />
                    <p className="text-sm" style={{ color: "#666" }}>No Tally POs found</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-inter text-sm font-semibold" style={{ color: "#1A1A1A" }}>{po.po_number ?? "—"}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#666" }}>{formatDate(po.po_date)}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#1A1A1A" }}>{po.vendor_name}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#666" }}>{po.project_name ?? "—"}</TableCell>
                  <TableCell className="font-inter text-sm text-right font-semibold" style={{ color: "#1A1A1A" }}>{formatCurrency(po.total_amount)}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#666" }}>{po.category ?? "—"}</TableCell>
                  <TableCell>{statusBadge(po.status)}</TableCell>
                  {isDirector && (
                    <TableCell>
                      {po.status === "pending_approval" && (
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => handleApprove(po.id)} disabled={acting} className="gap-1 font-display text-xs" style={{ backgroundColor: "#006039" }}>
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectPoId(po.id); setRejectOpen(true); }} disabled={acting} className="gap-1 font-display text-xs" style={{ borderColor: "#F40009", color: "#F40009" }}>
                            <X className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}
                      {po.status === "rejected" && po.rejection_reason && (
                        <span className="text-xs font-inter" style={{ color: "#F40009" }}>Reason: {po.rejection_reason}</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => { if (!v) { setRejectOpen(false); setRejectPoId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Reject PO</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-display text-sm">Reason for Rejection</Label>
              <Textarea
                placeholder="Explain why this PO is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="font-inter mt-1"
              />
            </div>
            <Button onClick={handleReject} disabled={acting || !rejectReason.trim()} className="w-full font-display" style={{ backgroundColor: "#F40009" }}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
