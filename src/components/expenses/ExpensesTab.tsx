import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Check, X, FileDown, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import * as XLSX from "xlsx";

const EXPENSE_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending_costing: { color: "#D4860A", bg: "#FFF8E8" },
  pending_head: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  processed: { color: "#666666", bg: "#F7F7F7" },
};

const STATUS_LABELS: Record<string, string> = {
  pending_costing: "Awaiting Costing",
  pending_head: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  processed: "Processed",
};

// Role-based routing for stage 2
const PRODUCTION_ROLES: string[] = ["factory_floor_supervisor", "fabrication_foreman", "electrical_installer", "elec_plumbing_installer", "production_head"];
const OPS_ROLES: string[] = ["head_operations", "site_installation_mgr", "site_engineer", "delivery_rm_lead"];
const FINANCE_ROLES: string[] = ["finance_manager", "accounts_executive", "costing_engineer"];
const SALES_ROLES: string[] = ["sales_director"];

function getStage2Approver(submitterRole: string): string {
  if (PRODUCTION_ROLES.includes(submitterRole)) return "production_head";
  if (OPS_ROLES.includes(submitterRole)) return "head_operations";
  if (FINANCE_ROLES.includes(submitterRole)) return "finance_director";
  if (SALES_ROLES.includes(submitterRole)) return "sales_director";
  return "managing_director";
}

export function ExpensesTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"pending" | "all">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: exps }, { data: profs }, { data: projs }] = await Promise.all([
      supabase.from("expense_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name, role"),
      supabase.from("projects").select("id, name"),
    ]);
    setExpenses((exps ?? []) as any[]);
    setProfiles(profs ?? []);
    setProjects(projs ?? []);
    setLoading(false);
  };

  const getName = (uid: string) => profiles.find((p) => p.auth_user_id === uid)?.display_name || "—";
  const getRole = (uid: string) => profiles.find((p) => p.auth_user_id === uid)?.role || "";
  const getProject = (pid: string | null) => pid ? projects.find((p) => p.id === pid)?.name || "—" : "—";

  const isCosting = role === "costing_engineer";
  const isHead = ["production_head", "head_operations", "managing_director", "finance_director", "sales_director", "architecture_director", "super_admin"].includes(role || "");

  const pendingExpenses = expenses.filter((e) => {
    if (isCosting && e.status === "pending_costing") return true;
    if (isHead && e.status === "pending_head") {
      const submitterRole = getRole(e.submitted_by);
      const targetApprover = getStage2Approver(submitterRole);
      return role === targetApprover || role === "managing_director" || role === "super_admin";
    }
    return false;
  });

  const allFiltered = expenses.filter((e) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (filterMonth) {
      const m = format(new Date(e.expense_date), "yyyy-MM");
      if (m !== filterMonth) return false;
    }
    return true;
  });

  const handleStage1Approve = async (id: string) => {
    const expense = expenses.find((e) => e.id === id);
    if (!expense || !user) return;
    const { error } = await supabase.from("expense_reports").update({
      status: "pending_head",
      stage1_approved_by: user.id,
      stage1_approved_at: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Approved to Department Head"); fetchData(); }
  };

  const handleStage2Approve = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("expense_reports").update({
      status: "approved",
      stage2_approved_by: user.id,
      stage2_approved_at: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Expense approved ✓"); fetchData(); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim() || !user) return;
    const { error } = await supabase.from("expense_reports").update({
      status: "rejected",
      rejection_reason: rejectReason.trim(),
    } as any).eq("id", rejectId);
    if (error) toast.error(error.message);
    else { toast.success("Expense rejected"); setRejectId(null); setRejectReason(""); fetchData(); }
  };

  const exportToExcel = () => {
    const rows = allFiltered.map((e) => ({
      Employee: getName(e.submitted_by),
      Role: ROLE_LABELS[getRole(e.submitted_by) as AppRole] || getRole(e.submitted_by),
      Date: e.expense_date,
      Category: e.category,
      Project: getProject(e.project_id),
      Description: e.description,
      "Amount ₹": e.amount,
      Status: STATUS_LABELS[e.status] || e.status,
      "Approved By": e.stage2_approved_by ? getName(e.stage2_approved_by) : "—",
      "Budget Flagged": e.budget_flag ? "Yes" : "No",
      "Receipt URL": e.receipt_url || "—",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    const month = format(new Date(), "MMMM_yyyy");
    XLSX.writeFile(wb, `HStack_Expenses_${month}.xlsx`);
  };

  const approvedThisMonth = expenses.filter((e) => e.status === "approved" && format(new Date(e.expense_date), "yyyy-MM") === format(new Date(), "yyyy-MM")).reduce((s, e) => s + e.amount, 0);
  const totalPending = expenses.filter((e) => e.status.startsWith("pending")).reduce((s, e) => s + e.amount, 0);
  const rejectedThisMonth = expenses.filter((e) => e.status === "rejected" && format(new Date(e.expense_date), "yyyy-MM") === format(new Date(), "yyyy-MM")).length;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={subTab === "pending" ? "default" : "outline"} onClick={() => setSubTab("pending")}
          style={subTab === "pending" ? { backgroundColor: "#006039" } : {}} className="text-xs">
          Pending {pendingExpenses.length > 0 && `(${pendingExpenses.length})`}
        </Button>
        <Button size="sm" variant={subTab === "all" ? "default" : "outline"} onClick={() => setSubTab("all")}
          style={subTab === "all" ? { backgroundColor: "#006039" } : {}} className="text-xs">
          All Expenses
        </Button>
      </div>

      {subTab === "pending" ? (
        <div className="space-y-3">
          {pendingExpenses.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "#999" }}>No expenses pending your approval.</p>
          ) : pendingExpenses.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7" }}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{getName(e.submitted_by)}</p>
                  <p className="text-xs" style={{ color: "#666" }}>{ROLE_LABELS[getRole(e.submitted_by) as AppRole] || getRole(e.submitted_by)}</p>
                </div>
                <p className="text-lg font-bold font-display" style={{ color: "#006039" }}>₹{Number(e.amount).toLocaleString("en-IN")}</p>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs"><span style={{ color: "#666" }}>Category:</span> {e.category}</p>
                <p className="text-xs"><span style={{ color: "#666" }}>Description:</span> {e.description}</p>
                <p className="text-xs"><span style={{ color: "#666" }}>Date:</span> {format(new Date(e.expense_date), "dd/MM/yyyy")}</p>
                {e.project_id && <p className="text-xs"><span style={{ color: "#666" }}>Project:</span> {getProject(e.project_id)}</p>}
                {e.receipt_url && (
                  <Button size="sm" variant="ghost" className="text-xs gap-1 h-6 px-2" onClick={() => setReceiptUrl(e.receipt_url)}>
                    <Eye className="h-3 w-3" /> View Receipt
                  </Button>
                )}
                {e.budget_flag && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold mt-1" style={{ backgroundColor: "#FFF0F0", color: "#F40009" }}>
                    <AlertTriangle className="h-3 w-3" /> Budget overrun flagged{e.budget_overrun_amount ? ` by ₹${Number(e.budget_overrun_amount).toLocaleString("en-IN")}` : ""}
                  </div>
                )}
                {e.status === "pending_head" && e.stage1_note && (
                  <p className="text-xs mt-1"><span style={{ color: "#666" }}>Costing note:</span> {e.stage1_note}</p>
                )}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {e.status === "pending_costing" && isCosting && (
                  <Button size="sm" onClick={() => handleStage1Approve(e.id)} style={{ backgroundColor: "#006039" }} className="text-white text-xs">
                    <Check className="h-3 w-3 mr-1" /> Approve to Manager
                  </Button>
                )}
                {e.status === "pending_head" && isHead && (
                  <Button size="sm" onClick={() => handleStage2Approve(e.id)} style={{ backgroundColor: "#006039" }} className="text-white text-xs">
                    <Check className="h-3 w-3 mr-1" /> Final Approve
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setRejectId(e.id)} className="text-xs" style={{ color: "#F40009", borderColor: "#F40009" }}>
                  <X className="h-3 w-3 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
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
                  {["Employee", "Date", "Category", "Project", "Amount ₹", "Status", "Approved By", "Flag"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allFiltered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: "#999" }}>No expenses found.</td></tr>
                ) : allFiltered.map((e) => {
                  const sc = EXPENSE_STATUS_COLORS[e.status] || EXPENSE_STATUS_COLORS.pending_costing;
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs font-medium" style={{ color: "#1A1A1A" }}>{getName(e.submitted_by)}</td>
                      <td className="px-3 py-2 text-xs font-inter">{format(new Date(e.expense_date), "dd/MM/yyyy")}</td>
                      <td className="px-3 py-2 text-xs">{e.category}</td>
                      <td className="px-3 py-2 text-xs">{getProject(e.project_id)}</td>
                      <td className="px-3 py-2 text-xs font-inter font-semibold">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>
                          {STATUS_LABELS[e.status] || e.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">{e.stage2_approved_by ? getName(e.stage2_approved_by) : "—"}</td>
                      <td className="px-3 py-2">{e.budget_flag && <AlertTriangle className="h-3 w-3" style={{ color: "#F40009" }} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 text-sm px-1">
            <div><span style={{ color: "#666" }}>Approved This Month:</span> <span className="font-mono font-bold" style={{ color: "#006039" }}>₹{approvedThisMonth.toLocaleString("en-IN")}</span></div>
            <div><span style={{ color: "#666" }}>Total Pending:</span> <span className="font-mono font-bold" style={{ color: "#D4860A" }}>₹{totalPending.toLocaleString("en-IN")}</span></div>
            <div><span style={{ color: "#666" }}>Rejected This Month:</span> <span className="font-mono font-bold" style={{ color: "#F40009" }}>{rejectedThisMonth}</span></div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Expense</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <Button onClick={handleReject} disabled={!rejectReason.trim()} style={{ backgroundColor: "#F40009" }} className="text-white w-full">Confirm Reject</Button>
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
