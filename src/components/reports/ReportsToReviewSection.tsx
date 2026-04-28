import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export function ReportsToReviewSection() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles").select("id, role").eq("auth_user_id", user.id).maybeSingle();
    if (!profile) { setLoading(false); return; }

    const { data: subs } = await supabase
      .from("weekly_report_submissions")
      .select("*, weekly_report_configs!inner(report_name, reviewer_user_id, reviewer_role)")
      .order("submitted_at", { ascending: false })
      .limit(50);

    const mine = (subs || []).filter((s: any) => {
      const c = s.weekly_report_configs;
      return c && (c.reviewer_user_id === profile.id || c.reviewer_role === profile.role);
    });

    // Enrich submitter names
    const submitterIds = Array.from(new Set(mine.map((s: any) => s.submitted_by)));
    const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", submitterIds.length ? submitterIds : ["00000000-0000-0000-0000-000000000000"]);
    const map = new Map((profs || []).map((p: any) => [p.id, p.display_name]));
    setRows(mine.map((s: any) => ({ ...s, _submitter: map.get(s.submitted_by) || "—" })));
    setLoading(false);
  }
  useEffect(() => { load(); }, [user?.id]);

  async function markReviewed() {
    if (!open) return;
    setSaving(true);
    const { data: prof } = await supabase.from("profiles").select("id").eq("auth_user_id", user!.id).maybeSingle();
    const { error } = await supabase.from("weekly_report_submissions").update({
      reviewed_by: prof?.id, reviewed_at: new Date().toISOString(),
      reviewer_comment: comment || null,
    }).eq("id", open.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as reviewed"); setOpen(null); setComment(""); load();
  }

  if (loading) return <Loader2 className="animate-spin h-5 w-5" />;
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Reports to Review</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="min-w-0">
              <div className="font-medium text-sm">{r.weekly_report_configs.report_name}</div>
              <div className="text-xs text-muted-foreground">
                {r._submitter} · {format(new Date(r.report_period_start), "dd/MM/yyyy")} – {format(new Date(r.report_period_end), "dd/MM/yyyy")}
                {" · "}
                <Badge style={{ backgroundColor: r.status === "on_time" ? "#006039" : r.status === "late" ? "#D4860A" : "#F40009", color: "white" }}>{r.status}</Badge>
              </div>
            </div>
            <Button size="sm" variant={r.reviewed_at ? "outline" : "default"} onClick={() => { setOpen(r); setComment(r.reviewer_comment || ""); }}
              style={!r.reviewed_at ? { backgroundColor: "#006039" } : undefined}>
              {r.reviewed_at ? "View" : "Review"}
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{open?.weekly_report_configs.report_name}</DialogTitle>
            <p className="text-sm text-muted-foreground">{open?._submitter} · submitted {open && format(new Date(open.submitted_at), "dd/MM/yyyy HH:mm")}</p>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <Section label="Accomplishments">{open.accomplishments}</Section>
              <Section label="Next week plan">{open.next_week_plan}</Section>
              {open.risks_blockers && <Section label="Risks / blockers">{open.risks_blockers}</Section>}
              {open.action_needed && <Section label="Action needed">{open.action_needed}</Section>}
              <div>
                <label className="text-sm font-medium">Reviewer comment (optional)</label>
                <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} disabled={!!open.reviewed_at} />
              </div>
              {open.reviewed_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Reviewed {format(new Date(open.reviewed_at), "dd/MM/yyyy HH:mm")}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
            {open && !open.reviewed_at && (
              <Button onClick={markReviewed} disabled={saving} style={{ backgroundColor: "#006039" }}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Mark as Reviewed
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Section({ label, children }: any) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase">{label}</div>
      <div className="whitespace-pre-wrap mt-1">{children}</div>
    </div>
  );
}
