import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";

interface Props {
  projectId: string;
  projectName?: string;
  userRole: string | null;
  setupUploadedAt?: string | null;
  onApproved?: () => void;
}

type Approval = {
  id: string;
  role: "planning_head" | "head_of_projects" | string;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  approved_at: string | null;
  approver_id: string;
};

const APPROVER_ROLES = new Set(["planning_head", "head_of_projects"]);
const ADMIN_ROLES = new Set(["super_admin", "managing_director"]);

const REQUIRED_ROLES: Array<{ key: "planning_head" | "head_of_projects"; label: string }> = [
  { key: "planning_head", label: "Planning Head" },
  { key: "head_of_projects", label: "Head of Projects" },
];

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    awaiting: "bg-muted text-muted-foreground",
  };
  return <Badge className={map[s] ?? "bg-muted"}>{s.replace("_", " ")}</Badge>;
}

export function ProjectSetupApprovalSection({ projectId, projectName, userRole, setupUploadedAt, onApproved }: Props) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [projectApproved, setProjectApproved] = useState<boolean>(false);
  const [projectStatus, setProjectStatus] = useState<string>("not_submitted");
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  const canApprove = !!userRole && (APPROVER_ROLES.has(userRole) || ADMIN_ROLES.has(userRole));

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ap }, { data: proj }] = await Promise.all([
      supabase
        .from("project_setup_approvals" as any)
        .select("id,role,status,comments,approved_at,approver_id")
        .eq("project_id", projectId)
        .eq("type", "project_setup"),
      supabase
        .from("projects")
        .select("project_setup_approved,project_setup_approved_at,project_setup_status")
        .eq("id", projectId)
        .maybeSingle(),
    ]);
    setApprovals((ap as any as Approval[]) ?? []);
    setProjectApproved(!!(proj as any)?.project_setup_approved);
    setProjectStatus(((proj as any)?.project_setup_status as string) ?? "not_submitted");
    setApprovedAt(((proj as any)?.project_setup_approved_at as string) ?? null);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const onDecision = async (decision: "approved" | "rejected") => {
    if (!canApprove) return;
    if (decision === "rejected" && !comment.trim()) {
      toast.error("Please provide a reason when rejecting");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: prof } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("auth_user_id", u.user.id)
        .maybeSingle();
      if (!prof) throw new Error("Profile not found");

      const myRole = (prof as any).role as string;
      // Admins act as Planning Head by default; if they've already recorded a
      // PH decision, treat them as Head of Projects so they can advance both.
      let actingRole: "planning_head" | "head_of_projects";
      if (APPROVER_ROLES.has(myRole)) {
        actingRole = myRole as "planning_head" | "head_of_projects";
      } else {
        const phTaken = approvals.some((a) => a.role === "planning_head");
        actingRole = phTaken ? "head_of_projects" : "planning_head";
      }

      const existing = approvals.find((a) => a.role === actingRole);
      const row = {
        project_id: projectId,
        approver_id: (prof as any).id,
        role: actingRole,
        type: "project_setup",
        status: decision,
        comments: comment.trim() || null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
      };
      if (existing) {
        const { error } = await supabase
          .from("project_setup_approvals" as any)
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_setup_approvals" as any).insert(row);
        if (error) throw error;
      }

      // Fan-out notifications
      const roleLabel = REQUIRED_ROLES.find((r) => r.key === actingRole)?.label ?? actingRole;
      if (decision === "rejected") {
        // Notify planning engineers so they can revise the setup
        const { data: recips } = await supabase
          .from("profiles")
          .select("auth_user_id")
          .in("role", ["planning_engineer", "planning_head", "head_of_projects", "head_operations"] as any)
          .eq("is_active", true);
        const msg = `${roleLabel} rejected Project Setup for ${projectName ?? "project"}. Reason: ${comment.trim() || "(no reason)"}`;
        if (recips?.length) {
          await supabase.from("notifications").insert(
            recips.map((p: any) => ({
              recipient_id: p.auth_user_id,
              type: "warning",
              category: "project_setup",
              title: "Project Setup rejected",
              body: msg,
              content: msg,
              navigate_to: `/projects/${projectId}`,
              priority: "high",
            })) as any,
          );
        }
      } else {
        // On approval, tell the other approver if they haven't acted yet
        const otherRole = actingRole === "planning_head" ? "head_of_projects" : "planning_head";
        const otherApproval = approvals.find((a) => a.role === otherRole);
        if (!otherApproval || otherApproval.status !== "approved") {
          const { data: recips } = await supabase
            .from("profiles")
            .select("auth_user_id")
            .in("role", [otherRole] as any)
            .eq("is_active", true);
          const msg = `${roleLabel} approved Project Setup for ${projectName ?? "project"}. Your approval is required.`;
          if (recips?.length) {
            await supabase.from("notifications").insert(
              recips.map((p: any) => ({
                recipient_id: p.auth_user_id,
                type: "info",
                category: "project_setup",
                title: "Project Setup awaiting your approval",
                body: msg,
                content: msg,
                navigate_to: `/projects/${projectId}`,
                priority: "high",
              })) as any,
            );
          }
        }
      }

      toast.success(`Recorded ${decision} as ${roleLabel}`);
      setComment("");
      await load();
      onApproved?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const overallLabel = projectApproved
    ? "approved"
    : projectStatus === "rejected"
    ? "rejected"
    : approvals.length > 0
    ? "pending"
    : "awaiting";

  const rejectedApproval = approvals.find((a) => a.status === "rejected");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Project Setup Approval
        </CardTitle>
        <div className="flex items-center gap-2">
          {statusBadge(overallLabel)}
          {projectApproved && approvedAt && (
            <span className="text-xs text-muted-foreground">
              on {format(parseISO(approvedAt), "dd/MM/yyyy HH:mm")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {!setupUploadedAt && (
              <p className="text-sm text-muted-foreground">
                Planning Head and Head of Projects must each approve the Project Setup Template independently before the project is unlocked for production.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {REQUIRED_ROLES.map((r) => {
                const a = approvals.find((x) => x.role === r.key);
                return (
                  <div key={r.key} className="rounded border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{r.label}</div>
                      {a ? statusBadge(a.status) : statusBadge("awaiting")}
                    </div>
                    {a?.approved_at && (
                      <div className="text-xs text-muted-foreground">
                        {format(parseISO(a.approved_at), "dd/MM/yyyy HH:mm")}
                      </div>
                    )}
                    {a?.comments && (
                      <div className="text-xs text-muted-foreground italic">
                        “{a.comments}”
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {rejectedApproval && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                Project Setup was rejected. Planning Engineer must re-upload the template and both approvers must approve again.
              </div>
            )}

            {projectApproved && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                Both approvers have signed off. Production is unlocked for this project.
              </div>
            )}

            {canApprove && !projectApproved && (
              <div className="space-y-2 pt-1">
                <Textarea
                  placeholder="Optional comments (required when rejecting)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onDecision("approved")} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onDecision("rejected")} disabled={busy}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Planning Head and Head of Projects approvals are recorded independently. The project auto-unlocks when both approve.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
