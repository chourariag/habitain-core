import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthedClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  drawing: any;
  isArchitect: boolean;
  userId: string | null;
  userName: string;
  onRefresh: () => void;
}

export function DrawingApprovalSheet({ drawing, isArchitect, userId, userName, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    approval_method: "Email",
    approval_date: new Date().toISOString().split("T")[0],
    approval_reference: "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const statusStyle = (s: string) => {
    if (s === "approved") return { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))", border: "none" };
    if (s === "revision_requested") return { backgroundColor: "hsl(36 88% 44% / 0.15)", color: "hsl(var(--warning))", border: "none" };
    if (s === "superseded") return { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none" };
    return { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "none" };
  };

  const statusLabel = (s: string) => ({
    pending_review: "Pending Client Review",
    approved: "Approved",
    revision_requested: "Revision Requested",
    superseded: "Superseded",
  }[s] ?? s);

  const handleApprove = async () => {
    setSaving(true);
    try {
      let screenshotUrl = null;
      if (screenshot) {
        const path = `approval-screenshots/${drawing.id}/${Date.now()}.${screenshot.name.split(".").pop()}`;
        await supabase.storage.from("design-files").upload(path, screenshot);
        screenshotUrl = supabase.storage.from("design-files").getPublicUrl(path).data.publicUrl;
      }

      const { client } = await getAuthedClient();
      await (client.from("drawings") as any).update({
        approval_status: "approved",
        approval_method: form.approval_method,
        approval_date: form.approval_date,
        approval_reference: form.approval_reference || null,
        approval_screenshot_url: screenshotUrl,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approved_by_name: userName,
      }).eq("id", drawing.id);

      toast.success("Drawing marked as approved");
      setOpen(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" style={statusStyle(drawing.approval_status || "pending_review")} className="text-[10px]">
          {statusLabel(drawing.approval_status || "pending_review")}
        </Badge>
        {drawing.approval_status === "approved" && drawing.approved_by_name && (
          <span className="text-[9px]" style={{ color: "hsl(var(--muted-foreground))" }}>
            by {drawing.approved_by_name} {drawing.approval_date && `on ${format(new Date(drawing.approval_date), "dd MMM")}`}
          </span>
        )}
        {isArchitect && drawing.status === "active" && drawing.approval_status !== "approved" && (
          <Button size="sm" variant="outline" className="text-[10px] h-6 px-2" onClick={() => setOpen(true)}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
          </Button>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Mark Drawing as Approved</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm font-medium">{drawing.drawing_id_code} — R{drawing.revision}</p>
            <div>
              <Label className="text-xs">Approval Method</Label>
              <Select value={form.approval_method} onValueChange={(v) => setForm({ ...form, approval_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date of Approval</Label>
              <Input type="date" value={form.approval_date} onChange={(e) => setForm({ ...form, approval_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Reference (email subject / WhatsApp date)</Label>
              <Input value={form.approval_reference} onChange={(e) => setForm({ ...form, approval_reference: e.target.value })} placeholder="Optional reference" />
            </div>
            <div>
              <Label className="text-xs">Screenshot of Approval (optional)</Label>
              <Input type="file" accept="image/*" onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" style={{ backgroundColor: "hsl(var(--primary))" }} onClick={handleApprove} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Approval
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
