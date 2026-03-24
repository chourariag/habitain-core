import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Receipt, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#666", bg: "#F7F7F7" },
  pending_hr: { color: "#D4860A", bg: "#FFF8E8" },
  pending_hod: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  paid: { color: "#006039", bg: "#E8F2ED" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_hr: "Awaiting HR",
  pending_hod: "Awaiting HOD",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

function getSubmissionWindow(): { isOpen: boolean; label: string; nextWindow: string } {
  const now = new Date();
  const day = now.getDate();
  // Window 1: 1st–5th — submit second-half expenses from last month
  if (day >= 1 && day <= 5) return { isOpen: true, label: "Submit expenses for 16th–end of last month", nextWindow: "" };
  // Window 2: 16th–20th — submit first-half expenses from this month
  if (day >= 16 && day <= 20) return { isOpen: true, label: "Submit expenses for 1st–15th of this month", nextWindow: "" };
  // Between 6th–15th: next window opens on the 16th of this month
  if (day >= 6 && day <= 15) return { isOpen: false, label: "", nextWindow: `16th–20th ${format(now, "MMMM")}` };
  // After 20th: next window opens on the 1st–5th of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { isOpen: false, label: "", nextWindow: `1st–5th ${format(nextMonth, "MMMM yyyy")}` };
}

export function MyExpenses() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("expense_entries").select("*").eq("submitted_by", user.id).order("entry_date", { ascending: false });
    setEntries((data ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const drafts = entries.filter((e) => e.status === "draft");
  const totalThisMonth = entries.filter((e) => format(new Date(e.entry_date), "yyyy-MM") === format(new Date(), "yyyy-MM")).reduce((s, e) => s + Number(e.amount), 0);
  const window = getSubmissionWindow();

  const handleSubmitAll = async () => {
    if (!drafts.length) return;
    setSubmitting(true);
    for (const d of drafts) {
      await supabase.from("expense_entries").update({ status: "pending_hr" } as any).eq("id", d.id);
    }
    toast.success(`${drafts.length} expenses submitted for HR review ✓`);
    setSubmitting(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expense_entries").delete().eq("id", id);
    toast.success("Draft deleted");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> My Expenses</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm">
          <div><span style={{ color: "#666" }}>This Month:</span> <span className="font-mono font-bold" style={{ color: "#006039" }}>₹{totalThisMonth.toLocaleString("en-IN")}</span></div>
          <div><span style={{ color: "#666" }}>Drafts:</span> <span className="font-mono font-bold">{drafts.length}</span></div>
        </div>
        {drafts.length > 0 && (
          <div className="rounded-md p-3 border border-border" style={{ backgroundColor: window.isOpen ? "#E8F2ED" : "#F7F7F7" }}>
            {window.isOpen ? (
              <>
                <p className="text-xs mb-2" style={{ color: "#006039" }}>{window.label}</p>
                <Button size="sm" onClick={handleSubmitAll} disabled={submitting} style={{ backgroundColor: "#006039" }} className="text-white gap-1">
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Submit {drafts.length} Draft{drafts.length > 1 ? "s" : ""} · ₹{drafts.reduce((s, d) => s + Number(d.amount), 0).toLocaleString("en-IN")}
                </Button>
              </>
            ) : (
              <p className="text-xs" style={{ color: "#999" }}>Next submission window: {window.nextWindow}</p>
            )}
          </div>
        )}
        {entries.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "#999" }}>No expenses logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {entries.slice(0, 20).map((e) => {
              const sc = STATUS_COLORS[e.status] || STATUS_COLORS.draft;
              return (
                <div key={e.id} className="flex items-center justify-between flex-wrap gap-2 p-2 rounded-md border border-border bg-white text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: "#1A1A1A" }}>{e.expense_type === "conveyance" ? `🚗 ${e.description}` : e.category}</p>
                    <p style={{ color: "#999" }}>{format(new Date(e.entry_date), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold font-inter" style={{ color: "#006039" }}>₹{Number(e.amount).toLocaleString("en-IN")}</span>
                    <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>{STATUS_LABELS[e.status] || e.status}</Badge>
                    {e.status === "draft" && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(e.id)}>
                        <Trash2 className="h-3 w-3" style={{ color: "#F40009" }} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
