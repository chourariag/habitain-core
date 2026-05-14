import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Receipt, Trash2, Info } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ExpenseExcelUpload } from "./ExpenseExcelUpload";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: "#666", bg: "#F7F7F7" },
  pending_hr: { color: "#D4860A", bg: "#FFF8E8" },
  pending_hod: { color: "#D4860A", bg: "#FFF8E8" },
  pending_finance: { color: "#D4860A", bg: "#FFF8E8" },
  flagged: { color: "#D4860A", bg: "#FFF8E8" },
  approved: { color: "#006039", bg: "#E8F2ED" },
  rejected: { color: "#F40009", bg: "#FEE2E2" },
  paid: { color: "#006039", bg: "#E8F2ED" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_hr: "Submitted — HR Review",
  pending_hod: "HR Approved — Pending Finance",
  pending_finance: "HR Approved — Pending Finance",
  flagged: "Flagged — Action Required",
  approved: "Approved for Payment",
  rejected: "Rejected",
  paid: "Paid",
};

type WindowState = {
  isOpen: boolean;
  statusLabel: string;
  nextSubmitDate: string;
};

function getSubmissionWindow(): WindowState {
  const now = new Date();
  const day = now.getDate();
  const monthLabel = format(now, "MMMM yyyy");
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  if (day >= 1 && day <= 5) {
    return { isOpen: true, statusLabel: `Submission window open — closes on 5th ${monthLabel}. Drafts auto-submitted today.`, nextSubmitDate: `5th ${monthLabel}` };
  }
  if (day >= 16 && day <= 20) {
    return { isOpen: true, statusLabel: `Submission window open — closes on 20th ${monthLabel}. Drafts auto-submitted today.`, nextSubmitDate: `20th ${monthLabel}` };
  }
  if (day < 16) {
    return { isOpen: false, statusLabel: `Submission window closed. Next window opens on 16th ${monthLabel}.`, nextSubmitDate: `20th ${monthLabel}` };
  }
  return { isOpen: false, statusLabel: `Submission window closed. Next window opens on 1st ${format(nextMonth, "MMMM yyyy")}.`, nextSubmitDate: `5th ${format(nextMonth, "MMMM yyyy")}` };
}

export function MyExpenses() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("expense_entries").select("*").eq("submitted_by", user.id).order("entry_date", { ascending: false });
    setEntries((data ?? []) as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Client-side auto-submit fallback. The pg_cron job is the primary path
  // (runs at 00:05 on the 5th and 20th); this catches drafts logged later
  // the same day or by employees who don't open the app on cron day.
  useEffect(() => {
    if (!user || loading) return;
    const win = getSubmissionWindow();
    if (!win.isOpen) return;
    const draftIds = entries.filter((e) => e.status === "draft").map((e) => e.id);
    if (draftIds.length === 0) return;
    (async () => {
      const { error } = await supabase
        .from("expense_entries")
        .update({ status: "pending_hr" } as any)
        .in("id", draftIds);
      if (!error) {
        toast.success(`${draftIds.length} draft expense${draftIds.length > 1 ? "s" : ""} auto-submitted ✓`);
        fetchData();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, entries.length]);

  const drafts = entries.filter((e) => e.status === "draft");
  const totalThisMonth = entries
    .filter((e) => format(new Date(e.entry_date), "yyyy-MM") === format(new Date(), "yyyy-MM"))
    .reduce((s, e) => s + Number(e.amount), 0);
  const win = getSubmissionWindow();

  const handleDelete = async (id: string) => {
    await supabase.from("expense_entries").delete().eq("id", id);
    toast.success("Draft deleted");
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> My Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Drafts info banner — auto-submission is handled by the system */}
          {drafts.length > 0 && (
            <div className="rounded-md p-3 border" style={{ backgroundColor: "#FFF8E8", borderColor: "#D4860A" }}>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5" style={{ color: "#D4860A" }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: "#7a5c00" }}>
                    You have {drafts.length} draft expense{drafts.length > 1 ? "s" : ""}.
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#7a5c00" }}>
                    These will be automatically submitted on {win.nextSubmitDate}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Read-only window status */}
          <div className="rounded-md p-2 text-xs font-inter" style={{ backgroundColor: win.isOpen ? "#E8F2ED" : "#F7F7F7", color: win.isOpen ? "#006039" : "#666" }}>
            {win.statusLabel}
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <div><span style={{ color: "#666" }}>This Month:</span> <span className="font-mono font-bold" style={{ color: "#006039" }}>₹{totalThisMonth.toLocaleString("en-IN")}</span></div>
            <div><span style={{ color: "#666" }}>Drafts:</span> <span className="font-mono font-bold">{drafts.length}</span></div>
          </div>

          {entries.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#999" }}>No expenses logged yet.</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {entries.slice(0, 20).map((e) => {
                const sc = STATUS_COLORS[e.status] || STATUS_COLORS.draft;
                const isDraft = e.status === "draft";
                return (
                  <div key={e.id} className="flex items-center justify-between flex-wrap gap-2 p-2 rounded-md border border-border bg-white text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" style={{ color: "#1A1A1A" }}>{e.expense_type === "conveyance" ? `🚗 ${e.description}` : e.category}</p>
                      <p style={{ color: "#999" }}>{format(new Date(e.entry_date), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-bold font-inter" style={{ color: "#006039" }}>₹{Number(e.amount).toLocaleString("en-IN")}</span>
                      <Badge variant="outline" className="text-[10px]" style={{ color: sc.color, borderColor: sc.color, backgroundColor: sc.bg }}>{STATUS_LABELS[e.status] || e.status}</Badge>
                      {isDraft && (
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDelete(e.id)} title="Delete draft">
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

      {/* Excel Upload */}
      <ExpenseExcelUpload />
    </>
  );
}
