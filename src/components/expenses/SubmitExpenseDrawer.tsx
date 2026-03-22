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

const CATEGORIES = [
  "Fuel & Transport",
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

export function SubmitExpenseDrawer({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("projects").select("id, name").eq("is_archived", false).then(({ data }) => {
        setProjects((data ?? []) as { id: string; name: string }[]);
      });
    }
  }, [open]);

  const resetForm = () => {
    setAmount(""); setCategory(""); setProjectId("none");
    setDescription(""); setExpenseDate(new Date()); setReceiptFile(null);
  };

  const handleSubmit = async () => {
    if (!user || !amount || !category || !description.trim()) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      let receiptUrl: string | null = null;

      if (receiptFile) {
        const ext = receiptFile.name.split(".").pop();
        const path = `expense-receipts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("site-photos").upload(path, receiptFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("site-photos").getPublicUrl(path);
          receiptUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from("expense_reports").insert({
        submitted_by: user.id,
        amount: Number(amount),
        category,
        project_id: projectId === "none" ? null : projectId,
        description: description.trim(),
        receipt_url: receiptUrl,
        expense_date: format(expenseDate, "yyyy-MM-dd"),
      } as any);

      if (error) throw error;
      toast.success("Expense submitted ✓");
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    }
    setSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display" style={{ color: "#1A1A1A" }}>Submit Expense</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label className="text-xs font-inter" style={{ color: "#666" }}>Amount (₹) *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0" className="mt-1 font-inter" style={{ fontSize: 15 }} />
          </div>

          <div>
            <Label className="text-xs font-inter" style={{ color: "#666" }}>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1 font-inter"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="font-inter">{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 150))}
              placeholder="Briefly describe the expense" className="mt-1 font-inter" rows={3} style={{ fontSize: 15 }} />
            <p className="text-[10px] mt-1" style={{ color: "#999" }}>{description.length}/150</p>
          </div>

          <div>
            <Label className="text-xs font-inter" style={{ color: "#666" }}>Date of Expense</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-inter mt-1", !expenseDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(expenseDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={expenseDate} onSelect={(d) => d && setExpenseDate(d)}
                  className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-xs font-inter" style={{ color: "#666" }}>Receipt Photo (optional)</Label>
            <p className="text-[10px] mb-1" style={{ color: "#999" }}>Attach receipt for faster approval</p>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-md p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4" style={{ color: "#006039" }} />
              <span className="text-sm font-inter" style={{ color: "#666" }}>
                {receiptFile ? receiptFile.name : "Choose file"}
              </span>
              <input type="file" accept="image/jpeg,image/png" className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <Button onClick={handleSubmit} disabled={submitting || !amount || !category || !description.trim()}
            className="w-full mt-4 text-white" style={{ backgroundColor: "#006039" }}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit for Approval
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
