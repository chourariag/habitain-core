import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X, FileDown, AlertTriangle, Eye, MessageCircle, Upload, Plus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import * as XLSX from "xlsx";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#666", bg: "#F7F7F7" },
  pending_hr: { color: "#D4860A", bg: "#FFF8E8" },
  pending_hod: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  paid: { color: "#006039", bg: "#E8F2ED" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_hr: "Awaiting HR",
  pending_hod: "Awaiting HOD",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const PRODUCTION_ROLES = ["factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer", "production_head"];
const OPS_ROLES = ["head_operations", "site_installation_mgr", "site_engineer", "delivery_rm_lead"];

function getHodForRole(submitterRole: string): string {
  if (PRODUCTION_ROLES.includes(submitterRole)) return "production_head";
  if (OPS_ROLES.includes(submitterRole)) return "head_operations";
  return "managing_director";
}

export function ExpensesTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [entries, setEntries] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"pending" | "all">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: exps }, { data: profs }, { data: projs }] = await Promise.all([
      supabase.from("expense_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name, role"),
      supabase.from("projects").select("id, name"),
    ]);
    setEntries((exps ?? []) as any[]);
    setProfiles(profs ?? []);
    setProjects(projs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (uid: string) => profiles.find((p) => p.auth_user_id === uid)?.display_name || "—";
  const getRole = (uid: string) => profiles.find((p) => p.auth_user_id === uid)?.role || "";
  const getProject = (pid: string | null) => pid ? projects.find((p) => p.id === pid)?.name || "—" : "—";

  const isHR = role === "hr_executive" || role === "super_admin" || role === "managing_director";
  const isHOD = ["production_head", "head_operations", "managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"].includes(role || "");

  // Group entries by report_period + submitted_by for pending_hr
  const pendingEntries = entries.filter((e) => {
    if (isHR && e.status === "pending_hr") return true;
    if (isHOD && e.status === "pending_hod") {
      const submitterRole = getRole(e.submitted_by);
      const target = getHodForRole(submitterRole);
      return role === target || role === "managing_director" || role === "super_admin";
    }
    return false;
  });

  // Group by employee + period
  const grouped: Record<string, any[]> = {};
  pendingEntries.forEach((e: any) => {
    const key = `${e.submitted_by}__${e.report_period}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  const allFiltered = entries.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterMonth) {
      const m = format(new Date(e.entry_date), "yyyy-MM");
      if (m !== filterMonth) return false;
    }
    return true;
  });

  const handleHRApprove = async (entryIds: string[]) => {
    if (!user) return;
    for (const id of entryIds) {
      await supabase.from("expense_entries").update({
        status: "pending_hod",
        hr_reviewed_by: user.id,
        hr_reviewed_at: new Date().toISOString(),
      } as any).eq("id", id);
    }
    toast.success("Sent to HOD for approval");
    fetchData();
  };

  const handleHODApprove = async (entryIds: string[]) => {
    if (!user) return;
    for (const id of entryIds) {
      await supabase.from("expense_entries").update({
        status: "approved",
        hod_approved_by: user.id,
        hod_approved_at: new Date().toISOString(),
      } as any).eq("id", id);
    }
    toast.success("Expenses approved for payment ✓");
    fetchData();
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    await supabase.from("expense_entries").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    } as any).eq("id", rejectId);
    toast.success("Expense rejected");
    setRejectId(null);
    setRejectReason("");
    fetchData();
  };

  const handleFlag = async () => {
    if (!flagId || !flagNote.trim()) return;
    await supabase.from("expense_entries").update({
      hr_flag_note: flagNote.trim(),
    } as any).eq("id", flagId);
    toast.success("Flagged for clarification");
    setFlagId(null);
    setFlagNote("");
    fetchData();
  };

  const exportToExcel = () => {
    const rows = allFiltered.map((e) => ({
      Employee: getName(e.submitted_by),
      Role: ROLE_LABELS[getRole(e.submitted_by) as AppRole] || getRole(e.submitted_by),
      Date: e.entry_date,
      Type: e.expense_type,
      Category: e.category,
      Project: getProject(e.project_id),
      Description: e.description,
      "Amount ₹": e.amount,
      Status: STATUS_LABELS[e.status] || e.status,
      "Vehicle": e.vehicle_type || "—",
      "Distance km": e.distance_km || "—",
      "Receipt URL": e.receipt_url || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `HStack_Expenses_${format(new Date(), "MMMM_yyyy")}.xlsx`);
  };

  const approvedTotal = entries.filter((e) => e.status === "approved" && format(new Date(e.entry_date), "yyyy-MM") === format(new Date(), "yyyy-MM")).reduce((s, e) => s + Number(e.amount), 0);
  const pendingTotal = entries.filter((e) => e.status.startsWith("pending")).reduce((s, e) => s + Number(e.amount), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={subTab === "pending" ? "default" : "outline"} onClick={() => setSubTab("pending")}
          style={subTab === "pending" ? { backgroundColor: "#006039" } : {}} className="text-xs">
          Pending {Object.keys(grouped).length > 0 && `(${Object.keys(grouped).length})`}
        </Button>
        <Button size="sm" variant={subTab === "all" ? "default" : "outline"} onClick={() => setSubTab("all")}
          style={subTab === "all" ? { backgroundColor: "#006039" } : {}} className="text-xs">
          All Expenses
        </Button>
      </div>

      {subTab === "pending" ? (
        <div className="space-y-4">
          {Object.keys(grouped).length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "#999" }}>No reports pending your review.</p>
          ) : Object.entries(grouped).map(([key, items]) => {
            const emp = items[0].submitted_by;
            const period = items[0].report_period || "—";
            const total = items.reduce((s: number, e: any) => s + Number(e.amount), 0);
            const status = items[0].status;
            const hasBudgetFlag = items.some((e: any) => e.budget_flag);

            return (
              <div key={key} className="rounded-lg border border-border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{getName(emp)}</p>
                    <p className="text-xs" style={{ color: "#666" }}>{ROLE_LABELS[getRole(emp) as AppRole] || getRole(emp)} · {period}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold font-display" style={{ color: "#006039" }}>₹{total.toLocaleString("en-IN")}</p>
                    <p className="text-[10px]" style={{ color: "#666" }}>{items.length} entries</p>
                  </div>
                </div>

                {hasBudgetFlag && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
                    <AlertTriangle className="h-3 w-3" /> Budget overrun flagged on some entries
                  </div>
                )}

                {/* Line items */}
                <div className="space-y-2">
                  {items.map((e: any) => (
                    <div key={e.id} className="bg-white rounded-md p-3 border border-border text-xs space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-medium" style={{ color: "#1A1A1A" }}>
                          {e.expense_type === "conveyance" ? `🚗 ${e.from_location} → ${e.to_location}` : e.category}
                        </span>
                        <span className="font-bold font-inter" style={{ color: "#006039" }}>₹{Number(e.amount).toLocaleString("en-IN")}</span>
                      </div>
                      <p style={{ color: "#666" }}>{e.description}</p>
                      <p style={{ color: "#999" }}>{format(new Date(e.entry_date), "dd/MM/yyyy")}</p>
                      {e.expense_type === "conveyance" && (
                        <p style={{ color: "#666" }}>{e.distance_km}km × ₹{e.rate_per_km} ({e.vehicle_type})</p>
                      )}
                      {e.receipt_url && (
                        <Button size="sm" variant="ghost" className="text-[10px] h-5 px-1 gap-1" onClick={() => setReceiptUrl(e.receipt_url)}>
                          <Eye className="h-3 w-3" /> Receipt
                        </Button>
                      )}
                      {e.hr_flag_note && (
                        <div className="rounded px-2 py-1 mt-1" style={{ backgroundColor: "#FFF8E8" }}>
                          <p className="text-[10px] font-semibold" style={{ color: "#D4860A" }}>HR query: {e.hr_flag_note}</p>
                          {e.hr_flag_response && <p className="text-[10px]" style={{ color: "#006039" }}>Response: {e.hr_flag_response}</p>}
                        </div>
                      )}
                      <div className="flex gap-1 mt-1">
                        {status === "pending_hr" && isHR && !e.hr_flag_note && (
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1 gap-1" onClick={() => setFlagId(e.id)}>
                            <MessageCircle className="h-3 w-3" /> Flag
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {status === "pending_hr" && isHR && (
                    <Button size="sm" onClick={() => handleHRApprove(items.map((e: any) => e.id))} style={{ backgroundColor: "#006039" }} className="text-white text-xs">
                      <Check className="h-3 w-3 mr-1" /> Approve & Send to HOD
                    </Button>
                  )}
                  {status === "pending_hod" && isHOD && (
                    <Button size="sm" onClick={() => handleHODApprove(items.map((e: any) => e.id))} style={{ backgroundColor: "#006039" }} className="text-white text-xs">
                      <Check className="h-3 w-3 mr-1" /> Approve for Payment
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setRejectId(items[0].id)} className="text-xs" style={{ color: "#F40009", borderColor: "#F40009" }}>
                    <X className="h-3 w-3 mr-1" /> Reject Report
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <label className="text-[10px] font-inter" style={{ color: "#666" }}>Month</label>
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 font-inter text-xs" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 font-inter text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="font-inter text-xs">{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportToExcel} className="gap-1 text-xs">
              <FileDown className="h-3 w-3" /> Export Excel
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#F7F7F7" }}>
                  {["Employee", "Date", "Type", "Category", "Amount ₹", "Status", "Flag"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFiltered.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm" style={{ color: "#999" }}>No expenses found.</td></tr>
                ) : allFiltered.map((e) => {
                  const sc = STATUS_COLORS[e.status] || STATUS_COLORS.draft;
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs font-medium" style={{ color: "#1A1A1A" }}>{getName(e.submitted_by)}</td>
                      <td className="px-3 py-2 text-xs font-inter">{format(new Date(e.entry_date), "dd/MM/yyyy")}</td>
                      <td className="px-3 py-2 text-xs capitalize">{e.expense_type}</td>
                      <td className="px-3 py-2 text-xs">{e.category}</td>
                      <td className="px-3 py-2 text-xs font-inter font-semibold">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                            {STATUS_LABELS[e.status] || e.status}
                          </Badge>
                          {(e as any).submission_method === "excel_upload" && (
                            <Badge variant="outline" className="text-[9px]" style={{ color: "#006039", borderColor: "#006039", backgroundColor: "#E8F2ED" }}>Excel</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">{e.budget_flag && <AlertTriangle className="h-3 w-3" style={{ color: "#D4860A" }} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 text-sm px-1">
            <div><span style={{ color: "#666" }}>Approved This Month:</span> <span className="font-mono font-bold" style={{ color: "#006039" }}>₹{approvedTotal.toLocaleString("en-IN")}</span></div>
            <div><span style={{ color: "#666" }}>Total Pending:</span> <span className="font-mono font-bold" style={{ color: "#D4860A" }}>₹{pendingTotal.toLocaleString("en-IN")}</span></div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Expense Report</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <Button onClick={handleReject} disabled={!rejectReason.trim()} style={{ backgroundColor: "#F40009" }} className="text-white w-full">Confirm Reject</Button>
        </DialogContent>
      </Dialog>

      {/* Flag dialog */}
      <Dialog open={!!flagId} onOpenChange={(v) => { if (!v) { setFlagId(null); setFlagNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Flag for Clarification</DialogTitle></DialogHeader>
          <Textarea placeholder="What needs clarification?" value={flagNote} onChange={(e) => setFlagNote(e.target.value)} rows={3} />
          <Button onClick={handleFlag} disabled={!flagNote.trim()} style={{ backgroundColor: "#D4860A" }} className="text-white w-full">Send to Employee</Button>
        </DialogContent>
      </Dialog>

      {/* Receipt preview */}
      <Dialog open={!!receiptUrl} onOpenChange={(v) => { if (!v) setReceiptUrl(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receiptUrl && <img src={receiptUrl} alt="Receipt" className="w-full rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
