import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";

type LedgerType = "bank" | "creditor" | "debtor";

const TABLE_MAP: Record<LedgerType, string> = {
  bank: "bank_ledger_entries",
  creditor: "creditor_ledger_entries",
  debtor: "debtor_ledger_entries",
};

export function LedgerUpload() {
  const [ledgerType, setLedgerType] = useState<LedgerType>("bank");
  const [file, setFile] = useState<File | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preview, setPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setPreview([]);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      setPreview((rows as any[]).slice(0, 5));
    };
    reader.readAsBinaryString(f);
  };

  const handleUpload = async () => {
    if (!file || !fromDate || !toDate) {
      toast.error("Select file and date range");
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

        const table = TABLE_MAP[ledgerType];

        // Delete existing entries in the date range (replace-by-date-range dedup)
        await (supabase.from(table as any) as any)
          .delete()
          .gte("entry_date", fromDate)
          .lte("entry_date", toDate);

        // Insert new rows
        const toInsert = rows.map((r) => {
          const base: any = {
            entry_date: r.Date || r.date || r.entry_date || fromDate,
            description: r.Description || r.Narration || r.description || "—",
            amount: Math.abs(parseFloat(String(r.Amount || r.Debit || r.Credit || r.amount || "0").replace(/[^0-9.-]/g, "")) || 0),
          };
          if (ledgerType === "bank") {
            base.debit = parseFloat(String(r.Debit || r.debit || "0").replace(/[^0-9.-]/g, "")) || 0;
            base.credit = parseFloat(String(r.Credit || r.credit || "0").replace(/[^0-9.-]/g, "")) || 0;
            base.closing_balance = parseFloat(String(r.Balance || r.closing_balance || "0").replace(/[^0-9.-]/g, "")) || 0;
          } else {
            base.party_name = r.Party || r.Vendor || r.Customer || r.party_name || "—";
            base.is_paid = String(r.Paid || r.paid || "").toLowerCase() === "yes";
            base.due_date = r.DueDate || r.due_date || null;
          }
          return base;
        });

        const { error } = await (supabase.from(table as any) as any).insert(toInsert);
        if (error) throw error;
        toast.success(`${toInsert.length} entries uploaded for ${ledgerType} ledger`);
        setFile(null);
        setPreview([]);
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4 mt-2">
      <p className="text-sm" style={{ color: "#666" }}>
        Upload bank/creditor/debtor ledger exports. Existing entries in the selected date range will be replaced.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Ledger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Ledger Type</Label>
            <Select value={ledgerType} onValueChange={(v: any) => { setLedgerType(v); setPreview([]); setFile(null); }}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Ledger</SelectItem>
                <SelectItem value="creditor">Creditor Ledger</SelectItem>
                <SelectItem value="debtor">Debtor Ledger</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From Date *</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">To Date *</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Excel File (.xlsx) *</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="mt-1" />
          </div>

          {fromDate && toDate && (
            <div className="rounded-md p-2 flex items-center gap-2 text-xs" style={{ backgroundColor: "#FFF8E8", color: "#D4860A" }}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              All existing {ledgerType} entries between {format(parseISO(fromDate), "dd/MM/yyyy")} and {format(parseISO(toDate), "dd/MM/yyyy")} will be replaced.
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#666" }}>Preview (first 5 rows):</p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="text-[10px] w-full">
                  <thead>
                    <tr className="bg-muted">
                      {Object.keys(preview[0]).slice(0, 6).map((k) => (
                        <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.keys(preview[0]).slice(0, 6).map((k) => (
                          <td key={k} className="px-2 py-1">{String(row[k]).slice(0, 20)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button onClick={handleUpload} disabled={uploading || !file} className="w-full text-white" style={{ backgroundColor: "#006039" }}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : "Upload & Replace"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
