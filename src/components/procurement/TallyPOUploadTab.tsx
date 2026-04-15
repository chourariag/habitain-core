import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, Download, Loader2, Check, X, AlertTriangle, FileSpreadsheet, ChevronRight, Link } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import * as XLSX from "xlsx";

const UPLOAD_ROLES = ["procurement", "production_head", "super_admin", "managing_director"];
const DIRECTOR_ROLES = ["super_admin", "managing_director", "finance_director", "sales_director", "architecture_director"];

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
  project_id: string | null;
  category: string | null;
  delivery_date: string | null;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  source: string | null;
  po_type: string;
  created_at: string;
}

interface UploadResult {
  totalPOs: number;
  totalWOs: number;
  imported: number;
  duplicates: number;
  failed: number;
  pendingApproval: number;
  linked: number;
  unlinked: { poNumber: string; extractedProject: string }[];
  totalPOValue: number;
  totalWOValue: number;
}

interface ProjectInfo { id: string; name: string }

function parseExcelDate(v: any): string | null {
  if (!v) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // Try Date object
  const d = new Date(s);
  if (isValid(d)) return format(d, "yyyy-MM-dd");
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (Number(a) > 31) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`;
    return `${c.length === 2 ? "20" + c : c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  return null;
}

function extractProjectFromNarration(narration: string): string | null {
  if (!narration) return null;
  // Match patterns: "project name-X", "project name X", "project-X"
  const patterns = [
    /project\s*name\s*[-–:]\s*(.+)/i,
    /project\s*[-–:]\s*(.+)/i,
    /proj\s*[-–:]\s*(.+)/i,
  ];
  for (const p of patterns) {
    const m = narration.match(p);
    if (m) return m[1].trim().replace(/[''"]+$/g, "").trim();
  }
  return null;
}

function matchProject(extractedName: string, projects: ProjectInfo[]): ProjectInfo | null {
  if (!extractedName) return null;
  const lower = extractedName.toLowerCase();
  // Exact substring match
  for (const p of projects) {
    if (p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())) {
      return p;
    }
  }
  return null;
}

function isWorkOrder(vchNo: string): boolean {
  return /^\d+$/.test(vchNo.trim());
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
  const [allProjects, setAllProjects] = useState<ProjectInfo[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPoId, setLinkPoId] = useState<string | null>(null);
  const [linkProjectId, setLinkProjectId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterProject, setFilterProject] = useState("all");
  const [filterVendor, setFilterVendor] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
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
    const [{ data: poData }, { data: projData }] = await Promise.all([
      supabase.from("purchase_orders").select("*").eq("source", "tally_upload").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name"),
    ]);
    setPos((poData as any as TallyPO[]) ?? []);
    setAllProjects((projData as ProjectInfo[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const canUpload = UPLOAD_ROLES.includes(userRole ?? "");
  const isDirector = DIRECTOR_ROLES.includes(userRole ?? "");

  const projectNames = useMemo(() => {
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
      if (filterType !== "all" && po.po_type !== filterType) return false;
      if (filterDateFrom && po.po_date < filterDateFrom) return false;
      if (filterDateTo && po.po_date > filterDateTo) return false;
      if (filterAbove50k && (po.total_amount ?? 0) <= 50000) return false;
      return true;
    });
  }, [pos, filterProject, filterVendor, filterStatus, filterType, filterDateFrom, filterDateTo, filterAbove50k]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["PO Number", "PO Date", "Vendor Name", "Vendor Code", "Item Description",
       "Quantity", "Unit", "Unit Rate", "Total Amount", "Project Name",
       "Category", "Delivery Date", "Expected Delivery Date", "Notes"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "PO Template");
    XLSX.writeFile(wb, "Tally_PO_Template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) { toast.error("Only .xlsx/.xls files accepted"); return; }

    setUploading(true);
    setUploadResult(null);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      if (!rows.length) { toast.error("No data rows found"); setUploading(false); return; }

      // Header detection: find row with "Date" in col A and row containing "Vch No" or "Order Amount"
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i];
        if (!row) continue;
        const rowStr = row.map((c: any) => String(c || "").toLowerCase()).join("|");
        const colA = String(row[0] || "").trim().toLowerCase();
        if (colA.includes("date") && (rowStr.includes("vch no") || rowStr.includes("order amount") || rowStr.includes("debit"))) {
          headerIdx = i;
          break;
        }
      }

      // If no Tally header found, try old template format
      if (headerIdx < 0) {
        // Check if row 0 looks like the template header
        const firstRow = rows[0];
        if (firstRow && String(firstRow[0] || "").toLowerCase().includes("po number")) {
          return handleTemplateUpload(rows);
        }
        // Try skipping first row as header
        headerIdx = 0;
      }

      const dataStart = headerIdx + 1;

      // Fetch projects for matching
      const { data: projList } = await supabase.from("projects").select("id, name");
      const projectsList: ProjectInfo[] = (projList as ProjectInfo[]) || [];

      const existingNums = new Set(pos.map((p) => p.po_number));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result: UploadResult = {
        totalPOs: 0, totalWOs: 0, imported: 0, duplicates: 0, failed: 0,
        pendingApproval: 0, linked: 0, unlinked: [], totalPOValue: 0, totalWOValue: 0,
      };

      const toInsert: any[] = [];
      let i = dataStart;

      while (i < rows.length) {
        const row = rows[i];
        if (!row) { i++; continue; }

        // Col A = Date, Col B = Particulars (vendor), Col D = Vch Type, Col E = Vch No, Col F = Order Ref, Col G = Order Amount
        const dateVal = row[0];
        const particulars = String(row[1] || "").trim();

        // Skip empty rows
        if (!dateVal && !particulars) { i++; continue; }

        // Parse date
        const parsedDate = parseExcelDate(dateVal);
        if (!parsedDate) { i++; continue; }

        const vchType = row[3] != null ? String(row[3]).trim() : null;
        const vchNo = row[4] != null ? String(row[4]).trim() : "";
        const orderRef = row[5] != null ? String(row[5]).trim() : null;
        const orderAmount = Number(row[6]) || 0;

        if (!particulars || orderAmount === 0) { result.failed++; i++; continue; }
        if (vchNo && existingNums.has(vchNo)) { result.duplicates++; i++; continue; }

        // Determine PO vs Work Order
        const poType = isWorkOrder(vchNo) ? "work_order" : "purchase_order";

        // Look ahead for narration row
        let narration = "";
        let extractedProject: string | null = null;
        let matchedProject: ProjectInfo | null = null;

        if (i + 1 < rows.length) {
          const nextRow = rows[i + 1];
          if (nextRow && !nextRow[0] && nextRow[1] && typeof nextRow[1] === "string") {
            // This is a narration row
            narration = String(nextRow[1]).trim();
            extractedProject = extractProjectFromNarration(narration);
            if (extractedProject) {
              matchedProject = matchProject(extractedProject, projectsList);
            }
            i++; // Skip narration row
          }
        }

        const totalAmt = orderAmount;
        const status = poType === "purchase_order" && totalAmt > 50000 ? "pending_approval" : "approved";
        if (status === "pending_approval") result.pendingApproval++;

        if (poType === "work_order") {
          result.totalWOs++;
          result.totalWOValue += totalAmt;
        } else {
          result.totalPOs++;
          result.totalPOValue += totalAmt;
        }

        if (matchedProject) result.linked++;
        else if (extractedProject) result.unlinked.push({ poNumber: vchNo || `Row ${i + 1}`, extractedProject });

        toInsert.push({
          po_number: vchNo || null,
          po_date: parsedDate,
          vendor_name: particulars,
          vendor_code: null,
          item_description: narration || null,
          quantity: null,
          unit: null,
          unit_rate: null,
          total_amount: totalAmt,
          amount: totalAmt,
          items_summary: narration || particulars,
          project_name: matchedProject?.name || extractedProject || null,
          project_id: matchedProject?.id || null,
          category: orderRef || null,
          delivery_date: null,
          expected_delivery_date: null,
          lead_time_promised: null,
          notes: narration || null,
          status,
          po_type: poType,
          source: "tally_upload",
          uploaded_by: user.id,
          raised_by: user.id,
        });

        if (vchNo) existingNums.add(vchNo);
        i++;
      }

      if (toInsert.length > 0) {
        const { client } = await getAuthedClient();
        for (let j = 0; j < toInsert.length; j += 50) {
          const { error } = await (client.from("purchase_orders") as any).insert(toInsert.slice(j, j + 50));
          if (error) throw error;
        }
        result.imported = toInsert.length;
      }

      setUploadResult(result);
      toast.success(`${result.imported} records imported (${result.totalPOs} POs, ${result.totalWOs} Work Orders)`);
      fetchData();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Handle old template format upload
  const handleTemplateUpload = async (rows: any[][]) => {
    try {
      const headers = rows[0];
      const jsonRows = rows.slice(1).map(r => {
        const obj: any = {};
        headers.forEach((h: any, idx: number) => { obj[String(h)] = r[idx]; });
        return obj;
      });

      const existingNums = new Set(pos.map((p) => p.po_number));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const result: UploadResult = {
        totalPOs: 0, totalWOs: 0, imported: 0, duplicates: 0, failed: 0,
        pendingApproval: 0, linked: 0, unlinked: [], totalPOValue: 0, totalWOValue: 0,
      };
      const toInsert: any[] = [];

      for (const row of jsonRows) {
        const poNum = String(row["PO Number"] ?? "").trim();
        const vendorName = String(row["Vendor Name"] ?? "").trim();
        const totalAmt = Number(row["Total Amount"]) || 0;
        if (!poNum || !vendorName || !totalAmt) { result.failed++; continue; }
        if (existingNums.has(poNum)) { result.duplicates++; continue; }

        const parsedDate = parseExcelDate(row["PO Date"]);
        if (!parsedDate) { result.failed++; continue; }

        const poType = isWorkOrder(poNum) ? "work_order" : "purchase_order";
        const status = poType === "purchase_order" && totalAmt > 50000 ? "pending_approval" : "approved";
        if (status === "pending_approval") result.pendingApproval++;
        if (poType === "work_order") { result.totalWOs++; result.totalWOValue += totalAmt; }
        else { result.totalPOs++; result.totalPOValue += totalAmt; }

        const deliveryDate = parseExcelDate(row["Delivery Date"]);
        const expectedDeliveryDate = parseExcelDate(row["Expected Delivery Date"]);
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
          po_type: poType,
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

  const handleLinkProject = async () => {
    if (!linkPoId || !linkProjectId) return;
    setActing(true);
    try {
      const proj = allProjects.find(p => p.id === linkProjectId);
      const { client } = await getAuthedClient();
      const { error } = await (client.from("purchase_orders") as any)
        .update({ project_id: linkProjectId, project_name: proj?.name || null })
        .eq("id", linkPoId);
      if (error) throw error;
      toast.success("PO linked to project");
      setLinkDialogOpen(false);
      setLinkPoId(null);
      setLinkProjectId("");
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

  const typeBadge = (poType: string) => {
    if (poType === "work_order") return <Badge style={{ backgroundColor: "#EBF5FF", color: "#1D4ED8", border: "none" }}>WO</Badge>;
    return <Badge style={{ backgroundColor: "#F7F7F7", color: "#666", border: "none" }}>PO</Badge>;
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
  };
  const fmtCurrency = (n: number | null) => n == null ? "—" : "₹" + n.toLocaleString("en-IN");

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
                <p className="text-xs mt-0.5 font-inter" style={{ color: "#666" }}>Import Purchase Orders and Work Orders from Tally export. Narration rows are parsed to auto-link projects.</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate} className="gap-2 font-display text-sm" style={{ borderColor: "#006039", color: "#006039" }}>
                <Download className="h-4 w-4" /> Download Template
              </Button>
            </div>

            <div className="rounded-md p-3 text-sm font-inter" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              <AlertTriangle className="h-4 w-4 inline mr-1.5" />
              Export from Tally: Gateway → Display → More Reports → Purchase → Purchase Order Register → Set Date Range → Export Excel. Narration rows with "project name-X" are auto-detected.
            </div>

            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2 font-display" style={{ backgroundColor: "#006039" }}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Processing..." : "Upload .xlsx"}
              </Button>
            </div>

            {uploadResult && (
              <div className="rounded-md p-4 space-y-3" style={{ backgroundColor: "#fff", border: "1px solid #E0E0E0" }}>
                <p className="font-display font-bold text-sm" style={{ color: "#1A1A1A" }}>Upload Summary</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm font-inter">
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#E8F2ED" }}>
                    <p className="font-bold" style={{ color: "#006039" }}>{uploadResult.imported}</p>
                    <p className="text-xs" style={{ color: "#006039" }}>Imported</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#F7F7F7" }}>
                    <p className="font-bold" style={{ color: "#1A1A1A" }}>{uploadResult.totalPOs}</p>
                    <p className="text-xs" style={{ color: "#666" }}>Purchase Orders</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#EBF5FF" }}>
                    <p className="font-bold" style={{ color: "#1D4ED8" }}>{uploadResult.totalWOs}</p>
                    <p className="text-xs" style={{ color: "#1D4ED8" }}>Work Orders</p>
                  </div>
                  <div className="rounded p-2 text-center" style={{ backgroundColor: "#FFF8E8" }}>
                    <p className="font-bold" style={{ color: "#D4860A" }}>{uploadResult.duplicates}</p>
                    <p className="text-xs" style={{ color: "#D4860A" }}>Duplicates Skipped</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs" style={{ color: "#666" }}>
                  <span>POs linked to projects: <strong style={{ color: "#006039" }}>{uploadResult.linked}</strong></span>
                  <span>Total PO Value: <strong className="font-mono">₹{uploadResult.totalPOValue.toLocaleString("en-IN")}</strong></span>
                  <span>Total WO Value: <strong className="font-mono">₹{uploadResult.totalWOValue.toLocaleString("en-IN")}</strong></span>
                  {uploadResult.pendingApproval > 0 && <span style={{ color: "#D4860A" }}>{uploadResult.pendingApproval} pending approval (above ₹50K)</span>}
                </div>
                {uploadResult.unlinked.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="text-xs cursor-pointer flex items-center gap-1" style={{ color: "#D4860A" }}>
                      <ChevronRight className="h-3 w-3" /> {uploadResult.unlinked.length} POs unlinked — project not found
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-4 pt-1 space-y-0.5 max-h-32 overflow-y-auto">
                        {uploadResult.unlinked.map((u, i) => (
                          <p key={i} className="text-[10px]" style={{ color: "#999" }}>{u.poNumber}: "{u.extractedProject}"</p>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
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
              {projectNames.map((p) => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
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
        <div className="w-36">
          <Label className="text-xs font-display mb-1 block" style={{ color: "#666" }}>Type</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="purchase_order">POs Only</SelectItem>
              <SelectItem value="work_order">WOs Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
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
                <TableHead className="font-display text-xs">Type</TableHead>
                <TableHead className="font-display text-xs">PO/WO Number</TableHead>
                <TableHead className="font-display text-xs">Date</TableHead>
                <TableHead className="font-display text-xs">Vendor</TableHead>
                <TableHead className="font-display text-xs">Project</TableHead>
                <TableHead className="font-display text-xs text-right">Amount</TableHead>
                <TableHead className="font-display text-xs">Status</TableHead>
                <TableHead className="font-display text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <FileSpreadsheet className="h-8 w-8 mx-auto mb-2" style={{ color: "#CCC" }} />
                    <p className="text-sm" style={{ color: "#666" }}>No Tally POs found</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>{typeBadge(po.po_type || "purchase_order")}</TableCell>
                  <TableCell className="font-inter text-sm font-semibold" style={{ color: "#1A1A1A" }}>{po.po_number ?? "—"}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#666" }}>{fmtDate(po.po_date)}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: "#1A1A1A" }}>{po.vendor_name}</TableCell>
                  <TableCell className="font-inter text-sm" style={{ color: po.project_name ? "#1A1A1A" : "#D4860A" }}>
                    {po.project_name ?? <span className="italic">Unlinked</span>}
                  </TableCell>
                  <TableCell className="font-inter text-sm text-right font-semibold" style={{ color: "#1A1A1A" }}>{fmtCurrency(po.total_amount)}</TableCell>
                  <TableCell>{statusBadge(po.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 flex-wrap">
                      {!po.project_id && (
                        <Button size="sm" variant="outline" className="gap-1 font-display text-xs" style={{ borderColor: "#006039", color: "#006039" }}
                          onClick={() => { setLinkPoId(po.id); setLinkProjectId(""); setLinkDialogOpen(true); }}>
                          <Link className="h-3 w-3" /> Link Project
                        </Button>
                      )}
                      {isDirector && po.status === "pending_approval" && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(po.id)} disabled={acting} className="gap-1 font-display text-xs" style={{ backgroundColor: "#006039" }}>
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setRejectPoId(po.id); setRejectOpen(true); }} disabled={acting} className="gap-1 font-display text-xs" style={{ borderColor: "#F40009", color: "#F40009" }}>
                            <X className="h-3 w-3" /> Reject
                          </Button>
                        </>
                      )}
                      {po.status === "rejected" && po.rejection_reason && (
                        <span className="text-xs font-inter" style={{ color: "#F40009" }}>Reason: {po.rejection_reason}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={(v) => { if (!v) { setRejectOpen(false); setRejectPoId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Reject PO</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-display text-sm">Reason for Rejection</Label>
              <Textarea placeholder="Explain why this PO is being rejected..." value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="font-inter mt-1" />
            </div>
            <Button onClick={handleReject} disabled={acting || !rejectReason.trim()} className="w-full font-display" style={{ backgroundColor: "#F40009" }}>
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link to Project Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Link to Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-display text-sm">Select Project</Label>
              <Select value={linkProjectId} onValueChange={setLinkProjectId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose project..." /></SelectTrigger>
                <SelectContent>
                  {allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleLinkProject} disabled={acting || !linkProjectId} style={{ backgroundColor: "#006039" }}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Link
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
