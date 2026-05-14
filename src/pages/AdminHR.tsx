import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Check, X, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { ExpensesTab } from "@/components/expenses/ExpensesTab";
import { PayrollSettingsTab } from "@/components/admin/PayrollSettingsTab";
import { PayrollGenerateTab } from "@/components/admin/PayrollGenerateTab";

function TeamAttendance() {
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("date", today),
      supabase.from("profiles").select("auth_user_id, display_name, role, is_active").eq("is_active", true),
    ]);
    setRecords(r ?? []); setProfiles(p ?? []); setLoading(false);
  })(); }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead><tr style={{ backgroundColor: "#F7F7F7" }}>
          {["Name", "Role", "Status", "Check-in", "Location", "Hours"].map(h => (
            <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {profiles.map(p => {
            const rec = records.find(r => r.user_id === p.auth_user_id);
            const status = rec?.check_in_time ? "present" : "absent";
            return (
              <tr key={p.auth_user_id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{p.display_name || "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: "#666" }}>{ROLE_LABELS[p.role as AppRole] || p.role}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]" style={{
                  color: status === "present" ? "#006039" : "#F40009",
                  borderColor: status === "present" ? "#006039" : "#F40009",
                  backgroundColor: status === "present" ? "#E8F2ED" : "#FEE2E2",
                }}>{status === "present" ? "Present" : "Not Checked In"}</Badge></td>
                <td className="px-3 py-2 font-mono text-xs">{rec?.check_in_time ? format(new Date(rec.check_in_time), "hh:mm a") : "—"}</td>
                <td className="px-3 py-2 text-xs capitalize">{rec?.location_type || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{rec?.hours_worked?.toFixed(1) ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeaveApprovals() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("leave_requests").select("*").order("requested_at", { ascending: false }),
      supabase.from("profiles").select("auth_user_id, display_name, role"),
    ]);
    setRequests(r ?? []); setProfiles(p ?? []); setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getName = (uid: string) => profiles.find(p => p.auth_user_id === uid)?.display_name || "—";

  const approve = async (id: string) => {
    await supabase.from("leave_requests").update({ status: "approved", approved_by: user?.id }).eq("id", id);
    toast.success("Leave approved"); fetchData();
  };
  const reject = async (id: string) => {
    const reason = prompt("Reason for rejection?");
    if (!reason) return;
    await supabase.from("leave_requests").update({ status: "rejected", approved_by: user?.id, rejection_reason: reason }).eq("id", id);
    toast.success("Leave rejected"); fetchData();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const pending = requests.filter(r => r.status === "pending");

  return (
    <div className="rounded-lg border border-border overflow-x-auto bg-card">
      <table className="w-full text-sm">
        <thead><tr style={{ backgroundColor: "#F7F7F7" }}>
          {["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Action"].map(h => (
            <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {requests.length === 0 ? <tr><td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: "#999" }}>No leave requests.</td></tr>
          : requests.map(r => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{getName(r.user_id)}</td>
              <td className="px-3 py-2 text-xs capitalize">{r.leave_type}</td>
              <td className="px-3 py-2 font-mono text-xs">{format(new Date(r.from_date), "dd/MM/yy")}</td>
              <td className="px-3 py-2 font-mono text-xs">{format(new Date(r.to_date), "dd/MM/yy")}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.days_count}</td>
              <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.reason}</td>
              <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] capitalize" style={{
                color: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
                borderColor: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
              }}>{r.status}</Badge></td>
              <td className="px-3 py-2">
                {r.status === "pending" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => approve(r.id)}><Check className="h-4 w-4" style={{ color: "#006039" }} /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => reject(r.id)}><X className="h-4 w-4" style={{ color: "#F40009" }} /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeDocuments() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [employee, setEmployee] = useState("");
  const [docType, setDocType] = useState("payslip");
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [gross, setGross] = useState("");
  const [deductions, setDeductions] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { (async () => {
    const { data } = await supabase.from("profiles").select("auth_user_id, display_name, role").eq("is_active", true);
    setProfiles(data ?? []);
  })(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) { toast.error("Select employee first"); return; }
    setUploading(true);
    try {
      const path = `${employee}/${docType}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("hr-docs").upload(path, file);
      if (upErr) throw upErr;

      if (docType === "payslip") {
        const net = (Number(gross) || 0) - (Number(deductions) || 0);
        const { error } = await supabase.from("payslips").insert({
          user_id: employee, month, year,
          gross_amount: Number(gross) || 0,
          deductions: Number(deductions) || 0,
          net_pay: net,
          pdf_url: path,
          uploaded_by: user?.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_documents").insert({
          user_id: employee,
          doc_type: docType,
          title: title || file.name,
          pdf_url: path,
          issued_on: format(new Date(), "yyyy-MM-dd"),
          uploaded_by: user?.id,
        });
        if (error) throw error;
      }
      toast.success("Uploaded ✓");
      setTitle(""); setGross(""); setDeductions("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-2xl">
      <h3 className="font-display font-semibold text-sm">Upload Document for Employee</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select value={employee} onValueChange={setEmployee}>
          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
          <SelectContent>{profiles.map(p => <SelectItem key={p.auth_user_id} value={p.auth_user_id}>{p.display_name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="payslip">Payslip</SelectItem>
            <SelectItem value="pf_statement">PF Statement</SelectItem>
            <SelectItem value="form_16">Form 16</SelectItem>
            <SelectItem value="offer_letter">Offer Letter</SelectItem>
            <SelectItem value="appointment_letter">Appointment Letter</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {docType === "payslip" ? (
          <>
            <div className="flex gap-2">
              <Input type="number" placeholder="Month (1-12)" value={month} onChange={e => setMonth(Number(e.target.value))} />
              <Input type="number" placeholder="Year" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
            <div className="flex gap-2">
              <Input type="number" placeholder="Gross ₹" value={gross} onChange={e => setGross(e.target.value)} />
              <Input type="number" placeholder="Deductions ₹" value={deductions} onChange={e => setDeductions(e.target.value)} />
            </div>
          </>
        ) : (
          <Input placeholder="Document title" value={title} onChange={e => setTitle(e.target.value)} className="md:col-span-2" />
        )}
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={handleUpload} />
      <Button disabled={uploading || !employee} onClick={() => fileRef.current?.click()} className="text-white gap-2" style={{ backgroundColor: "#006039" }}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload PDF
      </Button>
    </div>
  );
}

export default function AdminHR() {
  const [tab, setTab] = useState("attendance");
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>HR Management</h1>
        <p className="text-sm mt-1" style={{ color: "#666" }}>Team-wide attendance, leave approvals, expense reports and document management.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <ScrollableTabsWrapper>
          <TabsList>
            <TabsTrigger value="attendance">Team Attendance</TabsTrigger>
            <TabsTrigger value="leave">Leave Requests</TabsTrigger>
            <TabsTrigger value="expenses">Expense Reports</TabsTrigger>
            <TabsTrigger value="payroll-settings">Payroll Settings</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="docs">Employee Documents</TabsTrigger>
          </TabsList>
        </ScrollableTabsWrapper>
        <TabsContent value="attendance" className="mt-4"><TeamAttendance /></TabsContent>
        <TabsContent value="leave" className="mt-4"><LeaveApprovals /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><ExpensesTab /></TabsContent>
        <TabsContent value="payroll-settings" className="mt-4"><PayrollSettingsTab /></TabsContent>
        <TabsContent value="payroll" className="mt-4"><PayrollGenerateTab /></TabsContent>
        <TabsContent value="docs" className="mt-4"><EmployeeDocuments /></TabsContent>
      </Tabs>
    </div>
  );
}
