import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, Paperclip, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format, parse, isValid, isFuture, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const VALID_CATEGORIES = [
  "Travel by Car",
  "Travel by Bike",
  "Auto/Cab",
  "Meals and Entertainment",
  "Stationery and Supplies",
  "Site Expenses",
  "Client Meeting",
  "Medical",
  "Other",
];

const TRAVEL_CATEGORIES = ["Travel by Car", "Travel by Bike"];

function getSubmissionWindow(): { isOpen: boolean; label: string; nextWindow: string } {
  const now = new Date();
  const day = now.getDate();
  if (day >= 1 && day <= 5) return { isOpen: true, label: "Window 1 open — closes on the 5th. Payment on 10th.", nextWindow: "" };
  if (day >= 16 && day <= 20) return { isOpen: true, label: "Window 2 open — closes on the 20th. Payment on 25th.", nextWindow: "" };
  if (day < 16) return { isOpen: false, label: "", nextWindow: `16th ${format(now, "MMMM yyyy")}` };
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { isOpen: false, label: "", nextWindow: `1st ${format(nextMonth, "MMMM yyyy")}` };
}

interface ParsedRow {
  rowNum: number;
  date: string;
  parsedDate: Date | null;
  category: string;
  description: string;
  distanceKm: number | null;
  amount: number | null;
  projectName: string;
  receiptAvailable: boolean;
  notes: string;
  errors: string[];
  calculatedAmount: number;
}

export function ExpenseExcelUpload() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const fileRef = useRef<HTMLInputElement>(null);

  const [carRate, setCarRate] = useState(9.5);
  const [bikeRate, setBikeRate] = useState(3.5);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [onBehalfOf, setOnBehalfOf] = useState("self");
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");

  const isHR = role === "hr_executive" || role === "super_admin" || role === "managing_director";
  const window = getSubmissionWindow();

  useEffect(() => {
    Promise.all([
      supabase.from("hr_settings").select("key, value").in("key", ["car_rate_per_km", "bike_rate_per_km"]),
      isHR ? supabase.from("profiles").select("auth_user_id, display_name, role").eq("is_active", true) : Promise.resolve({ data: [] }),
    ]).then(([ratesRes, profsRes]) => {
      (ratesRes.data ?? []).forEach((r: any) => {
        if (r.key === "car_rate_per_km") setCarRate(Number(r.value) || 9.5);
        if (r.key === "bike_rate_per_km") setBikeRate(Number(r.value) || 3.5);
      });
      setProfiles(profsRes.data ?? []);
    });
  }, [isHR]);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    // Row 1: Title
    wsData.push(["HStack Expense Report Template — The Habitainer", "", "", "", "", "", "", ""]);
    // Row 2: Instructions
    wsData.push([
      "Fill one row per expense. Do not change column headers. Submission Window 1: 1st–5th of month. Window 2: 16th–20th. Conveyance is auto-calculated from distance — do not fill Amount for Travel by Car or Travel by Bike rows.",
      "", "", "", "", "", "", "",
    ]);
    // Row 3: Headers
    wsData.push([
      "Date (DD/MM/YYYY)", "Category", "Description",
      "Distance (km) — for travel only", "Amount (₹) — leave blank for travel",
      "Project Name", "Receipt Available? (Yes/No)", "Notes",
    ]);
    // Rows 4–33: 30 blank rows
    for (let i = 0; i < 30; i++) wsData.push(["", "", "", "", "", "", "", ""]);
    // Reference block
    wsData.push([]);
    wsData.push([]);
    wsData.push(["CONVEYANCE RATES (auto-applied on upload)"]);
    wsData.push([`Car: ₹${carRate} per km`]);
    wsData.push([`Bike / Two-Wheeler: ₹${bikeRate} per km`]);
    wsData.push(["For Auto/Cab — enter actual amount in Amount column"]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge title & instructions
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    ];

    // Column widths
    ws["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 30 }, { wch: 26 },
      { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 20 },
    ];

    // Category data validation for rows 4–33 (B4:B33)
    ws["!dataValidation"] = [{
      sqref: "B4:B33",
      type: "list",
      formula1: `"${VALID_CATEGORIES.join(",")}"`,
    }];

    XLSX.utils.book_append_sheet(wb, ws, "Expense Report");
    XLSX.writeFile(wb, `HStack_Expense_Template_${format(new Date(), "MMM_yyyy")}.xlsx`);
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
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

      // Skip first 3 rows (title, instructions, headers) → data starts at index 3
      const dataRows = rows.slice(3);
      const now = new Date();
      const earliestDate = startOfMonth(subMonths(now, 1));

      const parsed: ParsedRow[] = [];
      for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];
        if (!r || r.every((c: any) => !c || String(c).trim() === "")) continue;
        // Stop at reference block
        if (String(r[0] || "").includes("CONVEYANCE RATES")) break;

        const errors: string[] = [];
        const dateStr = String(r[0] || "").trim();
        let parsedDate: Date | null = null;

        // Try DD/MM/YYYY
        if (dateStr) {
          parsedDate = parse(dateStr, "dd/MM/yyyy", new Date());
          if (!isValid(parsedDate)) {
            // Try other common formats
            parsedDate = parse(dateStr, "d/M/yyyy", new Date());
          }
          if (!isValid(parsedDate)) {
            errors.push("Invalid date format — use DD/MM/YYYY");
            parsedDate = null;
          } else if (isFuture(parsedDate)) {
            errors.push("Date cannot be in the future");
          } else if (parsedDate < earliestDate) {
            errors.push("Date must be within current or last month");
          }
        } else {
          errors.push("Date is required");
        }

        const category = String(r[1] || "").trim();
        if (!category) errors.push("Category is required");
        else if (!VALID_CATEGORIES.includes(category)) errors.push(`Invalid category "${category}"`);

        const description = String(r[2] || "").trim();
        if (!description || description.length < 5) errors.push("Description required (min 5 chars)");

        const distanceRaw = r[3] ? Number(r[3]) : null;
        const amountRaw = r[4] ? Number(r[4]) : null;
        const isTravel = TRAVEL_CATEGORIES.includes(category);

        if (isTravel && (!distanceRaw || distanceRaw <= 0)) {
          errors.push("Distance (km) required for travel category");
        }
        if (!isTravel && (!amountRaw || amountRaw <= 0)) {
          errors.push("Amount required for non-travel category");
        }

        let calculatedAmount = 0;
        if (isTravel && distanceRaw && distanceRaw > 0) {
          const rate = category === "Travel by Car" ? carRate : bikeRate;
          calculatedAmount = distanceRaw * rate;
        } else if (amountRaw && amountRaw > 0) {
          calculatedAmount = amountRaw;
        }

        const receiptStr = String(r[6] || "").trim().toLowerCase();
        if (receiptStr && receiptStr !== "yes" && receiptStr !== "no") {
          errors.push("Receipt must be Yes or No");
        }

        parsed.push({
          rowNum: i + 4,
          date: dateStr,
          parsedDate,
          category,
          description,
          distanceKm: distanceRaw,
          amount: amountRaw,
          projectName: String(r[5] || "").trim(),
          receiptAvailable: receiptStr === "yes",
          notes: String(r[7] || "").trim(),
          errors,
          calculatedAmount,
        });
      }

      setParsedRows(parsed);
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const validRows = parsedRows?.filter((r) => r.errors.length === 0) ?? [];
  const errorRows = parsedRows?.filter((r) => r.errors.length > 0) ?? [];
  const totalAmount = validRows.reduce((s, r) => s + r.calculatedAmount, 0);

  const handleSubmit = async () => {
    if (!user || !validRows.length) return;
    setSubmitting(true);

    const targetUserId = onBehalfOf === "self" ? user.id : onBehalfOf;
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
        status: "pending_hr",
        report_period: reportPeriod,
        submission_method: "excel_upload",
        uploaded_on_behalf_of: onBehalfOf !== "self" ? onBehalfOf : null,
        project_id: null,
      } as any;
    });

    const { error } = await supabase.from("expense_entries").insert(entries);
    if (error) {
      toast.error("Upload failed: " + error.message);
      setSubmitting(false);
      return;
    }

    // Get target user name for notification
    const targetProfile = profiles.find((p) => p.auth_user_id === targetUserId);
    const empName = targetProfile?.display_name || "Employee";

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

        {/* HR: on behalf of */}
        {isHR && (
          <div>
            <label className="text-[11px] font-inter" style={{ color: "#666" }}>Uploading for Employee</label>
            <Select value={onBehalfOf} onValueChange={setOnBehalfOf}>
              <SelectTrigger className="mt-1 font-inter text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self" className="font-inter text-xs">Self</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.auth_user_id} value={p.auth_user_id} className="font-inter text-xs">{p.display_name || p.auth_user_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
                    {["#", "Date", "Category", "Description", "Dist.", "Amount ₹", "Status"].map((h) => (
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
                        <td className="px-2 py-1.5">
                          {hasErr ? (
                            <span className="text-[10px]" style={{ color: "#F40009" }}>{r.errors.join("; ")}</span>
                          ) : (
                            <Badge variant="outline" className="text-[9px]" style={{ color: "#006039", borderColor: "#006039", backgroundColor: "#E8F2ED" }}>Valid</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="text-xs font-display" onClick={() => { setParsedRows(null); setFileName(""); }}>
                Fix and Re-upload
              </Button>
              <Button
                size="sm"
                className="text-xs font-display text-white"
                style={{ backgroundColor: "#006039" }}
                disabled={!validRows.length || !window.isOpen || submitting}
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
