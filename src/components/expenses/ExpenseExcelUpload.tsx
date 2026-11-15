import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Paperclip, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { TRAVEL_CATEGORIES, downloadExpenseTemplate, sheetRowsFromWorkbook, parseExpenseRows, type ParsedExpenseRow } from "@/lib/expense-excel";
import { Textarea } from "@/components/ui/textarea";
import { computeWarnings, isDuplicate, matchProject, reasonOk, WARNING_LABELS, MIN_REASON, type ExpenseWarning } from "@/lib/expense-policy";

function getSubmissionWindow(): { isOpen: boolean; label: string; nextWindow: string } {
  const now = new Date();
  const day = now.getDate();
  if (day >= 1 && day <= 5) return { isOpen: true, label: "Window 1 open — closes on the 5th. Payment on 10th.", nextWindow: "" };
  if (day >= 16 && day <= 20) return { isOpen: true, label: "Window 2 open — closes on the 20th. Payment on 25th.", nextWindow: "" };
  if (day < 16) return { isOpen: false, label: "", nextWindow: `16th ${format(now, "MMMM yyyy")}` };
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { isOpen: false, label: "", nextWindow: `1st ${format(nextMonth, "MMMM yyyy")}` };
}

type ParsedRow = ParsedExpenseRow & { warnings: ExpenseWarning[] };

export function ExpenseExcelUpload() {
  const { user } = useAuth();
  
  const fileRef = useRef<HTMLInputElement>(null);

  const [carRate, setCarRate] = useState(9.5);
  const [bikeRate, setBikeRate] = useState(3.5);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [warningReason, setWarningReason] = useState("");

  
  const window = getSubmissionWindow();

  useEffect(() => {
    supabase.from("projects").select("id, name").then(({ data }) => setProjects((data ?? []) as any[]));
  }, []);

  useEffect(() => {
    supabase.from("hr_settings").select("key, value").in("key", ["car_rate_per_km", "bike_rate_per_km"]).then(({ data }) => {
      (data ?? []).forEach((r: any) => {
        if (r.key === "car_rate_per_km") setCarRate(Number(r.value) || 9.5);
        if (r.key === "bike_rate_per_km") setBikeRate(Number(r.value) || 3.5);
      });
    });
  }, []);

  const downloadTemplate = () => {
    downloadExpenseTemplate({ car: carRate, bike: bikeRate });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      toast.error("Only .xlsx files are accepted");
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const res = parseExpenseRows(sheetRowsFromWorkbook(wb), { carRate, bikeRate, matchProject: (c) => matchProject(c, projects) });
      if (!res.headerFound) { toast.error('Header row not found — the sheet must have a "Date (DD/MM/YYYY)" column'); return; }
      const parsed: ParsedRow[] = [];
      for (const row of res.rows) {
        const dup = row.errors.length === 0 ? await isDuplicate(row.vendor, row.billNo, row.calculatedAmount) : false;
        const warnings = row.parsedDate && isValid(row.parsedDate)
          ? computeWarnings({ entryDate: row.parsedDate, receiptMissing: true, duplicate: dup, categoryCap: null, amount: row.calculatedAmount })
          : [];
        parsed.push({ ...row, warnings });
      }

      setWarningReason("");
      setParsedRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const fileRejected = parsedRows?.some((r) => r.fatal) ?? false;
  const validRows = fileRejected ? [] : (parsedRows?.filter((r) => r.errors.length === 0) ?? []);
  const anyWarnings = validRows.some((r) => r.warnings.length > 0);
  const errorRows = parsedRows?.filter((r) => r.errors.length > 0) ?? [];
  const totalAmount = validRows.reduce((s, r) => s + r.calculatedAmount, 0);

  const handleSubmit = async () => {
    if (!user || !validRows.length || fileRejected) return;
    if (anyWarnings && !reasonOk(warningReason)) {
      toast.error(`Type a reason for the warnings (at least ${MIN_REASON} characters)`);
      return;
    }
    setSubmitting(true);

    const targetUserId = user.id;
    const now = new Date();

    const entries = validRows.map((r) => {
      const isTravel = TRAVEL_CATEGORIES.includes(r.category);
      const rate = r.category === "Travel by Car" ? carRate : r.category === "Travel by Bike" ? bikeRate : null;
      const entryDate = r.parsedDate ? format(r.parsedDate, "yyyy-MM-dd") : format(now, "yyyy-MM-dd");

      // Determine report period
      const d = r.parsedDate || now;
      const reportPeriod = d.getDate() <= 15
        ? `${format(d, "yyyy-MM")}-first-half`
        : `${format(d, "yyyy-MM")}-second-half`;

      return {
        submitted_by: targetUserId,
        entry_date: entryDate,
        expense_type: isTravel ? "conveyance" : "regular",
        category: r.category,
        amount: r.calculatedAmount,
        description: r.description,
        distance_km: isTravel ? r.distanceKm : null,
        rate_per_km: rate,
        rate_used: rate,
        vehicle_type: r.category === "Travel by Car" ? "car" : r.category === "Travel by Bike" ? "bike" : null,
        status: "draft",
        report_period: reportPeriod,
        submission_method: "excel_upload",
        uploaded_on_behalf_of: null,
        project_id: r.projectId,
        vendor: r.vendor || null,
        bill_no: r.billNo || null,
        receipt_path: null,
        receipt_flags: ["receipt_missing"],
        policy_warnings: r.warnings,
        warning_reason: r.warnings.length ? warningReason.trim() : null,
      } as any;
    });

    const { error } = await supabase.from("expense_entries").insert(entries);
    if (error) {
      console.error("expense excel insert failed", error);
      toast.error("Upload failed. Nothing was saved — please try again.");
      setSubmitting(false);
      return;
    }


    toast.success(`Expense report submitted. ${validRows.length} items, Total ₹${totalAmount.toLocaleString("en-IN")}.`);
    setParsedRows(null);
    setFileName("");
    setSubmitting(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Paperclip className="h-4 w-4" style={{ color: "#006039" }} />
          Excel Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Download template */}
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 text-xs font-display" style={{ color: "#006039", borderColor: "#006039" }}>
          <Download className="h-3.5 w-3.5" /> Download Expense Template
        </Button>

        {/* Every user uploads only for themselves — no employee selector. */}

        {/* Submission window status */}
        {window.isOpen ? (
          <div className="rounded-md px-3 py-2 text-xs font-inter" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
            {window.label}
          </div>
        ) : (
          <div className="rounded-md px-3 py-2 text-xs font-inter" style={{ backgroundColor: "#FFF3CD", color: "#7a5c00" }}>
            Submission window is currently closed. Next window opens on {window.nextWindow}.
          </div>
        )}

        {/* Upload area */}
        {!parsedRows && (
          <label
            className="flex flex-col items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed p-6 hover:bg-muted/30 transition-colors"
            style={{ borderColor: "#006039" }}
          >
            <Paperclip className="h-6 w-6" style={{ color: "#006039" }} />
            <span className="text-sm font-display" style={{ color: "#006039" }}>Upload Expense Report</span>
            <span className="text-[10px] font-inter" style={{ color: "#999" }}>.xlsx files only</span>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileUpload} />
          </label>
        )}

        {/* Preview table */}
        {parsedRows && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-xs font-inter">
              <span style={{ color: "#006039" }}>
                <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> {validRows.length} valid
              </span>
              {errorRows.length > 0 && (
                <span style={{ color: "#F40009" }}>
                  <XCircle className="inline h-3 w-3 mr-0.5" /> {errorRows.length} errors
                </span>
              )}
              <span className="font-semibold" style={{ color: "#006039" }}>
                Total: ₹{totalAmount.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="rounded-lg border border-border overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: "#F7F7F7" }}>
                    {["#", "Date", "Category", "Description", "Dist.", "Amount ₹", "Vendor / Bill", "Project", "Status"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold uppercase tracking-wider" style={{ color: "#666", fontSize: 10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => {
                    const hasErr = r.errors.length > 0;
                    return (
                      <tr key={i} className="border-t border-border" style={{ backgroundColor: hasErr ? "#FDE8E8" : "white" }}>
                        <td className="px-2 py-1.5 font-inter">{r.rowNum}</td>
                        <td className="px-2 py-1.5 font-inter">{r.date}</td>
                        <td className="px-2 py-1.5">{r.category}</td>
                        <td className="px-2 py-1.5 max-w-[120px] truncate">{r.description}</td>
                        <td className="px-2 py-1.5 font-inter">{r.distanceKm ?? "—"}</td>
                        <td className="px-2 py-1.5 font-inter font-semibold" style={{ color: "#006039" }}>
                          {r.calculatedAmount > 0 ? `₹${r.calculatedAmount.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-2 py-1.5">{r.vendor || "—"}{r.billNo ? ` · ${r.billNo}` : ""}</td>
                        <td className="px-2 py-1.5">{r.projectCode ? (projects.find((p) => p.id === r.projectId)?.name ?? r.projectCode) : "—"}</td>
                        <td className="px-2 py-1.5">
                          {hasErr ? (
                            <span className="text-[10px]" style={{ color: "#F40009" }}>{r.errors.join("; ")}</span>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-[9px]" style={{ color: "#006039", borderColor: "#006039", backgroundColor: "#E8F2ED" }}>Valid</Badge>
                              {r.warnings.length > 0 && <span className="block text-[10px]" style={{ color: "#D4860A" }}>{r.warnings.map((w) => WARNING_LABELS[w]).join("; ")}</span>}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {fileRejected && (
              <p className="text-xs font-inter" style={{ color: "#F40009" }}>
                <XCircle className="inline h-3 w-3 mr-0.5" />
                Whole file rejected: fix every bad date (DD/MM/YYYY) and unknown project code, then re-upload.
              </p>
            )}
            {!fileRejected && validRows.length > 0 && (
              <p className="text-[10px] font-inter" style={{ color: "#D4860A" }}>Rows are saved as "Receipt missing" — attach receipts later from Missing receipts.</p>
            )}
            {!fileRejected && anyWarnings && (
              <Textarea value={warningReason} onChange={(e) => setWarningReason(e.target.value.slice(0, 300))} placeholder="Reason for the warnings above (required, min 5 characters)" rows={2} className="font-inter text-sm" />
            )}
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="text-xs font-display" onClick={() => { setParsedRows(null); setFileName(""); }}>
                Fix and Re-upload
              </Button>
              <Button
                size="sm"
                className="text-xs font-display text-white"
                style={{ backgroundColor: "#006039" }}
                disabled={!validRows.length || fileRejected || !window.isOpen || submitting || (anyWarnings && !reasonOk(warningReason))}
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                Submit {validRows.length} Valid Row{validRows.length !== 1 ? "s" : ""} · ₹{totalAmount.toLocaleString("en-IN")}
              </Button>
            </div>
            {!window.isOpen && validRows.length > 0 && (
              <p className="text-[10px] font-inter" style={{ color: "#D4860A" }}>
                <AlertTriangle className="inline h-3 w-3 mr-0.5" />
                Cannot submit — submission window is closed.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
