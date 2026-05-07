import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { ScrollableTabsWrapper } from "@/components/ui/scrollable-tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, CalendarIcon, Download, Send, Check, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSunday, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { ExpensesTab } from "@/components/expenses/ExpensesTab";
import { HRSettingsTab } from "@/components/expenses/HRSettingsTab";
import * as XLSX from "xlsx";

const ARCHITECT_ROLES = ["principal_architect", "project_architect", "structural_architect"];

const STATUS_COLORS: Record<string, string> = {
  present: "#006039",
  "on_leave": "#D4860A",
  remote: "#666666",
  not_checked_in: "#F40009",
};

export default function Attendance() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const [tab, setTab] = useState("overview");

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: "#1A1A1A" }}>
        HR & Attendance
      </h1>

      <ScrollableTabsWrapper>
        <div className="flex gap-0 border-b border-border">
        {["overview", "daily", "labour", "leave", "export", "expenses", "hr_settings"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                color: tab === t ? "#006039" : "#666",
                borderBottom: tab === t ? "2px solid #006039" : "2px solid transparent",
                fontWeight: tab === t ? 700 : 500,
              }}
            >
              {t === "overview" ? "Overview" : t === "daily" ? "Daily Log" : t === "labour" ? "Labour Register" : t === "leave" ? "Leave Requests" : t === "export" ? "Export" : t === "expenses" ? "Expenses" : "HR Settings"}
            </button>
          ))}
        </div>
      </ScrollableTabsWrapper>

      {tab === "overview" && <OverviewTab />}
      {tab === "daily" && <DailyLogTab />}
      {tab === "labour" && <LabourRegisterTab />}
      {tab === "leave" && <LeaveRequestsTab />}
      {tab === "export" && <ExportTab />}
      {tab === "expenses" && <ExpensesTab />}
      {tab === "hr_settings" && <HRSettingsTab />}
    </div>
  );
}

/* ─── Overview ─── */
function OverviewTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const [{ data: recs }, { data: profs }] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("date", today),
      supabase.from("profiles").select("id, auth_user_id, display_name, role, is_active").eq("is_active", true),
    ]);
    setRecords(recs ?? []);
    setProfiles((profs ?? []).filter((p: any) => !ARCHITECT_ROLES.includes(p.role)));
    setLoading(false);
  };

  const present = records.filter((r) => r.check_in_time && r.location_type !== "remote").length;
  const remote = records.filter((r) => r.location_type === "remote").length;
  const today2 = format(new Date(), "yyyy-MM-dd");
  const onLeaveIds = new Set(
    records.filter((r) => r.location_type === "leave" || r.leave_approved === true).map((r) => r.user_id)
  );
  const onLeave = onLeaveIds.size;
  const notChecked = Math.max(0, profiles.length - records.length - onLeave);

  const tiles = [
    { label: "Present Today", value: present, color: "#006039" },
    { label: "On Leave", value: onLeave, color: "#D4860A" },
    { label: "Not Checked In", value: notChecked > 0 ? notChecked : 0, color: "#F40009" },
    { label: "Working Remotely", value: remote, color: "#666666" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-border p-4" style={{ backgroundColor: "#F7F7F7", borderLeft: `3px solid ${t.color}` }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999" }}>{t.label}</p>
            <p className="text-2xl font-bold font-display mt-1" style={{ color: t.color }}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Name", "Role", "Check-in", "Location", "Check-out", "Hours", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const rec = records.find((r: any) => r.user_id === p.auth_user_id);
              const status = rec ? (rec.location_type === "remote" ? "remote" : "present") : "not_checked_in";
              const now = new Date();
              const isMorning = now.getHours() < 10;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{p.display_name || p.email || "—"}</td>
                  <td className="px-3 py-2 text-xs" style={{ color: "#666" }}>{ROLE_LABELS[p.role as AppRole] || p.role}</td>
                  <td className="px-3 py-2 font-inter text-xs">{rec?.check_in_time ? format(new Date(rec.check_in_time), "hh:mm a") : "—"}</td>
                  <td className="px-3 py-2 text-xs capitalize">{rec?.location_type || "—"}</td>
                  <td className="px-3 py-2 font-inter text-xs">{rec?.check_out_time ? format(new Date(rec.check_out_time), "hh:mm a") : "—"}</td>
                  <td className="px-3 py-2 font-inter text-xs">{rec?.hours_worked ? `${rec.hours_worked.toFixed(1)}h` : "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] font-semibold" style={{
                      color: STATUS_COLORS[status] || "#666",
                      borderColor: STATUS_COLORS[status] || "#E5E7EB",
                      backgroundColor: status === "present" ? "#E8F2ED" : status === "not_checked_in" && !isMorning ? "#FEE2E2" : "transparent",
                    }}>
                      {status === "present" ? "Present" : status === "remote" ? "Remote" : "Not Checked In"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Daily Log ─── */
function DailyLogTab() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const [{ data: recs }, { data: profs }] = await Promise.all([
      supabase.from("attendance_records").select("*").eq("date", dateStr),
      supabase.from("profiles").select("id, auth_user_id, display_name, role, is_active").eq("is_active", true),
    ]);
    setRecords(recs ?? []);
    setProfiles((profs ?? []).filter((p: any) => !ARCHITECT_ROLES.includes(p.role)));
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-2">
            <CalendarIcon className="h-4 w-4" />
            {format(selectedDate, "dd MMM yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#F7F7F7" }}>
                {["Name", "Role", "Check-in", "Location", "Check-out", "Hours", "Override"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const rec = records.find((r: any) => r.user_id === p.auth_user_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{p.display_name || "—"}</td>
                    <td className="px-3 py-2 text-xs" style={{ color: "#666" }}>{ROLE_LABELS[p.role as AppRole] || p.role}</td>
                    <td className="px-3 py-2 font-inter text-xs">{rec?.check_in_time ? format(new Date(rec.check_in_time), "hh:mm a") : "—"}</td>
                    <td className="px-3 py-2 text-xs capitalize">{rec?.location_type || "—"}</td>
                    <td className="px-3 py-2 font-inter text-xs">{rec?.check_out_time ? format(new Date(rec.check_out_time), "hh:mm a") : "—"}</td>
                    <td className="px-3 py-2 font-inter text-xs">{rec?.hours_worked ? `${rec.hours_worked.toFixed(1)}h` : "—"}</td>
                    <td className="px-3 py-2">
                      {rec?.is_manual_override && <span className="text-xs" title={rec.override_reason}>✏️</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Leave Requests ─── */
function LeaveRequestsTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: profs }] = await Promise.all([
      supabase.from("leave_requests").select("*").order("requested_at", { ascending: false }),
      supabase.from("profiles").select("id, auth_user_id, display_name, role"),
    ]);
    setRequests(reqs ?? []);
    setProfiles(profs ?? []);
    setLoading(false);
  };

  const getName = (userId: string) => profiles.find((p: any) => p.auth_user_id === userId)?.display_name || "—";

  const handleApprove = async (id: string) => {
    const { error } = await supabase.from("leave_requests").update({ status: "approved", approved_by: user?.id }).eq("id", id);
    if (error) toast.error("Failed"); else { toast.success("Leave approved"); fetchData(); }
  };

  const handleReject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    const { error } = await supabase.from("leave_requests").update({ status: "rejected", approved_by: user?.id, rejection_reason: rejectReason.trim() }).eq("id", rejectId);
    if (error) toast.error("Failed"); else { toast.success("Leave rejected"); setRejectId(null); setRejectReason(""); fetchData(); }
  };

  const filtered = requests.filter((r: any) => filter === "all" || r.status === filter);

  const LEAVE_LABELS: Record<string, string> = { casual: "Casual Leave", sick: "Sick Leave", earned: "Earned Leave", lop: "LOP", other: "Other" };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["pending", "approved", "rejected", "all"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}
            style={filter === f ? { backgroundColor: "#006039" } : {}} className="capitalize text-xs">
            {f}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Employee", "Type", "From", "To", "Days", "Reason", "Status", "Action"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: "#999" }}>No leave requests found.</td></tr>
            ) : filtered.map((r: any) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium" style={{ color: "#1A1A1A" }}>{getName(r.user_id)}</td>
                <td className="px-3 py-2 text-xs">{LEAVE_LABELS[r.leave_type] || r.leave_type}</td>
                <td className="px-3 py-2 font-inter text-xs">{format(new Date(r.from_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 font-inter text-xs">{format(new Date(r.to_date), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 font-inter text-xs">{r.days_count}</td>
                <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.reason}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]" style={{
                    color: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
                    borderColor: r.status === "approved" ? "#006039" : r.status === "rejected" ? "#F40009" : "#D4860A",
                  }}>
                    {r.status}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {r.status === "pending" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleApprove(r.id)}>
                        <Check className="h-4 w-4" style={{ color: "#006039" }} />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setRejectId(r.id)}>
                        <X className="h-4 w-4" style={{ color: "#F40009" }} />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!rejectId} onOpenChange={(v) => { if (!v) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reject Leave</DialogTitle></DialogHeader>
          <Textarea placeholder="Reason for rejection" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
          <Button onClick={handleReject} disabled={!rejectReason.trim()} style={{ backgroundColor: "#F40009" }} className="text-white w-full">Confirm Reject</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Export ─── */
function ExportTab() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const startDate = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

      const [{ data: records }, { data: profiles }] = await Promise.all([
        supabase.from("attendance_records").select("*").gte("date", startDate).lte("date", endDate),
        supabase.from("profiles").select("auth_user_id, display_name, role, is_active").eq("is_active", true),
      ]);

      const nonArchitects = (profiles ?? []).filter((p: any) => !ARCHITECT_ROLES.includes(p.role));
      const workingDays = eachDayOfInterval({ start: new Date(year, month - 1, 1), end: endOfMonth(new Date(year, month - 1, 1)) })
        .filter((d) => !isSunday(d)).length;

      const rows = nonArchitects.map((p: any) => {
        const userRecs = (records ?? []).filter((r: any) => r.user_id === p.auth_user_id);
        const presentDays = userRecs.filter((r: any) => r.check_in_time).length;
        const remoteDays = userRecs.filter((r: any) => r.location_type === "remote").length;
        const totalHours = userRecs.reduce((s: number, r: any) => s + (r.hours_worked || 0), 0);
        const lateCheckins = userRecs.filter((r: any) => {
          if (!r.check_in_time) return false;
          const h = new Date(r.check_in_time).getHours();
          const m = new Date(r.check_in_time).getMinutes();
          return h > 9 || (h === 9 && m > 30);
        }).length;

        return {
          "Employee Name": p.display_name || "—",
          "Role": ROLE_LABELS[p.role as AppRole] || p.role,
          "Days Present": presentDays,
          "Days on Leave": 0, // TODO: from leave_requests
          "Days Absent": Math.max(0, workingDays - presentDays),
          "Total Hours": Math.round(totalHours * 10) / 10,
          "Remote Days": remoteDays,
          "Late Check-ins": lateCheckins,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");
      const monthName = format(new Date(year, month - 1, 1), "MMMM");
      XLSX.writeFile(wb, `HStack_Attendance_${monthName}_${year}.xlsx`);
      toast.success("Report downloaded");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
    setGenerating(false);
  };

  const handleSendToFinance = async () => {
    setSending(true);
    const { error } = await supabase.from("attendance_exports").insert({
      month,
      year,
      generated_by: user?.id,
      sent_to_finance_at: new Date().toISOString(),
    });
    if (error) toast.error("Failed to log"); else toast.success("Marked as sent to Finance");
    setSending(false);
  };

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: format(new Date(2024, i, 1), "MMMM") }));

  return (
    <div className="space-y-4 max-w-md">
      <div className="flex gap-3">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 font-inter" />
      </div>

      <div className="flex gap-3">
        <Button onClick={handleGenerate} disabled={generating} className="gap-2" style={{ backgroundColor: "#006039" }}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Generate Report
        </Button>
        <Button onClick={handleSendToFinance} disabled={sending} variant="outline" className="gap-2">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send to Finance
        </Button>
      </div>
    </div>
  );
}

/* ─── Labour Register ─── */

const CONTRACTOR_COMPANIES = [
  {
    name: "Dushyamyh Enterprises",
    workers: [
      { name: "Md Tabrej Khan", type: "Arc Welder", monthly: 22000, joined: "2023-04-01" },
      { name: "Neeraj", type: "Tiles Mason", monthly: 18000, joined: "2023-06-15" },
      { name: "Abu Hasan", type: "Wall Panelling", monthly: 19000, joined: "2023-07-01" },
      { name: "Uttam Malakur", type: "Helper", monthly: 14000, joined: "2024-01-10" },
    ],
  },
  {
    name: "Shiv Engineering",
    workers: [
      { name: "Suresh B", type: "Fabricator", monthly: 24000, joined: "2023-03-01" },
      { name: "Ramesh P", type: "Welder", monthly: 21000, joined: "2023-05-01" },
      { name: "Dinesh K", type: "Helper", monthly: 14000, joined: "2024-02-01" },
    ],
  },
  {
    name: "ALTREE Internal Laborers",
    workers: [
      { name: "Gangadhar", type: "Store Helper", monthly: 16000, joined: "2022-11-01" },
      { name: "Venugopal", type: "Plumbing/Elec Installer", monthly: 20000, joined: "2023-01-15" },
      { name: "Mohan", type: "Electrical Installer", monthly: 20000, joined: "2023-02-01" },
    ],
  },
];

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function LabourRegisterTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newWorkerOpen, setNewWorkerOpen] = useState(false);
  const [form, setForm] = useState({ company: "", name: "", type: "", monthly: "", joined: "" });

  const dailyRate = (monthly: number) => (monthly / 26).toFixed(0);
  const otRate = (monthly: number) => ((monthly / 26) / 8).toFixed(0);
  const reviewDue = (joined: string) => {
    const d = new Date(joined);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  };
  const daysToReview = (joined: string) => {
    const diff = reviewDue(joined).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const downloadTemplate = () => {
    import("xlsx").then((XLSX) => {
      const headers = [["Company Name", "Worker Name", "Worker Type", "Monthly Salary (₹)", "Date Joined", "Contact", "Notes"]];
      const ws = XLSX.utils.aoa_to_sheet(headers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Labour Register");
      XLSX.writeFile(wb, "Labour_Register_Template.xlsx");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-semibold" style={{ color: "#1A1A1A" }}>Labour Register</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-3.5 w-3.5 mr-1" />Template</Button>
          <Button size="sm" onClick={() => setNewWorkerOpen(true)} style={{ backgroundColor: "#006039", color: "#fff" }}>
            <span className="mr-1 font-bold">+</span> New Worker
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {CONTRACTOR_COMPANIES.map((company) => {
          const hasReviewDue = company.workers.some((w) => daysToReview(w.joined) <= 30);
          const isOpen = expanded === company.name;
          return (
            <div key={company.name} className="rounded-xl border overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ backgroundColor: "#F7F7F7" }}
                onClick={() => setExpanded(isOpen ? null : company.name)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>{company.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                    {company.workers.length} workers
                  </span>
                  {hasReviewDue && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
                      ⚠ Review Due
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: "#999" }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="divide-y">
                  {company.workers.map((w) => {
                    const days = daysToReview(w.joined);
                    const reviewAmber = days <= 30;
                    return (
                      <div key={w.name} className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="font-semibold" style={{ color: "#1A1A1A" }}>{w.name}</p>
                          <p className="text-xs" style={{ color: "#666" }}>{w.type}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "#999" }}>Monthly Salary</p>
                          <p className="font-mono font-semibold" style={{ color: "#006039" }}>₹{w.monthly.toLocaleString("en-IN")}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "#999" }}>Daily Rate / OT Rate</p>
                          <p className="font-mono text-xs" style={{ color: "#666" }}>₹{dailyRate(w.monthly)}/day · ₹{otRate(w.monthly)}/hr</p>
                          <p className="text-[10px]" style={{ color: "#aaa" }}>Calculated from salary</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "#999" }}>Salary Review Due</p>
                          <p className="text-xs font-semibold" style={{ color: reviewAmber ? "#D4860A" : "#666" }}>
                            {format(reviewDue(w.joined), "dd/MM/yyyy")}
                            {reviewAmber && ` (${days}d)`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {newWorkerOpen && (
        <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: "#F7F7F7" }}>
          <h3 className="font-semibold text-sm" style={{ color: "#1A1A1A" }}>Add New Worker</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium" style={{ color: "#666" }}>Company</label>
              <select className="w-full h-9 rounded border px-2 text-sm" style={{ borderColor: "#E0E0E0" }}
                value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}>
                <option value="">— Select company —</option>
                {CONTRACTOR_COMPANIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: "#666" }}>Name</label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: "#666" }}>Worker Type</label>
              <Input value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} placeholder="e.g. Welder" /></div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: "#666" }}>Monthly Salary (₹)</label>
              <Input type="number" value={form.monthly} onChange={(e) => setForm((p) => ({ ...p, monthly: e.target.value }))} /></div>
            <div className="space-y-1"><label className="text-xs font-medium" style={{ color: "#666" }}>Date Joined</label>
              <Input type="date" value={form.joined} onChange={(e) => setForm((p) => ({ ...p, joined: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setNewWorkerOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { toast.success("Worker added (session only)"); setNewWorkerOpen(false); }} style={{ backgroundColor: "#006039", color: "#fff" }}>Add Worker</Button>
          </div>
        </div>
      )}
    </div>
  );
}

