import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Search, Download } from "lucide-react";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { toast } from "sonner";
import { format, parse, isValid, differenceInDays } from "date-fns";

interface LedgerEntry {
  id: string; party_name: string; bill_date: string | null; bill_no: string | null;
  due_date: string | null; amount: number; overdue_days: number | null; status: string | null;
  uploaded_at: string | null;
}

function parseDate(v: any): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  let d = parse(s, "dd/MM/yyyy", new Date());
  if (isValid(d)) return d;
  d = parse(s, "dd-MM-yyyy", new Date());
  if (isValid(d)) return d;
  d = new Date(s);
  return isValid(d) ? d : null;
}

function calcStatus(dueDate: string | null): { status: string; overdue: number } {
  if (!dueDate) return { status: "not_due", overdue: 0 };
  const days = differenceInDays(new Date(), new Date(dueDate));
  if (days > 0) return { status: "overdue", overdue: days };
  if (days >= -7) return { status: "due_soon", overdue: 0 };
  return { status: "not_due", overdue: 0 };
}

const statusBadge = (s: string | null) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    not_due: { bg: "#E8F2ED", color: "#006039", label: "Not Due" },
    due_soon: { bg: "#FFF3CD", color: "#D4860A", label: "Due Soon" },
    overdue: { bg: "#FDE8E8", color: "#F40009", label: "Overdue" },
  };
  const style = map[s || "not_due"] || map.not_due;
  return <span className="text-[10px] px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>{style.label}</span>;
};

export function DebtorLedgerSubTab({ canUpload }: { canUpload: boolean }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    const { data } = await supabase.from("debtor_ledger_entries").select("*").order("overdue_days", { ascending: false });
    setEntries((data as LedgerEntry[]) || []);
  };
  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("debtor_ledger_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      let imported = 0;
      const toInsert: any[] = [];
      for (const r of rows) {
        const partyName = String(r["Party Name"] || r.PartyName || r.party_name || "").trim();
        const amt = Number(r.Amount || r.amount) || 0;
        if (!partyName || amt === 0) continue;
        const billDate = parseDate(r["Bill Date"] || r.BillDate);
        const dueDate = parseDate(r["Due Date"] || r.DueDate);
        const dueDateStr = dueDate ? format(dueDate, "yyyy-MM-dd") : null;
        const { status, overdue } = calcStatus(dueDateStr);
        toInsert.push({
          party_name: partyName,
          bill_date: billDate ? format(billDate, "yyyy-MM-dd") : null,
          bill_no: String(r["Bill No"] || r.BillNo || "").trim() || null,
          due_date: dueDateStr,
          amount: amt,
          overdue_days: r["Overdue Days"] != null ? Number(r["Overdue Days"]) : overdue,
          status,
          uploaded_by: user?.id,
        });
      }
      for (let i = 0; i < toInsert.length; i += 50) {
        const { error } = await supabase.from("debtor_ledger_entries").insert(toInsert.slice(i, i + 50));
        if (error) { toast.error(error.message); return; }
        imported += toInsert.slice(i, i + 50).length;
      }
      toast.success(`${imported} debtor entries imported`);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const totalReceivables = entries.reduce((s, e) => s + e.amount, 0);
  const overdueAmt = entries.filter(e => e.status === "overdue").reduce((s, e) => s + e.amount, 0);
  const dueThisWeek = entries.filter(e => e.status === "due_soon").reduce((s, e) => s + e.amount, 0);
  const overdueClients = new Set(entries.filter(e => e.status === "overdue").map(e => e.party_name)).size;

  const filtered = entries.filter(e => !search || e.party_name.toLowerCase().includes(search.toLowerCase()) || (e.bill_no || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FFF3CD", color: "#664D03" }}>
        <strong>Export from Tally:</strong> Gateway → Display → More Reports → Statements of Accounts → Outstanding → Receivables → Set Date → Export Excel. Upload the file here.
      </div>

      {canUpload && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { const t = TEMPLATES.debtorLedger; downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample); }} className="gap-1.5" style={{ borderColor: "#006039", color: "#006039" }}>
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Debtor Ledger</span>
            </Button>
          </label>
        </div>
      )}

      {entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Total Receivables</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#006039" }}>₹{totalReceivables.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Overdue Receivables</p>
            <p className="text-lg font-mono font-bold" style={{ color: overdueAmt > 0 ? "#F40009" : "#006039" }}>₹{overdueAmt.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Due This Week</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#D4860A" }}>₹{dueThisWeek.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Clients Overdue</p>
            <p className="text-lg font-mono font-bold" style={{ color: overdueClients > 0 ? "#F40009" : "#006039" }}>{overdueClients}</p>
          </CardContent></Card>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-3.5 w-3.5" style={{ color: "#999" }} />
        <Input placeholder="Search party or bill no..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 text-sm h-9" />
      </div>

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}>
              <th className="text-left py-2 text-xs font-display">Party Name</th>
              <th className="text-left py-2 text-xs font-display">Bill No</th>
              <th className="text-left py-2 text-xs font-display">Bill Date</th>
              <th className="text-left py-2 text-xs font-display">Due Date</th>
              <th className="text-right py-2 text-xs font-display">Amount (₹)</th>
              <th className="text-right py-2 text-xs font-display">Overdue Days</th>
              <th className="text-center py-2 text-xs font-display">Status</th>
            </tr></thead>
            <tbody>{filtered.map(e => (
              <tr key={e.id} className="border-b">
                <td className="py-1.5 text-xs">{e.party_name}</td>
                <td className="py-1.5 text-xs">{e.bill_no || "—"}</td>
                <td className="py-1.5 text-xs">{e.bill_date ? format(new Date(e.bill_date), "dd/MM/yyyy") : "—"}</td>
                <td className="py-1.5 text-xs">{e.due_date ? format(new Date(e.due_date), "dd/MM/yyyy") : "—"}</td>
                <td className="text-right py-1.5 text-xs font-mono font-semibold">₹{e.amount.toLocaleString("en-IN")}</td>
                <td className="text-right py-1.5 text-xs font-mono" style={{ color: (e.overdue_days || 0) > 0 ? "#F40009" : "#666" }}>
                  {(e.overdue_days || 0) > 0 ? e.overdue_days : "—"}
                </td>
                <td className="text-center py-1.5">{statusBadge(e.status)}</td>
              </tr>
            ))}</tbody>
          </table>
          {entries.length === 0 && <p className="text-center text-xs py-8" style={{ color: "#999" }}>No debtor data. Upload a Tally export to begin.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
