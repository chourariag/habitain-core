import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FileText, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { computeDeadline, computePeriod, statusFromTimes, type ReportConfig } from "@/lib/weekly-reports";
import { formatDistanceToNowStrict } from "date-fns";
import { insertNotifications } from "@/lib/notifications";

type ConfigWithStatus = ReportConfig & {
  _deadline: Date;
  _period: { start: Date; end: Date; label: string };
  _submission?: any;
};

export function MyReportsSection({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ConfigWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCfg, setOpenCfg] = useState<ConfigWithStatus | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: profile } = await supabase
      .from("profiles").select("id, role").eq("auth_user_id", user.id).maybeSingle();
    if (!profile) { setLoading(false); return; }
    setProfileId(profile.id); setProfileRole(profile.role);

    const { data: cfgs } = await supabase
      .from("weekly_report_configs").select("*")
      .eq("active", true)
      .or(`assigned_user_id.eq.${profile.id},assigned_role.eq.${profile.role}`);

    const list: ConfigWithStatus[] = [];
    for (const c of cfgs || []) {
      const deadline = computeDeadline(c as any);
      const period = computePeriod(c as any);
      const { data: sub } = await supabase
        .from("weekly_report_submissions").select("*")
        .eq("config_id", c.id).eq("submitted_by", profile.id)
        .eq("report_period_start", period.start.toISOString().slice(0,10))
        .maybeSingle();
      list.push({ ...(c as any), _deadline: deadline, _period: period, _submission: sub });
    }
    setConfigs(list);
    setLoading(false);
  }
  useEffect(() => { load(); }, [user?.id]);

  if (loading) return <Loader2 className="animate-spin h-5 w-5" />;
  if (configs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: "#006039" }} /> My Weekly Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {configs.map((c) => {
          const submitted = !!c._submission;
          const now = new Date();
          const overdue = !submitted && now > c._deadline;
          return (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="min-w-0">
                <div className="font-medium text-sm">{c.report_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c._period.label}
                  {submitted ? (
                    <> · <Badge variant="secondary" className="text-[10px]">Submitted</Badge></>
                  ) : overdue ? (
                    <span className="text-[#F40009]"> · overdue</span>
                  ) : (
                    <> · due {formatDistanceToNowStrict(c._deadline, { addSuffix: true })}</>
                  )}
                </div>
              </div>
              <Button size="sm" onClick={() => setOpenCfg(c)} variant={submitted ? "outline" : "default"}
                style={!submitted ? { backgroundColor: overdue ? "#F40009" : "#006039" } : undefined}>
                {submitted ? "View" : "Submit"}
              </Button>
            </div>
          );
        })}
      </CardContent>

      <SubmissionDialog
        open={!!openCfg}
        config={openCfg}
        profileId={profileId}
        onClose={() => { setOpenCfg(null); load(); }}
      />
    </Card>
  );
}

function SubmissionDialog({ open, config, profileId, onClose }: any) {
  const [accomplishments, setAccomplishments] = useState("");
  const [nextWeek, setNextWeek] = useState("");
  const [risks, setRisks] = useState("");
  const [action, setAction] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config?._submission) {
      setAccomplishments(config._submission.accomplishments || "");
      setNextWeek(config._submission.next_week_plan || "");
      setRisks(config._submission.risks_blockers || "");
      setAction(config._submission.action_needed || "");
    } else {
      setAccomplishments(""); setNextWeek(""); setRisks(""); setAction("");
    }
  }, [config?.id, config?._submission?.id]);

  if (!config) return null;
  const readOnly = !!config._submission;

  async function submit() {
    if (accomplishments.trim().length < 20) { toast.error("Accomplishments must be at least 20 characters"); return; }
    if (!nextWeek.trim()) { toast.error("Next week plan required"); return; }
    setSaving(true);
    const submittedAt = new Date();
    const status = statusFromTimes(submittedAt, config._deadline);
    const { error } = await supabase.from("weekly_report_submissions").insert({
      config_id: config.id,
      submitted_by: profileId,
      report_period_start: config._period.start.toISOString().slice(0,10),
      report_period_end: config._period.end.toISOString().slice(0,10),
      accomplishments, next_week_plan: nextWeek,
      risks_blockers: risks || null,
      action_needed: action || null,
      submitted_at: submittedAt.toISOString(),
      deadline_at: config._deadline.toISOString(),
      status,
    });
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Notify reviewer(s)
    let reviewerAuthIds: string[] = [];
    if (config.reviewer_user_id) {
      const { data } = await supabase.from("profiles").select("auth_user_id").eq("id", config.reviewer_user_id).maybeSingle();
      if (data?.auth_user_id) reviewerAuthIds.push(data.auth_user_id);
    } else if (config.reviewer_role) {
      const { data } = await supabase.from("profiles").select("auth_user_id").eq("role", config.reviewer_role).eq("is_active", true);
      reviewerAuthIds = (data || []).map((d) => d.auth_user_id).filter(Boolean);
    }
    if (reviewerAuthIds.length > 0) {
      await insertNotifications(reviewerAuthIds.map((rid) => ({
        recipient_id: rid,
        title: "Weekly report submitted",
        body: `${config.report_name} submitted for ${config._period.label}. Tap to review.`,
        category: "weekly_report",
        related_table: "weekly_report_submissions",
        navigate_to: "/attendance",
      })));
    }

    setSaving(false);
    toast.success(status === "on_time" ? "Submitted on time ✓" : status === "late" ? "Submitted (late)" : "Submitted");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{config.report_name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{config._period.label}</p>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Key accomplishments this week <span className="text-[#F40009]">*</span></label>
            <Textarea rows={4} value={accomplishments} disabled={readOnly} onChange={(e) => setAccomplishments(e.target.value)} placeholder="What did you finish or move forward this week?" />
            {!readOnly && <p className="text-xs text-muted-foreground mt-1">{accomplishments.length}/20 minimum</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Plan for next week <span className="text-[#F40009]">*</span></label>
            <Textarea rows={3} value={nextWeek} disabled={readOnly} onChange={(e) => setNextWeek(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Risks or blockers</label>
            <Textarea rows={2} value={risks} disabled={readOnly} onChange={(e) => setRisks(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Action needed from reviewer</label>
            <Textarea rows={2} value={action} disabled={readOnly} onChange={(e) => setAction(e.target.value)} />
          </div>
          {readOnly && config._submission && (
            <div className="p-3 rounded bg-muted text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Submitted {new Date(config._submission.submitted_at).toLocaleString("en-IN")}
                <Badge style={{ backgroundColor: config._submission.status === "on_time" ? "#006039" : config._submission.status === "late" ? "#D4860A" : "#F40009", color: "white" }}>
                  {config._submission.status}
                </Badge>
              </div>
              {config._submission.reviewed_at && (
                <div className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3" /> Reviewed {new Date(config._submission.reviewed_at).toLocaleString("en-IN")}</div>
              )}
              {config._submission.reviewer_comment && <div>Comment: {config._submission.reviewer_comment}</div>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!readOnly && (
            <Button onClick={submit} disabled={saving} style={{ backgroundColor: "#006039" }}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit Report
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
