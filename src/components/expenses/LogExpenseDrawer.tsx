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
import { CalendarIcon, Loader2, Upload } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSubmissionWindow } from "@/lib/expense-utils";

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
      supabase.from("profiles").select("home_base").eq("auth_user_id", user?.id ?? "").single(),
    ]).then(([projRes, ratesRes, profRes]) => {
      setProjects((projRes.data ?? []) as any[]);
      (ratesRes.data ?? []).forEach((r: any) => {
        if (r.key === "car_rate_per_km") setCarRate(Number(r.value) || 9.5);
        if (r.key === "bike_rate_per_km") setBikeRate(Number(r.value) || 3.5);
      });
      if (profRes.data?.home_base) setFromLocation(profRes.data.home_base);
    });
  }, [open, user?.id]);

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

    setSubmitting(true);
    try {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `expense-receipts/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("site-photos").upload(path, receiptFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
          receiptUrl = urlData.publicUrl;
        }
      }

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
        receipt_url: receiptUrl,
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
      toast.error(err.message || "Failed to save");
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
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 font-inter"
                  style={{ fontSize: 15, borderColor: Number(amount) > 5000 ? "#D4860A" : undefined, backgroundColor: Number(amount) > 5000 ? "#FFF8E8" : undefined }}
                />
                {Number(amount) > 5000 && (
                  <p className="text-[10px] mt-1 font-medium" style={{ color: "#D4860A" }}>
                    ⚠ Amount exceeds ₹5,000 — this expense will be flagged for Finance review.
                  </p>
                )}
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
              <div>
                <Label className="text-xs font-inter" style={{ color: "#666" }}>Receipt Photo (optional)</Label>
                <p className="text-[10px] mb-1" style={{ color: "#999" }}>Attach receipt for faster approval</p>
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-md p-3 hover:bg-muted/50 transition-colors">
                  <Upload className="h-4 w-4" style={{ color: "#006039" }} />
                  <span className="text-sm font-inter" style={{ color: "#666" }}>{receiptFile ? receiptFile.name : "Choose file"}</span>
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
                </label>
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

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full mt-4 text-white"
            style={{ backgroundColor: "#006039" }}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save as Draft
          </Button>
          {(() => {
            const win = getSubmissionWindow();
            return win.isOpen ? (
              <p className="text-[10px] text-center font-inter" style={{ color: "#006039" }}>
                {win.label}
              </p>
            ) : (
              <p className="text-[10px] text-center font-inter" style={{ color: "#999" }}>
                Next submission window: {win.nextWindow}
              </p>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
