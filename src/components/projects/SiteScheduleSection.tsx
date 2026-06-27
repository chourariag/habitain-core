import { useEffect, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, CheckCircle2, XCircle, Loader2, CalendarRange } from "lucide-react";

interface Props {
  projectId: string;
  projectName?: string;
  userRole: string | null;
}

const TEMPLATE_MILESTONES = [
  "Site Readiness Confirmed",
  "First Module Landing",
  "Structural Connections Complete",
  "MEP Site Connections Complete",
  "Interior Fitout Start",
  "Interior Fitout Complete",
  "Snagging Start",
  "Snagging Complete",
  "Final QC Inspection",
  "Handover",
];

const UPLOAD_ROLES = new Set(["planning_engineer", "planning_head", "head_operations", "super_admin", "managing_director"]);
const APPROVER_ROLES = new Set(["planning_head", "head_of_projects"]);
const ADMIN_ROLES = new Set(["super_admin", "managing_director"]);

type Milestone = { milestone_name: string; planned_date: string | null; notes?: string };

type Approval = { id: string; role: string; status: string; comments: string | null; approved_at: string | null };

type SiteSchedule = {
  id: string;
  project_id: string;
  site_start_date: string | null;
  installation_milestones: Milestone[];
  handover_date: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  rejection_reason: string | null;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending_approval: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
  };
  return <Badge className={map[s] ?? "bg-muted"}>{s.replace("_", " ")}</Badge>;
};

export function SiteScheduleSection({ projectId, projectName, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<SiteSchedule | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [dispatchDate, setDispatchDate] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const canUpload = !!userRole && UPLOAD_ROLES.has(userRole);
  const canApprove = !!userRole && (APPROVER_ROLES.has(userRole) || ADMIN_ROLES.has(userRole));

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ss }, { data: ap }, { data: stage15 }] = await Promise.all([
      supabase.from("site_schedules" as any).select("*").eq("project_id", projectId).maybeSingle(),
      supabase.from("project_setup_approvals" as any).select("id,role,status,comments,approved_at").eq("project_id", projectId).eq("type", "site_schedule"),
      supabase.from("project_stages" as any).select("planned_end").eq("project_id", projectId).eq("stage_number", 15).order("planned_end", { ascending: true }).limit(1).maybeSingle(),
    ]);
    setSchedule(ss as any);
    setApprovals((ap as any) || []);
    setDispatchDate((stage15 as any)?.planned_end ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const downloadTemplate = () => {
    const rows = [["Milestone Name", "Planned Date (DD/MM/YYYY)", "Notes"], ...TEMPLATE_MILESTONES.map(m => [m, "", ""])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Site Schedule");
    XLSX.writeFile(wb, `Site_Schedule_Template_${projectName ?? "project"}.xlsx`);
  };

  const parseDate = (raw: any): string | null => {
    if (!raw) return null;
    if (raw instanceof Date) return format(raw, "yyyy-MM-dd");
    if (typeof raw === "number") {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
    const s = String(raw).trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : format(d, "yyyy-MM-dd");
  };

  const onUpload = async (file: File) => {
    if (!canUpload) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "", header: 1 });
      const milestones: Milestone[] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const name = String(r[0] ?? "").trim();
        if (!name) continue;
        milestones.push({ milestone_name: name, planned_date: parseDate(r[1]), notes: String(r[2] ?? "").trim() || undefined });
      }
      if (milestones.length === 0) throw new Error("No milestones found");
      const handover = milestones.find(m => /handover/i.test(m.milestone_name))?.planned_date ?? null;
      const start = milestones.find(m => /site readiness|first module/i.test(m.milestone_name))?.planned_date ?? milestones[0]?.planned_date ?? null;
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        project_id: projectId,
        site_start_date: start,
        installation_milestones: milestones,
        handover_date: handover,
        uploaded_by: u.user?.id,
        uploaded_at: new Date().toISOString(),
        status: "pending_approval",
        rejection_reason: null,
      };
      if (schedule) {
        const { error } = await supabase.from("site_schedules" as any).update(payload).eq("id", schedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_schedules" as any).insert(payload);
        if (error) throw error;
      }
      // reset approvals
      await supabase.from("project_setup_approvals" as any).delete().eq("project_id", projectId).eq("type", "site_schedule");
      // notify approvers
      const { data: appr } = await supabase.from("profiles").select("auth_user_id").in("role", ["planning_head", "head_of_projects"] as any).eq("is_active", true);
      const msg = `Site Schedule submitted for ${projectName ?? "project"}. Approval required.`;
      if (appr?.length) {
        await supabase.from("notifications").insert(appr.map((p: any) => ({
          recipient_id: p.auth_user_id, type: "info", category: "site_schedule",
          title: "Site Schedule pending approval", body: msg, content: msg,
          navigate_to: `/projects/${projectId}?tab=schedule`, priority: "high",
        })));
      }
      toast.success("Site Schedule uploaded — pending approval");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onDecision = async (decision: "approved" | "rejected") => {
    if (!canApprove || !schedule) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("id,role").eq("auth_user_id", u.user!.id).maybeSingle();
      if (!prof) throw new Error("Profile not found");
      const myRole = (prof as any).role;
      const role = APPROVER_ROLES.has(myRole) ? myRole : "planning_head";
      const existing = approvals.find(a => a.role === role);
      const row = {
        project_id: projectId, approver_id: (prof as any).id, role, type: "site_schedule",
        status: decision, comments: comment || null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
      };
      if (existing) {
        const { error } = await supabase.from("project_setup_approvals" as any).update(row).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_setup_approvals" as any).insert(row);
        if (error) throw error;
      }
      toast.success(`Marked ${decision}`);
      setComment("");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const daysToDispatch = dispatchDate ? Math.ceil((parseISO(dispatchDate).getTime() - Date.now()) / 86400000) : null;
  const showReminder = daysToDispatch !== null && daysToDispatch <= 14 && daysToDispatch >= 0 && (!schedule || schedule.status === "draft");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" /> Site Schedule</CardTitle>
        <div className="flex items-center gap-2">
          {schedule && statusBadge(schedule.status)}
          <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Template</Button>
          {canUpload && (
            <label>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files[0])} />
              <Button size="sm" asChild disabled={busy}>
                <span><Upload className="h-4 w-4 mr-1" />{busy ? "Uploading..." : schedule ? "Re-upload" : "Upload"}</span>
              </Button>
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            {showReminder && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Dispatch is in <b>{daysToDispatch}</b> day{daysToDispatch === 1 ? "" : "s"} ({format(parseISO(dispatchDate!), "dd/MM/yyyy")}). Upload Site Schedule now.
              </div>
            )}
            {!schedule ? (
              <p className="text-sm text-muted-foreground">No Site Schedule uploaded yet. Download the template, fill the dates, and upload.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div><Label>Site Start</Label><div>{schedule.site_start_date ? format(parseISO(schedule.site_start_date), "dd/MM/yyyy") : "—"}</div></div>
                  <div><Label>Handover</Label><div>{schedule.handover_date ? format(parseISO(schedule.handover_date), "dd/MM/yyyy") : "—"}</div></div>
                  <div><Label>Uploaded</Label><div>{format(parseISO(schedule.uploaded_at), "dd/MM/yyyy HH:mm")}</div></div>
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Planned Date</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.installation_milestones.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{m.milestone_name}</TableCell>
                          <TableCell>{m.planned_date ? format(parseISO(m.planned_date), "dd/MM/yyyy") : "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{m.notes ?? ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Approvals */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium text-sm">Dual Approval — Planning Head & Head of Projects</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {(["planning_head", "head_of_projects"] as const).map(r => {
                      const a = approvals.find(x => x.role === r);
                      return (
                        <div key={r} className="flex items-center justify-between rounded border p-2">
                          <div className="capitalize">{r.replace("_", " ")}</div>
                          <div>{a ? statusBadge(a.status) : <Badge variant="outline">awaiting</Badge>}</div>
                        </div>
                      );
                    })}
                  </div>
                  {schedule.rejection_reason && (
                    <div className="text-sm text-red-700">Rejection reason: {schedule.rejection_reason}</div>
                  )}
                  {canApprove && schedule.status !== "approved" && (
                    <div className="space-y-2 pt-2">
                      <Textarea placeholder="Optional comments / rejection reason" value={comment} onChange={(e) => setComment(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => onDecision("approved")} disabled={busy}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onDecision("rejected")} disabled={busy}>
                          <XCircle className="h-4 w-4 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
