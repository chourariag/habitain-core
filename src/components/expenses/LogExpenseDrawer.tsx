import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CalendarIcon, Loader2, Camera, ImageIcon, AlertTriangle } from "lucide-react";
import { computeWarnings, isDuplicate, reasonOk, uploadReceipt, WARNING_LABELS, MIN_REASON, type ExpenseWarning } from "@/lib/expense-policy";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const REGULAR_CATEGORIES = [
  "Site Materials (small purchase)",
  "Food & Accommodation",
  "Labour Food & Transport",
  "Tools & Equipment",
  "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function LogExpenseDrawer({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [expenseType, setExpenseType] = useState<"regular" | "conveyance">("regular");

  // Common
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("none");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Regular
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptFromGallery, setReceiptFromGallery] = useState(false);
  const [noReceipt, setNoReceipt] = useState(false);
  const [noReceiptReason, setNoReceiptReason] = useState("");
  const [vendor, setVendor] = useState("");
  const [billNo, setBillNo] = useState("");
  const [pendingWarnings, setPendingWarnings] = useState<ExpenseWarning[] | null>(null);
  const [warningReason, setWarningReason] = useState("");

  // Conveyance
  const [vehicleType, setVehicleType] = useState("car");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [conveyanceNotes, setConveyanceNotes] = useState("");
  const [carRate, setCarRate] = useState(9.5);
  const [bikeRate, setBikeRate] = useState(3.5);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      supabase.from("projects").select("id, name").eq("is_archived", false),
      supabase.from("hr_settings").select("key, value").in("key", ["car_rate_per_km", "bike_rate_per_km"]),
      supabase.rpc("get_my_profile_pii").maybeSingle(),
    ]).then(([projRes, ratesRes, profRes]) => {
      setProjects((projRes.data ?? []) as any[]);
      (ratesRes.data ?? []).forEach((r: any) => {
        if (r.key === "car_rate_per_km") setCarRate(Number(r.value) || 9.5);
        if (r.key === "bike_rate_per_km") setBikeRate(Number(r.value) || 3.5);
      });
      if ((profRes.data as any)?.home_base) setFromLocation((profRes.data as any).home_base);
    });
  }, [open, user?.id]);

  useEffect(() => { setPendingWarnings(null); }, [entryDate, amount, vendor, billNo, receiptFile, noReceipt, expenseType, distanceKm]);

  const conveyanceRate = vehicleType === "car" ? carRate : bikeRate;
  const conveyanceAmount = distanceKm ? (Number(distanceKm) * conveyanceRate) : 0;

  const resetForm = () => {
    setExpenseType("regular");
    setEntryDate(new Date());
    setProjectId("none");
    setCategory("");
    setAmount("");
    setDescription("");
    setReceiptFile(null);
    setReceiptFromGallery(false);
    setNoReceipt(false);
    setNoReceiptReason("");
    setVendor("");
    setBillNo("");
    setPendingWarnings(null);
    setWarningReason("");
    setVehicleType("car");
    setToLocation("");
    setDistanceKm("");
    setConveyanceNotes("");
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (expenseType === "regular" && (!amount || !category || !description.trim())) {
      toast.error("Fill all required fields");
      return;
    }
    if (expenseType === "conveyance" && (!distanceKm || !toLocation.trim())) {
      toast.error("Fill distance and destination");
      return;
    }
    const isRegular = expenseType === "regular";
    const receiptMissing = isRegular && !receiptFile;
    if (receiptMissing && !(noReceipt && reasonOk(noReceiptReason))) {
      toast.error(`Add a receipt photo, or tick "No receipt" and type a reason (at least ${MIN_REASON} characters)`);
      return;
    }
    const finalAmt = isRegular ? Number(amount) : conveyanceAmount;
    // Policy checks — warnings only; a reason must be recorded before saving.
    if (pendingWarnings === null) {
      setSubmitting(true);
      const dup = isRegular ? await isDuplicate(vendor, billNo, finalAmt) : false;
      setSubmitting(false);
      const w = computeWarnings({ entryDate, receiptMissing, duplicate: dup, categoryCap: null, amount: finalAmt });
      if (w.length > 0) {
        setPendingWarnings(w);
        if (receiptMissing && !warningReason) setWarningReason(noReceiptReason.trim());
        return;
      }
    } else if (pendingWarnings.length > 0 && !reasonOk(warningReason)) {
      toast.error(`Type a reason for the warnings (at least ${MIN_REASON} characters)`);
      return;
    }

    setSubmitting(true);
    try {
      let receipt: { path: string; exifAt: string | null; flags: string[] } | null = null;
      if (expenseType === "regular" && receiptFile) {
        try {
          receipt = await uploadReceipt(user.id, receiptFile, receiptFromGallery);
        } catch (upErr) {
          console.error("receipt upload failed", upErr);
          toast.error("Receipt upload failed — check your connection and try again");
          setSubmitting(false);
          return;
        }
      }
      const warnings = pendingWarnings ?? [];
      const missing = expenseType === "regular" && !receipt;

      const now = new Date();
      const day = now.getDate();
      const month = now.getMonth(); // 0-indexed
      const year = now.getFullYear();
      // Determine report period
      let reportPeriod: string;
      if (entryDate.getDate() <= 15) {
        reportPeriod = `${format(entryDate, "yyyy-MM")}-first-half`;
      } else {
        reportPeriod = `${format(entryDate, "yyyy-MM")}-second-half`;
      }

      const finalAmount = expenseType === "conveyance" ? conveyanceAmount : Number(amount);

      const { error } = await supabase.from("expense_entries").insert({
        submitted_by: user.id,
        entry_date: format(entryDate, "yyyy-MM-dd"),
        expense_type: expenseType,
        category: expenseType === "regular" ? category : "Conveyance",
        amount: finalAmount,
        project_id: projectId === "none" ? null : projectId,
        description: expenseType === "regular" ? description.trim() : `${fromLocation} → ${toLocation}`,
        receipt_url: null,
        receipt_path: receipt?.path ?? null,
        receipt_exif_at: receipt?.exifAt ?? null,
        receipt_flags: missing ? ["receipt_missing"] : (receipt?.flags ?? []),
        policy_warnings: warnings,
        warning_reason: warnings.length ? (warningReason.trim() || noReceiptReason.trim()) : (missing ? noReceiptReason.trim() : null),
        vendor: expenseType === "regular" ? (vendor.trim() || null) : null,
        bill_no: expenseType === "regular" ? (billNo.trim() || null) : null,
        vehicle_type: expenseType === "conveyance" ? vehicleType : null,
        from_location: expenseType === "conveyance" ? fromLocation : null,
        to_location: expenseType === "conveyance" ? toLocation : null,
        distance_km: expenseType === "conveyance" ? Number(distanceKm) : null,
        rate_per_km: expenseType === "conveyance" ? conveyanceRate : null,
        status: "draft",
        report_period: reportPeriod,
      } as any);

      if (error) throw error;
      toast.success("Expense logged as draft ✓");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("expense save failed", err);
      toast.error("Could not save the expense. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display" style={{ color: "#1A1A1A" }}>Log Expense</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={expenseType === "regular" ? "default" : "outline"}
              onClick={() => setExpenseType("regular")}
              style={expenseType === "regular" ? { backgroundColor: "#006039" } : {}}
              className={expenseType === "regular" ? "text-white" : ""}
            >
              Regular Expense
            </Button>
            <Button
              size="sm"
              variant={expenseType === "conveyance" ? "default" : "outline"}
              onClick={() => setExpenseType("conveyance")}
              style={expenseType === "conveyance" ? { backgroundColor: "#006039" } : {}}
              className={expenseType === "conveyance" ? "text-white" : ""}
            >
              Conveyance Claim
            </Button>
          </div>

          {/* Date */}
          <div>
            <Label className="text-xs font-inter" style={{ color: "#666" }}>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-inter mt-1")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(entryDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={entryDate} onSelect={(d) => d && setEntryDate(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {expenseType === "regular" ? (
            <>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1 font-inter"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {REGULAR_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="font-inter">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Amount (₹) *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="mt-1 font-inter" style={{ fontSize: 15 }} />
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Project (optional)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1 font-inter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-inter">Not project-specific</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id} className="font-inter">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Description * (max 150 chars)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 150))} placeholder="Briefly describe" className="mt-1 font-inter" rows={3} style={{ fontSize: 15 }} />
                <p className="text-[10px] mt-1" style={{ color: "#999" }}>{description.length}/150</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-inter" style={{ color: "#666" }}>Vendor</Label>
                  <Input value={vendor} onChange={(e) => setVendor(e.target.value.slice(0, 80))} placeholder="Shop / supplier" className="mt-1 font-inter" style={{ fontSize: 15 }} />
                </div>
                <div>
                  <Label className="text-xs font-inter" style={{ color: "#666" }}>Bill number</Label>
                  <Input value={billNo} onChange={(e) => setBillNo(e.target.value.slice(0, 40))} placeholder="Bill no." className="mt-1 font-inter" style={{ fontSize: 15 }} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Receipt photo *</Label>
                {receiptFile ? (
                  <div className="flex items-center justify-between gap-2 border border-border rounded-md p-2 mt-1">
                    <span className="text-xs font-inter truncate min-w-0">{receiptFile.name}{receiptFromGallery ? " (gallery)" : ""}</span>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setReceiptFile(null)}>Change</Button>
                  </div>
                ) : !noReceipt && (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <label className="flex items-center justify-center gap-2 cursor-pointer border border-dashed border-border rounded-md p-3 hover:bg-muted/50">
                      <Camera className="h-4 w-4" style={{ color: "#006039" }} />
                      <span className="text-sm font-inter">Camera</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReceiptFile(f); setReceiptFromGallery(false); } e.target.value = ""; }} />
                    </label>
                    <label className="flex items-center justify-center gap-2 cursor-pointer border border-dashed border-border rounded-md p-3 hover:bg-muted/50">
                      <ImageIcon className="h-4 w-4" style={{ color: "#006039" }} />
                      <span className="text-sm font-inter">Gallery</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setReceiptFile(f); setReceiptFromGallery(true); } e.target.value = ""; }} />
                    </label>
                  </div>
                )}
                {!receiptFile && (
                  <label className="flex items-center gap-2 mt-2 text-xs font-inter" style={{ color: "#666" }}>
                    <input type="checkbox" checked={noReceipt} onChange={(e) => setNoReceipt(e.target.checked)} />
                    No receipt available
                  </label>
                )}
                {!receiptFile && noReceipt && (
                  <div className="mt-1">
                    <Input value={noReceiptReason} onChange={(e) => setNoReceiptReason(e.target.value.slice(0, 200))} placeholder="Why is there no receipt? (min 5 characters)" className="font-inter" style={{ fontSize: 15 }} />
                    <p className="text-[10px] mt-1" style={{ color: "#D4860A" }}>This entry will be marked "Receipt missing".</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Vehicle Type *</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="mt-1 font-inter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="car" className="font-inter">Car</SelectItem>
                    <SelectItem value="bike" className="font-inter">Bike</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>From Location</Label>
                <Input value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} placeholder="Home base" className="mt-1 font-inter" style={{ fontSize: 15 }} />
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>To Location *</Label>
                <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} placeholder="Destination" className="mt-1 font-inter" style={{ fontSize: 15 }} />
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Project / Purpose</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1 font-inter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="font-inter">Other — specify in notes</SelectItem>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id} className="font-inter">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Distance (km) *</Label>
                <Input type="number" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="0" className="mt-1 font-inter" style={{ fontSize: 15 }} />
              </div>
              <div className="rounded-md p-3 border border-border" style={{ backgroundColor: "#E8F2ED" }}>
                <p className="text-xs font-inter" style={{ color: "#006039" }}>
                  Amount (₹): <span className="font-bold text-base">₹{conveyanceAmount.toFixed(2)}</span>
                </p>
                <p className="text-[10px] mt-1" style={{ color: "#666" }}>
                  {distanceKm || 0} km × ₹{conveyanceRate} = ₹{conveyanceAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Notes (optional, 100 chars)</Label>
                <Input value={conveyanceNotes} onChange={(e) => setConveyanceNotes(e.target.value.slice(0, 100))} placeholder="Optional notes" className="mt-1 font-inter" style={{ fontSize: 15 }} />
              </div>
            </>
          )}

          {pendingWarnings && pendingWarnings.length > 0 && (
            <div className="rounded-md p-3 border space-y-2" style={{ backgroundColor: "#FFF8E8", borderColor: "#D4860A" }}>
              <p className="text-xs font-semibold flex items-center gap-1" style={{ color: "#7a5c00" }}><AlertTriangle className="h-3.5 w-3.5" /> Please check before saving</p>
              <ul className="text-xs list-disc pl-4" style={{ color: "#7a5c00" }}>
                {pendingWarnings.map((w) => <li key={w}>{WARNING_LABELS[w]}</li>)}
              </ul>
              <Textarea value={warningReason} onChange={(e) => setWarningReason(e.target.value.slice(0, 300))} placeholder="Reason (required, min 5 characters)" rows={2} className="font-inter" style={{ fontSize: 15 }} />
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-4 text-white"
            style={{ backgroundColor: "#006039" }}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {pendingWarnings && pendingWarnings.length > 0 ? "Save with reason" : "Save as Draft"}
          </Button>
          <p className="text-[10px] text-center" style={{ color: "#999" }}>
            Drafts can be submitted during the next submission window.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
