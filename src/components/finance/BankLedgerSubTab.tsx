import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Search, ChevronRight, Download } from "lucide-react";
import { downloadXlsxTemplate, TEMPLATES } from "@/lib/xlsx-templates";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BankEntry {
  id: string; entry_date: string; particulars: string; vch_type: string | null;
  vch_no: string | null; debit: number; credit: number; balance: number | null;
  upload_month: string | null; uploaded_at: string | null;
}

interface ParsedRow {
  entry_date: string | null;
  entry_date_display: string;
  particulars: string;
  vch_type: string | null;
  vch_no: string | null;
  debit: number;
  credit: number;
  balance: number | null;
  valid: boolean;
  bank_account: string;
}

interface BankSheetResult {
  bankName: string;
  openingBalance: number;
  openingBalanceType: string;
  transactions: ParsedRow[];
  skipped: { row: number; reason: string }[];
}

interface UploadSummary {
  banks: { name: string; txnCount: number; openingBalance: number; closingBalance: number }[];
  totalImported: number;
  totalSkipped: number;
  skippedDetails: { row: number; reason: string; sheet: string }[];
}

function parseExcelDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date && isValid(v)) return v;
  if (typeof v === "number") {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isValid(d) ? d : null;
  }
  const s = String(v).trim();
  const d = new Date(s);
  return isValid(d) ? d : null;
}

function parseTallyBankSheet(rows: any[][], sheetName: string): BankSheetResult {
  // Detect bank name from first 10 rows
  let bankName = sheetName;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cellA = String(rows[i]?.[0] || "").trim();
    if (/bank|hdfc|icici|sbi|axis|kotak|yes bank|indusind/i.test(cellA) && cellA.length > 3) {
      bankName = cellA;
      break;
    }
  }

  // Find header row: scan for row with "Date" in col A and "Debit" somewhere
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const colA = String(row[0] || "").trim().toLowerCase();
    const rowStr = row.map((c: any) => String(c || "").toLowerCase()).join("|");
    if (colA.includes("date") && rowStr.includes("debit")) {
      headerIdx = i;
      break;
    }
  }

  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 1;
  const transactions: ParsedRow[] = [];
  const skipped: { row: number; reason: string }[] = [];
  let openingBalance = 0;
  let openingBalanceType = "Cr";
  let runningBalance = 0;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const colA = row[0]; // Date
    const colB = String(row[1] || "").trim(); // Dr/Cr indicator or narration
    const colC = String(row[2] || "").trim(); // Particulars

    // Skip narration rows: no date and col B starts with "Being" or is just text
    if (!colA && (colB.toLowerCase().startsWith("being") || (!colB.match(/^(dr|cr)$/i) && colB.length > 0 && !colC))) {
      skipped.push({ row: i + 1, reason: `Narration row: "${colB.slice(0, 40)}"` });
      continue;
    }

    // Must have a date
    const dateVal = parseExcelDate(colA);
    if (!dateVal) {
      if (colA) skipped.push({ row: i + 1, reason: `Invalid date: "${colA}"` });
      continue;
    }

    // Must have Dr/Cr indicator in col B
    const drCr = colB.toLowerCase();
    if (drCr !== "dr" && drCr !== "cr") {
      skipped.push({ row: i + 1, reason: `No Dr/Cr indicator: "${colB}"` });
      continue;
    }

    const particulars = colC;

    // Opening Balance row
    if (particulars.toLowerCase().includes("opening balance")) {
      const amt = Number(row[6]) || Number(row[7]) || Number(row[5]) || 0;
      openingBalance = amt;
      openingBalanceType = drCr === "dr" ? "Dr" : "Cr";
      runningBalance = openingBalance;
      continue;
    }

    // Skip empty particulars
    if (!particulars) {
      skipped.push({ row: i + 1, reason: "Empty particulars" });
      continue;
    }

    const vchType = row[4] != null ? String(row[4]).trim() : null;
    const vchNo = row[5] != null ? String(row[5]).trim() : null;

    // Amount detection: Col G (index 6) = Debit, Col H (index 7) = Credit
    let debitAmt = Number(row[6]) || 0;
    let creditAmt = Number(row[7]) || 0;

    // Fallback: if both G and H are empty but F has a number
    if (debitAmt === 0 && creditAmt === 0) {
      const fallback = Number(row[5]);
      if (fallback > 0) {
        if (drCr === "dr") debitAmt = fallback;
        else creditAmt = fallback;
      }
    }

    // If still no amount, skip
    if (debitAmt === 0 && creditAmt === 0) {
      skipped.push({ row: i + 1, reason: `No amount found: "${particulars}"` });
      continue;
    }

    // Calculate running balance
    runningBalance = runningBalance + creditAmt - debitAmt;

    const entryDate = format(dateVal, "yyyy-MM-dd");
    transactions.push({
      entry_date: entryDate,
      entry_date_display: format(dateVal, "dd/MM/yyyy"),
      particulars,
      vch_type: vchType,
      vch_no: vchNo,
      debit: debitAmt,
      credit: creditAmt,
      balance: Math.round(runningBalance * 100) / 100,
      valid: true,
      bank_account: bankName,
    });
  }

  return { bankName, openingBalance, openingBalanceType, transactions, skipped };
}

export function BankLedgerSubTab({ canUpload }: { canUpload: boolean }) {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [previewBanks, setPreviewBanks] = useState<BankSheetResult[]>([]);
  const [previewMonth, setPreviewMonth] = useState("");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  const fetchEntries = async () => {
    const { data } = await supabase.from("bank_ledger_entries").select("*").order("entry_date");
    setEntries((data as BankEntry[]) || []);
  };
  useEffect(() => { fetchEntries(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());

      const allResults: BankSheetResult[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (rows.length < 3) continue;

        // Check if this sheet is a bank book: look for "Bank" or "Debit"/"Credit" in first 15 rows
        const first15 = rows.slice(0, 15).map(r => (r || []).map((c: any) => String(c || "").toLowerCase()).join(" ")).join(" ");
        if (!(/bank|hdfc|icici|sbi|axis|kotak/i.test(first15) || (first15.includes("debit") && first15.includes("credit")))) {
          continue;
        }

        const result = parseTallyBankSheet(rows, sheetName);
        if (result.transactions.length > 0) {
          allResults.push(result);
        }
      }

      if (allResults.length === 0) { toast.error("No bank transaction data found in any sheet"); return; }

      const allTxns = allResults.flatMap(r => r.transactions);
      const dates = allTxns.filter(r => r.entry_date).map(r => r.entry_date!);
      const month = dates.length ? dates[0].slice(0, 7) : format(new Date(), "yyyy-MM");

      setPreviewMonth(month);
      setPreviewBanks(allResults);
      setPreview(allTxns);
    } catch (err: any) { toast.error(err.message); }
    e.target.value = "";
  };

  const doImport = async (rows: ParsedRow[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    // Delete existing for same month
    await supabase.from("bank_ledger_entries").delete().eq("upload_month", previewMonth);

    const toInsert = rows.filter(r => r.valid).map(r => ({
      entry_date: r.entry_date!, particulars: r.particulars, vch_type: r.vch_type,
      vch_no: r.vch_no, debit: r.debit, credit: r.credit, balance: r.balance,
      upload_month: previewMonth, uploaded_by: user?.id,
    }));

    for (let i = 0; i < toInsert.length; i += 50) {
      const { error } = await supabase.from("bank_ledger_entries").insert(toInsert.slice(i, i + 50));
      if (error) { toast.error(error.message); return; }
    }

    // Build upload summary
    const banks = previewBanks.map(b => {
      const credits = b.transactions.reduce((s, t) => s + t.credit, 0);
      const debits = b.transactions.reduce((s, t) => s + t.debit, 0);
      return {
        name: b.bankName,
        txnCount: b.transactions.length,
        openingBalance: b.openingBalance,
        closingBalance: Math.round((b.openingBalance + credits - debits) * 100) / 100,
      };
    });
    const allSkipped = previewBanks.flatMap(b => b.skipped.map(s => ({ ...s, sheet: b.bankName })));

    setUploadSummary({
      banks,
      totalImported: toInsert.length,
      totalSkipped: allSkipped.length,
      skippedDetails: allSkipped,
    });

    toast.success(`${toInsert.length} bank ledger entries imported`);
    setPreview(null);
    setPreviewBanks([]);
    setConfirmReplace(false);
    fetchEntries();
  };

  const handleConfirmImport = async () => {
    if (!preview) return;
    const { count } = await supabase.from("bank_ledger_entries").select("id", { count: "exact", head: true }).eq("upload_month", previewMonth);
    if (count && count > 0) {
      setConfirmReplace(true);
    } else {
      doImport(preview);
    }
  };

  const totalInflows = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const totalOutflows = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const closingBalance = entries.length ? entries[entries.length - 1].balance : null;

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
        <strong>Export from Tally:</strong> Gateway → Display → More Reports → Account Books → Bank Book → Select Bank Account → Set Date Range → Export Excel. You can export multiple bank accounts — each will appear as a separate sheet. Upload the single file here.
      </div>

      {canUpload && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => { const t = TEMPLATES.bankLedger; downloadXlsxTemplate(t.filename, t.sheet, t.headers, t.sample); }} className="gap-1.5" style={{ borderColor: "#006039", color: "#006039" }}>
            <Download className="h-4 w-4" /> Download Template
          </Button>
          <label>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
            <Button variant="default" asChild style={{ backgroundColor: "#006039" }}>
              <span className="cursor-pointer flex items-center gap-2"><Upload className="h-4 w-4" /> Upload Bank Ledger</span>
            </Button>
          </label>
        </div>
      )}

      {/* Upload Summary */}
      {uploadSummary && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold font-display" style={{ color: "#006039" }}>
              ✓ {uploadSummary.totalImported} transactions imported
            </p>
            <div className="space-y-1">
              {uploadSummary.banks.map((b, i) => (
                <div key={i} className="flex flex-wrap gap-4 text-xs items-center py-1 border-b" style={{ borderColor: "#E5E7EB" }}>
                  <span className="font-semibold" style={{ color: "#1A1A1A" }}>{b.name}</span>
                  <span>{b.txnCount} transactions</span>
                  <span>Opening: <span className="font-mono">₹{b.openingBalance.toLocaleString("en-IN")}</span></span>
                  <span>Closing: <span className="font-mono" style={{ color: b.closingBalance >= 0 ? "#006039" : "#F40009" }}>₹{b.closingBalance.toLocaleString("en-IN")}</span></span>
                </div>
              ))}
            </div>
            {uploadSummary.totalSkipped > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="text-xs cursor-pointer flex items-center gap-1" style={{ color: "#D4860A" }}>
                  <ChevronRight className="h-3 w-3" /> {uploadSummary.totalSkipped} rows skipped
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="pl-4 pt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    {uploadSummary.skippedDetails.map((s, i) => (
                      <p key={i} className="text-[10px]" style={{ color: "#999" }}>[{s.sheet}] Row {s.row}: {s.reason}</p>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setUploadSummary(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm font-semibold font-display" style={{ color: "#1A1A1A" }}>
              Preview — {preview.length} transactions from {previewBanks.length} bank account{previewBanks.length > 1 ? "s" : ""}, Period: {previewMonth}
            </p>
            {previewBanks.map((b, idx) => (
              <div key={idx} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: "#E8F2ED" }}>
                <span className="font-semibold">{b.bankName}</span>: {b.transactions.length} txns, Opening Balance: ₹{b.openingBalance.toLocaleString("en-IN")} ({b.openingBalanceType})
              </div>
            ))}
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b" style={{ color: "#666" }}>
                  <th className="text-left py-1">Date</th><th className="text-left py-1">Bank</th>
                  <th className="text-left py-1">Particulars</th><th className="text-left py-1">Type</th>
                  <th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th>
                  <th className="text-right py-1">Balance</th>
                </tr></thead>
                <tbody>{preview.map((r, i) => (
                  <tr key={i} className="border-b" style={{ backgroundColor: r.debit > 0 ? "#FDE8E8" : r.credit > 0 ? "#E8F2ED" : undefined }}>
                    <td className="py-1">{r.entry_date_display}</td>
                    <td className="py-1 text-[10px]">{r.bank_account.slice(0, 15)}</td>
                    <td className="py-1">{r.particulars}</td>
                    <td className="py-1">{r.vch_type || "—"}</td>
                    <td className="text-right py-1 font-mono">{r.debit > 0 ? `₹${r.debit.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="text-right py-1 font-mono">{r.credit > 0 ? `₹${r.credit.toLocaleString("en-IN")}` : "—"}</td>
                    <td className="text-right py-1 font-mono">{r.balance != null ? `₹${r.balance.toLocaleString("en-IN")}` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleConfirmImport} style={{ backgroundColor: "#006039" }} disabled={preview.filter(r => r.valid).length === 0}>
                Import {preview.filter(r => r.valid).length} Transactions
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setPreview(null); setPreviewBanks([]); }}>Cancel</Button>
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
            <Button onClick={() => preview && doImport(preview)} style={{ backgroundColor: "#F40009", color: "white" }}>Replace & Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
