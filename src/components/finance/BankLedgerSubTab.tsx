import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface BankEntry {
  id: string; entry_date: string; particulars: string; vch_type: string | null;
  vch_no: string | null; debit: number; credit: number; balance: number | null;
  upload_month: string | null; uploaded_at: string | null;
}

export function BankLedgerSubTab({ canUpload }: { canUpload: boolean }) {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [preview, setPreview] = useState<any[] | null>(null);
  const [previewMonth, setPreviewMonth] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingRows, setPendingRows] = useState<any[]>([]);

  const fetch = async () => {
    const { data } = await supabase.from("bank_ledger_entries").select("*").order("entry_date");
    setEntries((data as BankEntry[]) || []);
  };
  useEffect(() => { fetch(); }, []);

  const parseDate = (v: any): Date | null => {
    if (!v) return null;
    const s = String(v).trim();
    // Try DD/MM/YYYY
    let d = parse(s, "dd/MM/yyyy", new Date());
    if (isValid(d)) return d;
    // Try DD-MM-YYYY
    d = parse(s, "dd-MM-yyyy", new Date());
    if (isValid(d)) return d;
    // Try ISO / Excel serial
    d = new Date(s);
    return isValid(d) ? d : null;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const parsed = rows.filter(r => r.Date || r.Particulars).map(r => {
        const d = parseDate(r.Date);
        return {
          entry_date: d ? format(d, "yyyy-MM-dd") : null,
          entry_date_display: d ? format(d, "dd/MM/yyyy") : String(r.Date || ""),
          particulars: String(r.Particulars || "").trim(),
          vch_type: r["Vch Type"] || r.VchType || null,
          vch_no: r["Vch No"] || r.VchNo || null,
          debit: Number(r.Debit) || 0,
          credit: Number(r.Credit) || 0,
          balance: r.Balance != null ? Number(r.Balance) : null,
          valid: !!d && (Number(r.Debit) > 0 || Number(r.Credit) > 0),
        };
      });
      if (parsed.length === 0) { toast.error("No data rows found"); return; }
      const dates = parsed.filter(r => r.entry_date).map(r => r.entry_date!);
      const month = dates.length ? dates[0].slice(0, 7) : format(new Date(), "yyyy-MM");
      setPreviewMonth(month);
      setPreview(parsed);
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const doImport = async (rows: any[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    // Delete existing for same month
    await supabase.from("bank_ledger_entries").delete().eq("upload_month", previewMonth);
    const valid = rows.filter(r => r.valid);
    const toInsert = valid.map(r => ({
      entry_date: r.entry_date, particulars: r.particulars, vch_type: r.vch_type,
      vch_no: r.vch_no, debit: r.debit, credit: r.credit, balance: r.balance,
      upload_month: previewMonth, uploaded_by: user?.id,
    }));
    for (let i = 0; i < toInsert.length; i += 50) {
      const { error } = await supabase.from("bank_ledger_entries").insert(toInsert.slice(i, i + 50));
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`${valid.length} bank ledger entries imported`);
    setPreview(null);
    setConfirmReplace(false);
    fetch();
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    // Check if data exists for this month
    const { count } = await supabase.from("bank_ledger_entries").select("id", { count: "exact", head: true }).eq("upload_month", previewMonth);
    if (count && count > 0) {
      setPendingRows(preview);
      setConfirmReplace(true);
    } else {
      doImport(preview);
    }
  };

  const totalInflows = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const totalOutflows = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const closingBalance = entries.length ? entries[entries.length - 1].balance : null;
  const lastUpload = entries.length ? entries[0].uploaded_at : null;

  const filtered = entries.filter(e => {
    if (search && !e.particulars.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter === "receipt" && e.credit <= 0) return false;
    if (typeFilter === "payment" && e.debit <= 0) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Tally Instructions */}
      <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FFF3CD", color: "#664D03" }}>
        <strong>Export from Tally:</strong> Gateway → Display → More Reports → Account Books → Bank Book → Select Bank Account → Set Date Range → Export Excel. Upload the file here.
      </div>

      {canUpload && (
        <div className="flex gap-2 flex-wrap">
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Bank Ledger</span>
            </Button>
          </label>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold font-display" style={{ color: "#1A1A1A" }}>
              Preview — {preview.length} rows, Period: {previewMonth}
            </p>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b" style={{ color: "#666" }}>
                  <th className="text-left py-1">Date</th><th className="text-left py-1">Particulars</th>
                  <th className="text-left py-1">Type</th><th className="text-right py-1">Debit</th>
                  <th className="text-right py-1">Credit</th><th className="text-right py-1">Balance</th>
                </tr></thead>
                <tbody>{preview.map((r, i) => (
                  <tr key={i} className="border-b" style={{ backgroundColor: !r.valid ? "#FDE8E8" : undefined }}>
                    <td className="py-1">{r.entry_date_display}</td>
                    <td className="py-1">{r.particulars}</td>
                    <td className="py-1">{r.vch_type || "—"}</td>
                    <td className="text-right py-1 font-mono">{r.debit > 0 ? `₹${r.debit.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="text-right py-1 font-mono">{r.credit > 0 ? `₹${r.credit.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="text-right py-1 font-mono">{r.balance != null ? `₹${r.balance.toLocaleString("en-IN")}` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="text-xs" style={{ color: "#666" }}>
              <span style={{ color: "#006039" }}>{preview.filter(r => r.valid).length} valid</span> · <span style={{ color: "#F40009" }}>{preview.filter(r => !r.valid).length} invalid (skipped)</span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleConfirmImport} style={{ backgroundColor: "#006039" }} disabled={preview.filter(r => r.valid).length === 0}>Import Valid Rows</Button>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Strip */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Total Inflows</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#006039" }}>₹{totalInflows.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Total Outflows</p>
            <p className="text-lg font-mono font-bold" style={{ color: "#F40009" }}>₹{totalOutflows.toLocaleString("en-IN")}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-3 pb-3">
            <p className="text-[10px] font-display uppercase" style={{ color: "#666" }}>Closing Balance</p>
            <p className="text-lg font-mono font-bold" style={{ color: closingBalance != null && closingBalance >= 0 ? "#006039" : "#F40009" }}>
              {closingBalance != null ? `₹${closingBalance.toLocaleString("en-IN")}` : "—"}
            </p>
          </CardContent></Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5" style={{ color: "#999" }} />
          <Input placeholder="Search particulars..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 text-sm h-9" />
        </div>
        <select className="text-xs border rounded px-2 py-1.5 h-9" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="receipt">Receipts Only</option>
          <option value="payment">Payments Only</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b" style={{ color: "#666" }}>
              <th className="text-left py-2 text-xs font-display">Date</th>
              <th className="text-left py-2 text-xs font-display">Particulars</th>
              <th className="text-left py-2 text-xs font-display">Type</th>
              <th className="text-left py-2 text-xs font-display">Voucher No</th>
              <th className="text-right py-2 text-xs font-display">Debit (₹)</th>
              <th className="text-right py-2 text-xs font-display">Credit (₹)</th>
              <th className="text-right py-2 text-xs font-display">Balance (₹)</th>
            </tr></thead>
            <tbody>{filtered.map(e => (
              <tr key={e.id} className="border-b" style={{ backgroundColor: e.debit > 0 ? "#FDE8E8" : e.credit > 0 ? "#E8F2ED" : undefined }}>
                <td className="py-1.5 text-xs">{format(new Date(e.entry_date), "dd/MM/yyyy")}</td>
                <td className="py-1.5 text-xs">{e.particulars}</td>
                <td className="py-1.5 text-xs">{e.vch_type || "—"}</td>
                <td className="py-1.5 text-xs">{e.vch_no || "—"}</td>
                <td className="text-right py-1.5 text-xs font-mono">{e.debit > 0 ? `₹${e.debit.toLocaleString("en-IN")}` : "—"}</td>
                <td className="text-right py-1.5 text-xs font-mono">{e.credit > 0 ? `₹${e.credit.toLocaleString("en-IN")}` : "—"}</td>
                <td className="text-right py-1.5 text-xs font-mono">{e.balance != null ? `₹${e.balance.toLocaleString("en-IN")}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
          {entries.length === 0 && <p className="text-center text-xs py-8" style={{ color: "#999" }}>No bank ledger data. Upload a Tally export to begin.</p>}
        </CardContent>
      </Card>

      {/* Replace Confirm Dialog */}
      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Replace Existing Data?</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: "#666" }}>Data for <strong>{previewMonth}</strong> already exists. This upload will replace it.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReplace(false)}>Cancel</Button>
            <Button onClick={() => doImport(pendingRows)} style={{ backgroundColor: "#F40009" }}>Replace & Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
