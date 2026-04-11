import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Receipt, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getSubmissionWindow } from "@/lib/expense-utils";

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

export function MyExpenses() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [flagResponses, setFlagResponses] = useState<Record<string, string>>({});

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

  const handleFlagResponse = async (id: string) => {
    const response = flagResponses[id];
    if (!response?.trim()) return;
    await supabase.from("expense_entries").update({ hr_flag_response: response.trim() } as any).eq("id", id);
    toast.success("Response sent to HR ✓");
    setFlagResponses((prev) => ({ ...prev, [id]: "" }));
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
            {entries.map((e) => {
              const sc = STATUS_COLORS[e.status] || STATUS_COLORS.draft;
              return (
                <div key={e.id} className="flex flex-col gap-1 p-2 rounded-md border border-border bg-white text-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
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
                  {e.hr_flag_note && (
                    <div className="rounded-md p-2 border" style={{ backgroundColor: "#FFF8E8" }}>
                      <p className="text-[10px] font-semibold" style={{ color: "#D4860A" }}>HR query: {e.hr_flag_note}</p>
                      {e.hr_flag_response ? (
                        <p className="text-[10px] mt-0.5" style={{ color: "#006039" }}>Your response: {e.hr_flag_response}</p>
                      ) : (
                        <div className="mt-1 flex gap-1">
                          <Input
                            placeholder="Your response..."
                            value={flagResponses[e.id] || ""}
                            onChange={(ev) => setFlagResponses((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                            className="h-6 text-[10px] font-inter"
                          />
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2 text-white"
                            style={{ backgroundColor: "#006039" }}
                            onClick={() => handleFlagResponse(e.id)}
                            disabled={!flagResponses[e.id]?.trim()}
                          >
                            Send
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
