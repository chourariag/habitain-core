import { supabase } from "@/integrations/supabase/client";
import { setApprovalDecision, type ApprovalRequest } from "@/lib/approval-requests";
import { createUserWithPassword, reassignAndDeactivate } from "@/lib/admin-api";
import { logAudit } from "@/lib/super-admin";
import type { AppRole } from "@/lib/roles";

const TEMP_PASSWORD = "HStack@2026";

export async function approveRequest(req: ApprovalRequest, currentUserId?: string): Promise<{ tempPassword?: string }> {
  if (req.request_type === "add_user") {
    const p = req.payload as Record<string, string>;
    await createUserWithPassword({
      email: p.email,
      role: p.role as AppRole,
      password: TEMP_PASSWORD,
      display_name: p.full_name,
      phone: p.phone,
      reporting_manager_id: p.reporting_to,
    });
    await setApprovalDecision(req.id, "approved", undefined, `Created with temp password ${TEMP_PASSWORD}`);
    await logAudit({ section: "User Management", action: "approve_add_user", entity: p.email, summary: `Added ${p.full_name}` });
    return { tempPassword: TEMP_PASSWORD };
  }
  if (req.request_type === "deactivate_user") {
    const p = req.payload as Record<string, string>;
    await reassignAndDeactivate(p.user_id, p.reassign_to);
    await setApprovalDecision(req.id, "approved");
    await logAudit({ section: "User Management", action: "approve_deactivate_user", entity: p.user_email, summary: `Deactivated ${p.user_name}` });
    return {};
  }
  if (req.request_type === "create_project") {
    const p = req.payload as Record<string, unknown>;
    const { module_count: _mc, panel_count: _pc, ...projectFields } = p as any;
    const { data: created, error } = await supabase.from("projects").insert({
      ...projectFields, status: "Active", created_by: req.requested_by, updated_by: req.requested_by,
    } as never).select("id,name").single();
    if (error) throw error;
    await setApprovalDecision(req.id, "approved");
    await logAudit({ section: "Projects", action: "approve_create_project", entity: String(p.name) });
    try {
      const { insertNotifications } = await import("@/lib/notifications");
      await insertNotifications({
        recipient_id: req.requested_by,
        title: `Project approved — ${p.name}`,
        body: `Your project request has been approved.`,
        category: "info",
        related_table: "projects", related_id: (created as any)?.id,
        navigate_to: `/projects/${(created as any)?.id}`,
      });
    } catch { /* ignore */ }
    return {};
  }
  if (req.request_type === "archive_project") {
    const p = req.payload as Record<string, string>;
    const { error } = await supabase.from("projects").update({
      status: "Archived", is_archived: true,
      archived_at: new Date().toISOString(), archive_reason: p.reason,
    } as never).eq("id", p.project_id);
    if (error) throw error;
    await setApprovalDecision(req.id, "approved");
    await logAudit({ section: "Projects", action: "approve_archive_project", entity: p.project_name, summary: p.reason });
    return {};
  }
  void currentUserId;
  throw new Error(`Unsupported request type: ${req.request_type}`);
}

export async function rejectRequest(req: ApprovalRequest, reason: string): Promise<void> {
  await setApprovalDecision(req.id, "rejected", reason);
  await logAudit({ section: "Approvals", action: `reject_${req.request_type}`, entity: req.id, summary: reason });
  try {
    const { insertNotifications } = await import("@/lib/notifications");
    const p = req.payload as Record<string, unknown>;
    const subject = req.request_type === "create_project" ? `Project request rejected — ${p.name}`
      : req.request_type === "archive_project" ? `Archive request rejected — ${p.project_name}`
      : "Request rejected";
    await insertNotifications({
      recipient_id: req.requested_by,
      title: subject,
      body: `Reason: ${reason}. You can edit and resubmit.`,
      category: "info",
      related_table: "approval_requests", related_id: req.id,
      navigate_to: "/approvals",
    });
  } catch { /* ignore */ }
}

export const APPROVAL_TYPE_META: Record<string, { label: string; pill: { bg: string; fg: string }; group: "project"|"user"|"financial" }> = {
  archive_project:  { label: "Project Archive",   pill: { bg: "#FEF3C7", fg: "#92400E" }, group: "project" },
  create_project:   { label: "Project Creation",  pill: { bg: "#DBEAFE", fg: "#1E40AF" }, group: "project" },
  add_user:         { label: "Add User",          pill: { bg: "#DCFCE7", fg: "#166534" }, group: "user" },
  deactivate_user:  { label: "Deactivate User",   pill: { bg: "#FEE2E2", fg: "#991B1B" }, group: "user" },
};

export function summarizeRequest(req: ApprovalRequest): string {
  const p = req.payload as Record<string, string>;
  switch (req.request_type) {
    case "add_user": return `${p.full_name} as ${p.role}`;
    case "deactivate_user": return `${p.user_name || p.user_email} — ${p.reason}`;
    case "create_project": return `${p.name}${p.client_name ? ` — ${p.client_name}` : ""}`;
    case "archive_project": return `${p.project_name} — ${p.reason}`;
    default: return req.id;
  }
}
