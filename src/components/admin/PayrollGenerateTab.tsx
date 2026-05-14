import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wallet, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { calcPayslip, generatePayslipPdf, type PayrollConfig } from "@/lib/payslip";
import { format } from "date-fns";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function PayrollGenerateTab() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [slips, setSlips] = useState<any[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { void load(); }, [month, year]);

  async function load() {
    setLoading(true);
    const [psRes, profRes] = await Promise.all([
      supabase.from("payslips").select("*").eq("month", month).eq("year", year),
      supabase.from("profiles").select("auth_user_id, display_name, email"),
    ]);
    setSlips(psRes.data ?? []);
    const map: Record<string, any> = {};
    (profRes.data ?? []).forEach((p: any) => { map[p.auth_user_id] = p; });
    setProfileMap(map);
    setLoading(false);
  }

  async function generate() {
    setGenerating(true);
    try {
      const { data: cfgs } = await (supabase.from("payroll_config") as any)
        .select("*").eq("is_archived", false).gt("monthly_ctc", 0);
      if (!cfgs?.length) { toast.error("No employees configured. Open Payroll Settings first."); setGenerating(false); return; }

      const userIds = cfgs.map((c: any) => c.user_id);
      const { data: profs } = await supabase
        .from("profiles").select("auth_user_id, display_name, email").in("auth_user_id", userIds);
      const pMap: Record<string, any> = {};
      (profs ?? []).forEach((p: any) => { pMap[p.auth_user_id] = p; });

      const dim = daysInMonth(year, month);
      const generatedAt = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();

      let okCount = 0;
      for (const cfg of cfgs as any[]) {
        const b = calcPayslip(cfg as PayrollConfig);
        const prof = pMap[cfg.user_id];
        const empName = prof?.display_name || prof?.email || "Employee";
        const pdfBlob = await generatePayslipPdf({
          employee_name: empName,
          employee_id: prof?.email?.split("@")[0]?.toUpperCase() ?? "—",
          designation: cfg.designation || "—",
          department: cfg.department || "—",
          doj: cfg.doj ? format(new Date(cfg.doj), "dd MMM yyyy") : "—",
          pan: cfg.pan || "—",
          pf_number: cfg.pf_number || "—",
          bank_account: cfg.bank_account || "—",
          bank_name: cfg.bank_name || "—",
          ifsc: cfg.ifsc || "—",
          days_worked: dim,
          days_in_month: dim,
          month, year,
          generated_on: new Date(),
        }, b);

        const path = `payslips/${year}-${String(month).padStart(2,"0")}/${cfg.user_id}.pdf`;
        const up = await supabase.storage.from("hr-docs").upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (up.error) { console.error(up.error); continue; }

        const { error } = await (supabase.from("payslips") as any).upsert({
          user_id: cfg.user_id,
          month, year,
          basic: b.basic, hra: b.hra, special_allowance: b.special_allowance,
          gross_amount: b.gross_earnings,
          pf_deduction: b.pf_deduction, pt_deduction: b.pt_deduction, tds_deduction: b.tds_deduction,
          deductions: b.total_deductions,
          net_pay: b.net_pay,
          days_worked: dim, days_in_month: dim,
          pdf_url: path,
          uploaded_by: user?.id ?? null,
          generated_by: user?.id ?? null,
          generated_at: generatedAt,
        }, { onConflict: "user_id,month,year" });
        if (error) { console.error(error); continue; }
        okCount++;
      }
      toast.success(`Generated ${okCount} payslip${okCount === 1 ? "" : "s"} for ${MONTHS[month - 1]} ${year}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadAllZip() {
    if (!slips.length) { toast.error("No payslips to download"); return; }
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const s of slips) {
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
        <Button onClick={generate} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
          Generate Payslips
        </Button>
        <Button variant="outline" onClick={downloadAllZip} disabled={downloading || slips.length === 0} className="gap-2">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download All (ZIP)
        </Button>
      </div>

      <div className="rounded-lg border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F7F7F7" }}>
              {["Employee", "Basic ₹", "HRA ₹", "Special ₹", "Gross ₹", "PF ₹", "PT ₹", "TDS ₹", "Net Pay ₹", ""].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : slips.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-12 text-center text-sm" style={{ color: "#999" }}>
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No payslips for {MONTHS[month - 1]} {year}. Click "Generate Payslips" to create them.
              </td></tr>
            ) : slips.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{profileMap[s.user_id]?.display_name || profileMap[s.user_id]?.email || "—"}</td>
                <td className="px-3 py-2 font-mono">{Number(s.basic).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono">{Number(s.hra).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono">{Number(s.special_allowance).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono">{Number(s.gross_amount).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "#F40009" }}>{Number(s.pf_deduction).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "#F40009" }}>{Number(s.pt_deduction).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono" style={{ color: "#F40009" }}>{Number(s.tds_deduction).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2 font-mono font-bold" style={{ color: "#006039" }}>{Number(s.net_pay).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2">
                  {s.pdf_url && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
                      const { data } = await supabase.storage.from("hr-docs").createSignedUrl(s.pdf_url, 60);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                    }}>
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
