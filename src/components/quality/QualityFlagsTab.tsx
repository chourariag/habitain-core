import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Flag } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

const ACTION_ROLES = ["qc_inspector", "production_head", "managing_director", "super_admin", "head_operations"];

export function QualityFlagsTab() {
  const { user } = useAuth();
  const { role } = useUserRole();
  const canAction = ACTION_ROLES.includes(role ?? "");

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ id: string; mode: "ncr" | "dismiss" | "resolve" } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("quality_flags").select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status !== "open");

  // Weekly count for KPI
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = rows.filter((r) => new Date(r.created_at) >= weekStart && new Date(r.created_at) <= weekEnd).length;
  const kpiOk = thisWeek >= 2;

  const submitAction = async () => {
    if (!actionDialog || !user) return;
    if (actionDialog.mode !== "resolve" && !note.trim()) { toast.error("Note required"); return; }
    const status =
      actionDialog.mode === "ncr" ? "converted_to_ncr" :
      actionDialog.mode === "dismiss" ? "dismissed" : "resolved";
    const { error } = await (supabase as any).from("quality_flags").update({
      status,
      tagore_action: actionDialog.mode,
      tagore_note: note.trim() || null,
      actioned_by: user.id,
      actioned_at: new Date().toISOString(),
    }).eq("id", actionDialog.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Flag actioned");
    setActionDialog(null); setNote("");
    load();
  };

  return (
    <div className="space-y-4">
      {/* KPI tile */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: `3px solid ${kpiOk ? "#006039" : "#F40009"}` }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Flags this week</p>
          <p className="text-2xl font-bold font-display" style={{ color: kpiOk ? "#006039" : "#F40009" }}>{thisWeek}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Target ≥ 2/week (Rakesh KPI)</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: "3px solid #D4860A" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Open flags</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#D4860A" }}>{open.length}</p>
        </div>
        <div className="rounded-lg border border-border p-4 bg-card" style={{ borderLeft: "3px solid #006039" }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Actioned (total)</p>
          <p className="text-2xl font-bold font-display" style={{ color: "#006039" }}>{closed.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Flag className="h-4 w-4" style={{ color: "#D4860A" }}/> Open Flags</h3>
          {open.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No open flags. Good observation discipline.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {open.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold" style={{ color: "#1A1A1A" }}>{r.bay_label || `Bay ${r.bay_number ?? "—"}`}</span>
                          <Badge variant="outline" className="text-[10px]" style={{
                            color: r.severity === "stop_work" ? "#F40009" : r.severity === "review" ? "#D4860A" : "#006039",
                            borderColor: r.severity === "stop_work" ? "#F40009" : r.severity === "review" ? "#D4860A" : "#006039",
                          }}>
                            {r.severity === "stop_work" ? "Stop work" : r.severity === "review" ? "Needs review" : "Minor"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "dd/MM hh:mm a")}</span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: "#1A1A1A" }}>{r.observation}</p>
                      </div>
                    </div>
                    {canAction && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => { setActionDialog({ id: r.id, mode: "ncr" }); setNote(""); }} className="text-xs">Convert to NCR</Button>
                        <Button size="sm" variant="outline" onClick={() => { setActionDialog({ id: r.id, mode: "resolve" }); setNote(""); }} className="text-xs">Resolve</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setActionDialog({ id: r.id, mode: "dismiss" }); setNote(""); }} className="text-xs text-muted-foreground">Dismiss</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <h3 className="text-sm font-semibold mt-4">Recent Actions</h3>
          {closed.length === 0 ? (
            <p className="text-xs text-muted-foreground">None yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead><tr style={{ backgroundColor: "#F7F7F7" }}>
                  {["Bay", "Observation", "Severity", "Outcome", "Note", "When"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {closed.slice(0, 60).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 text-xs">{r.bay_label || `Bay ${r.bay_number ?? "—"}`}</td>
                      <td className="px-3 py-2 text-xs max-w-[280px]">{r.observation}</td>
                      <td className="px-3 py-2 text-xs">{r.severity}</td>
                      <td className="px-3 py-2 text-xs font-semibold">{r.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.tagore_note || "—"}</td>
                      <td className="px-3 py-2 text-xs">{r.actioned_at ? format(new Date(r.actioned_at), "dd/MM hh:mm a") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(v) => { if (!v) { setActionDialog(null); setNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>
            {actionDialog?.mode === "ncr" ? "Convert to NCR" : actionDialog?.mode === "dismiss" ? "Dismiss flag" : "Mark resolved"}
          </DialogTitle></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
            placeholder={actionDialog?.mode === "resolve" ? "Optional note" : "Reason / note (required)"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setNote(""); }}>Cancel</Button>
            <Button onClick={submitAction} disabled={actionDialog?.mode !== "resolve" && !note.trim()}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
