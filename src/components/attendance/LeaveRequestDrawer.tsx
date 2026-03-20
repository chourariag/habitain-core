import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { format, eachDayOfInterval, isSunday } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const LEAVE_TYPES = [
  { value: "casual", label: "Casual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "earned", label: "Earned Leave" },
  { value: "lop", label: "LOP (Loss of Pay)" },
  { value: "other", label: "Other" },
];

interface Props {
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function LeaveRequestDrawer({ onSuccess, trigger }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("casual");
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const daysCount = fromDate && toDate
    ? eachDayOfInterval({ start: fromDate, end: toDate }).filter((d) => !isSunday(d)).length
    : 0;

  const handleSubmit = async () => {
    if (!user || !fromDate || !toDate || !reason.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      user_id: user.id,
      leave_type: leaveType,
      from_date: format(fromDate, "yyyy-MM-dd"),
      to_date: format(toDate, "yyyy-MM-dd"),
      days_count: daysCount,
      reason: reason.trim(),
    });
    if (error) {
      toast.error("Failed to submit: " + error.message);
    } else {
      toast.success("Leave request submitted");
      setOpen(false);
      setLeaveType("casual");
      setFromDate(undefined);
      setToDate(undefined);
      setReason("");
      onSuccess?.();
    }
    setSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2" style={{ borderColor: "#006039", color: "#006039" }}>
            <Plus className="h-4 w-4" /> Apply for Leave
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Apply for Leave</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium font-inter" style={{ color: "#666" }}>Leave Type</label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium font-inter" style={{ color: "#666" }}>From</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !fromDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {fromDate ? format(fromDate, "dd/MM/yyyy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fromDate} onSelect={setFromDate} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium font-inter" style={{ color: "#666" }}>To</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !toDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {toDate ? format(toDate, "dd/MM/yyyy") : "Select"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={toDate} onSelect={setToDate} disabled={(d) => fromDate ? d < fromDate : false} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {daysCount > 0 && (
            <p className="text-sm font-semibold" style={{ color: "#006039" }}>
              {daysCount} working day{daysCount !== 1 ? "s" : ""} (excl. Sundays)
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium font-inter" style={{ color: "#666" }}>Reason</label>
            <Textarea placeholder="Reason for leave" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="font-inter text-[15px]" />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !fromDate || !toDate || !reason.trim() || daysCount === 0}
            className="w-full text-white"
            style={{ backgroundColor: "#006039" }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Submit Request
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
