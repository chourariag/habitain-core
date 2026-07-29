import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Download, FileText, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { calcPayslip, generatePayslipPdf, type PayrollConfig } from "@/lib/payslip";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// Mon-Sat working days (exclude Sundays only)
function workingDaysInMonth(year: number, month: number) {
  const dim = daysInMonth(year, month);
  let n = 0;
  for (let d = 1; d <= dim; d++) {
    if (new Date(year, month - 1, d).getDay() !== 0) n++;
  }
  return n;
}

interface AttendanceSummary {
  working_days: number;
  days_present: number;
  days_absent: number;
  leave_taken: number;
  lop_days: number;
}

async function fetchAttendance(userId: string, month: number, year: number): Promise<AttendanceSummary> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const dim = daysInMonth(year, month);
  const to = `${year}-${String(month).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
  const working_days = workingDaysInMonth(year, month);

  const [{ data: att }, { data: leaves }] = await Promise.all([
    supabase.from("attendance_records")
      .select("date, check_in_time")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", to),
    supabase.from("leave_requests")
      .select("from_date, to_date, days_count, status")
      .eq("user_id", userId)
      .eq("status", "approved")
      .lte("from_date", to)
      .gte("to_date", from),
  ]);

  const presentDates = new Set<string>();
  (att ?? []).forEach((r: any) => { if (r.check_in_time) presentDates.add(r.date); });
  const days_present = presentDates.size;

  // Approved leave days that fall in the month
  let leave_taken = 0;
  (leaves ?? []).forEach((l: any) => {
    const ls = new Date(Math.max(new Date(l.from_date).getTime(), new Date(from).getTime()));
    const le = new Date(Math.min(new Date(l.to_date).getTime(), new Date(to).getTime()));
    const days = Math.max(0, Math.round((le.getTime() - ls.getTime()) / 86400000) + 1);
    leave_taken += days;
  });

  const days_absent = Math.max(0, working_days - days_present - leave_taken);
  const lop_days = days_absent; // unpaid absences = LOP
  return { working_days, days_present, days_absent, leave_taken, lop_days };
}

export function PayrollGenerateTab() {
  const now = new Date();
  const { role } = useUserRole();
  const maskAmounts = role === "hr_executive";
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [generating, setGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [slips, setSlips] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [month, year]);

  async function load() {
    setLoading(true);
    const [psRes, profRes, cfgRes] = await Promise.all([
      supabase.from("payslips").select("*").eq("month", month).eq("year", year).order("revision", { ascending: false }),
      (supabase.rpc as any)("get_active_profiles_directory"),
      (supabase.from("payroll_config") as any).select("*").eq("is_archived", false),
    ]);
    setSlips(psRes.data ?? []);
    setConfigs(cfgRes.data ?? []);
    const map: Record<string, any> = {};
    (profRes.data ?? []).forEach((p: any) => { map[p.auth_user_id] = p; });
    setProfileMap(map);
    setLoading(false);
  }

  async function generateOne(cfg: any, currentUser: any): Promise<{ ok: boolean; revised: boolean }> {
    const ctc = Number(cfg.monthly_ctc) || 0;
    if (ctc <= 0) return { ok: false, revised: false };

    const b = calcPayslip(cfg as PayrollConfig);
    const prof = profileMap[cfg.user_id]
      ?? ((await (supabase.rpc as any)("get_active_profiles_directory")).data ?? []).find((p: any) => p.auth_user_id === cfg.user_id);
    const empName = prof?.display_name || prof?.email || "Employee";
    const att = await fetchAttendance(cfg.user_id, month, year);

    // Check existing active payslip — if exists, archive & bump revision
    const { data: existing } = await supabase.from("payslips")
      .select("id, revision")
      .eq("user_id", cfg.user_id).eq("month", month).eq("year", year)
      .is("superseded_at", null).maybeSingle();
    const newRevision = existing ? (Number(existing.revision) + 1) : 1;

    const pdfBlob = await generatePayslipPdf({
      employee_name: empName,
      employee_id: prof?.email?.split("@")[0]?.toUpperCase() ?? "—",
      designation: cfg.designation || "—",
      department: cfg.department || "—",
      doj: cfg.doj ? format(new Date(cfg.doj), "dd/MM/yyyy") : "—",
      pan: cfg.pan || "—",
      pf_number: cfg.pf_number || "—",
      bank_account: cfg.bank_account || "—",
      bank_name: cfg.bank_name || "—",
      ifsc: cfg.ifsc || "—",
      days_worked: att.days_present,
      days_in_month: daysInMonth(year, month),
      working_days: att.working_days,
      days_present: att.days_present,
      days_absent: att.days_absent,
      leave_taken: att.leave_taken,
      lop_days: att.lop_days,
      month, year,
      generated_on: new Date(),
      revision: newRevision,
    }, b);

    const path = `payslips/${year}-${String(month).padStart(2,"0")}/${cfg.user_id}_v${newRevision}.pdf`;
    const up = await supabase.storage.from("hr-docs").upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
    if (up.error) { console.error(up.error); return { ok: false, revised: false }; }

    // Archive prior active version
    if (existing) {
      await supabase.from("payslips")
        .update({ superseded_at: new Date().toISOString(), superseded_by: currentUser?.id ?? null } as any)
        .eq("id", existing.id);
    }

    const { error } = await supabase.from("payslips").insert({
      user_id: cfg.user_id,
      month, year,
      basic: b.basic, hra: b.hra,
      conveyance_allowance: b.conveyance_allowance,
      special_allowance: b.special_allowance,
      gross_amount: b.gross_earnings,
      pf_deduction: b.pf_deduction, pt_deduction: b.pt_deduction, tds_deduction: b.tds_deduction,
      deductions: b.total_deductions,
      net_pay: b.net_pay,
      days_worked: att.days_present,
      days_in_month: daysInMonth(year, month),
      days_present: att.days_present,
      days_absent: att.days_absent,
      leave_taken: att.leave_taken,
      lop_days: att.lop_days,
      revision: newRevision,
      pdf_url: path,
      uploaded_by: currentUser?.id ?? null,
      generated_by: currentUser?.id ?? null,
      generated_at: new Date().toISOString(),
    } as any);
    if (error) { console.error(error); return { ok: false, revised: false }; }
    return { ok: true, revised: !!existing };
  }

  async function generateAll() {
    setGenerating(true);
    try {
      const cfgs = configs;
      if (!cfgs?.length) { toast.error("No employees configured. Open Payroll Settings first."); return; }
      const zeroes = cfgs.filter((c: any) => !(Number(c.monthly_ctc) > 0));
      const valid = cfgs.filter((c: any) => Number(c.monthly_ctc) > 0);
      if (!valid.length) { toast.error("All employees have salary = 0. Set salaries in Payroll Settings."); return; }
      if (zeroes.length) toast.warning(`Skipped ${zeroes.length} employee(s) with salary = 0`);

      const { data: { user } } = await supabase.auth.getUser();
      let okCount = 0, revisedCount = 0;
      for (const cfg of valid) {
        const res = await generateOne(cfg, user);
        if (res.ok) { okCount++; if (res.revised) revisedCount++; }
      }
      const revLabel = revisedCount ? ` (${revisedCount} revised)` : "";
      toast.success(`Generated ${okCount} payslip${okCount === 1 ? "" : "s"} for ${MONTHS[month - 1]} ${year}${revLabel}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function generateSingle(cfg: any) {
    if (!(Number(cfg.monthly_ctc) > 0)) {
      toast.error("Set salary in Payroll Settings first."); return;
    }
    setGeneratingId(cfg.user_id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await generateOne(cfg, user);
      if (res.ok) toast.success(res.revised ? "Payslip revised" : "Payslip generated");
      else toast.error("Generation failed");
      await load();
    } finally {
      setGeneratingId(null);
    }
  }

  async function downloadAllZip() {
    const active = slips.filter(s => !s.superseded_at);
    if (!active.length) { toast.error("No payslips to download"); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const s of active) {
        if (!s.pdf_url) continue;
        const dl = await supabase.storage.from("hr-docs").download(s.pdf_url);
        if (dl.error || !dl.data) continue;
        const name = (profileMap[s.user_id]?.display_name || s.user_id).replace(/[^a-z0-9]+/gi, "_");
        zip.file(`${name}_${MONTHS[month - 1]}_${year}.pdf`, dl.data);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payslips_${MONTHS[month - 1]}_${year}.zip`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) ys.push(y);
    return ys;
  }, []);

  const zeroEmployees = useMemo(
    () => configs.filter((c: any) => !(Number(c.monthly_ctc) > 0))
      .map((c: any) => profileMap[c.user_id]?.display_name || profileMap[c.user_id]?.email || c.user_id),
    [configs, profileMap],
  );

  const slipByUser = useMemo(() => {
    const m: Record<string, any> = {};
    for (const s of slips) {
      if (!s.superseded_at) m[s.user_id] = s;
    }
    return m;
  }, [slips]);

  const fmt = (n: number) => maskAmounts ? "•••" : Number(n || 0).toLocaleString("en-IN");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999" }}>Month</label>
          <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
            <SelectTrigger className="w-36 h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#999" }}>Year</label>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28 h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!maskAmounts && (
          <Button onClick={generateAll} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
            Generate Payslips for All
          </Button>
        )}
        <Button variant="outline" onClick={downloadAllZip} disabled={downloading || slips.filter(s => !s.superseded_at).length === 0} className="gap-2">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download All (ZIP)
        </Button>
      </div>

      {maskAmounts && (
        <div className="rounded-lg border p-3 text-xs flex items-center gap-2" style={{ borderColor: "#D4860A", backgroundColor: "#FFF7E6", color: "#7A4F00" }}>
          <AlertTriangle className="h-4 w-4" /> Salary amounts are hidden for HR. Only Mary (Finance) and the MD can see amounts.
        </div>
      )}

      {zeroEmployees.length > 0 && !maskAmounts && (
        <div className="rounded-lg border p-3 text-xs flex items-start gap-2" style={{ borderColor: "#D4860A", backgroundColor: "#FFF7E6", color: "#7A4F00" }}>
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            <div className="font-semibold">Salary not set for {zeroEmployees.length} employee(s).</div>
            <div className="opacity-80">Open Payroll Settings to fix: {zeroEmployees.slice(0, 6).join(", ")}{zeroEmployees.length > 6 ? "…" : ""}</div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Employee", "Basic ₹", "HRA ₹", "Conveyance ₹", "Other ₹", "Gross ₹", "Deductions ₹", "Net Pay ₹", "Status", ""].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : configs.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-12 text-center text-sm" style={{ color: "#999" }}>
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No employees configured. Set up salary structures in Payroll Settings first.
              </td></tr>
            ) : configs.map((cfg: any) => {
              const s = slipByUser[cfg.user_id];
              const prof = profileMap[cfg.user_id];
              const ctc = Number(cfg.monthly_ctc) || 0;
              const hasSlip = !!s;
              const isRevised = hasSlip && Number(s.revision) > 1;
              return (
                <tr key={cfg.user_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{prof?.display_name || prof?.email || "—"}</div>
                    {ctc <= 0 && <div className="text-[10px]" style={{ color: "#D4860A" }}>Salary not set</div>}
                  </td>
                  <td className="px-3 py-2 font-mono">{hasSlip ? fmt(s.basic) : "—"}</td>
                  <td className="px-3 py-2 font-mono">{hasSlip ? fmt(s.hra) : "—"}</td>
                  <td className="px-3 py-2 font-mono">{hasSlip ? fmt(s.conveyance_allowance) : "—"}</td>
                  <td className="px-3 py-2 font-mono">{hasSlip ? fmt(s.special_allowance) : "—"}</td>
                  <td className="px-3 py-2 font-mono">{hasSlip ? fmt(s.gross_amount) : "—"}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: maskAmounts ? undefined : "#F40009" }}>{hasSlip ? fmt(s.deductions) : "—"}</td>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: maskAmounts ? undefined : "#006039" }}>{hasSlip ? fmt(s.net_pay) : "—"}</td>
                  <td className="px-3 py-2">
                    {hasSlip ? (
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: isRevised ? "#D4860A" : "#006039",
                        borderColor: isRevised ? "#D4860A" : "#006039",
                        backgroundColor: isRevised ? "#FFF7E6" : "#E8F2ED",
                      }}>
                        {isRevised ? `Revised v${s.revision}` : "Generated"}
                      </Badge>
                    ) : <span className="text-[10px]" style={{ color: "#999" }}>Not generated</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex gap-1">
                      {!maskAmounts && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                          disabled={generatingId === cfg.user_id || ctc <= 0}
                          onClick={() => generateSingle(cfg)}>
                          {generatingId === cfg.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          {hasSlip ? "Regenerate" : "Generate"}
                        </Button>
                      )}
                      {hasSlip && s.pdf_url && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
                          const { data } = await supabase.storage.from("hr-docs").createSignedUrl(s.pdf_url, 60);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                        }}>
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                      )}
                    </div>
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
